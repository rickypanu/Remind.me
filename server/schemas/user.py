"""User profile schemas (finding S8, S11)."""

import re
from datetime import datetime
from typing import Annotated
from urllib.parse import unquote
from xml.etree import ElementTree

from pydantic import AfterValidator, BaseModel, ConfigDict, field_validator

from schemas.auth import Username

# The only avatar URLs the server ever hands out: the hex ObjectId of a user, with an optional cache-buster.
AVATAR_URL_RE = re.compile(r"^/uploads/avatars/(?P<user_id>[0-9a-f]{24})(?:\?v=\d{1,12})?$")

# The profile picker offers two kinds of built-in illustration, and both are stored as avatar_url:
#   1. DiceBear images: https://api.dicebear.com/7.x/<style>/svg?seed=<seed>&backgroundColor=<hex>
#   2. "Dev Icons": small inline SVGs sent as data:image/svg+xml;utf8,<url-encoded svg>
# Both are accepted ONLY in these exact shapes. Anything else (javascript:, http:, other hosts, HTML, SVG with
# scripts / handlers / external references) is rejected, so a stored avatar_url can never carry active content.
DICEBEAR_URL_RE = re.compile(
    r"^https://api\.dicebear\.com/7\.x/[a-z][a-z-]{0,30}/svg\?seed=[A-Za-z0-9_-]{1,40}&backgroundColor=[0-9a-f]{6}$"
)
SVG_DATA_URI_PREFIX = "data:image/svg+xml;utf8,"
MAX_SVG_CHARS = 4000
MAX_SVG_DATA_URI_CHARS = 12000
_SVG_NS = "{http://www.w3.org/2000/svg}"
_SVG_TAGS = frozenset({"svg", "g", "rect", "circle", "ellipse", "path", "line", "polygon", "polyline"})
_SVG_ATTRS = frozenset(
    {
        "viewBox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
        "x", "y", "x1", "y1", "x2", "y2", "rx", "ry", "cx", "cy", "r", "d", "points", "opacity",
        "fill-opacity", "stroke-opacity", "transform",
    }
)
_SVG_VALUE_RE = re.compile(r"^[A-Za-z0-9#.,\- %()+]*$")


def _is_safe_svg_data_uri(value: str) -> bool:
    if not value.startswith(SVG_DATA_URI_PREFIX) or len(value) > MAX_SVG_DATA_URI_CHARS:
        return False
    svg = unquote(value[len(SVG_DATA_URI_PREFIX):])
    if len(svg) > MAX_SVG_CHARS or "<!" in svg or "<?" in svg or "&" in svg:
        return False  # no DOCTYPE / entities / processing instructions / CDATA
    try:
        # Safe: DOCTYPE, entities, processing instructions and CDATA were rejected above, so the parser has nothing
        # to expand (no billion-laughs / external-entity input can reach it) and the document is size-capped.
        root = ElementTree.fromstring(svg)  # noqa: S314
    except ElementTree.ParseError:
        return False
    if root.tag != f"{_SVG_NS}svg":
        return False
    for element in root.iter():
        if not isinstance(element.tag, str) or not element.tag.startswith(_SVG_NS):
            return False
        if element.tag[len(_SVG_NS):] not in _SVG_TAGS:
            return False  # rejects <script>, <style>, <foreignObject>, <image>, <use>, <a>, <animate>, ...
        if (element.text or "").strip() or (element.tail or "").strip():
            return False
        for name, attr_value in element.attrib.items():
            if name not in _SVG_ATTRS or not _SVG_VALUE_RE.match(attr_value):
                return False  # rejects on* handlers, href, style, and anything outside the plain-character set
            if "url(" in attr_value.lower() or "javascript" in attr_value.lower():
                return False
    return True


def check_avatar_url(value: str | None) -> str | None:
    if value is None:
        return None
    if AVATAR_URL_RE.match(value) or DICEBEAR_URL_RE.match(value) or _is_safe_svg_data_uri(value):
        return value
    raise ValueError("avatar_url must be a picture uploaded to RemindMe or one of the built-in illustrations.")


AvatarUrl = Annotated[str | None, AfterValidator(check_avatar_url)]


class UserUpdate(BaseModel):
    """PATCH /user/me. Only these two fields can ever be changed here (no is_admin, email, password, ...)."""

    model_config = ConfigDict(extra="forbid")

    username: Username | None = None
    avatar_url: AvatarUrl = None

    @field_validator("username", mode="before")
    @classmethod
    def _blank_username_is_an_error(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            raise ValueError("Username must not be empty.")
        return value


class UserResponse(BaseModel):
    """GET /v1/user/me"""

    id: str
    username: str
    email: str | None = None
    created_at: datetime | None = None
    avatar_url: str | None = None
    is_admin: bool = False


class ProfileUpdateResponse(BaseModel):
    message: str
    updated_fields: dict[str, str | None]


class AvatarResponse(BaseModel):
    avatar_url: str
    message: str
