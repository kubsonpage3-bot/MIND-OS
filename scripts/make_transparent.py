import os
from PIL import Image


def flood_fill_transparent(img, xy, threshold=15):
    # Convert to RGBA
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size

    target_color = pixels[xy]

    # If the corner is already transparent, we can just return
    if target_color[3] == 0:
        return img

    # We want to remove black backgrounds specifically
    if (
        target_color[0] > threshold
        or target_color[1] > threshold
        or target_color[2] > threshold
    ):
        # Background is not black, don't touch it
        print("Background not black enough.")
        return img

    stack = [xy]
    visited = set()

    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
        visited.add((x, y))

        r, g, b, a = pixels[x, y]
        if r <= threshold and g <= threshold and b <= threshold and a > 0:
            pixels[x, y] = (0, 0, 0, 0)

            if x > 0:
                stack.append((x - 1, y))
            if x < width - 1:
                stack.append((x + 1, y))
            if y > 0:
                stack.append((x, y - 1))
            if y < height - 1:
                stack.append((x, y + 1))

    return img


def make_transparent(folder_path, prefix="ally_", ext=".webp"):
    for file_name in os.listdir(folder_path):
        if file_name.startswith(prefix) and file_name.endswith(ext):
            path = os.path.join(folder_path, file_name)
            img = Image.open(path)
            # Fill from top-left
            img = flood_fill_transparent(img, (0, 0))
            # Fill from top-right
            img = flood_fill_transparent(img, (img.width - 1, 0))
            # Fill from bottom-left
            img = flood_fill_transparent(img, (0, img.height - 1))
            # Fill from bottom-right
            img = flood_fill_transparent(img, (img.width - 1, img.height - 1))

            img.save(path, "WEBP")
            print(f"Processed {file_name}")


if __name__ == "__main__":
    folder = "c:/coder/mind-os-growth/frontend/public/images/webp"
    make_transparent(folder)
