from django.db import migrations


def cleanup_consumables(apps, schema_editor):
    Item = apps.get_model("api", "Item")

    # 1. Remove memory_patch and daily_gold_rush from shop
    Item.objects.filter(code__in=["memory_patch", "daily_gold_rush"]).update(
        is_purchasable=False
    )

    # 2. Fix streak_shield description: protects character daily login streak, not habit streaks
    Item.objects.filter(code="streak_shield").update(
        description="Automatically protects your daily login streak from breaking once if you miss a day."
    )

    # 3. Fix elixir description: 10 minutes of immunity, not 24 hours
    Item.objects.filter(code="elixir").update(
        description="Restores HP to 100% and grants 10 minutes of complete damage immunity."
    )


def reverse_cleanup(apps, schema_editor):
    Item = apps.get_model("api", "Item")

    Item.objects.filter(code__in=["memory_patch", "daily_gold_rush"]).update(
        is_purchasable=True
    )
    Item.objects.filter(code="streak_shield").update(
        description="Automatically protects your daily streak from breaking once if you miss a day."
    )
    Item.objects.filter(code="elixir").update(
        description="Restores HP to 100% and grants 10 minutes of complete damage immunity."
    )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0096_useractivitylog_add_achievement_boss_defeat"),
    ]

    operations = [
        migrations.RunPython(cleanup_consumables, reverse_cleanup),
    ]
