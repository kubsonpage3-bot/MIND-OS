"""
Minimal, dependency-free iCalendar (RFC 5545) writer for the MIND OS calendar
feed: manual events, scheduled Dailies (as weekly-recurring events honouring
"every N weeks" / "until") and open Todo deadlines (all-day).

Subscribe URL -> Google Calendar / Apple Calendar / Outlook / Thunderbird.
"""
import datetime
import zoneinfo

from django.utils import timezone

WEEKDAY_CODES = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")


def _escape(text) -> str:
    text = str(text or "")
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def _fold(line: str) -> str:
    """Fold a content line at 75 octets (continuation lines start with a space)."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, current, size = [], "", 0
    for ch in line:
        n = len(ch.encode("utf-8"))
        limit = 75 if not parts else 74  # continuation lines lose 1 octet to the space
        if size + n > limit:
            parts.append(current)
            current, size = "", 0
        current += ch
        size += n
    parts.append(current)
    return "\r\n ".join(parts)


def _dt_local(date: datetime.date, time: datetime.time) -> str:
    return f"{date:%Y%m%d}T{time:%H%M%S}"


def _user_tz(profile):
    try:
        return zoneinfo.ZoneInfo(getattr(profile, "timezone", None) or "UTC")
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def _first_scheduled_date(task, start: datetime.date) -> datetime.date:
    """First date on/after `start` the Daily is actually scheduled on."""
    from api.services.task_service import is_daily_scheduled_for_date

    for offset in range(0, 7 * (task.repeat_interval_weeks or 1) + 7):
        d = start + datetime.timedelta(days=offset)
        if is_daily_scheduled_for_date(task, d):
            return d
    return start


def build_calendar_ics(user, host_hint: str = "mind-os") -> str:
    from api.models import CalendarEvent, Task

    profile = getattr(user, "profile", None)
    tz = _user_tz(profile)
    tzid = getattr(tz, "key", "UTC")
    stamp = timezone.now().astimezone(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MIND OS//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:MIND OS",
        f"X-WR-TIMEZONE:{tzid}",
    ]

    def add_event(uid, summary, description="", color=None, extra=()):
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{uid}@{host_hint}")
        lines.append(f"DTSTAMP:{stamp}")
        lines.extend(extra)
        lines.append(f"SUMMARY:{_escape(summary)}")
        if description:
            lines.append(f"DESCRIPTION:{_escape(description)}")
        lines.append("END:VEVENT")

    # 1. Manual events
    for ev in CalendarEvent.objects.filter(user=user):
        if ev.all_day:
            end_day = ev.date + datetime.timedelta(days=1)
            extra = [
                f"DTSTART;VALUE=DATE:{ev.date:%Y%m%d}",
                f"DTEND;VALUE=DATE:{end_day:%Y%m%d}",
            ]
        else:
            extra = [
                f"DTSTART;TZID={tzid}:{_dt_local(ev.date, ev.start_time)}",
                f"DTEND;TZID={tzid}:{_dt_local(ev.date, ev.end_time)}",
            ]
        add_event(f"event-{ev.id}", ev.title, ev.description, extra=extra)

    # 2. Scheduled Dailies -> weekly recurring events
    dailies = Task.objects.filter(
        user=user,
        task_type=Task.TaskType.DAILY,
        show_in_calendar=True,
        scheduled_time__isnull=False,
    )
    for task in dailies:
        mask = task.repeat_weekdays if task.repeat_weekdays is not None else 127
        byday = ",".join(code for i, code in enumerate(WEEKDAY_CODES) if mask & (1 << i))
        if not byday:
            continue
        anchor = task.repeat_start_date or (
            task.created_at.astimezone(tz).date() if task.created_at else timezone.now().astimezone(tz).date()
        )
        first = _first_scheduled_date(task, anchor)
        start_t = task.scheduled_time
        end_t = task.scheduled_end_time
        if not end_t or end_t <= start_t:
            end_dt = datetime.datetime.combine(first, start_t) + datetime.timedelta(minutes=30)
            end_t = end_dt.time() if end_dt.date() == first else datetime.time(23, 59)
        rrule = f"RRULE:FREQ=WEEKLY;WKST=MO;INTERVAL={task.repeat_interval_weeks or 1};BYDAY={byday}"
        if task.repeat_until:
            rrule += f";UNTIL={task.repeat_until:%Y%m%d}"
        add_event(
            f"daily-{task.id}",
            task.title,
            task.notes or "",
            extra=[
                f"DTSTART;TZID={tzid}:{_dt_local(first, start_t)}",
                f"DTEND;TZID={tzid}:{_dt_local(first, end_t)}",
                rrule,
            ],
        )

    # 3. Open Todo deadlines -> all-day events
    for todo in Task.objects.filter(
        user=user, task_type=Task.TaskType.TODO, is_completed=False, due_date__isnull=False
    ):
        end_day = todo.due_date + datetime.timedelta(days=1)
        add_event(
            f"todo-{todo.id}",
            f"Deadline: {todo.title}",
            todo.notes or "",
            extra=[
                f"DTSTART;VALUE=DATE:{todo.due_date:%Y%m%d}",
                f"DTEND;VALUE=DATE:{end_day:%Y%m%d}",
            ],
        )

    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
