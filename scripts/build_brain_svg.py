import numpy as np
from PIL import Image
from skimage.feature import canny
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
        closed_mask = closing(mask, disk(3))

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

    # Canny edge detection for internal wrinkles
    gray = np.mean(crop, axis=2)
    edges = canny(gray, sigma=1.2, low_threshold=12, high_threshold=35)
    edges[is_bg] = False

    edge_contours = find_contours(edges.astype(float), 0.5)

    wrinkles_by_lobe = {n: [] for n in names}
    for c in edge_contours:
        if len(c) < 6 or len(c) > 120:
            continue

        simplified = approximate_polygon(c, tolerance=1.0)
        if len(simplified) < 3:
            continue

        mid_pt = simplified[len(simplified) // 2]
        r_idx, c_idx = int(mid_pt[0]), int(mid_pt[1])
        if 0 <= r_idx < h and 0 <= c_idx < w and not is_bg[r_idx, c_idx]:
            lobe_name = names[closest_idx[r_idx, c_idx]]

            path_cmds = []
            for idx, pt in enumerate(simplified):
                svg_x = round(pt[1] * scale_x, 1)
                svg_y = round(pt[0] * scale_y, 1)
                cmd = "M" if idx == 0 else "L"
                path_cmds.append(f"{cmd} {svg_x} {svg_y}")

            wrinkles_by_lobe[lobe_name].append(" ".join(path_cmds))

    for name in names:
        if name in lobe_paths:
            # Sort wrinkles by length and pick best 12 per lobe
            sorted_w = sorted(
                wrinkles_by_lobe[name], key=lambda w_str: len(w_str), reverse=True
            )
            lobe_paths[name]["wrinkles"] = sorted_w[:12]

    with open(r"c:\coder\mind-os-growth\scripts\traced_brain_paths.json", "w") as f:
        json.dump(lobe_paths, f, indent=2)

    print("Updated traced_brain_paths.json successfully!")


if __name__ == "__main__":
    process_brain_image()
