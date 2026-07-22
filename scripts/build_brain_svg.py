import numpy as np
from PIL import Image
from skimage.measure import find_contours, approximate_polygon
from skimage.morphology import closing, disk
import json


def process_brain_image():
    img = Image.open(
        r"C:\Users\kubso\.gemini\antigravity-ide\brain\17c501fb-b6a9-401c-bb77-7fb272e35fac\media__1784706738969.png"
    ).convert("RGB")
    arr = np.array(img)

    xmin, xmax, ymin, ymax = 245, 715, 230, 615
    crop = arr[ymin:ymax, xmin:xmax]
    h, w, _ = crop.shape

    target_w, target_h = 500, 400
    scale_x = target_w / w
    scale_y = target_h / h

    ref_colors = {
        "sciences": np.array([82, 185, 144]),  # Green
        "body": np.array([89, 155, 215]),  # Blue
        "languages": np.array([193, 148, 203]),  # Purple
        "spirit": np.array([241, 147, 114]),  # Orange
        "humanities": np.array([248, 215, 118]),  # Yellow
    }

    is_bg = (crop[:, :, 0] > 240) & (crop[:, :, 1] > 240) & (crop[:, :, 2] > 240)

    dists = {}
    for name, col in ref_colors.items():
        dists[name] = np.sum((crop.astype(float) - col.reshape(1, 1, 3)) ** 2, axis=2)

    names = list(ref_colors.keys())
    dist_stack = np.stack([dists[n] for n in names], axis=2)
    closest_idx = np.argmin(dist_stack, axis=2)

    lobe_paths = {}

    for i, name in enumerate(names):
        mask = (closest_idx == i) & (~is_bg)
        closed_mask = closing(mask, disk(4))

        contours = find_contours(closed_mask.astype(float), 0.5)
        if not contours:
            continue

        main_contour = max(contours, key=lambda c: len(c))
        simplified = approximate_polygon(main_contour, tolerance=1.2)

        path_cmds = []
        for idx, pt in enumerate(simplified):
            svg_x = round(pt[1] * scale_x, 1)
            svg_y = round(pt[0] * scale_y, 1)
            cmd = "M" if idx == 0 else "L"
            path_cmds.append(f"{cmd} {svg_x} {svg_y}")
        path_cmds.append("Z")

        avg_x = round(np.mean([pt[1] * scale_x for pt in simplified]), 1)
        avg_y = round(np.mean([pt[0] * scale_y for pt in simplified]), 1)

        lobe_paths[name] = {
            "d": " ".join(path_cmds),
            "labelPos": {"x": avg_x, "y": avg_y},
            "wrinkles": [],
        }

    # Extract dark fold lines per lobe relative to lobe background fill
    gray = np.mean(crop, axis=2)
    wrinkles_by_lobe = {n: [] for n in names}

    for i, name in enumerate(names):
        lobe_mask = (closest_idx == i) & (~is_bg)
        if not np.any(lobe_mask):
            continue

        # Mean brightness of this lobe fill
        mean_bright = np.mean(gray[lobe_mask])
        # Dark lines inside this lobe are significantly darker than the fill
        dark_lobe_mask = (gray < (mean_bright - 22)) & lobe_mask

        c_list = find_contours(dark_lobe_mask.astype(float), 0.5)
        for c in c_list:
            if len(c) < 10 or len(c) > 200:
                continue

            simplified = approximate_polygon(c, tolerance=1.1)
            if len(simplified) < 3:
                continue

            path_cmds = []
            for idx, pt in enumerate(simplified):
                svg_x = round(pt[1] * scale_x, 1)
                svg_y = round(pt[0] * scale_y, 1)
                cmd = "M" if idx == 0 else "L"
                path_cmds.append(f"{cmd} {svg_x} {svg_y}")

            wrinkles_by_lobe[name].append(" ".join(path_cmds))

    for name in names:
        if name in lobe_paths:
            sorted_w = sorted(
                wrinkles_by_lobe[name], key=lambda w_str: len(w_str), reverse=True
            )
            lobe_paths[name]["wrinkles"] = sorted_w[:12]

    with open(r"c:\coder\mind-os-growth\scripts\traced_brain_paths.json", "w") as f:
        json.dump(lobe_paths, f, indent=2)

    print("Extracted high-contrast wrinkles for all 5 lobes successfully!")


if __name__ == "__main__":
    process_brain_image()
