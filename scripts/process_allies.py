import os
from PIL import Image

ART_DIR = (
    "C:/Users/kubso/.gemini/antigravity-ide/brain/5be291e4-8124-402a-bd35-5a03b58554ef"
)
OUT_DIR = "c:/coder/mind-os-growth/frontend/public/images/webp"

MAPPING = {
    "media__1784313765629.jpg": "ally_16.webp",  # Rhea
    "media__1784313765681.jpg": "ally_13.webp",  # Zephyr
    "media__1784313765755.jpg": "ally_15.webp",  # Vivian
    "media__1784313765877.png": "ally_11.webp",  # Meldor
    "media__1784313765967.png": "ally_10.webp",  # Lyra
}


def remove_background_floodfill(img, tolerance=25):
    img = img.convert("RGBA")
    width, height = img.size
    pixels = list(img.getdata())

    # Visited grid for BFS
    visited = [[False for _ in range(height)] for _ in range(width)]
    queue = []

    # Initialize BFS queue with all border pixels
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
        visited[x][0] = True
        visited[x][height - 1] = True

    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
        visited[0][y] = True
        visited[width - 1][y] = True

    # We check similarity to white (255, 255, 255)
    target = (255, 255, 255)

    def is_similar(color):
        # Allow alpha transparency as already transparent
        if len(color) > 3 and color[3] == 0:
            return True
        return (
            abs(color[0] - target[0]) <= tolerance
            and abs(color[1] - target[1]) <= tolerance
            and abs(color[2] - target[2]) <= tolerance
        )

    head = 0
    while head < len(queue):
        cx, cy = queue[head]
        head += 1

        idx = cy * width + cx
        color = pixels[idx]

        if is_similar(color):
            pixels[idx] = (0, 0, 0, 0)

            # 4-connectivity check
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if not visited[nx][ny]:
                        visited[nx][ny] = True
                        queue.append((nx, ny))

    img.putdata(pixels)
    return img


def process_ally_image(in_path, out_path):
    print(f"Processing: {os.path.basename(in_path)} -> {os.path.basename(out_path)}")
    img = Image.open(in_path)

    # 1. Remove background cleanly via boundary flood fill
    img_transparent = remove_background_floodfill(img, tolerance=25)

    # 2. Crop to content bounding box
    bbox = img_transparent.getbbox()
    if bbox:
        img_cropped = img_transparent.crop(bbox)
    else:
        img_cropped = img_transparent

    # 3. Pad to square to keep aspect ratio
    max_dim = max(img_cropped.size)
    square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
    offset = (
        (max_dim - img_cropped.size[0]) // 2,
        (max_dim - img_cropped.size[1]) // 2,
    )
    square_img.paste(img_cropped, offset)

    # 4. Resize to 603x603 using high quality Lanczos resampling
    final_img = square_img.resize((603, 603), Image.Resampling.LANCZOS)

    # 5. Save as optimized WebP
    final_img.save(out_path, "WEBP", quality=85)
    print("Successfully processed and saved.")


def main():
    if not os.path.exists(OUT_DIR):
        os.makedirs(OUT_DIR)

    for raw_name, clean_name in MAPPING.items():
        in_path = os.path.join(ART_DIR, raw_name)
        out_path = os.path.join(OUT_DIR, clean_name)

        if os.path.exists(in_path):
            process_ally_image(in_path, out_path)
        else:
            print(f"Warning: Source file {in_path} does not exist.")


if __name__ == "__main__":
    main()
