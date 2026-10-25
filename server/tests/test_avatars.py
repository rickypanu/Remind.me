"""Avatar hardening (S10, S11): magic bytes, re-encoding, metadata stripping, bombs."""

import io
import unittest

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from PIL import Image  # noqa: E402

from app.services.avatars import (  # noqa: E402
    AVATAR_SIZE,
    MAX_AVATAR_BYTES,
    AvatarError,
    process_avatar,
    process_avatar_bytes,
    read_limited,
    sniff_format,
)


def encode(image: Image.Image, fmt: str, **kwargs) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


def output_image(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


class SniffTests(unittest.TestCase):
    def test_recognises_the_four_accepted_formats_only(self):
        self.assertEqual(sniff_format(b"\xff\xd8\xff\xe0" + b"0" * 12), "JPEG")
        self.assertEqual(sniff_format(b"\x89PNG\r\n\x1a\n" + b"0" * 8), "PNG")
        self.assertEqual(sniff_format(b"GIF89a" + b"0" * 10), "GIF")
        self.assertEqual(sniff_format(b"RIFF\x00\x00\x00\x00WEBPVP8 "), "WEBP")
        for other in (b"<svg xmlns=", b"<html><scrip", b"%PDF-1.7\n", b"BM" + b"0" * 14, b"RIFF\x00\x00\x00\x00WAVEfmt ", b""):
            self.assertIsNone(sniff_format(other), other)


class ProcessTests(unittest.TestCase):
    def test_png_is_reencoded_to_a_256_square_webp(self):
        result = process_avatar_bytes(encode(Image.new("RGB", (640, 300), (200, 30, 30)), "PNG"))
        self.assertEqual(result.content_type, "image/webp")
        self.assertEqual(result.data[:4], b"RIFF")
        self.assertEqual(result.data[8:12], b"WEBP")
        image = output_image(result.data)
        self.assertEqual(image.format, "WEBP")
        self.assertEqual(image.size, (AVATAR_SIZE, AVATAR_SIZE))

    def test_exif_gps_and_icc_do_not_survive(self):
        source = Image.new("RGB", (400, 400), (10, 120, 200))
        exif = Image.Exif()
        exif[0x010F] = "SecretCameraMaker"  # Make
        exif[0x8825] = {1: "N", 2: (28.0, 36.0, 0.0)}  # GPS IFD
        data = encode(source, "JPEG", exif=exif.tobytes(), icc_profile=b"fake-icc-profile")
        self.assertIn(b"SecretCameraMaker", data)  # the fixture really carries metadata

        out = process_avatar_bytes(data).data
        self.assertNotIn(b"SecretCameraMaker", out)
        self.assertNotIn(b"Exif", out)
        self.assertNotIn(b"fake-icc-profile", out)
        image = output_image(out)
        self.assertEqual(len(image.getexif()), 0)
        self.assertNotIn("icc_profile", image.info)

    def test_exif_orientation_is_applied_before_metadata_is_dropped(self):
        source = Image.new("RGB", (400, 200), (255, 255, 255))
        for x in range(200):
            for y in range(200):
                source.putpixel((x, y), (255, 0, 0))  # left half red, right half white
        exif = Image.Exif()
        exif[0x0112] = 6  # "rotate 90 degrees clockwise to display"
        out = output_image(process_avatar_bytes(encode(source, "JPEG", exif=exif.tobytes(), quality=95)).data).convert("RGB")
        top, bottom = out.getpixel((128, 20)), out.getpixel((128, 236))
        self.assertGreater(top[0], 200)  # red moved to the top after rotating
        self.assertGreater(top[0] - top[1], 100)
        self.assertGreater(bottom[1], 200)  # white at the bottom

    def test_transparency_is_kept(self):
        image = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        out = output_image(process_avatar_bytes(encode(image, "PNG")).data)
        self.assertIn(out.mode, ("RGBA", "LA"))
        self.assertEqual(out.convert("RGBA").getpixel((10, 10))[3], 0)

    def test_animated_gif_uses_the_first_frame_only(self):
        frames = [Image.new("RGB", (50, 50), c) for c in ((255, 0, 0), (0, 0, 255))]
        data = encode(frames[0], "GIF", save_all=True, append_images=frames[1:], duration=100, loop=0)
        out = output_image(process_avatar_bytes(data).data)
        self.assertEqual(getattr(out, "n_frames", 1), 1)

    def test_jpeg_and_webp_inputs_work(self):
        for fmt in ("JPEG", "WEBP"):
            with self.subTest(fmt=fmt):
                process_avatar_bytes(encode(Image.new("RGB", (64, 64), (1, 2, 3)), fmt))


class RejectionTests(unittest.TestCase):
    def assertRejected(self, data: bytes, status: int):
        with self.assertRaises(AvatarError) as ctx:
            process_avatar_bytes(data)
        self.assertEqual(ctx.exception.status_code, status, ctx.exception.message)

    def test_svg_html_text_and_empty_files(self):
        self.assertRejected(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 415)
        self.assertRejected(b"<html><script>alert(1)</script></html>", 415)
        self.assertRejected(b"just some text", 415)
        self.assertRejected(b"", 400)

    def test_a_script_hidden_behind_an_image_header_is_not_an_image(self):
        self.assertRejected(b"GIF89a/*" + b"\x00" * 20 + b"*/=1;alert(1);", 415)
        self.assertRejected(b"\xff\xd8\xff" + b"<script>alert(1)</script>" * 4, 415)

    def test_format_mismatch_is_refused(self):
        png = encode(Image.new("RGB", (10, 10)), "PNG")
        self.assertRejected(b"\xff\xd8\xff\xe0" + png[4:], 415)  # JPEG magic on a PNG body

    def test_truncated_image(self):
        data = encode(Image.effect_noise((300, 300), 90).convert("RGB"), "PNG")
        self.assertRejected(data[: len(data) // 2], 415)

    def test_pixel_bomb_is_refused_before_decoding(self):
        bomb = encode(Image.new("1", (6000, 6000)), "PNG")  # 36 million pixels, a few KB of data
        self.assertLess(len(bomb), MAX_AVATAR_BYTES)
        self.assertRejected(bomb, 413)

    def test_oversized_file(self):
        self.assertRejected(b"\x89PNG\r\n\x1a\n" + b"0" * (MAX_AVATAR_BYTES + 1), 413)


class _Upload:
    def __init__(self, data: bytes):
        self._buf = io.BytesIO(data)
        self.reads = 0

    async def read(self, n: int = -1) -> bytes:
        self.reads += 1
        return self._buf.read(n)


class StreamingTests(unittest.IsolatedAsyncioTestCase):
    async def test_read_limited_stops_early(self):
        upload = _Upload(b"x" * (MAX_AVATAR_BYTES * 3))
        with self.assertRaises(AvatarError) as ctx:
            await read_limited(upload)
        self.assertEqual(ctx.exception.status_code, 413)
        self.assertLess(upload.reads, MAX_AVATAR_BYTES // (64 * 1024) + 5)  # did not read the whole 6 MB

    async def test_read_limited_returns_small_files(self):
        self.assertEqual(await read_limited(_Upload(b"abc")), b"abc")

    async def test_async_wrapper(self):
        result = await process_avatar(encode(Image.new("RGB", (20, 20)), "PNG"))
        self.assertEqual(result.content_type, "image/webp")


if __name__ == "__main__":
    unittest.main()
