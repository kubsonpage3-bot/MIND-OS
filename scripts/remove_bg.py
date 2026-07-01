import os
import sys
from rembg import remove
from PIL import Image


def process_image(input_path, output_path):
    print(f"Processing {input_path} -> {output_path}...")
    try:
        input_image = Image.open(input_path)
        output_image = remove(input_image)
        output_image.save(output_path)
        print("Success!")
    except Exception as e:
        print(f"Failed to process {input_path}: {e}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)

    in_file = sys.argv[1]
    out_file = sys.argv[2]

    if not os.path.exists(in_file):
        print(f"Input file not found: {in_file}")
        sys.exit(1)

    process_image(in_file, out_file)
