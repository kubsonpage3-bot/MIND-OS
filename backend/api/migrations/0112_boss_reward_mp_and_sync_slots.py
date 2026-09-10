from django.db import migrations, models


def populate_boss_reward_mp_and_sync_slots(apps, schema_editor):
    Boss = apps.get_model("api", "Boss")
    Item = apps.get_model("api", "Item")

    BOSS_MP_MAP = {
        "misted_wanderer": 10,
        "nameless_bones": 10,
        "herald_jackal": 15,
        "ink_warden": 15,
        "abyssal_bellringer": 20,
        "frost_executioner": 20,
        "weaving_shade": 20,
        "ember_smith": 30,
        "sanctuary_weeper": 30,
        "shallow_leviathan": 30,
        "faceless_king": 50,
        "ore_golem": 50,
        "wounded_moon": 50,
        "choir_forgotten": 80,
        "bottomless_miser": 80,
        "winter_thorn": 80,
        "king_ashen_throne": 120,
        "eclipse_warden": 120,
        "nameless_god": 200,
        "final_dusk": 200,
    }

    for id_name, mp in BOSS_MP_MAP.items():
        Boss.objects.filter(id_name=id_name).update(reward_mp=mp)

    SLOT_UPDATES = {
        "echo_bell": "offhand",
        "glass_tear": "neural_link",
        "scar_shard": "ring2",
        "forgotten_score": "offhand",
        "abyssal_purse": "ring2",
        "throne_seal": "ring1",
        "heralds_fang": "neural_link",
        "wardens_quill": "offhand",
    }

    for code, slot in SLOT_UPDATES.items():
        Item.objects.filter(code=code).update(slot_type=slot)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0111_rebalance_boss_xp_scaling"),
    ]

    operations = [
        migrations.AddField(
            model_name="boss",
            name="reward_mp",
            field=models.PositiveIntegerField(
                default=10, verbose_name="Награда (MP)"
            ),
        ),
        migrations.RunPython(
            populate_boss_reward_mp_and_sync_slots,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
