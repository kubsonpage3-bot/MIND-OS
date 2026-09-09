from django.db import migrations

REBALANCED_BOSS_XP = {
    # Rank A
    "faceless_king": 240,
    "ore_golem": 270,
    "wounded_moon": 300,
    # Rank S
    "choir_forgotten": 360,
    "bottomless_miser": 400,
    "winter_thorn": 450,
    # Rank SS
    "king_ashen_throne": 550,
    "eclipse_warden": 650,
    # Rank SSS
    "nameless_god": 850,
    "final_dusk": 1000,
}


def apply_boss_xp_rebalance(apps, schema_editor):
    Boss = apps.get_model("api", "Boss")
    for id_name, reward_xp in REBALANCED_BOSS_XP.items():
        Boss.objects.filter(id_name=id_name).update(reward_xp=reward_xp)


def rollback_boss_xp_rebalance(apps, schema_editor):
    Boss = apps.get_model("api", "Boss")
    previous_xp = {
        "faceless_king": 350,
        "ore_golem": 400,
        "wounded_moon": 450,
        "choir_forgotten": 750,
        "bottomless_miser": 850,
        "winter_thorn": 1000,
        "king_ashen_throne": 1400,
        "eclipse_warden": 1600,
        "nameless_god": 2400,
        "final_dusk": 2800,
    }
    for id_name, reward_xp in previous_xp.items():
        Boss.objects.filter(id_name=id_name).update(reward_xp=reward_xp)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0110_userprofile_hide_party_task_names"),
    ]

    operations = [
        migrations.RunPython(apply_boss_xp_rebalance, rollback_boss_xp_rebalance),
    ]
