import os
import glob
from PIL import Image, ImageDraw

ARTIFACT_DIR = (
    r"C:\Users\kubso\.gemini\antigravity-ide\brain\733b3bf3-0d5c-40e2-b3f0-18491f945b73"
)
RAW_DIR = r"c:\coder\mind-os-growth\_raw_assets"
OUT_DIRS = [
    r"c:\coder\mind-os-growth\backend\static\items",
    r"c:\coder\mind-os-growth\frontend\public\static\items",
]

# Ensure output dirs exist
for d in OUT_DIRS + [RAW_DIR]:
    os.makedirs(d, exist_ok=True)


# 1. Clean background & process PNG
def process_generated_image(filepath, tolerance=25):
    img = Image.open(filepath).convert("RGBA")
    data = img.getdata()

    new_data = []
    for item in data:
        is_black = (
            item[0] <= tolerance and item[1] <= tolerance and item[2] <= tolerance
        )
        is_white = item[0] >= 240 and item[1] >= 240 and item[2] >= 240
        is_magenta = item[0] >= 240 and item[1] <= 15 and item[2] >= 240

        if is_black or is_white or is_magenta:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        max_dim = max(img.size)
        square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
        offset = ((max_dim - img.size[0]) // 2, (max_dim - img.size[1]) // 2)
        square_img.paste(img, offset)
        final_img = square_img.resize((64, 64), Image.NEAREST)
    else:
        final_img = img.resize((64, 64), Image.NEAREST)

    return final_img


# 2. Procedural generator for missing 7 SSS items
def generate_procedural_sss(item_id):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    violet = (204, 0, 255, 255)
    gold = (255, 215, 0, 255)
    cyan = (0, 255, 240, 255)
    dark_purple = (40, 10, 60, 255)
    crimson = (255, 0, 85, 255)

    if "void_fist" in item_id:
        draw.rectangle([16, 16, 48, 48], outline=(150, 0, 200, 100), width=3)
        draw.polygon(
            [(20, 48), (28, 20), (44, 20), (48, 48)],
            fill=dark_purple,
            outline=violet,
        )
        draw.rectangle([24, 26, 40, 34], fill=gold)
        draw.ellipse([28, 36, 36, 44], fill=cyan)

    elif "paradox_step" in item_id:
        draw.polygon(
            [(18, 48), (24, 20), (32, 20), (36, 48)],
            fill=dark_purple,
            outline=violet,
        )
        draw.polygon(
            [(36, 48), (40, 24), (48, 24), (52, 48)],
            fill=dark_purple,
            outline=violet,
        )
        draw.rectangle([16, 46, 54, 50], fill=gold)
        draw.line([(24, 28), (44, 28)], fill=cyan, width=2)

    elif "infinity_sigil" in item_id:
        draw.ellipse([16, 16, 48, 48], outline=gold, width=4)
        draw.ellipse([24, 24, 40, 40], fill=dark_purple, outline=violet)
        draw.ellipse([26, 30, 32, 36], outline=cyan, width=2)
        draw.ellipse([32, 30, 38, 36], outline=cyan, width=2)

    elif "celestial_seal" in item_id:
        draw.polygon(
            [(32, 12), (52, 32), (32, 52), (12, 32)],
            fill=dark_purple,
            outline=gold,
        )
        draw.ellipse([22, 22, 42, 42], fill=violet, outline=cyan)
        draw.rectangle([30, 30, 34, 34], fill=gold)

    elif "godcore" in item_id:
        draw.rectangle([14, 14, 50, 50], fill=dark_purple, outline=gold, width=2)
        draw.rectangle([20, 20, 44, 44], outline=violet, width=2)
        draw.ellipse([24, 24, 40, 40], fill=crimson)
        draw.ellipse([28, 28, 36, 36], fill=cyan)

    elif "lightspeed" in item_id:
        draw.polygon(
            [(16, 48), (22, 16), (34, 24), (32, 48)],
            fill=dark_purple,
            outline=gold,
        )
        draw.polygon(
            [(32, 48), (38, 16), (50, 24), (48, 48)],
            fill=dark_purple,
            outline=gold,
        )
        draw.line([(10, 40), (54, 40)], fill=cyan, width=2)
        draw.line([(14, 32), (50, 32)], fill=violet, width=2)

    elif "ouroboros" in item_id:
        draw.ellipse([14, 14, 50, 50], outline=gold, width=5)
        draw.ellipse([22, 22, 42, 42], fill=dark_purple, outline=crimson)
        draw.ellipse([28, 28, 36, 36], fill=violet)

    else:
        draw.rectangle([16, 16, 48, 48], fill=dark_purple, outline=gold)

    return img


def main():
    png_files = glob.glob(os.path.join(ARTIFACT_DIR, "*_ss_*.png")) + glob.glob(
        os.path.join(ARTIFACT_DIR, "*_sss_*.png")
    )
    processed_ids = set()

    for filepath in png_files:
        filename = os.path.basename(filepath)
        parts = filename.replace(".png", "").split("_")
        if len(parts) > 1 and parts[-1].isdigit():
            clean_id = "_".join(parts[:-1])
        else:
            clean_id = "_".join(parts)

        processed_ids.add(clean_id)
        final_img = process_generated_image(filepath, tolerance=25)

        raw_path = os.path.join(RAW_DIR, f"{clean_id}.png")
        final_img.save(raw_path, "PNG")

        for out_dir in OUT_DIRS:
            out_path = os.path.join(out_dir, f"{clean_id}.webp")
            final_img.save(out_path, "WEBP", lossless=True)
            print(f"[OK] Processed AI image: {clean_id} -> {out_path}")

    all_20_ids = [
        "quantum_cortex_ss",
        "void_link_ss",
        "aegis_core_ss",
        "phantom_arms_ss",
        "gravshift_legs_ss",
        "sovereign_ring_ss",
        "eclipse_charm_ss",
        "neural_mantle_ss",
        "warpstep_ss",
        "cipher_ring_ss",
        "omnimind_crown_sss",
        "singularity_link_sss",
        "titan_core_sss",
        "void_fist_sss",
        "paradox_step_sss",
        "infinity_sigil_sss",
        "celestial_seal_sss",
        "godcore_sss",
        "lightspeed_sss",
        "ouroboros_sss",
    ]

    for item_id in all_20_ids:
        if item_id not in processed_ids:
            procedural_img = generate_procedural_sss(item_id)
            for out_dir in OUT_DIRS:
                out_path = os.path.join(out_dir, f"{item_id}.webp")
                procedural_img.save(out_path, "WEBP", lossless=True)
                print(f"[OK] Created SSS pixel icon: {item_id} -> {out_path}")

    print("\nALL 20 SS & SSS ITEM ICONS PROCESSED AND DEPLOYED!")


if __name__ == "__main__":
    main()
