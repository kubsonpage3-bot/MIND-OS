from django.db import migrations


def sync_all_zero_damage_penalties(apps, schema_editor):
    UserActivityLog = apps.get_model("api", "UserActivityLog")
    UserProfile = apps.get_model("api", "UserProfile")

    zero_logs = UserActivityLog.objects.filter(
        activity_type="habit_neg",
        hp_lost=0,
    )
    user_deductions = {}
    for log in zero_logs:
        diff = getattr(log, "difficulty", "medium") or "medium"
        dmg = 2 if diff in ["medium", "hard", "critical"] else 1
        log.hp_lost = dmg
        if isinstance(log.metadata, dict):
            penalty = log.metadata.get("penalty")
            if isinstance(penalty, dict):
                penalty["hp"] = -dmg
            else:
                log.metadata["penalty"] = {"hp": -dmg}
        else:
            log.metadata = {"penalty": {"hp": -dmg}}
        log.save(update_fields=["hp_lost", "metadata"])
        user_deductions[log.user_id] = user_deductions.get(log.user_id, 0) + dmg

    for user_id, total_lost in user_deductions.items():
        profile = UserProfile.objects.filter(user_id=user_id).first()
        if profile and total_lost > 0:
            profile.hp = max(1, profile.hp - total_lost)
            profile.save(update_fields=["hp"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0102_userprofile_last_mutator_tick_at"),
    ]

    operations = [
        migrations.RunPython(
            sync_all_zero_damage_penalties,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
