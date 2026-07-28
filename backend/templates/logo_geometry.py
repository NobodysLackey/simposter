from __future__ import annotations

from PIL import Image, ImageChops, ImageFilter


def trim_transparent_logo(
    logo: Image.Image,
    *,
    alpha_threshold: int = 8,
    padding_ratio: float = 0.025,
) -> Image.Image:
    """Crop transparent padding while retaining a small visual safety margin.

    Logo files frequently use very different transparent canvases. Sizing the raw
    bitmap makes identical visible artwork render at wildly different scales. This
    helper derives bounds from meaningful alpha, ignores nearly invisible pixels,
    and pads the visible artwork proportionally so placement remains natural.
    """
    image = logo.convert("RGBA")
    if image.width <= 1 or image.height <= 1:
        return image

    alpha = image.getchannel("A")
    threshold = max(0, min(int(alpha_threshold), 254))
    meaningful = alpha.point(lambda value: 255 if value > threshold else 0)
    bounds = meaningful.getbbox()
    if not bounds:
        return image

    left, top, right, bottom = bounds
    visible_width = max(1, right - left)
    visible_height = max(1, bottom - top)
    padding = max(2, int(round(max(visible_width, visible_height) * max(0.0, padding_ratio))))

    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))
