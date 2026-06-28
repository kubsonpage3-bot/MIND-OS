import os
from PIL import Image
from rembg import remove

RAW_DIR = "_raw_assets"
OUT_DIR = "backend/static/items"

os.makedirs(OUT_DIR, exist_ok=True)

def process_image(filename):
    if not filename.endswith(('.png', '.jpg', '.jpeg')):
        return

    input_path = os.path.join(RAW_DIR, filename)
    base_name = os.path.splitext(filename)[0]
    out_path = os.path.join(OUT_DIR, f"{base_name}.webp")

    print(f"Processing {filename}...")

    # Load image
    input_image = Image.open(input_path).convert("RGBA")
    
    # Remove background using rembg
    # This will download the u2net model on first run
    output_image = remove(input_image)
    
    # Resize nearest neighbor to 64x64 to preserve pixel art style
    resized = output_image.resize((64, 64), resample=Image.Resampling.NEAREST)
    
    # Save as webp
    resized.save(out_path, "WEBP", quality=100)
    print(f"Saved -> {out_path}")

if __name__ == "__main__":
    if not os.path.exists(RAW_DIR):
        print(f"Directory {RAW_DIR} not found.")
        exit(1)
        
    files = os.listdir(RAW_DIR)
    if not files:
        print("No raw assets to process.")
        
    for f in files:
        process_image(f)
    
    print("Done!")
