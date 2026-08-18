"""
0086_recalculate_task_rewards.py

Data migration: recalculate xp_reward, gold_reward, boss_damage for all
existing non-BUTTON Task rows to match the v0.8.53 balance anchor:

    trivial -> xp: 3,  gold: 2,  dmg: 10
    easy    -> xp: 6,  gold: 3,  dmg: 20
    medium  -> xp: 12, gold: 6,  dmg: 40
    hard    -> xp: 24, gold: 12, dmg: 80

BUTTON tasks are excluded -- their per-session rewards are calculated
dynamically in training_rewards() and do NOT live in these columns.
"""

from django.db import migrations


TIER_REWARDS = {
    "trivial": {"xp": 3, "gold": 2, "dmg": 10},
    "easy": {"xp": 6, "gold": 3, "dmg": 20},
    "medium": {"xp": 12, "gold": 6, "dmg": 40},
    "hard": {"xp": 24, "gold": 12, "dmg": 80},
}

BUTTON_TYPE = "button"


def recalculate_task_rewards(apps, schema_editor):
    Task = apps.get_model("api", "Task")

    for tier, rewards in TIER_REWARDS.items():
        updated = (
            Task.objects.filter(
                difficulty=tier,
            )
            .exclude(
                task_type=BUTTON_TYPE,
            )
            .update(
                xp_reward=rewards["xp"],
                gold_reward=rewards["gold"],
                boss_damage=rewards["dmg"],
            )
        )
        print(
            f"  [{tier}] Updated {updated} tasks -> xp={rewards['xp']}, gold={rewards['gold']}, dmg={rewards['dmg']}"
        )

    # Fallback: tasks with unknown difficulty default to medium
    unknown_updated = (
        Task.objects.exclude(difficulty__in=TIER_REWARDS.keys())
        .exclude(
            task_type=BUTTON_TYPE,
        )
        .update(
            xp_reward=TIER_REWARDS["medium"]["xp"],
            gold_reward=TIER_REWARDS["medium"]["gold"],
            boss_damage=TIER_REWARDS["medium"]["dmg"],
        )
    )
    if unknown_updated:
        print(f"  [unknown->medium] Updated {unknown_updated} tasks")


def reverse_recalculate_task_rewards(apps, schema_editor):
    """Restore old values (pre-v0.8.53) for rollback."""
    Task = apps.get_model("api", "Task")
    OLD_REWARDS = {
        "trivial": {"xp": 5, "gold": 2, "dmg": 17},
        "easy": {"xp": 15, "gold": 8, "dmg": 50},
        "medium": {"xp": 25, "gold": 12, "dmg": 83},
        "hard": {"xp": 50, "gold": 25, "dmg": 166},
    }
    for tier, rewards in OLD_REWARDS.items():
        Task.objects.filter(
            difficulty=tier,
        ).exclude(
            task_type=BUTTON_TYPE,
        ).update(
            xp_reward=rewards["xp"],
            gold_reward=rewards["gold"],
            boss_damage=rewards["dmg"],
        )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0085_userprofile_habit_boss_dmg_today"),
    ]

    operations = [
        migrations.RunPython(
            recalculate_task_rewards,
            reverse_code=reverse_recalculate_task_rewards,
        ),
    ]
