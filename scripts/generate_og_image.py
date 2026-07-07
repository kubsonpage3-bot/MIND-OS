import os
import requests
from PIL import Image, ImageDraw, ImageFont


def generate_og():
    # 1. Base Image Setup
    width, height = 1200, 630

    # Try to open existing theme background, or create a dark fallback
    base_path = (
        "c:/coder/mind-os-growth/frontend/public/images/webp/theme_dark_fantasy.webp"
    )
    if os.path.exists(base_path):
        bg = Image.open(base_path).convert("RGBA")
        # Resize/crop to 1200x630
        bg_w, bg_h = bg.size
        # scale to cover
        scale = max(width / bg_w, height / bg_h)
        new_w, new_h = int(bg_w * scale), int(bg_h * scale)
        bg = bg.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Crop center
        left = (new_w - width) / 2
        top = (new_h - height) / 2
        right = (new_w + width) / 2
        bottom = (new_h + height) / 2
        img = bg.crop((left, top, right, bottom))
    else:
        img = Image.new("RGBA", (width, height), "#0a0814")

    # Darken background slightly to make text pop
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 150))
    img = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(img)

    # 2. Download a Pixel Font (VT323)
    font_path = "vt323.ttf"
    if not os.path.exists(font_path):
        url = "https://github.com/google/fonts/raw/main/ofl/vt323/VT323-Regular.ttf"
        r = requests.get(url)
        with open(font_path, "wb") as f:
            f.write(r.content)

    font_large = ImageFont.truetype(font_path, 180)
    font_medium = ImageFont.truetype(font_path, 60)

    # 3. Draw Text
    title = "MIND OS"
    subtitle = "RPG Habit Tracker — Level Up Your Life"

    # Text bounds
    title_bbox = draw.textbbox((0, 0), title, font=font_large)
    title_w = title_bbox[2] - title_bbox[0]
    title_h = title_bbox[3] - title_bbox[1]

    sub_bbox = draw.textbbox((0, 0), subtitle, font=font_medium)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sub_h = sub_bbox[3] - sub_bbox[1]

    # Coordinates
    x_title = (width - title_w) / 2
    y_title = (height - title_h - sub_h - 40) / 2

    x_sub = (width - sub_w) / 2
    y_sub = y_title + title_h + 40

    # Draw shadows
    shadow_offset = 6
    draw.text(
        (x_title + shadow_offset, y_title + shadow_offset),
        title,
        font=font_large,
        fill=(0, 0, 0, 200),
    )
    draw.text((x_sub + 4, y_sub + 4), subtitle, font=font_medium, fill=(0, 0, 0, 200))

    # Draw actual text (Primary theme color)
    draw.text((x_title, y_title), title, font=font_large, fill="#7c3aed")
    # Draw subtitle (White)
    draw.text((x_sub, y_sub), subtitle, font=font_medium, fill="#e5e7eb")

    # Save to public directory
    out_path = "c:/coder/mind-os-growth/frontend/public/og-image.png"
    img.convert("RGB").save(out_path, "PNG")
    print("Generated og-image.png")


if __name__ == "__main__":
    generate_og()
