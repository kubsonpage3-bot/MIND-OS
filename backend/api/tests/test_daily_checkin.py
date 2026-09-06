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
    user.date_joined = timezone.now() - timedelta(days=5)
    user.save()
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
    Task.objects.filter(id=daily.id).update(created_at=yesterday_dt - timedelta(days=1))

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
    Task.objects.filter(id__in=[task1.id, task2.id]).update(
        created_at=yesterday_dt - timedelta(days=1)
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

    # Case C: If profile.last_daily_checkin_at is today, needs_checkin MUST be False even if tasks missed
    task1.last_completed_at = None
    task1.save()
    profile.last_daily_checkin_at = timezone.now().date()
    profile.save()

    response = client.get("/api/daily-checkin/")
    assert response.status_code == 200
    assert response.data["needs_checkin"] is False

    # Case D: Skipping daily check-in marks last_daily_checkin_at = today
    profile.last_daily_checkin_at = None
    profile.save()
    skip_res = client.post("/api/daily-checkin/", {"action": "skip"})
    assert skip_res.status_code == 200
    assert skip_res.data["status"] == "skipped"

    profile.refresh_from_db()
    assert profile.last_daily_checkin_at == timezone.now().date()

    # And now get returns needs_checkin: False
    response = client.get("/api/daily-checkin/")
    assert response.data["needs_checkin"] is False


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
    Task.objects.filter(id=task.id).update(created_at=timezone.now() - timedelta(days=2))

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


@pytest.mark.django_db
def test_daily_task_serializer_is_completed_false_if_not_today(checkin_user):
    from api.serializers.tasks import TaskSerializer
    from api.services.task_service import complete_task

    user, profile = checkin_user
    yesterday_dt = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)

    # Task has is_completed=True in DB, but last_completed_at was yesterday
    stale_task = Task.objects.create(
        user=user,
        title="Brush Teeth",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        is_completed=True,
        last_completed_at=yesterday_dt,
    )

    # Serializer MUST report is_completed=False because it was not done today
    data = TaskSerializer(stale_task).data
    assert data["is_completed"] is False

    # When user sends uncomplete (is_positive=False), it must auto-heal and NOT throw 400
    res = complete_task(user, stale_task.id, is_positive=False)
    assert "detail" in res
    stale_task.refresh_from_db()
    assert stale_task.is_completed is False

    # Now user can complete it for today with is_positive=True
    res2 = complete_task(user, stale_task.id, is_positive=True)
    stale_task.refresh_from_db()
    assert stale_task.is_completed is True
    assert TaskSerializer(stale_task).data["is_completed"] is True


@pytest.mark.django_db
def test_checkin_actually_deducts_hp_and_reload_does_not_prompt(checkin_user):
    user, profile = checkin_user
    client = APIClient()
    client.force_authenticate(user=user)

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    yesterday_dt = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)

    profile.last_daily_cron_at = yesterday
    profile.last_daily_checkin_at = yesterday
    profile.hp = 100
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Hard Workout",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        is_completed=False,
        difficulty=Task.Difficulty.HARD,
    )
    Task.objects.filter(id=task.id).update(created_at=yesterday_dt - timedelta(days=1))

    # 1. User opens page -> needs_checkin is True
    res_get = client.get("/api/daily-checkin/")
    assert res_get.status_code == 200
    assert res_get.data["needs_checkin"] is True
    assert len(res_get.data["dailies"]) == 1

    # 2. User submits without completing the task (missed it)
    res_post = client.post("/api/daily-checkin/", {"completed_ids": []}, format="json")
    assert res_post.status_code == 200
    assert res_post.data["total_dmg"] > 0

    # 3. VERIFY HP WAS ACTUALLY DEDUCTED
    profile.refresh_from_db()
    assert profile.hp < 100
    assert profile.hp == 100 - res_post.data["total_dmg"]
    assert profile.last_daily_cron_at == today
    assert profile.last_daily_checkin_at == today

    # 4. VERIFY RELOAD (F5) NEVER RE-PROMPTS CHECK-IN
    res_reload = client.get("/api/daily-checkin/")
    assert res_reload.status_code == 200
    assert res_reload.data["needs_checkin"] is False


@pytest.mark.django_db
def test_checkin_skip_applies_damage_and_advances_day(checkin_user):
    user, profile = checkin_user
    client = APIClient()
    client.force_authenticate(user=user)

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    yesterday_dt = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=1)

    profile.last_daily_cron_at = yesterday
    profile.last_daily_checkin_at = yesterday
    profile.hp = 100
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Missed Meditation",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=127,
        is_completed=False,
        difficulty=Task.Difficulty.MEDIUM,
    )
    Task.objects.filter(id=task.id).update(created_at=yesterday_dt - timedelta(days=1))

    # User clicks Skip
    res = client.post("/api/daily-checkin/", {"action": "skip"}, format="json")
    assert res.status_code == 200
    assert res.data["status"] == "skipped"
    assert res.data["total_dmg"] > 0

    profile.refresh_from_db()
    assert profile.hp < 100
    assert profile.last_daily_cron_at == today
    assert profile.last_daily_checkin_at == today

    # Reload check
    res_reload = client.get("/api/daily-checkin/")
    assert res_reload.data["needs_checkin"] is False


@pytest.mark.django_db
def test_reset_data_clears_checkin_and_does_not_prompt(checkin_user):
    user, profile = checkin_user
    client = APIClient()
    client.force_authenticate(user=user)

    today = timezone.now().date()

    # User resets stats/nuclear
    res = client.post("/api/profile/reset/", {"reset_type": "stats"}, format="json")
    assert res.status_code == 200

    profile.refresh_from_db()
    assert profile.last_daily_cron_at == today
    assert profile.last_daily_checkin_at == today

    # Check that daily check-in is NOT prompted after reset
    res_checkin = client.get("/api/daily-checkin/")
    assert res_checkin.status_code == 200
    assert res_checkin.data["needs_checkin"] is False


