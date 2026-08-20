from django.db import migrations


def seed_consumables(apps, schema_editor):
    Item = apps.get_model("api", "Item")

    consumables = [
        {
            "code": "small_heal",
            "name": "Small Health Potion",
            "description": "Restores 20 HP instantly.",
            "item_type": "consumable",
            "cost": 25,
            "hp_boost": 20,
            "icon_url": "/static/items/small_heal.webp",
            "is_purchasable": True,
            "gear_class": "E",
        },
        {
            "code": "medium_heal",
            "name": "Health Potion",
            "description": "Restores 50 HP instantly.",
            "item_type": "consumable",
            "cost": 60,
            "hp_boost": 50,
            "icon_url": "/static/items/medium_heal.webp",
            "is_purchasable": True,
            "gear_class": "D",
        },
        {
            "code": "health_potion",
            "name": "Elixir of Vitality",
            "description": "Restores +50 HP instantly.",
            "item_type": "consumable",
            "cost": 50,
            "hp_boost": 50,
            "icon_url": "/static/items/health_potion.webp",
            "is_purchasable": True,
            "gear_class": "D",
        },
        {
            "code": "large_heal",
            "name": "Mega Health Potion",
            "description": "Restores 100 HP instantly.",
            "item_type": "consumable",
            "cost": 150,
            "hp_boost": 100,
            "icon_url": "/static/items/large_heal.webp",
            "is_purchasable": True,
            "gear_class": "C",
        },
        {
            "code": "elixir",
            "name": "Elixir of Life",
            "description": "Restores HP to 100% and grants 10 minutes of complete damage immunity.",
            "item_type": "consumable",
            "cost": 500,
            "hp_boost": 9999,
            "icon_url": "/static/items/elixir.webp",
            "is_purchasable": True,
            "gear_class": "B",
        },
        {
            "code": "focus_stim",
            "name": "Focus Stim",
            "description": "Grants +30% Focus multiplier for your next Focus Session.",
            "item_type": "consumable",
            "cost": 30,
            "hp_boost": 0,
            "icon_url": "/static/items/focus_stim.webp",
            "is_purchasable": True,
            "gear_class": "E",
        },
        {
            "code": "memory_patch",
            "name": "Memory Patch",
            "description": "Instantly boosts your Growth Coefficient (Gc) by +0.2.",
            "item_type": "consumable",
            "cost": 35,
            "hp_boost": 0,
            "icon_url": "/static/items/memory_patch.webp",
            "is_purchasable": True,
            "gear_class": "E",
        },
        {
            "code": "boss_damage_plus",
            "name": "Boss Damage+",
            "description": "Deals +50% damage to the boss in your next Focus Session.",
            "item_type": "consumable",
            "cost": 60,
            "hp_boost": 0,
            "icon_url": "/static/items/boss_damage_plus.webp",
            "is_purchasable": True,
            "gear_class": "D",
        },
        {
            "code": "xp_booster",
            "name": "XP Booster",
            "description": "Grants +50% XP from all sources for 24 hours.",
            "item_type": "consumable",
            "cost": 80,
            "hp_boost": 0,
            "icon_url": "/static/items/xp_booster.webp",
            "is_purchasable": True,
            "gear_class": "D",
        },
        {
            "code": "streak_shield",
            "name": "Streak Shield",
            "description": "Automatically protects your daily streak from breaking once if you miss a day.",
            "item_type": "consumable",
            "cost": 200,
            "hp_boost": 0,
            "icon_url": "/static/items/streak_shield.webp",
            "is_purchasable": True,
            "gear_class": "C",
        },
        {
            "code": "daily_xp_surge",
            "name": "XP Surge Scroll",
            "description": "+100% XP gain for 2h.",
            "item_type": "consumable",
            "cost": 140,
            "hp_boost": 0,
            "icon_url": "/static/items/daily_xp_surge.webp",
            "is_purchasable": True,
            "gear_class": "B",
        },
        {
            "code": "daily_gold_rush",
            "name": "Gold Rush Token",
            "description": "Instantly grants +200 Gold.",
            "item_type": "consumable",
            "cost": 110,
            "hp_boost": 0,
            "icon_url": "/static/items/daily_gold_rush.webp",
            "is_purchasable": True,
            "gear_class": "C",
        },
        {
            "code": "focus_scroll",
            "name": "Scroll of Focus",
            "description": "Reduces cooldowns & +25% XP.",
            "item_type": "consumable",
            "cost": 160,
            "hp_boost": 0,
            "icon_url": "/static/items/focus_scroll.webp",
            "is_purchasable": True,
            "gear_class": "B",
        },
    ]

    for item_data in consumables:
        obj, created = Item.objects.get_or_create(
            code=item_data["code"],
            defaults=item_data,
        )
        if not created:
            for k, v in item_data.items():
                setattr(obj, k, v)
            obj.save()


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0087_remove_bossencounter_idle_tick"),
    ]

    operations = [
        migrations.RunPython(seed_consumables, reverse_seed),
    ]
