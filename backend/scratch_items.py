import os
import sys
import django
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import Item, ItemEffect

items = Item.objects.filter(item_type="consumable")
results = []
for item in items:
    effects = list(item.effects.all().values("effect_name", "effect_value"))
    results.append(
        {
            "code": item.code,
            "name": item.name,
            "cost": item.cost,
            "description": item.description,
            "damage_boost": item.damage_boost,
            "gold_boost": item.gold_boost,
            "xp_boost": item.xp_boost,
            "hp_boost": item.hp_boost,
            "mana_boost": item.mana_boost,
            "effects": effects,
        }
    )

print(json.dumps(results, indent=2))
