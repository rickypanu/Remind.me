"""Avatar upload hardening (findings S10, S11).

Nothing the client says about the file is trusted (not the extension, not the Content-Type header, not even the
bytes' claim on their own). The pipeline is:

  1. size cap while reading (the caller streams, so an oversized upload is never held in memory)
  2. magic-byte sniffing: the file must start like a JPEG, PNG, GIF or WebP
  3. Pillow must open it with exactly that format, and the declared pixel count must be sane
     (stops decompression bombs before any pixel is decoded)
  4. full decode, EXIF orientation applied, then the image is COPIED into a fresh bitmap and re-encoded as a
     256x256 WebP. Metadata (EXIF / GPS / ICC / XMP / comments), animation frames, trailing bytes and polyglot
     payloads do not survive a re-encode, so what is stored is a pixel grid and nothing else.

Only that WebP is stored and served.
"""

import asyncio
import io
import logging
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

log = logging.getLogger("avatars")

MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB, same limit the profile page advertises
MAX_PIXELS = 25_000_000  # ~5000x5000; larger is refused before decoding
MAX_DIMENSION = 12_000
AVATAR_SIZE = 256
OUTPUT_FORMAT = "WEBP"
OUTPUT_CONTENT_TYPE = "image/webp"
WEBP_QUALITY = 85

# Pillow raises on anything above 2x this value; we check against MAX_PIXELS ourselves first.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS * 2


class AvatarError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ProcessedAvatar:
    data: bytes
    content_type: str = OUTPUT_CONTENT_TYPE


def sniff_format(head: bytes) -> str | None:
    """Image format named by the first bytes of a file, or None. Only the four accepted formats are recognised."""
    if head.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "GIF"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "WEBP"
    return None


def process_avatar_bytes(data: bytes) -> ProcessedAvatar:
    """Synchronous and CPU-bound; call it through :func:`process_avatar` from async code."""
    if not data:
        raise AvatarError("The uploaded file is empty.")
    if len(data) > MAX_AVATAR_BYTES:
        raise AvatarError("Image must be under 2 MB.", 413)

    sniffed = sniff_format(data[:16])
    if sniffed is None:
        raise AvatarError("Unsupported image. Please upload a JPEG, PNG, GIF or WebP picture.", 415)

    try:
        with Image.open(io.BytesIO(data), formats=[sniffed]) as image:
            if image.format != sniffed:
                raise AvatarError("The file content does not match its image type.", 415)
            width, height = image.size
            too_big = width > MAX_DIMENSION or height > MAX_DIMENSION or width * height > MAX_PIXELS
            if width < 1 or height < 1 or too_big:
                raise AvatarError("That image is too large. Please use one under 5000 x 5000 pixels.", 413)

            image.seek(0)  # animated GIF / WebP: first frame only
            image.load()  # full decode: corrupt or truncated files fail here, not later
            upright = ImageOps.exif_transpose(image)
            has_alpha = upright.mode in ("RGBA", "LA", "PA") or "transparency" in upright.info
            clean = upright.convert("RGBA" if has_alpha else "RGB")  # a brand-new bitmap, no metadata carried over
            square = ImageOps.fit(clean, (AVATAR_SIZE, AVATAR_SIZE), method=Image.Resampling.LANCZOS)

            output = io.BytesIO()
            square.save(output, format=OUTPUT_FORMAT, quality=WEBP_QUALITY, method=4, exif=b"", icc_profile=None)
    except AvatarError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise AvatarError("That file is not a valid image.", 415) from None
    except (OSError, ValueError, SyntaxError, EOFError, MemoryError):
        raise AvatarError("That image could not be read. It may be corrupted.", 415) from None

    return ProcessedAvatar(data=output.getvalue())


async def process_avatar(data: bytes) -> ProcessedAvatar:
    return await asyncio.to_thread(process_avatar_bytes, data)


async def read_limited(upload, limit: int = MAX_AVATAR_BYTES) -> bytes:
    """Read an UploadFile in chunks and stop as soon as it is bigger than ``limit``."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise AvatarError("Image must be under 2 MB.", 413)
        chunks.append(chunk)
    return b"".join(chunks)
