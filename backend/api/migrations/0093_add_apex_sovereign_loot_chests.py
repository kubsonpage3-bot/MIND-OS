from django.db import migrations, models

def seed_all_loot_chests(apps, schema_editor):
    LootChest = apps.get_model("api", "LootChest")
    chest_defs = [
        {
            "chest_type": "standard_cache",
            "name": "Standard Cache",
            "description": "A battered container of unknown origin. Common finds, rare surprises.",
            "cost_gold": 100,
            "drop_rates": {"E": 50, "D": 35, "C": 12, "B": 2.5, "A": 0.5, "S": 0},
            "icon_url": "/static/items/standard_cache.webp",
        },
        {
            "chest_type": "quantum_safe",
            "name": "Quantum Safe",
            "description": "Sealed with a lock that does not exist in three dimensions.",
            "cost_gold": 500,
            "drop_rates": {
                "E": 15,
                "D": 45,
                "C": 25,
                "B": 12,
                "A": 2.5,
                "S": 0.5,
                "SS": 0,
                "SSS": 0,
            },
            "icon_url": "/static/items/quantum_safe.webp",
        },
        {
            "chest_type": "apex_vault",
            "name": "Apex Vault",
            "description": "Reinforced cybernetic container housing refined mid-to-high tier tactical gear.",
            "cost_gold": 1800,
            "drop_rates": {
                "E": 0,
                "D": 5,
                "C": 25,
                "B": 45,
                "A": 20,
                "S": 4,
                "SS": 1,
                "SSS": 0,
            },
            "icon_url": "/static/items/apex_vault.webp",
        },
        {
            "chest_type": "sovereign_reliquary",
            "name": "Sovereign Reliquary",
            "description": "Ancient cosmic vault pulsing with void resonance. Contains sovereign and godlike armaments.",
            "cost_gold": 6000,
            "drop_rates": {
                "E": 0,
                "D": 0,
                "C": 5,
                "B": 15,
                "A": 40,
                "S": 25,
                "SS": 12,
                "SSS": 3,
            },
            "icon_url": "/static/items/sovereign_reliquary.webp",
        },
    ]
    for cd in chest_defs:
        LootChest.objects.update_or_create(
            chest_type=cd["chest_type"],
            defaults=cd,
        )

def reverse_loot_chests(apps, schema_editor):
    LootChest = apps.get_model("api", "LootChest")
    LootChest.objects.filter(chest_type__in=["apex_vault", "sovereign_reliquary"]).delete()

class Migration(migrations.Migration):

    dependencies = [
        ("api", "0092_update_consumable_base_prices"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lootchest",
            name="chest_type",
            field=models.CharField(
                choices=[
                    ("standard_cache", "Standard Cache"),
                    ("quantum_safe", "Quantum Safe"),
                    ("apex_vault", "Apex Vault"),
                    ("sovereign_reliquary", "Sovereign Reliquary"),
                ],
                max_length=30,
                unique=True,
                verbose_name="Тип сундука",
            ),
        ),
        migrations.RunPython(seed_all_loot_chests, reverse_loot_chests),
    ]
