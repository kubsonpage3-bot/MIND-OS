from django.db import migrations
from django.db.models import Sum


def sync_rank_xp_with_history(apps, schema_editor):
    UserProfile = apps.get_model("api", "UserProfile")
    UserActivityLog = apps.get_model("api", "UserActivityLog")

    for profile in UserProfile.objects.all():
        if getattr(profile, "prestige_count", 0) > 0:
            continue
        history_xp = (
            UserActivityLog.objects.filter(user_id=profile.user_id)
            .exclude(activity_type__in=["daily_uncomplete", "todo_uncomplete"])
            .aggregate(Sum("xp_earned"))["xp_earned__sum"]
        )
        if history_xp is not None and history_xp > 0:
            profile.rank_xp = history_xp
            profile.save(update_fields=["rank_xp"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0098_fix_stale_daily_completions"),
    ]

    operations = [
        migrations.RunPython(
            sync_rank_xp_with_history,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
