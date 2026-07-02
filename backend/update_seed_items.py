import re

with open("seed_items.py", "r", encoding="utf-8") as f:
    content = f.read()

# For any block after "# BOSS DROPS" and before "]", add "source": "boss_drop",
boss_drops_idx = content.find("# BOSS DROPS")
if boss_drops_idx != -1:
    pre_boss = content[:boss_drops_idx]
    post_boss = content[boss_drops_idx:]

    post_boss = re.sub(
        r'("cost": 0,)', r'\1\n        "source": "boss_drop",', post_boss
    )

    content = pre_boss + post_boss

# Also update is_purchasable
old_logic = """    item, created = Item.objects.get_or_create(
        code=data["id"],
        defaults={
            "name": data["name"],
            "description": data["name"],
            "item_type": item_type,
            "slot_type": slot_type,
            "icon_url": icon_path,
            "cost": data["cost"],
            "hp_boost": data.get("hp_boost", 0),
            "icon_url": icon_path,
        },
    )

    if not created:
        item.name = data["name"]
        item.item_type = item_type
        item.slot_type = slot_type
        item.icon_url = icon_path
        item.cost = data["cost"]
        item.hp_boost = data.get("hp_boost", 0)
        item.icon_url = icon_path
        item.save()"""

new_logic = """    is_purchasable = data.get("source", "shop") == "shop"

    item, created = Item.objects.get_or_create(
        code=data["id"],
        defaults={
            "name": data["name"],
            "description": data["name"],
            "item_type": item_type,
            "slot_type": slot_type,
            "icon_url": icon_path,
            "cost": data["cost"],
            "hp_boost": data.get("hp_boost", 0),
            "is_purchasable": is_purchasable,
        },
    )

    if not created:
        item.name = data["name"]
        item.item_type = item_type
        item.slot_type = slot_type
        item.icon_url = icon_path
        item.cost = data["cost"]
        item.hp_boost = data.get("hp_boost", 0)
        item.is_purchasable = is_purchasable
        item.save()"""

content = content.replace(old_logic, new_logic)

with open("seed_items.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated seed_items.py")
