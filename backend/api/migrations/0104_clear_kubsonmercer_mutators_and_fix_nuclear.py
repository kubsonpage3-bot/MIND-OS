from django.db import migrations
from django.db.models import Q


def clear_kubsonmercer_mutators(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("api", "UserProfile")

    users = User.objects.filter(
        Q(username__iexact="KubsonMercer")
        | Q(username__iexact="kubsonmercer")
        | Q(username__icontains="kubson")
        | Q(email__icontains="kubson")
    )

    for u in users:
        profile = UserProfile.objects.filter(user=u).first()
        if profile:
            profile.active_mutators = {"purchased": [], "active": []}
            profile.last_mutator_tick_at = None
            profile.tasks_completed_today = 0
            profile.habits_completed_today = 0
            profile.habit_boss_dmg_today = 0
            profile.todos_completed_today = 0
            profile.dailies_completed_today = 0
            profile.save(
                update_fields=[
                    "active_mutators",
                    "last_mutator_tick_at",
                    "tasks_completed_today",
                    "habits_completed_today",
                    "habit_boss_dmg_today",
                    "todos_completed_today",
                    "dailies_completed_today",
                ]
            )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0103_sync_habit_negative_history_and_hp"),
    ]

    operations = [
        migrations.RunPython(
            clear_kubsonmercer_mutators,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
