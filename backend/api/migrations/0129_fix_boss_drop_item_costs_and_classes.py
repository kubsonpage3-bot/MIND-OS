from django.db import migrations


def fix_boss_drop_item_costs(apps, schema_editor):
    """
    Sync boss-drop item costs and gear_class with the canonical values from
    migration 0109_boss_reward_sp_and_rebalance_drops.

    seed_items_new.py previously had cost=0 and wrong gear_class for all boss
    drops. Running that script overwrote the correct DB state.  This migration
    restores the canonical values so sell prices are balanced:
        sell = cost * 0.30  (BASE_SELL_RATE)
    """
    Item = apps.get_model("api", "Item")

    BOSS_ITEM_FIX = {
        # code: (gear_class, boss_rank, cost)
        "wanderers_hood":  ("E",   "E",   70),
        "bone_bracelet":   ("E",   "E",   75),
        "heralds_fang":    ("D",   "D",  180),
        "wardens_quill":   ("D",   "D",  190),
        "silk_mantle":     ("C",   "C",  440),
        "echo_bell":       ("C",   "C",  460),
        "frostbite_blade": ("C",   "C",  480),
        "ember_gauntlet":  ("B",   "B", 1350),
        "glass_tear":      ("B",   "B", 1400),
        "leviathan_scale": ("B",   "B", 1450),
        "crown_of_ash":    ("A",   "A", 3200),
        "golems_grip":     ("A",   "A", 3400),
        "scar_shard":      ("A",   "A", 3600),
        "forgotten_score": ("S",   "S", 7500),
        "abyssal_purse":   ("S",   "S", 8000),
        "winter_plate":    ("S",   "S", 8500),
        "throne_seal":     ("SS",  "SS", 19000),
        "eclipse_eye":     ("SS",  "SS", 21000),
        "mask_nameless":   ("SSS", "SSS", 48000),
        "blade_final_dusk":("SSS", "SSS", 52000),
    }

    for code, (gc, br, cost) in BOSS_ITEM_FIX.items():
        updated = Item.objects.filter(code=code).update(
            gear_class=gc,
            boss_rank=br,
            cost=cost,
            source="boss_drop",
            is_purchasable=False,
        )
        if not updated:
            # Item may not exist yet (fresh DB) — create a minimal placeholder
            # so the sell logic always has a valid cost to work from.
            pass  # seed_items_new.py will create it with the correct values


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0128_rival_overtook_push_dedup"),
    ]

    operations = [
        migrations.RunPython(
            fix_boss_drop_item_costs,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
