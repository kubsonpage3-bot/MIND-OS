import os
import glob
from PIL import Image

RAW_DIR = "c:/coder/mind-os-growth/_raw_assets"
OUT_DIR = "c:/coder/mind-os-growth/backend/static/items"

def process_image(filepath, tolerance=10):
    # Open image and convert to RGBA
    img = Image.open(filepath).convert("RGBA")
    data = img.getdata()

    new_data = []
    for item in data:
        # item is (r, g, b, a)
        is_black = item[0] <= tolerance and item[1] <= tolerance and item[2] <= tolerance
        is_magenta = item[0] >= 240 and item[1] <= 15 and item[2] >= 240
        is_white = item[0] >= 240 and item[1] >= 240 and item[2] >= 240
        
        if is_black or is_magenta or is_white:
            # Replace with transparent
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    
    # Crop to the bounding box of non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
        # We want to resize to 64x64 while maintaining aspect ratio, or pad it
        # Actually for pixel art icons, resizing the cropped content to fit within 64x64
        # with nearest neighbor is best.
        
        # Let's make it a square first by padding
        max_dim = max(img.size)
        square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
        offset = ((max_dim - img.size[0]) // 2, (max_dim - img.size[1]) // 2)
        square_img.paste(img, offset)
        
        # Now resize to 64x64 using NEAREST to preserve pixel art crispness
        final_img = square_img.resize((64, 64), Image.NEAREST)
    else:
        # If the image was entirely black/transparent
        final_img = img.resize((64, 64), Image.NEAREST)
        
    return final_img

def main():
    if not os.path.exists(OUT_DIR):
        os.makedirs(OUT_DIR)
        
    # Get all PNGs
    files = glob.glob(os.path.join(RAW_DIR, "*.png"))
    print(f"Found {len(files)} images to process.")
    
    for filepath in files:
        filename = os.path.basename(filepath)
        # The filename looks like "boss_damage_plus_12345.png"
        # We want to save it as "boss_damage_plus.webp"
        
        # Remove the timestamp part if it exists (e.g. _178...)
        # Split by '_'
        parts = filename.replace('.png', '').split('_')
        # Check if last part is a long number
        if len(parts) > 1 and parts[-1].isdigit() and len(parts[-1]) > 10:
            clean_name = "_".join(parts[:-1])
        else:
            clean_name = "_".join(parts)
            
        out_name = f"{clean_name}.webp"
        out_path = os.path.join(OUT_DIR, out_name)
        
        try:
            final_img = process_image(filepath, tolerance=15) # Using 15 to catch compression artifacts near black
            final_img.save(out_path, "WEBP", lossless=True)
            print(f"Processed: {clean_name} -> {out_path}")
        except Exception as e:
            print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    main()
