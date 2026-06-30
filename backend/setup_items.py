import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from api.models import Item  # noqa: E402

Item.objects.all().delete()

items = [
    {
        "code": "carbon_vest",
        "name": "Carbon Vest",
        "item_type": "equipment",
        "cost": 150,
        "icon_url": "/static/items/carbon_vest.webp",
        "damage_boost": 0,
    },
    {
        "code": "data_ring",
        "name": "Data Ring",
        "item_type": "equipment",
        "cost": 300,
        "icon_url": "/static/items/data_ring.webp",
        "damage_boost": 1,
    },
    {
        "code": "health_potion",
        "name": "Health Potion",
        "item_type": "consumable",
        "cost": 50,
        "icon_url": "/static/items/health_potion.webp",
        "damage_boost": 0,
    },
    {
        "code": "mobility_frame",
        "name": "Mobility Frame",
        "item_type": "equipment",
        "cost": 250,
        "icon_url": "/static/items/mobility_frame.webp",
        "damage_boost": 0,
    },
    {
        "code": "neural_cap",
        "name": "Neural Cap",
        "item_type": "equipment",
        "cost": 100,
        "icon_url": "/static/items/neural_cap.webp",
        "damage_boost": 0,
    },
]

for it in items:
    Item.objects.create(**it)

print("Items created successfully.")
