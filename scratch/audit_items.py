import os
import re

# Read seed_items.py to extract all item IDs, names, and slots
seed_path = r"c:\coder\mindos\backend\seed_items.py"
frontend_static_dir = r"c:\coder\mindos\frontend\public\static\items"
backend_static_dir = r"c:\coder\mindos\backend\static\items"

item_id_regex = re.compile(r'"id":\s*"([^"]+)"')
item_name_regex = re.compile(r'"name":\s*"([^"]+)"')
item_tier_regex = re.compile(r'"tier":\s*"([^"]+)"')
item_slot_regex = re.compile(r'"slot":\s*"([^"]+)"')
item_source_regex = re.compile(r'"source":\s*"([^"]+)"')

items = []
current_item = {}

with open(seed_path, "r", encoding="utf-8") as f:
    for line in f:
        line_str = line.strip()
        if line_str.startswith("{"):
            current_item = {}
        elif line_str.startswith("}") or line_str.startswith("},"):
            if "id" in current_item:
                items.append(current_item)
            current_item = {}
        else:
            id_match = item_id_regex.search(line_str)
            if id_match:
                current_item["id"] = id_match.group(1)
            name_match = item_name_regex.search(line_str)
            if name_match:
                current_item["name"] = name_match.group(1)
            tier_match = item_tier_regex.search(line_str)
            if tier_match:
                current_item["tier"] = tier_match.group(1)
            slot_match = item_slot_regex.search(line_str)
            if slot_match:
                current_item["slot"] = slot_match.group(1)
            source_match = item_source_regex.search(line_str)
            if source_match:
                current_item["source"] = source_match.group(1)

print(f"Total items in seed_items.py: {len(items)}")

print("\n--- AUDIT OF ITEMS ---")
print(f"{'Item ID':<25} | {'Item Name':<25} | {'Tier':<10} | {'FE Exist':<8} | {'FE Size (KB)':<12} | {'BE Exist':<8}")
print("-" * 100)

missing_fe = []
unoptimized_fe = []
optimized_fe = []

for item in items:
    fe_filename = f"{item['id']}.webp"
    fe_filepath = os.path.join(frontend_static_dir, fe_filename)
    be_filepath = os.path.join(backend_static_dir, fe_filename)
    
    fe_exists = os.path.exists(fe_filepath)
    be_exists = os.path.exists(be_filepath)
    
    fe_size_kb = 0.0
    if fe_exists:
        fe_size_kb = os.path.getsize(fe_filepath) / 1024.0
        
    fe_exists_str = "YES" if fe_exists else "NO"
    be_exists_str = "YES" if be_exists else "NO"
    fe_size_str = f"{fe_size_kb:.2f}" if fe_exists else "-"
    
    print(f"{item['id']:<25} | {item['name']:<25} | {item.get('tier', 'Common'):<10} | {fe_exists_str:<8} | {fe_size_str:<12} | {be_exists_str:<8}")
    
    if not fe_exists:
        missing_fe.append(item)
    elif fe_size_kb > 15.0:  # unoptimized files are usually > 15KB (they are raw generations around 30-160KB)
        unoptimized_fe.append((item, fe_size_kb))
    else:
        optimized_fe.append((item, fe_size_kb))

print("\n--- SUMMARY ---")
print(f"Missing images in FE ({len(missing_fe)}):")
for item in missing_fe:
    print(f"  - {item['id']} ({item['name']}) - Tier: {item.get('tier', 'Common')}, Source: {item.get('source', 'shop')}")

print(f"\nUnoptimized images in FE ({len(unoptimized_fe)}):")
for item, size in unoptimized_fe:
    print(f"  - {item['id']} ({item['name']}) - Tier: {item.get('tier', 'Common')}, Size: {size:.2f} KB")
