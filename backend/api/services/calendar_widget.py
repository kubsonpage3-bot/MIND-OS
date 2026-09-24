"""
Compact per-day JSON summary for a single month, consumed by the native
Android home-screen Calendar widget (CalendarWidgetProvider / the
WorkManager background sync job) -- NOT the browser. Reuses the exact same
data the in-app CalendarPanel and the ICS feed show, so the widget never
disagrees with the app.

Kept intentionally small (only days that have something) since it's fetched
over a background/possibly metered connection by a WorkManager job.
"""
import calendar
import datetime
import zoneinfo

from django.utils import timezone


def _user_tz(profile):
    try:
        return zoneinfo.ZoneInfo(getattr(profile, "timezone", None) or "UTC")
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def _parse_month(month_str, tz):
    """'YYYY-MM' -> (year, month), defaulting to the user's current local month."""
    if month_str:
        try:
            year, month = (int(p) for p in month_str.split("-", 1))
            if 1 <= month <= 12 and 1 <= year <= 9999:
                return year, month
        except (ValueError, TypeError):
            pass
    today = timezone.now().astimezone(tz).date()
    return today.year, today.month


def build_calendar_widget_summary(user, month_str=None) -> dict:
    from api.models import CalendarEvent, Task, UserActivityLog
    from api.services.task_service import is_daily_scheduled_for_date

    profile = getattr(user, "profile", None)
    tz = _user_tz(profile)
    today = timezone.now().astimezone(tz).date()
    year, month = _parse_month(month_str, tz)

    first_day = datetime.date(year, month, 1)
    days_in_month = calendar.monthrange(year, month)[1]
    last_day = datetime.date(year, month, days_in_month)

    days: dict = {}

    def bucket(d: datetime.date) -> dict:
        key = d.isoformat()
        return days.setdefault(
            key, {"events": [], "dailies_total": 0, "dailies_done": 0, "deadlines": []}
        )

    # 1. Manual events for this month.
    for ev in CalendarEvent.objects.filter(
        user=user, date__gte=first_day, date__lte=last_day
    ).order_by("start_time"):
        bucket(ev.date)["events"].append(
            {
                "title": ev.title,
                "color": ev.color or "#3b82f6",
                "all_day": bool(ev.all_day),
                "start_time": "" if ev.all_day else ev.start_time.strftime("%H:%M"),
            }
        )

    # 2. Scheduled Dailies -> every day in the month they actually occur on.
    # "Done" only has meaning for today (is_completed) or the past (activity
    # log); future occurrences are just shown as scheduled.
    dailies = list(
        Task.objects.filter(
            user=user,
            task_type=Task.TaskType.DAILY,
            show_in_calendar=True,
            scheduled_time__isnull=False,
        )
    )
    if dailies:
        past_done: dict = {}
        if first_day <= today:
            lower = datetime.datetime.combine(first_day, datetime.time.min, tzinfo=tz)
            upper_date = min(today, last_day) + datetime.timedelta(days=1)
            upper = datetime.datetime.combine(upper_date, datetime.time.min, tzinfo=tz)
            logs = UserActivityLog.objects.filter(
                user=user,
                activity_type=UserActivityLog.ActivityType.DAILY,
                task__isnull=False,
                created_at__gte=lower,
                created_at__lt=upper,
            ).values_list("task_id", "created_at")
            for task_id, created_at in logs:
                day_key = created_at.astimezone(tz).date().isoformat()
                past_done.setdefault(day_key, set()).add(task_id)

        d = first_day
        while d <= last_day:
            day_key = d.isoformat()
            for task in dailies:
                if not is_daily_scheduled_for_date(task, d):
                    continue
                b = bucket(d)
                b["dailies_total"] += 1
                if d == today:
                    if task.is_completed:
                        b["dailies_done"] += 1
                elif d < today:
                    if task.id in past_done.get(day_key, ()):
                        b["dailies_done"] += 1
            d += datetime.timedelta(days=1)

    # 3. Todo deadlines within the month (open or completed -- completed ones
    # are shown struck through rather than disappearing from the grid).
    for todo in Task.objects.filter(
        user=user,
        task_type=Task.TaskType.TODO,
        due_date__gte=first_day,
        due_date__lte=last_day,
    ):
        bucket(todo.due_date)["deadlines"].append(
            {"title": todo.title, "done": bool(todo.is_completed)}
        )

    return {
        "month": f"{year:04d}-{month:02d}",
        "today": today.isoformat(),
        "timezone": getattr(tz, "key", "UTC"),
        "generated_at": timezone.now().astimezone(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "days": days,
    }
