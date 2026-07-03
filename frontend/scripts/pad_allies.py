import glob
from PIL import Image

for f in glob.glob('frontend/public/images/webp/ally_*.webp'):
    img = Image.open(f).convert("RGBA")
    w, h = img.size
    
    # Target size is the max dimension plus 10% padding
    s = int(max(w, h) * 1.15)
    
    # Create a new transparent square image
    new_img = Image.new("RGBA", (s, s), (255, 255, 255, 0))
    
    # Center the original image
    x = (s - w) // 2
    y = (s - h) // 2
    
    new_img.paste(img, (x, y), img)
    
    # Save back
    new_img.save(f, format="WEBP", quality=95, method=6)
    print(f"Padded {f} from {w}x{h} to {s}x{s}")
