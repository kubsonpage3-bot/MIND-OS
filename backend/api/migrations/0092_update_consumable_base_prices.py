from django.db import migrations


def update_consumable_base_prices(apps, schema_editor):
    Item = apps.get_model("api", "Item")

    price_map = {
        "small_heal": 200,
        "focus_stim": 220,
        "memory_patch": 250,
        "medium_heal": 350,
        "health_potion": 350,
        "boss_damage_plus": 400,
        "xp_booster": 500,
        "large_heal": 650,
        "daily_gold_rush": 600,
        "streak_shield": 750,
        "daily_xp_surge": 900,
        "focus_scroll": 950,
        "elixir": 2000,
    }

    for code, cost in price_map.items():
        Item.objects.filter(code=code).update(cost=cost)


def reverse_consumable_base_prices(apps, schema_editor):
    Item = apps.get_model("api", "Item")

    old_price_map = {
        "small_heal": 25,
        "focus_stim": 30,
        "memory_patch": 35,
        "medium_heal": 60,
        "health_potion": 50,
        "boss_damage_plus": 60,
        "xp_booster": 80,
        "large_heal": 150,
        "daily_gold_rush": 110,
        "streak_shield": 200,
        "daily_xp_surge": 140,
        "focus_scroll": 160,
        "elixir": 500,
    }

    for code, cost in old_price_map.items():
        Item.objects.filter(code=code).update(cost=cost)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0091_nutrition_overhaul"),
    ]

    operations = [
        migrations.RunPython(
            update_consumable_base_prices, reverse_consumable_base_prices
        ),
    ]
