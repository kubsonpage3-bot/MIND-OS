import pytest
from datetime import timedelta
import zoneinfo
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import Task, UserProfile, UserActivityLog
from api.services.task_service import (
    has_completed_any_daily_yesterday,
    get_yesterday_uncompleted_dailies,
    complete_yesterday_dailies,
    process_missed_tasks,
)


@pytest.fixture
def checkin_user():
    user = User.objects.create_user(username="checkin_tester", password="password123")
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={"timezone": "UTC", "hp": 100, "gold": 50, "rank_xp": 0},
    )
    profile.hp = 100
    profile.gold = 50
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_has_completed_any_daily_yesterday(checkin_user):
    user, profile = checkin_user
    yesterday = timezone.now().date() - timedelta(days=1)
    user_tz = zoneinfo.ZoneInfo("UTC")
    yesterday_dt = timezone.now().replace(hour=14, minute=0, second=0, microsecond=0) - timedelta(days=1)

    daily = Task.objects.create(
        user=user,
        title="Read Book",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
    )

    # 1. When 0 dailies done yesterday -> False
    assert has_completed_any_daily_yesterday(user, yesterday) is False

    # 2. When last_completed_at is set to yesterday -> True
    daily.last_completed_at = yesterday_dt
    daily.save()
    assert has_completed_any_daily_yesterday(user, yesterday) is True

    # 3. When daily was completed via UserActivityLog -> True even if task timestamp moved
    daily.last_completed_at = timezone.now()  # e.g. done again today
    daily.save()
    log = UserActivityLog.objects.create(
        user=user,
        activity_type=UserActivityLog.ActivityType.DAILY,
        task=daily,
        title=daily.title,
    )
    UserActivityLog.objects.filter(id=log.id).update(created_at=yesterday_dt)
    assert has_completed_any_daily_yesterday(user, yesterday) is True


@pytest.mark.django_db
def test_daily_checkin_view_logic(checkin_user):
    user, profile = checkin_user
    client = APIClient()
    client.force_authenticate(user=user)

    yesterday_dt = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0) - timedelta(days=1)

    task1 = Task.objects.create(
        user=user,
        title="Morning Workout",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        difficulty=Task.Difficulty.MEDIUM,
    )
    task2 = Task.objects.create(
        user=user,
        title="Meditate",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        difficulty=Task.Difficulty.MEDIUM,
    )

    # Case A: User completed ZERO dailies yesterday -> needs_checkin MUST be True
    response = client.get("/api/daily-checkin/")
    assert response.status_code == 200
    assert response.data["needs_checkin"] is True
    assert response.data["completed_any_yesterday"] is False
    assert len(response.data["dailies"]) == 2

    # Case B: User completed at least ONE daily yesterday -> needs_checkin MUST be False
    task1.last_completed_at = yesterday_dt
    task1.save()

    response = client.get("/api/daily-checkin/")
    assert response.status_code == 200
    assert response.data["needs_checkin"] is False
    assert response.data["completed_any_yesterday"] is True


@pytest.mark.django_db
def test_process_missed_tasks_does_not_wipe_last_completed_at(checkin_user):
    user, profile = checkin_user
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    yesterday_dt = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)

    profile.last_daily_cron_at = yesterday
    profile.save()

    daily = Task.objects.create(
        user=user,
        title="Daily Journal",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        is_completed=True,
        last_completed_at=yesterday_dt,
        streak=3,
    )

    # Run cron
    res = process_missed_tasks(user)
    assert res["fired"] is True

    daily.refresh_from_db()
    # Task should be reset to not completed for the new day
    assert daily.is_completed is False
    # But last_completed_at MUST be preserved so yesterday's completion is not forgotten
    assert daily.last_completed_at is not None
    assert daily.last_completed_at.date() == yesterday_dt.date()

    # Yesterday's uncompleted dailies list should NOT contain this task
    missed = get_yesterday_uncompleted_dailies(user)
    assert daily not in missed


@pytest.mark.django_db
def test_complete_yesterday_dailies_refunds_fail_damage(checkin_user):
    user, profile = checkin_user
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    profile.last_daily_cron_at = yesterday
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Yoga",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        is_completed=False,
        difficulty=Task.Difficulty.MEDIUM,
    )

    # 1. Cron runs, penalizes missed Yoga daily
    cron_res = process_missed_tasks(user)
    assert cron_res["fired"] is True
    profile.refresh_from_db()
    hp_after_cron = profile.hp
    assert hp_after_cron < 100  # Took fail damage

    # 2. User wakes up, opens modal and says "I actually completed Yoga yesterday!"
    checkin_res = complete_yesterday_dailies(user, completed_ids=[task.id])
    assert checkin_res["total_refund"] > 0
    assert checkin_res["total_xp"] > 0

    profile.refresh_from_db()
    # Damage should be refunded
    assert profile.hp > hp_after_cron
    # Streak should be incremented
    task.refresh_from_db()
    assert task.streak == 1
    # is_completed should be False so it's ready for today
    assert task.is_completed is False
