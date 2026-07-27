from typing import Any, Dict, Optional

from PIL import Image, ImageChops, ImageDraw

from .universal import (
    _add_grain,
    _add_vignette,
    _hex_to_rgb,
    _render_text_overlay,
    _resize_cover,
    _solid_color_logo,
    apply_overlay_config,
)


def render_audiobook_cover(
    background: Image.Image,
    logo: Optional[Image.Image],
    options: Dict[str, Any] | None,
) -> Image.Image:
    """Render a square audiobook/album cover using Simposter's existing controls."""
    if background is None:
        raise ValueError("Background image is required")

    options = options or {}
    canvas_size = int(options.get("canvas_size", 2000))
    canvas_size = max(500, min(canvas_size, 4000))

    poster_zoom = max(float(options.get("poster_zoom", 1.0)), 0.1)
    poster_shift_y = max(-0.5, min(float(options.get("poster_shift_y", 0.0)), 0.5))
    matte_height_ratio = max(0.0, min(float(options.get("matte_height_ratio", 0.0)), 0.5))
    fade_height_ratio = max(0.0, min(float(options.get("fade_height_ratio", 0.0)), 1.0))
    vignette_strength = max(0.0, min(float(options.get("vignette_strength", 0.0)), 1.0))
    grain_amount = max(0.0, min(float(options.get("grain_amount", 0.0)), 0.6))

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 255))
    cover = _resize_cover(background, canvas_size, canvas_size, zoom=poster_zoom)
    shift_px = int(poster_shift_y * canvas_size)
    canvas.paste(cover, (0, shift_px))

    matte_h = int(canvas_size * matte_height_ratio)
    fade_h = int(canvas_size * fade_height_ratio)
    if matte_h > 0 or fade_h > 0:
        matte_start = canvas_size - matte_h
        fade_start = max(0, matte_start - fade_h)
        mask = Image.new("L", (1, canvas_size), 0)
        pixels = mask.load()
        for y in range(canvas_size):
            if y >= matte_start:
                alpha = 255
            elif y >= fade_start and matte_start > fade_start:
                alpha = int(255 * ((y - fade_start) / (matte_start - fade_start)))
            else:
                alpha = 0
            pixels[0, y] = alpha
        mask = mask.resize((canvas_size, canvas_size))
        black = Image.new("RGBA", canvas.size, (0, 0, 0, 255))
        canvas = Image.composite(black, canvas, mask)

    canvas_rgb = canvas.convert("RGB")
    if vignette_strength > 0:
        canvas_rgb = _add_vignette(canvas_rgb, vignette_strength)
    canvas_rgb = _add_grain(canvas_rgb, grain_amount)
    canvas = canvas_rgb.convert("RGBA")

    logo_mode = str(options.get("logo_mode", "stock") or "stock")
    if logo is not None and logo_mode != "none":
        logo = logo.convert("RGBA")
        if logo_mode == "match":
            color = background.resize((1, 1), Image.LANCZOS).getpixel((0, 0))[:3]
            logo = _solid_color_logo(logo, color)
        elif logo_mode == "hex":
            logo = _solid_color_logo(logo, _hex_to_rgb(str(options.get("logo_hex", "#FFFFFF"))))

        max_w = int(options.get("uniform_logo_max_w", int(canvas_size * 0.72)))
        max_h = int(options.get("uniform_logo_max_h", int(canvas_size * 0.28)))
        scale = min(max_w / max(logo.width, 1), max_h / max(logo.height, 1))
        logo = logo.resize((max(1, int(logo.width * scale)), max(1, int(logo.height * scale))), Image.LANCZOS)
        cx = int(canvas_size * float(options.get("uniform_logo_offset_x", 0.5)))
        cy = int(canvas_size * float(options.get("uniform_logo_offset_y", 0.78)))
        canvas.alpha_composite(logo, (cx - logo.width // 2, cy - logo.height // 2))

    if bool(options.get("text_overlay_enabled", False)):
        custom_text = str(options.get("custom_text", ""))
        if custom_text:
            canvas = _render_text_overlay(canvas, custom_text, options)

    border_enabled = bool(options.get("border_enabled", False))
    border_px = int(options.get("border_px", 0))
    if border_enabled and border_px > 0:
        border_color = _hex_to_rgb(str(options.get("border_color", "#FFFFFF")))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, 0, canvas_size - 1, canvas_size - 1), outline=(*border_color, 255), width=border_px)

    preset_id = options.get("preset_id")
    overlay_config_ids = options.get("overlay_config_ids")
    if preset_id or overlay_config_ids:
        canvas = apply_overlay_config(
            canvas,
            preset_id,
            "audiobookcover",
            options.get("metadata", {}),
            overlay_config_ids,
        )

    return canvas.convert("RGB")
