import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, TrainingSession
from api.services.mechanics import calculate_battery_level
from api.services.task_service import process_missed_tasks
from api.serializers.profile import UserProfileSerializer
from datetime import timedelta
import zoneinfo
from django.utils import timezone


@pytest.fixture
def user_and_profile():
    user = User.objects.create(username="battery_test_user")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return user, profile


@pytest.mark.django_db
def test_battery_calculations(user_and_profile):
    user, profile = user_and_profile

    # Default battery level should be 100%
    info = calculate_battery_level(profile)
    assert info["level"] == 100
    assert info["habits"] == 0
    assert info["todos"] == 0
    assert info["dailies"] == 0
    assert info["hours"] == 0.0

    # 1. Complete some tasks
    profile.habits_completed_today = 4
    profile.todos_completed_today = 2
    profile.dailies_completed_today = 3
    profile.save()

    # 2. Log 9 hours of training today
    TrainingSession.objects.create(
        user_profile=profile,
        activity_key="mathematics",
        hours=2.0,
        focus_rating=7,
        efficiency=1.0,
    )
    TrainingSession.objects.create(
        user_profile=profile,
        activity_key="reading",
        hours=4.0,
        focus_rating=7,
        efficiency=1.0,
    )
    TrainingSession.objects.create(
        user_profile=profile,
        activity_key="vocabulary",
        hours=3.0,
        focus_rating=7,
        efficiency=1.0,
    )

    info = calculate_battery_level(profile)
    # w_habit(5)*4 + w_todo(5)*2 + w_daily(5)*3 + w_hour(6)*9 = 20 + 10 + 15 + 54 = 99 drain.
    # Level = 100 - 99 = 1.
    assert info["level"] == 1
    assert info["habits"] == 4
    assert info["todos"] == 2
    assert info["dailies"] == 3
    assert info["hours"] == 9.0

    # Serializer test
    serializer = UserProfileSerializer(profile)
    assert serializer.data["battery_info"]["level"] == 1
    assert serializer.data["battery_info"]["habits"] == 4
    assert serializer.data["battery_info"]["hours"] == 9.0


@pytest.mark.django_db
def test_battery_clamp_and_reset(user_and_profile):
    user, profile = user_and_profile

    # Exceeding drain
    profile.habits_completed_today = 30
    profile.save()

    info = calculate_battery_level(profile)
    # 30 * 5 = 150 drain. Battery level should clamp to 0.
    assert info["level"] == 0

    # Set last cron to yesterday so we fire rollover
    try:
        user_tz = zoneinfo.ZoneInfo(profile.timezone or "UTC")
    except Exception:
        user_tz = zoneinfo.ZoneInfo("UTC")
    local_today = timezone.now().astimezone(user_tz).date()
    profile.last_daily_cron_at = local_today - timedelta(days=1)
    profile.save()

    # Daily rollover cron should reset counters
    process_missed_tasks(user)
    profile.refresh_from_db()
    assert profile.habits_completed_today == 0

    info = calculate_battery_level(profile)
    assert info["level"] == 100
