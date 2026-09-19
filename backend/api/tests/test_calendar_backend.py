"""
Calendar/Tasks backend fixes (see the calendar audit):

  * Completing a Todo that has a due_date used to be an HTTP 500 (a datetime was
    subtracted from the DateField).
  * The default paginator was a hard 25 and the calendar/dashboard only read
    `.results`, so the 26th task/event vanished; clients can now ask for a
    bigger page.
  * GET /tasks/ cost ~9 queries per task (a fresh profile + stat recompute per
    row); all rows belong to request.user, so one shared profile is enough.
  * Dailies can repeat every N weeks / until a date (A/B weeks, semesters).
  * Calendar events reject end <= start and support all-day.
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.models import CalendarEvent, Task, UserProfile
from api.services.task_service import complete_task, is_daily_scheduled_for_date

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="cal_backend", password="pass")
    profile = getattr(u, "profile", None) or UserProfile.objects.get_or_create(user=u)[0]
    profile.is_premium = True
    profile.save(update_fields=["is_premium"])
    return u


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
@pytest.mark.parametrize("delta_days", [-3, 0, 5])
def test_completing_a_todo_with_a_due_date_works(user, delta_days):
    due = datetime.date.today() + datetime.timedelta(days=delta_days)
    todo = Task.objects.create(
        user=user, title="Deadline task", task_type=Task.TaskType.TODO, due_date=due
    )
    result = complete_task(user, todo.id, True)  # used to raise TypeError -> 500
    assert result["detail"] == "Task completed!"
    todo.refresh_from_db()
    assert todo.is_completed is True


@pytest.mark.django_db
def test_lists_can_be_fetched_past_the_default_page(client, user):
    for i in range(30):
        Task.objects.create(user=user, title=f"t{i}", task_type=Task.TaskType.TODO)
    default = client.get("/api/tasks/").json()
    assert len(default["results"]) == 25 and default["count"] == 30

    everything = client.get("/api/tasks/?page_size=100").json()
    assert len(everything["results"]) == 30


@pytest.mark.django_db
def test_task_list_query_count_does_not_scale_with_rows(client, user, django_assert_max_num_queries):
    def make(n):
        for i in range(n):
            Task.objects.create(user=user, title=f"h{i}", task_type=Task.TaskType.HABIT)
            Task.objects.create(user=user, title=f"d{i}", task_type=Task.TaskType.DAILY)

    make(3)
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as small:
        assert client.get("/api/tasks/?page_size=100").status_code == 200
    make(10)
    with CaptureQueriesContext(connection) as large:
        assert client.get("/api/tasks/?page_size=100").status_code == 200

    # 6 rows -> 26 rows: the old N+1 added ~9 queries per task (~180 more).
    assert len(large) - len(small) <= 25, (len(small), len(large))


@pytest.mark.django_db
def test_daily_repeats_every_other_week_and_until(user):
    monday = datetime.date(2026, 9, 14)  # a Monday
    daily = Task.objects.create(
        user=user, title="Lecture (A-week)", task_type=Task.TaskType.DAILY,
        repeat_weekdays=0b0000001, repeat_interval_weeks=2,
        repeat_start_date=monday, repeat_until=datetime.date(2026, 10, 12),
    )
    assert is_daily_scheduled_for_date(daily, monday)                                    # week 0
    assert not is_daily_scheduled_for_date(daily, monday + datetime.timedelta(days=7))   # week 1: off
    assert is_daily_scheduled_for_date(daily, monday + datetime.timedelta(days=14))      # week 2: on
    assert not is_daily_scheduled_for_date(daily, monday - datetime.timedelta(days=14))  # before the anchor
    assert is_daily_scheduled_for_date(daily, datetime.date(2026, 10, 12))               # last allowed day
    assert not is_daily_scheduled_for_date(daily, datetime.date(2026, 10, 26))           # past repeat_until
    assert not is_daily_scheduled_for_date(daily, monday + datetime.timedelta(days=1))   # wrong weekday


@pytest.mark.django_db
def test_interval_task_created_via_api_anchors_on_its_creation_week(client, user):
    res = client.post(
        "/api/tasks/",
        {"title": "Seminar", "task_type": "daily", "repeat_weekdays": 127,
         "repeat_interval_weeks": 2},
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.json()["repeat_start_date"]  # anchored, so the first week is an "on" week
    bad = client.post(
        "/api/tasks/",
        {"title": "x", "task_type": "daily", "repeat_interval_weeks": 99},
        format="json",
    )
    assert bad.status_code == 400


@pytest.mark.django_db
def test_calendar_event_validation_and_all_day(client, user):
    ok = client.post(
        "/api/calendar/events/",
        {"title": "Lecture", "date": "2026-09-21", "start_time": "10:00", "end_time": "11:30"},
        format="json",
    )
    assert ok.status_code == 201, ok.data

    for start, end in (("22:00", "02:00"), ("09:00", "09:00"), ("09:00", "00:00")):
        bad = client.post(
            "/api/calendar/events/",
            {"title": "bad", "date": "2026-09-21", "start_time": start, "end_time": end},
            format="json",
        )
        assert bad.status_code == 400, (start, end)

    allday = client.post(
        "/api/calendar/events/",
        {"title": "Exam week", "date": "2026-09-22", "all_day": True},
        format="json",
    )
    assert allday.status_code == 201, allday.data
    assert allday.json()["start_time"] == "00:00:00" and allday.json()["all_day"] is True


@pytest.mark.django_db
def test_calendar_events_are_not_paginated_and_can_be_range_filtered(client, user):
    for day in range(1, 31):
        CalendarEvent.objects.create(
            user=user, title=f"e{day}", date=datetime.date(2026, 9, day),
            start_time=datetime.time(9), end_time=datetime.time(10),
        )
    everything = client.get("/api/calendar/events/").json()
    assert isinstance(everything, list) and len(everything) == 30  # used to stop at 25

    ranged = client.get("/api/calendar/events/?from=2026-09-10&to=2026-09-12").json()
    assert [e["title"] for e in ranged] == ["e10", "e11", "e12"]


# ── ICS feed, Daily history, reminders, timezone fixes ────────────────────────
import zoneinfo
from unittest import mock

from django.utils import timezone as dj_timezone

from api.models import PushSubscription, UserActivityLog


@pytest.mark.django_db
def test_ics_feed_is_a_real_private_subscription(client, user):
    profile = user.profile
    profile.timezone = "Europe/Berlin"
    profile.save(update_fields=["timezone"])

    CalendarEvent.objects.create(
        user=user, title="Analysis, Übung; Raum H12", description="Line1\nLine2",
        date=datetime.date(2026, 9, 21), start_time=datetime.time(10), end_time=datetime.time(11, 30),
    )
    CalendarEvent.objects.create(
        user=user, title="Exam week", date=datetime.date(2026, 9, 28),
        start_time=datetime.time(0), end_time=datetime.time(23, 59), all_day=True,
    )
    Task.objects.create(
        user=user, title="Lecture A-week", task_type=Task.TaskType.DAILY,
        show_in_calendar=True, scheduled_time=datetime.time(8, 30),
        scheduled_end_time=datetime.time(10, 0), repeat_weekdays=0b0000101,  # Mon + Wed
        repeat_interval_weeks=2, repeat_start_date=datetime.date(2026, 9, 14),
        repeat_until=datetime.date(2026, 12, 18),
    )
    Task.objects.create(
        user=user, title="Hand in Hausarbeit", task_type=Task.TaskType.TODO,
        due_date=datetime.date(2026, 10, 5),
    )
    Task.objects.create(  # completed deadlines are not published
        user=user, title="Done already", task_type=Task.TaskType.TODO,
        due_date=datetime.date(2026, 10, 6), is_completed=True,
    )

    info = client.get("/api/calendar/feed-info/")
    assert info.status_code == 200
    url = info.json()["url"]
    assert url.endswith(".ics") and "/api/calendar/feed/" in url
    path = url.split("testserver", 1)[1]

    anon = APIClient()  # a calendar app has no login
    res = anon.get(path)
    assert res.status_code == 200
    assert res["Content-Type"].startswith("text/calendar")
    body = res.content.decode("utf-8")
    assert body.startswith("BEGIN:VCALENDAR") and body.rstrip().endswith("END:VCALENDAR")
    assert "SUMMARY:Analysis\\, Übung\\; Raum H12" in body  # RFC 5545 escaping
    assert "DESCRIPTION:Line1\\nLine2" in body
    assert "DTSTART;TZID=Europe/Berlin:20260921T100000" in body
    assert "DTSTART;VALUE=DATE:20260928" in body and "DTEND;VALUE=DATE:20260929" in body
    assert "RRULE:FREQ=WEEKLY;WKST=MO;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261218" in body
    assert "SUMMARY:Deadline: Hand in Hausarbeit" in body
    assert "Done already" not in body
    for physical_line in body.split("\r\n"):
        assert len(physical_line.encode("utf-8")) <= 75, physical_line

    # Rotating the token revokes the old URL.
    new = client.post("/api/calendar/feed-info/").json()["url"]
    assert new != url
    assert anon.get(path).status_code == 404
    assert anon.get(new.split("testserver", 1)[1]).status_code == 200


@pytest.mark.django_db
def test_ics_feed_is_premium_only_and_rejects_unknown_tokens(client, user):
    url = client.get("/api/calendar/feed-info/").json()["url"].split("testserver", 1)[1]
    assert APIClient().get("/api/calendar/feed/" + "x" * 43 + ".ics").status_code == 404
    assert APIClient().get("/api/calendar/feed/short.ics").status_code == 404

    profile = user.profile
    profile.is_premium = False
    profile.save(update_fields=["is_premium"])
    assert APIClient().get(url).status_code == 404
    free = APIClient()
    free.force_authenticate(user=User.objects.get(pk=user.pk))
    assert free.get("/api/calendar/feed-info/").status_code == 403


@pytest.mark.django_db
def test_daily_history_buckets_by_the_local_day_of_the_user(client, user):
    profile = user.profile
    profile.timezone = "America/New_York"  # UTC-4 in September
    profile.save(update_fields=["timezone"])
    daily = Task.objects.create(user=user, title="Read", task_type=Task.TaskType.DAILY)

    # 02:30 UTC on the 19th is still the evening of the 18th in New York.
    log = UserActivityLog.objects.create(
        user=user, task=daily, activity_type=UserActivityLog.ActivityType.DAILY, title="Read"
    )
    UserActivityLog.objects.filter(pk=log.pk).update(
        created_at=datetime.datetime(2026, 9, 19, 2, 30, tzinfo=datetime.timezone.utc)
    )

    res = client.get("/api/calendar/daily-history/?from=2026-09-17&to=2026-09-20")
    assert res.status_code == 200
    assert res.json() == {"2026-09-18": [daily.id]}
    assert client.get("/api/calendar/daily-history/?from=bad&to=2026-09-20").status_code == 400
    assert client.get("/api/calendar/daily-history/?from=2026-09-20&to=2026-09-01").status_code == 400


@pytest.mark.django_db
def test_deadline_reminder_is_sent_once_per_local_day(user):
    from api.services import push_service

    tokyo = zoneinfo.ZoneInfo("Asia/Tokyo")
    profile = user.profile
    profile.timezone = "Asia/Tokyo"
    profile.save(update_fields=["timezone"])
    PushSubscription.objects.create(user=user, endpoint="https://push.example/1", p256dh="k", auth="a")
    today_local = dj_timezone.now().astimezone(tokyo).date()
    Task.objects.create(user=user, title="Due today", task_type=Task.TaskType.TODO, due_date=today_local)
    Task.objects.create(user=user, title="Late", task_type=Task.TaskType.TODO,
                        due_date=today_local - datetime.timedelta(days=2))
    Task.objects.create(user=user, title="Far away", task_type=Task.TaskType.TODO,
                        due_date=today_local + datetime.timedelta(days=30))

    hour_now = dj_timezone.now().astimezone(tokyo).hour
    sent_payloads = []

    def fake_push(sub, payload):
        sent_payloads.append(payload)
        return True

    with mock.patch.object(push_service, "DEADLINE_REMINDER_HOUR", hour_now), \
         mock.patch.object(push_service, "send_web_push", fake_push):
        assert push_service.send_deadline_reminders() == 1
        assert push_service.send_deadline_reminders() == 0  # already sent today

    assert "1 overdue" in sent_payloads[0]["body"] and "1 due today" in sent_payloads[0]["body"]

    profile.refresh_from_db()
    assert profile.last_deadline_push_date == today_local

    profile.notification_preferences = {"deadline_reminder": False}
    profile.last_deadline_push_date = None
    profile.save()
    with mock.patch.object(push_service, "DEADLINE_REMINDER_HOUR", hour_now), \
         mock.patch.object(push_service, "send_web_push", fake_push):
        assert push_service.send_deadline_reminders() == 0  # opted out


@pytest.mark.django_db
def test_meal_reminder_uses_the_local_hour_of_the_user(user):
    from api.models import NutriGoal
    from api.services import push_service

    tz = zoneinfo.ZoneInfo("Pacific/Kiritimati")  # UTC+14: local hour never equals the UTC hour
    profile = user.profile
    profile.timezone = "Pacific/Kiritimati"
    profile.save(update_fields=["timezone"])
    PushSubscription.objects.create(user=user, endpoint="https://push.example/2", p256dh="k", auth="a")
    local_hour = dj_timezone.now().astimezone(tz).hour
    NutriGoal.objects.create(user=user, reminder_breakfast=datetime.time(local_hour, 0))

    with mock.patch.object(push_service, "send_web_push", lambda sub, payload: True):
        assert push_service.send_meal_reminders() == 1  # UTC-hour matching used to miss this


@pytest.mark.django_db
def test_weekly_reset_does_not_fire_twice_across_new_year(user):
    from api.services.daily_service import process_daily_login

    profile = user.profile
    profile.last_login_date = datetime.date(2025, 12, 28)
    profile.last_weekly_reset = "2025-W51"
    profile.ledger_gold = 100
    profile.save()

    def at(y, m, d):
        return datetime.datetime(y, m, d, 12, 0, tzinfo=datetime.timezone.utc)

    with mock.patch("django.utils.timezone.now", return_value=at(2025, 12, 29)):
        process_daily_login(user)  # Monday of ISO week 2026-W01: weekly reset pays the ledger out
    profile.refresh_from_db()
    assert profile.ledger_gold == 0 and profile.gold > 0

    profile.ledger_gold = 100
    profile.save(update_fields=["ledger_gold"])
    with mock.patch("django.utils.timezone.now", return_value=at(2026, 1, 1)):
        process_daily_login(user)  # Thursday of the SAME ISO week: must not reset again
    profile.refresh_from_db()
    assert profile.ledger_gold == 100  # untouched: no second weekly payout
