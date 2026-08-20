import os
import re

seed_path = r"c:\coder\mindos\backend\seed_items_new.py"
frontend_static_dir = r"c:\coder\mindos\frontend\public\static\items"
backend_static_dir = r"c:\coder\mindos\backend\static\items"
raw_assets_dir = r"c:\coder\mindos\_raw_assets"

missing_items = [
    "veil_of_dusk",
    "ironbloom_plate",
    "laced_cortex",
    "strider_frame",
    "ring_of_embers",
    "severance_clasp",
    "foxblood_ring",
    "crown_of_the_waning",
    "the_unbroken",
    "hollow_eye_link",
    "gravewarden_legs",
    "seal_of_quiet_ruin",
    "oracle_of_the_last_age",
    "ebon_mantle",
    "ring_of_the_first_fire",
    "mask_of_the_nameless",
    "gauntlet_of_the_epoch",
]

# Read seed_items_new.py to extract item metadata for these 17 items
item_id_regex = re.compile(r'"id":\s*"([^"]+)"')
item_name_regex = re.compile(r'"name":\s*"([^"]+)"')
item_class_regex = re.compile(r'"gear_class":\s*"([^"]+)"')
item_slot_regex = re.compile(r'"slot":\s*"([^"]+)"')

items_metadata = {}
current_item = {}

with open(seed_path, "r", encoding="utf-8") as f:
    for line in f:
        line_str = line.strip()
        if line_str.startswith("{"):
            current_item = {}
        elif line_str.startswith("}") or line_str.startswith("},"):
            if "id" in current_item:
                items_metadata[current_item["id"]] = current_item
            current_item = {}
        else:
            id_match = item_id_regex.search(line_str)
            if id_match:
                current_item["id"] = id_match.group(1)
            name_match = item_name_regex.search(line_str)
            if name_match:
                current_item["name"] = name_match.group(1)
            class_match = item_class_regex.search(line_str)
            if class_match:
                current_item["gear_class"] = class_match.group(1)
            slot_match = item_slot_regex.search(line_str)
            if slot_match:
                current_item["slot"] = slot_match.group(1)

print("--- AUDIT OF 17 NEW CHEST ITEMS ---")
print(f"{'Item ID':<25} | {'Item Name':<25} | {'Class':<5} | {'Slot':<12} | {'Raw Exist':<10} | {'FE Exist':<8} | {'FE Size (KB)':<12}")
print("-" * 110)

for item_id in missing_items:
    meta = items_metadata.get(item_id, {"name": item_id.replace("_", " ").title(), "gear_class": "C", "slot": "unknown"})
    
    raw_filename = f"{item_id}.png"
    raw_filepath = os.path.join(raw_assets_dir, raw_filename)
    raw_exists = os.path.exists(raw_filepath)
    
    fe_filename = f"{item_id}.webp"
    fe_filepath = os.path.join(frontend_static_dir, fe_filename)
    fe_exists = os.path.exists(fe_filepath)
    
    fe_size_kb = 0.0
    if fe_exists:
        fe_size_kb = os.path.getsize(fe_filepath) / 1024.0
        
    raw_str = "YES" if raw_exists else "NO"
    fe_str = "YES" if fe_exists else "NO"
    size_str = f"{fe_size_kb:.2f}" if fe_exists else "-"
    
    print(f"{item_id:<25} | {meta['name']:<25} | {meta['gear_class']:<5} | {meta['slot']:<12} | {raw_str:<10} | {fe_str:<8} | {size_str:<12}")
