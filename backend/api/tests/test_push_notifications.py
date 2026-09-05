"""
Regression tests for the Notifications settings screen actually doing what
it says: the "channel" picker (push/email/none) and per-type toggles, plus
send_streak_warnings() only firing for users genuinely at risk instead of
blasting everyone with an active streak every hour.
"""
import pytest
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import UserProfile, PushSubscription
from api.services.push_service import (
    send_notification_to_user,
    send_streak_warnings,
    STREAK_WARNING_HOUR_UTC,
)


@pytest.fixture
def user_with_sub(db):
    u = User.objects.create(username="pushuser")
    profile, _ = UserProfile.objects.get_or_create(user=u)
    PushSubscription.objects.create(
        user=u, endpoint="https://example.com/ep1", p256dh="p", auth="a"
    )
    return u, profile


@pytest.mark.django_db
def test_channel_none_blocks_all_push(user_with_sub):
    user, profile = user_with_sub
    profile.notification_preferences = {"boss_defeated": True, "channel": "none"}
    profile.save()
    user.refresh_from_db()  # drop the stale cached user.profile from the fixture

    with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
        sent = send_notification_to_user(user, "boss_defeated", "t", "b")

    assert sent == 0
    mock_send.assert_not_called()


@pytest.mark.django_db
def test_channel_email_blocks_push_until_email_delivery_exists(user_with_sub):
    user, profile = user_with_sub
    profile.notification_preferences = {"boss_defeated": True, "channel": "email"}
    profile.save()
    user.refresh_from_db()

    with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
        sent = send_notification_to_user(user, "boss_defeated", "t", "b")

    assert sent == 0
    mock_send.assert_not_called()


@pytest.mark.django_db
def test_channel_push_default_still_delivers(user_with_sub):
    user, profile = user_with_sub
    profile.notification_preferences = {"boss_defeated": True}
    profile.save()
    user.refresh_from_db()

    with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
        sent = send_notification_to_user(user, "boss_defeated", "t", "b")

    assert sent == 1
    mock_send.assert_called_once()


@pytest.mark.django_db
def test_streak_warning_skipped_before_evening_utc(user_with_sub):
    user, profile = user_with_sub
    profile.streak = 5
    profile.last_login_date = timezone.now().date() - timedelta(days=1)
    profile.notification_preferences = {"streak_risk": True}
    profile.save()

    early_time = timezone.now().replace(hour=max(0, STREAK_WARNING_HOUR_UTC - 5))
    with patch("api.services.push_service.timezone.now", return_value=early_time):
        with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
            sent = send_streak_warnings()

    assert sent == 0
    mock_send.assert_not_called()


@pytest.mark.django_db
def test_streak_warning_skipped_if_already_logged_in_today(user_with_sub):
    user, profile = user_with_sub
    profile.streak = 5
    profile.last_login_date = timezone.now().date()  # already logged in today
    profile.notification_preferences = {"streak_risk": True}
    profile.save()

    evening = timezone.now().replace(hour=min(23, STREAK_WARNING_HOUR_UTC + 1))
    with patch("api.services.push_service.timezone.now", return_value=evening):
        with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
            sent = send_streak_warnings()

    assert sent == 0
    mock_send.assert_not_called()


@pytest.mark.django_db
def test_streak_warning_skipped_with_zero_streak(user_with_sub):
    user, profile = user_with_sub
    profile.streak = 0
    profile.last_login_date = timezone.now().date() - timedelta(days=1)
    profile.notification_preferences = {"streak_risk": True}
    profile.save()

    evening = timezone.now().replace(hour=min(23, STREAK_WARNING_HOUR_UTC + 1))
    with patch("api.services.push_service.timezone.now", return_value=evening):
        with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
            sent = send_streak_warnings()

    assert sent == 0
    mock_send.assert_not_called()


@pytest.mark.django_db
def test_streak_warning_fires_when_genuinely_at_risk(user_with_sub):
    user, profile = user_with_sub
    profile.streak = 5
    profile.last_login_date = timezone.now().date() - timedelta(days=1)
    profile.notification_preferences = {"streak_risk": True}
    profile.save()

    evening = timezone.now().replace(hour=min(23, STREAK_WARNING_HOUR_UTC + 1))
    with patch("api.services.push_service.timezone.now", return_value=evening):
        with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
            sent = send_streak_warnings()

    assert sent == 1
    mock_send.assert_called_once()


@pytest.mark.django_db
def test_streak_warning_respects_channel_none(user_with_sub):
    user, profile = user_with_sub
    profile.streak = 5
    profile.last_login_date = timezone.now().date() - timedelta(days=1)
    profile.notification_preferences = {"streak_risk": True, "channel": "none"}
    profile.save()

    evening = timezone.now().replace(hour=min(23, STREAK_WARNING_HOUR_UTC + 1))
    with patch("api.services.push_service.timezone.now", return_value=evening):
        with patch("api.services.push_service.send_web_push", return_value=True) as mock_send:
            sent = send_streak_warnings()

    assert sent == 0
    mock_send.assert_not_called()
