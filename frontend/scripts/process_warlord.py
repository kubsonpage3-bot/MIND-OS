import os
import shutil
from rembg import remove
from PIL import Image

src_dir = (
    r"C:\Users\kubso\.gemini\antigravity-ide\brain\41282a9e-2b65-467c-ac94-3aaf58f573e2"
)
dest_dir = r"c:\coder\mind-os-growth\frontend\public\images\webp"

images_map = {
    "E": "warlord_f_1783019189659.png",
    "D": "warlord_d_1783019197715.png",
    "C": "warlord_c_1783019205263.png",
    "B": "warlord_b_1783019213359.png",
    "A": "warlord_a_1783019227767.png",
    "S": "warlord_s_1783019234618.png",
    "SS": "warlord_ss_1783019241783.png",
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


for rank, filename in images_map.items():
    src_path = os.path.join(src_dir, filename)
    dest_path = os.path.join(dest_dir, f"warlord_{rank.lower()}.webp")
    if os.path.exists(src_path):
        process_image(src_path, dest_path)

# Handle SSS by duplicating SS
ss_path = os.path.join(dest_dir, "warlord_ss.webp")
sss_path = os.path.join(dest_dir, "warlord_sss.webp")
if os.path.exists(ss_path):
    shutil.copy2(ss_path, sss_path)
    print(f"Copied SS to {sss_path}")
