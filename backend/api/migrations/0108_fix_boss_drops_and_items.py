import random
from django.db import migrations


def fix_boss_drops_and_items(apps, schema_editor):
    Item = apps.get_model("api", "Item")
    Boss = apps.get_model("api", "Boss")
    InventoryItem = apps.get_model("api", "InventoryItem")

    # 1. Alias / rename mask_of_the_nameless -> mask_nameless
    mask_old = Item.objects.filter(code="mask_of_the_nameless").first()
    mask_new = Item.objects.filter(code="mask_nameless").first()

    if mask_old and not mask_new:
        mask_old.code = "mask_nameless"
        mask_old.save()
    elif not mask_old and not mask_new:
        Item.objects.create(
            code="mask_nameless",
            name="Mask of the Nameless",
            slot_type="headware",
            item_type="equipment",
            gear_class="SSS",
            source="boss_drop",
            is_purchasable=False,
            cost=0,
            icon_url="/static/items/mask_nameless.webp",
        )

    RANK_TO_LEVEL = {
        1: "E",
        2: "D",
        3: "C",
        4: "B",
        5: "A",
        6: "S",
        7: "SS",
        8: "SSS",
    }

    BOSS_RANK_STATS = {
        "E": {"count": 1, "min": 1, "max": 1},
        "D": {"count": 1, "min": 1, "max": 2},
        "C": {"count": 2, "min": 2, "max": 2},
        "B": {"count": 2, "min": 2, "max": 3},
        "A": {"count": 3, "min": 3, "max": 3},
        "S": {"count": 3, "min": 3, "max": 4},
        "SS": {"count": 4, "min": 4, "max": 4},
        "SSS": {"count": 4, "min": 4, "max": 5},
    }
    POSSIBLE_STATS = ["pwr", "def", "foc", "mem", "spd", "lck"]

    # 2. Update all boss drop items with boss_rank and source
    for boss in Boss.objects.all():
        item_code = boss.drop_item_id
        if not item_code:
            continue

        item = Item.objects.filter(code=item_code).first()
        if not item:
            continue

        rank = RANK_TO_LEVEL.get(boss.level, "E")
        item.boss_rank = rank
        item.source = "boss_drop"
        item.is_purchasable = False
        item.save()

        # Backfill existing InventoryItem rows without stat_bonuses
        rules = BOSS_RANK_STATS[rank]
        for inv in InventoryItem.objects.filter(item=item):
            if not inv.stat_bonuses:
                chosen_stats = random.sample(POSSIBLE_STATS, rules["count"])
                inv.stat_bonuses = {
                    s: random.randint(rules["min"], rules["max"])
                    for s in chosen_stats
                }
                inv.save(update_fields=["stat_bonuses"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0107_remove_userachievement_and_cleanup_history"),
    ]

    operations = [
        migrations.RunPython(
            fix_boss_drops_and_items,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
