"""
Compact profile-stats + today's-Dailies summary for the native Android home
screen widgets (RPGStatsWidgetProvider, DailiesWidgetProvider,
DailySummaryWidgetProvider, QuickActionsWidgetProvider) -- NOT the browser.
Lets WidgetSyncWorker (WorkManager) keep those widgets live in the
background, the same way CalendarWidgetSyncWorker already does for the
Calendar widget, instead of only updating whenever the app happens to be
open.

Unlike the calendar feed, this isn't a Premium feature, so it's gated by
its own widget_sync_token (UserProfile.widget_sync_token) rather than the
Premium-only calendar_feed_token.

theme / avatar_res_name are deliberately left out: theme lives only in the
frontend's localStorage (no server column to read), and avatar_res_name is
already unused by RPGStatsWidgetProvider, which derives its own avatar
filename from class+rank. The native side merges this payload over its
existing cached mindos_profile rather than replacing it outright, so a
theme/avatar picked while the app was last open survives a background sync.
"""
import zoneinfo

from django.utils import timezone


def _user_tz(profile):
    try:
        return zoneinfo.ZoneInfo(getattr(profile, "timezone", None) or "UTC")
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def _daily_completed_today(task, today, tz) -> bool:
    """Mirrors TaskSerializer.to_representation's rule (serializers/tasks.py):
    a daily only counts as completed if last_completed_at actually falls on
    today in the user's own timezone -- trusting the raw is_completed flag
    alone would show yesterday's checkmark until the daily-rollover job runs
    for a user who hasn't opened the app yet."""
    if not task.is_completed or not task.last_completed_at:
        return False
    return task.last_completed_at.astimezone(tz).date() == today


def build_widget_sync_summary(user) -> dict:
    from api.models import Task
    from api.services.profile_service import get_rank_info

    profile = user.profile
    tz = _user_tz(profile)
    today = timezone.now().astimezone(tz).date()

    rank_info = get_rank_info(profile)
    thresholds = rank_info["thresholds"]
    current_idx = next(
        (i for i, t in enumerate(thresholds) if t["id"] == rank_info["current_id"]),
        0,
    )
    current_min = thresholds[current_idx]["min"]
    next_min = (
        thresholds[current_idx + 1]["min"]
        if current_idx < len(thresholds) - 1
        else 10000
    )

    stats = profile.total_stats
    profile_payload = {
        "hp": profile.hp,
        "max_hp": stats.get("hp_max", profile.max_hp),
        "mp": profile.mana,
        "max_mp": stats.get("mana_max", profile.max_mana),
        "xp": max(0, profile.rank_xp - current_min),
        "max_xp": max(1, next_min - current_min),
        "class": (profile.character_class or "wanderer").lower(),
        "rank": rank_info["current_id"],
        "gold": profile.gold,
        "sp": profile.skill_points,
        "streak": profile.streak,
        "level": profile.level,
        "username": profile.character_name or "",
    }

    # Same "all configured dailies, not just ones scheduled for today's
    # weekday" set the app's own open-app sync (Dashboard.jsx) already shows
    # in this widget -- background sync should never disagree with what the
    # app last displayed for the same data.
    dailies_payload = [
        {
            "id": task.id,
            "title": task.title,
            "completed": _daily_completed_today(task, today, tz),
            "category": task.category or "Other",
            "difficulty": task.difficulty,
            "streak": task.streak,
            "value": task.value,
        }
        for task in Task.objects.filter(user=user, task_type=Task.TaskType.DAILY)
    ]

    return {
        "profile": profile_payload,
        "dailies": dailies_payload,
        "generated_at": timezone.now().astimezone(zoneinfo.ZoneInfo("UTC")).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
    }
