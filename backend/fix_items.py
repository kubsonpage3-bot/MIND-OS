"""
Seed/fix script: fixes health_potion hp_boost and adds daily deal items.
Run: python manage.py shell < fix_items.py
"""

import django
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import Item  # noqa: E402

# Fix 1: health_potion hp_boost should be 50 (it's the medium heal)
fixed = Item.objects.filter(code="health_potion").update(
    hp_boost=50, item_type="consumable"
)
print(f"Fixed health_potion hp_boost: {fixed} rows")

# Fix 2: add daily deal items that frontend uses
daily_items = [
    {
        "code": "daily_gold_rush",
        "name": "Gold Rush Token",
        "description": "Instantly grants +200 Gold.",
        "item_type": "consumable",
        "cost": 150,
        "icon_url": "/static/items/daily_gold_rush.webp",
        "hp_boost": 0,
        "damage_boost": 0.0,
        "gold_boost": 0.0,
        "xp_boost": 0.0,
        "mana_boost": 0,
    },
    {
        "code": "daily_xp_surge",
        "name": "XP Surge Scroll",
        "description": "+100% XP gain for 2 hours.",
        "item_type": "consumable",
        "cost": 150,
        "icon_url": "/static/items/daily_xp_surge.webp",
        "hp_boost": 0,
        "damage_boost": 0.0,
        "gold_boost": 0.0,
        "xp_boost": 0.0,
        "mana_boost": 0,
    },
]

for data in daily_items:
    obj, created = Item.objects.get_or_create(code=data["code"], defaults=data)
    if not created:
        for k, v in data.items():
            setattr(obj, k, v)
        obj.save()
        print(f"Updated: {obj.code}")
    else:
        print(f"Created: {obj.code}")

print("Done!")
