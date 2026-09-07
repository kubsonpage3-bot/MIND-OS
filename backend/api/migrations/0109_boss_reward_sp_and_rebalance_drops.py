from django.db import migrations, models


def apply_boss_reward_sp_and_rebalance_drops(apps, schema_editor):
    Boss = apps.get_model("api", "Boss")
    Item = apps.get_model("api", "Item")

    BOSS_SP_MAP = {
        "misted_wanderer": 3,
        "nameless_bones": 3,
        "herald_jackal": 5,
        "ink_warden": 5,
        "abyssal_bellringer": 8,
        "frost_executioner": 8,
        "weaving_shade": 8,
        "ember_smith": 12,
        "sanctuary_weeper": 12,
        "shallow_leviathan": 12,
        "faceless_king": 18,
        "ore_golem": 18,
        "wounded_moon": 18,
        "choir_forgotten": 28,
        "bottomless_miser": 28,
        "winter_thorn": 28,
        "king_ashen_throne": 45,
        "eclipse_warden": 45,
        "nameless_god": 75,
        "final_dusk": 75,
    }

    for id_name, sp in BOSS_SP_MAP.items():
        Boss.objects.filter(id_name=id_name).update(reward_sp=sp)

    ITEM_REBALANCE = {
        # code: (gear_class, boss_rank, cost)
        "wanderers_hood": ("E", "E", 70),
        "bone_bracelet": ("E", "E", 75),
        "heralds_fang": ("D", "D", 180),
        "wardens_quill": ("D", "D", 190),
        "silk_mantle": ("C", "C", 440),
        "echo_bell": ("C", "C", 460),
        "frostbite_blade": ("C", "C", 480),
        "ember_gauntlet": ("B", "B", 1350),
        "glass_tear": ("B", "B", 1400),
        "leviathan_scale": ("B", "B", 1450),
        "crown_of_ash": ("A", "A", 3200),
        "golems_grip": ("A", "A", 3400),
        "scar_shard": ("A", "A", 3600),
        "forgotten_score": ("S", "S", 7500),
        "abyssal_purse": ("S", "S", 8000),
        "winter_plate": ("S", "S", 8500),
        "throne_seal": ("SS", "SS", 19000),
        "eclipse_eye": ("SS", "SS", 21000),
        "mask_nameless": ("SSS", "SSS", 48000),
        "blade_final_dusk": ("SSS", "SSS", 52000),
    }

    for code, (gc, br, cost) in ITEM_REBALANCE.items():
        Item.objects.filter(code=code).update(
            gear_class=gc, boss_rank=br, cost=cost, source="boss_drop"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0108_fix_boss_drops_and_items"),
    ]

    operations = [
        migrations.AddField(
            model_name="boss",
            name="reward_sp",
            field=models.PositiveIntegerField(
                default=3, verbose_name="Награда (SP)"
            ),
        ),
        migrations.RunPython(
            apply_boss_reward_sp_and_rebalance_drops,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
