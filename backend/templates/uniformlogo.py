# backend/templates/uniformlogo.py

from PIL import Image
from ..config import settings, logger
from .logo_geometry import trim_transparent_logo
from .universal import build_base_poster, _hex_to_rgb, _solid_color_logo, _render_text_overlay


def render_uniform_logo(bg: Image.Image, logo: Image.Image, options: dict) -> Image.Image:
    """
    Template that fits any logo into a fixed bounding box.
    Allows override mode for manual scaling & Y offset.
    """

    canvas = build_base_poster(bg, options)
    W, H = canvas.size

    if logo is not None:
        logo = trim_transparent_logo(logo)

        logo_mode = str(options.get("logo_mode", "stock") or "stock")
        logo_hex = str(options.get("logo_hex", "#FFFFFF") or "#FFFFFF")

        if logo_mode == "match":
            poster_avg = bg.resize((1, 1), Image.Resampling.LANCZOS).getpixel((0, 0))
            color = poster_avg[:3]
            logo = _solid_color_logo(logo, color)
        elif logo_mode == "hex":
            color = _hex_to_rgb(logo_hex)
            logo = _solid_color_logo(logo, color)

        max_w = max(1, int(options.get("uniform_logo_max_w", int(W * 0.72))))
        max_h = max(1, int(options.get("uniform_logo_max_h", int(H * 0.28))))

        offset_x_pct = max(0.0, min(float(options.get("uniform_logo_offset_x", 0.5)), 1.0))
        offset_y_pct = max(0.0, min(float(options.get("uniform_logo_offset_y", 0.78)), 1.0))

        cx = int(W * offset_x_pct)
        cy = int(H * offset_y_pct)

        lw, lh = logo.size
        scale = min(max_w / max(lw, 1), max_h / max(lh, 1))

        # Modern editors use logo_scale. Preserve the older override controls for
        # saved presets that still contain them.
        if "logo_scale" in options:
            scale *= max(0.05, min(float(options.get("logo_scale", 1.0)), 3.0))
        elif options.get("uniform_logo_override_enabled", False):
            scale = float(options.get("uniform_logo_override_scale", scale))
            offset_y_pct = max(
                0.0,
                min(float(options.get("uniform_logo_override_offset_y", offset_y_pct)), 1.0),
            )
            cy = int(H * offset_y_pct)

        new_w = max(1, int(round(lw * scale)))
        new_h = max(1, int(round(lh * scale)))
        logo_res = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)

        h_align = str(options.get("uniform_logo_h_align", "center") or "center").lower()
        v_align = str(options.get("uniform_logo_v_align", "center") or "center").lower()

        box_left = cx - max_w // 2
        box_right = cx + max_w // 2
        box_top = cy - max_h // 2
        box_bottom = cy + max_h // 2

        if h_align == "left":
            x = box_left
        elif h_align == "right":
            x = box_right - new_w
        else:
            x = cx - new_w // 2

        if v_align == "top":
            y = box_top
        elif v_align == "bottom":
            y = box_bottom - new_h
        else:
            y = cy - new_h // 2

        canvas.paste(logo_res, (x, y), logo_res)

    text_overlay_enabled = bool(options.get("text_overlay_enabled", False))
    if text_overlay_enabled:
        custom_text = str(options.get("custom_text", ""))
        if custom_text:
            canvas = _render_text_overlay(canvas, custom_text, options)

    if options.get("border_enabled", False):
        px = options.get("border_px", 0)
        if px > 0:
            border_color = options.get("border_color", "#FFFFFF")
            from PIL import ImageOps
            canvas = ImageOps.expand(canvas, border=px, fill=border_color)

    from .universal import apply_overlay_config
    metadata = options.get("metadata", {})
    preset_id = options.get("preset_id")
    overlay_config_ids = options.get("overlay_config_ids")
    if preset_id or overlay_config_ids:
        canvas = apply_overlay_config(canvas, preset_id, "uniformlogo", metadata, overlay_config_ids)

    return canvas
