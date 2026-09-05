from django.db import migrations


def remove_memory_patch_forever(apps, schema_editor):
    Item = apps.get_model("api", "Item")
    InventoryItem = apps.get_model("api", "InventoryItem")

    # Delete memory_patch from inventory
    InventoryItem.objects.filter(item__code="memory_patch").delete()

    # Delete memory_patch item entirely
    Item.objects.filter(code="memory_patch").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0099_sync_user_rank_xp"),
    ]

    operations = [
        migrations.RunPython(
            remove_memory_patch_forever,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
