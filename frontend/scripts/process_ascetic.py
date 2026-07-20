import os
from rembg import remove
from PIL import Image

src_dir = (
    r"C:\Users\kubso\.gemini\antigravity-ide\brain\1a3519cf-ff34-4b18-b7f8-2a16d47510c5"
)
dest_dir = r"c:\coder\mind-os-growth\frontend\public\images\webp"

images_map = {
    "E": "ascetic_f_1783076547453.png",
    "D": "ascetic_d_1783076559950.png",
    "C": "ascetic_c_1783076572294.png",
    "B": "ascetic_b_v2_1783077019447.png",
    "A": "ascetic_a_1783076596291.png",
    "S": "ascetic_s_1783076609107.png",
    "SS": "ascetic_ss_1783076622352.png",
    "SSS": "ascetic_sss_v2_1783077031570.png",
}


def process_image(img_path, dest_path):
    print(f"Processing {img_path} -> {dest_path}")
    input_img = Image.open(img_path).convert("RGBA")
    output_img = remove(input_img)
    data = output_img.getdata()
    newData = []
    for item in data:
        if item[3] > 128:
            newData.append((item[0], item[1], item[2], 255))
        else:
            newData.append((255, 255, 255, 0))
    output_img.putdata(newData)
    output_img.save(dest_path, format="WEBP", quality=100, method=6)


if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

for rank, filename in images_map.items():
    src_path = os.path.join(src_dir, filename)
    dest_path = os.path.join(dest_dir, f"ascetic_{rank.lower()}.webp")
    if os.path.exists(src_path):
        process_image(src_path, dest_path)
    else:
        print(f"Source file not found: {src_path}")
