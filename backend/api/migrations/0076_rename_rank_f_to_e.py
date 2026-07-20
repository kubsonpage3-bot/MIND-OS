from django.db import migrations


def rename_rank_f_to_e(apps, schema_editor):
    """Update all existing records that use rank 'F' to use 'E' instead."""
    Item = apps.get_model("api", "Item")
    updated_items = Item.objects.filter(boss_rank="F").update(boss_rank="E")
    print(f"  Updated {updated_items} Item boss_rank records from F to E")


def reverse_rename_rank_e_to_f(apps, schema_editor):
    """Reverse: rename rank 'E' back to 'F'."""
    Item = apps.get_model("api", "Item")
    Item.objects.filter(boss_rank="E").update(boss_rank="F")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0075_userstats_tracking_fields"),
    ]

    operations = [
        migrations.RunPython(
            rename_rank_f_to_e,
            reverse_code=reverse_rename_rank_e_to_f,
        ),
    ]
