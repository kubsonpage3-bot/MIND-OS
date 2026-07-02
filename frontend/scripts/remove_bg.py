import os
from rembg import remove
from PIL import Image

images = [
    r"c:\coder\mind-os-growth\frontend\public\images\webp\f5c789146_characters1.webp",
    r"c:\coder\mind-os-growth\frontend\public\images\webp\7958b621c_characters2.webp",
    r"c:\coder\mind-os-growth\frontend\public\images\webp\303411c1f_characters3.webp",
    r"c:\coder\mind-os-growth\frontend\public\images\webp\eb9d93154_characters4.webp",
]


def process_image(img_path):
    print(f"Processing {img_path}...")
    # Read image
    input_img = Image.open(img_path).convert("RGBA")

    # Remove bg
    output_img = remove(input_img)

    # Threshold the alpha channel to keep pixel edges sharp
    data = output_img.getdata()
    newData = []
    for item in data:
        # item is (R, G, B, A)
        if item[3] > 128:
            newData.append((item[0], item[1], item[2], 255))
        else:
            newData.append((255, 255, 255, 0))  # fully transparent

    output_img.putdata(newData)

    # Save back
    output_img.save(img_path, format="WEBP", quality=100, method=6)
    print(f"Saved {img_path}")


for img in images:
    if os.path.exists(img_path := img):
        process_image(img_path)
    else:
        print(f"Not found: {img}")
