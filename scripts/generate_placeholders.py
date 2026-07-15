import os
from PIL import Image, ImageDraw, ImageFont
import random

RAW_DIR = "c:/coder/mind-os-growth/_raw_assets"

missing_items = [
    "veil_of_dusk",
    "ironbloom_plate",
    "laced_cortex",
    "strider_frame",
    "ring_of_embers",
    "severance_clasp",
    "foxblood_ring",
    "crown_of_the_waning",
    "the_unbroken",
    "hollow_eye_link",
    "gravewarden_legs",
    "seal_of_quiet_ruin",
    "oracle_of_the_last_age",
    "ebon_mantle",
    "ring_of_the_first_fire",
    "mask_of_the_nameless",
    "gauntlet_of_the_epoch",
]


def generate_placeholder(name):
    # Create 64x64 black image (will be made transparent by process_assets.py)
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Pick a random vibrant color
    color = (
        random.randint(50, 255),
        random.randint(50, 255),
        random.randint(50, 255),
        255,
    )

    # Draw a simple shape in the center (leave some black border)
    # The black border will be cropped away, so we need some shape.
    draw.rectangle([32, 32, 96, 96], fill=color)

    # Draw initial letter
    initial = name[0].upper()
    try:
        font = ImageFont.load_default()
        draw.text((54, 54), initial, fill=(255, 255, 255, 255), font=font)
    except Exception:
        pass  # Ignore if font fails

    # add pixel art noise
    for _ in range(50):
        x = random.randint(32, 96)
        y = random.randint(32, 96)
        draw.point((x, y), fill=(0, 0, 0, 100))

    out_path = os.path.join(RAW_DIR, f"{name}.png")
    img.save(out_path)
    print(f"Generated placeholder for {name} at {out_path}")


if not os.path.exists(RAW_DIR):
    os.makedirs(RAW_DIR)

for item in missing_items:
    generate_placeholder(item)

print("Placeholders generated.")
