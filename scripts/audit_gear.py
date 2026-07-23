import os
import sys

sys.path.insert(0, r"c:\coder\mind-os-growth\backend")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")

import django  # noqa: E402

django.setup()

from api.models import Item, InventoryItem  # noqa: E402

items = Item.objects.all()
print(f"Total Item records in DB: {items.count()}")
print("=" * 80)

missing_name = []
missing_desc = []
missing_effects = []

for item in items:
    effects = list(item.effects.all())
    stats_dict = {e.effect_name: e.effect_value for e in effects}
    print(
        f"[{item.gear_class or '?'}] Code: {item.code} | Name: '{item.name}' | Slot: {item.slot_type} | Stats: {stats_dict}"
    )
    if not item.name:
        missing_name.append(item.code)
    if not item.description:
        missing_desc.append(item.code)
    if not stats_dict and item.item_type == Item.ItemType.EQUIPMENT:
        missing_effects.append(item.code)

print("=" * 80)
print(f"Missing name ({len(missing_name)}): {missing_name}")
print(f"Missing description ({len(missing_desc)}): {missing_desc}")
print(f"Missing equipment stats ({len(missing_effects)}): {missing_effects}")

print("\n--- INVENTORY ITEMS AUDIT ---")
inv_items = InventoryItem.objects.all()
print(f"Total InventoryItem records: {inv_items.count()}")
for inv in inv_items:
    effects = list(inv.item.effects.all())
    stats_dict = inv.stat_bonuses or {e.effect_name: e.effect_value for e in effects}
    print(
        f"User: {inv.user_profile.user.username} | Item: {inv.item.code} ('{inv.item.name}') | Class: {inv.item.gear_class} | Slot: {inv.item.slot_type} | Equipped: {inv.is_equipped} | Stats: {stats_dict}"
    )
