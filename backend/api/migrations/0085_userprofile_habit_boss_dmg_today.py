"""
DIS-3 Migration: Add habit_boss_dmg_today to UserProfile.

Tracks cumulative boss damage dealt by Habit completions within the
current daily-reset window. Used to enforce DAILY_HABIT_DMG_CAP (498).
Resets to 0 in process_missed_tasks alongside habits_completed_today.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0084_recalculate_boss_damage"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="habit_boss_dmg_today",
            field=models.PositiveIntegerField(
                default=0,
                verbose_name="Суммарный boss dmg от Habits сегодня (DIS-3 cap)",
            ),
        ),
    ]
