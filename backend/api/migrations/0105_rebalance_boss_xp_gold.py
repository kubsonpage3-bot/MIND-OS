from django.db import migrations

REBALANCED_BOSSES = {
    "misted_wanderer": {"reward_gold": 100, "reward_xp": 12},
    "nameless_bones": {"reward_gold": 120, "reward_xp": 15},
    "herald_jackal": {"reward_gold": 250, "reward_xp": 35},
    "ink_warden": {"reward_gold": 280, "reward_xp": 45},
    "weaving_shade": {"reward_gold": 450, "reward_xp": 70},
    "abyssal_bellringer": {"reward_gold": 500, "reward_xp": 75},
    "frost_executioner": {"reward_gold": 550, "reward_xp": 90},
    "ember_smith": {"reward_gold": 900, "reward_xp": 150},
    "sanctuary_weeper": {"reward_gold": 1000, "reward_xp": 165},
    "shallow_leviathan": {"reward_gold": 1100, "reward_xp": 180},
    "faceless_king": {"reward_gold": 2000, "reward_xp": 350},
    "ore_golem": {"reward_gold": 2300, "reward_xp": 400},
    "wounded_moon": {"reward_gold": 2600, "reward_xp": 450},
    "choir_forgotten": {"reward_gold": 4500, "reward_xp": 750},
    "bottomless_miser": {"reward_gold": 5500, "reward_xp": 850},
    "winter_thorn": {"reward_gold": 6500, "reward_xp": 1000},
    "king_ashen_throne": {"reward_gold": 10000, "reward_xp": 1400},
    "eclipse_warden": {"reward_gold": 12000, "reward_xp": 1600},
    "nameless_god": {"reward_gold": 20000, "reward_xp": 2400},
    "final_dusk": {"reward_gold": 24000, "reward_xp": 2800},
}


def apply_boss_rebalance(apps, schema_editor):
    Boss = apps.get_model("api", "Boss")
    for id_name, rewards in REBALANCED_BOSSES.items():
        Boss.objects.filter(id_name=id_name).update(
            reward_gold=rewards["reward_gold"],
            reward_xp=rewards["reward_xp"],
        )


def rollback_boss_rebalance(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0104_clear_kubsonmercer_mutators_and_fix_nuclear"),
    ]

    operations = [
        migrations.RunPython(apply_boss_rebalance, rollback_boss_rebalance),
    ]
