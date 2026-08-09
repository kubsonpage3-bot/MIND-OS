"""
DIS-2 Data Migration: Recalculate boss_damage for all non-Training tasks.

After v0.8.47 (BASE_XP 3→5), task.boss_damage = round(base_xp × 3.33) changed:
    trivial: 10 → 17
    easy:    30 → 50 (banker's round)
    medium:  50 → 83
    hard:   100 → 166 (banker's round)

Tasks created before the patch retain the old values in the DB.
This migration brings all non-Button (non-Training) tasks up to the new formula.

Scope:
- Task.task_type IN ('habit', 'daily', 'todo')
- Task.task_type = 'button' (Training) is intentionally excluded — its boss
  damage path goes through training_rewards(), not task_rewards(). DIS-3 handles it.

Safe to run on completed tasks: the old boss_damage on an already-completed task
has already been applied to BossEncounter.hp_current. We are only updating the
*template* value so the NEXT completion uses the correct number. We do NOT
revert or re-apply any past combat results.
"""

from django.db import migrations


DIFFICULTY_DMG = {
    "trivial": 17,
    "easy": 50,
    "medium": 83,
    "hard": 166,
}
DEFAULT_DMG = DIFFICULTY_DMG["medium"]


def recalculate_boss_damage(apps, schema_editor):
    Task = apps.get_model("api", "Task")

    tasks = Task.objects.filter(task_type__in=["habit", "daily", "todo"]).only(
        "id", "difficulty", "boss_damage", "task_type"
    )

    to_update = []
    for task in tasks.iterator(chunk_size=500):
        new_dmg = DIFFICULTY_DMG.get(task.difficulty, DEFAULT_DMG)
        if task.boss_damage != new_dmg:
            task.boss_damage = new_dmg
            to_update.append(task)

    if to_update:
        Task.objects.bulk_update(to_update, ["boss_damage"], batch_size=500)
        print(f"\n  [DIS-2] Updated boss_damage on {len(to_update)} tasks.")
    else:
        print("\n  [DIS-2] All tasks already up to date — nothing to change.")


def reverse_migration(apps, schema_editor):
    """
    Reverse is intentionally a no-op.
    We cannot safely restore pre-patch values without knowing which tasks
    existed before v0.8.47. Running backward does nothing — the old numbers
    were already wrong even before the patch (hard=100 was correct then,
    easy=30 was correct then), but there is no risk in keeping new values.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0083_party_v2_description_cap_quest_achievement"),
    ]

    operations = [
        migrations.RunPython(
            recalculate_boss_damage,
            reverse_code=reverse_migration,
        ),
    ]
