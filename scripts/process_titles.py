import os
from PIL import Image

RAW_DIR = "c:/coder/mind-os-growth/_raw_assets"
OUT_DIRS = [
    "c:/coder/mind-os-growth/backend/static/titles",
    "c:/coder/mind-os-growth/frontend/public/static/titles",
]


# We want to crop the central badge, removing the brick wall background.
# The badge is centered and occupies approximately 78% of the image.
def crop_central_badge(img):
    width, height = img.size

    # We will crop the central 78% of the image
    crop_factor = 0.78
    new_width = int(width * crop_factor)
    new_height = int(height * crop_factor)

    left = (width - new_width) // 2
    top = (height - new_height) // 2
    right = left + new_width
    bottom = top + new_height

    cropped = img.crop((left, top, right, bottom))

    # Resize to 64x64 using NEAREST to preserve pixel art details
    return cropped.resize((64, 64), Image.NEAREST)


def main():
    for out_dir in OUT_DIRS:
        if not os.path.exists(out_dir):
            os.makedirs(out_dir)

    # Get the title PNGs we copied
    title_names = [
        "grandmaster",
        "awakened_one",
        "boss_slayer",
        "night_owl",
        "early_bird",
        "ally_patron",
        "bookworm",
        "chronomancer",
        "tycoon",
        "noonday_sentinel",
        "twilight_hunter",
        "weekend_warrior",
        "midnight_alchemist",
        "ignited",
        "marathoner",
        "iron_will",
        "unbroken",
        "time_legend",
        "phoenix",
        "polyglot",
        "architect_mind",
    ]

    print(f"Processing {len(title_names)} title icons...")

    for name in title_names:
        filepath = os.path.join(RAW_DIR, f"{name}.png")
        if not os.path.exists(filepath):
            print(f"Warning: {filepath} not found.")
            continue

        try:
            img = Image.open(filepath).convert("RGBA")
            final_img = crop_central_badge(img)

            for out_dir in OUT_DIRS:
                out_path = os.path.join(out_dir, f"{name}.webp")
                final_img.save(out_path, "WEBP", lossless=True)
                print(f"Processed: {name} -> {out_path}")
        except Exception as e:
            print(f"Error processing {name}: {e}")


if __name__ == "__main__":
    main()
