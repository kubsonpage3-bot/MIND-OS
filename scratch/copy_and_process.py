import os
import shutil
import glob
from PIL import Image

ARTIFACTS_DIR = r"C:\Users\kubso\.gemini\antigravity-ide\brain\07cf553f-3ce1-4004-859d-c299d15aa2fa"
RAW_DIR = r"c:\coder\mindos\_raw_assets"
FE_OUT_DIR = r"c:\coder\mindos\frontend\public\static\items"
BE_OUT_DIR = r"c:\coder\mindos\backend\static\items"

# 1. Copy the newly generated images
generated_files = [
    "veil_of_dusk_1784156665610.png",
    "ironbloom_plate_1784156676377.png",
    "laced_cortex_1784156686284.png",
    "strider_frame_1784156698019.png",
    "ring_of_embers_1784156707618.png",
    "severance_clasp_1784156717580.png",
    "foxblood_ring_1784156727604.png",
    "crown_of_the_waning_1784156735728.png",
    "the_unbroken_1784156745060.png",
    "hollow_eye_link_1784156754622.png",
    "gravewarden_legs_1784156764456.png",
    "seal_of_quiet_ruin_1784156773307.png",
    "oracle_of_the_last_age_1784156782749.png"
]

print("Copying generated images from artifacts to _raw_assets...")
for filename in generated_files:
    src = os.path.join(ARTIFACTS_DIR, filename)
    dst = os.path.join(RAW_DIR, filename)
    if os.path.exists(src):
        shutil.copy(src, dst)
        print(f"  Copied: {filename}")
    else:
        print(f"  Warning: Source not found: {src}")

# 2. Process function (similar to process_assets.py but with correct tolerance and outputting to both FE and BE)
def process_image(filepath, tolerance=20):
    img = Image.open(filepath).convert("RGBA")
    data = img.getdata()

    new_data = []
    for item in data:
        # item is (r, g, b, a)
        # Check if the pixel is near black (background)
        is_black = item[0] <= tolerance and item[1] <= tolerance and item[2] <= tolerance
        is_magenta = item[0] >= 240 and item[1] <= 15 and item[2] >= 240
        is_white = item[0] >= 240 and item[1] >= 240 and item[2] >= 240
        
        # Also check if it's already semi-transparent or black
        if is_black or is_magenta or is_white or item[3] == 0:
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

# 3. Main processing loops
print("\nProcessing newly copied raw assets into optimized WebP...")
os.makedirs(FE_OUT_DIR, exist_ok=True)
os.makedirs(BE_OUT_DIR, exist_ok=True)

# Process all files with timestamp pattern matching the ones we generated
for filepath in glob.glob(os.path.join(RAW_DIR, "*_178415*.png")):
    filename = os.path.basename(filepath)
    parts = filename.replace('.png', '').split('_')
    
    # Strip timestamp
    if len(parts) > 1 and parts[-1].isdigit() and len(parts[-1]) > 10:
        clean_name = "_".join(parts[:-1])
    else:
        clean_name = "_".join(parts)
        
    out_name = f"{clean_name}.webp"
    fe_out_path = os.path.join(FE_OUT_DIR, out_name)
    be_out_path = os.path.join(BE_OUT_DIR, out_name)
    
    try:
        final_img = process_image(filepath, tolerance=15)
        # Save to FE
        final_img.save(fe_out_path, "WEBP", lossless=True)
        # Save to BE
        final_img.save(be_out_path, "WEBP", lossless=True)
        print(f"  Processed: {clean_name} -> WebP saved in FE & BE")
    except Exception as e:
        print(f"  Error processing {filename}: {e}")

print("All done!")
