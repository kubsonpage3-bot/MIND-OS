from django.db import migrations


def rebalance_consumables(apps, schema_editor):
    Item = apps.get_model("api", "Item")

    # 1. Hide duplicate medium health potion (health_potion / Elixir of Vitality)
    Item.objects.filter(code="health_potion").update(is_purchasable=False)

    # 2. Update consumable costs and descriptions
    updates = {
        "small_heal": {
            "cost": 25,
            "hp_boost": 25,
            "description": "Restores 25% of Max HP instantly.",
            "is_purchasable": True,
        },
        "medium_heal": {
            "cost": 60,
            "hp_boost": 50,
            "name": "Health Potion",
            "description": "Restores 50% of Max HP instantly.",
            "is_purchasable": True,
        },
        "large_heal": {
            "cost": 150,
            "hp_boost": 75,
            "name": "Mega Health Potion",
            "description": "Restores 75% of Max HP instantly.",
            "is_purchasable": True,
        },
        "elixir": {
            "cost": 500,
            "hp_boost": 9999,
            "name": "Elixir of Life",
            "description": "Restores HP to 100% and grants a protective shield for 24 hours.",
            "is_purchasable": True,
        },
        "daily_gold_rush": {
            "cost": 120,
            "name": "Gold Rush Booster",
            "description": "+50% Gold from all activities for 24 hours.",
            "is_purchasable": True,
        },
        "daily_xp_surge": {
            "cost": 150,
            "name": "XP Surge Scroll",
            "description": "+100% XP from all activities for 2 hours.",
            "is_purchasable": True,
        },
        "focus_scroll": {
            "cost": 160,
            "name": "Scroll of Focus",
            "description": "-50% skill cooldowns and +25% XP for 2 hours.",
            "is_purchasable": True,
        },
        "focus_stim": {
            "cost": 30,
            "is_purchasable": True,
        },
        "memory_patch": {
            "cost": 35,
            "is_purchasable": True,
        },
        "boss_damage_plus": {
            "cost": 60,
            "is_purchasable": True,
        },
        "xp_booster": {
            "cost": 80,
            "is_purchasable": True,
        },
        "streak_shield": {
            "cost": 200,
            "is_purchasable": True,
        },
    }

    for code, fields in updates.items():
        Item.objects.filter(code=code).update(**fields)


def reverse_rebalance(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0096_useractivitylog_add_achievement_boss_defeat"),
    ]

    operations = [
        migrations.RunPython(rebalance_consumables, reverse_rebalance),
    ]
