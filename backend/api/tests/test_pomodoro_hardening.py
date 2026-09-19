"""
Server-side hardening of the Pomodoro API. Before this, the server trusted
whatever the client claimed, so:

  * POST /pomodoro/sessions/ {duration: 100000} paid ~300k XP / 200k gold in
    one call (no bounds, no elapsed-time check, no daily cap);
  * active-session/complete accepted a client-declared duration, worked with
    NO active session at all, and paid a full reward at 0 seconds elapsed;
  * completing twice (two tabs, a retry, the extension) paid twice;
  * "start" reset the server clock even when the identical session was already
    running (opening a second tab/popup restarted it);
  * pause/resume was a non-idempotent toggle;
  * breaks were stored as completed sessions and counted as Pomodoros in stats,
    streaks and titles;
  * "today" was the server's clock, not the user's timezone;
  * the Premium gate was a CSS blur -- the API was open to everyone.

Rewards now come only from active-session/complete and are derived from how
long the server saw the session actually run.
"""
import pytest
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import ActivePomodoroSession, PomodoroSession, UserProfile
from api.tests.pomodoro_utils import backdate_active_session, make_premium

User = get_user_model()
BASE = "/api/pomodoro/sessions/"


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="pomo_hardening", password="pass")
    UserProfile.objects.get_or_create(user=u)
    make_premium(u)
    return u


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def start(client, minutes=25, mode="work", key=None):
    body = {"duration_minutes": minutes, "mode": mode}
    if key is not None:
        body["linked_activity_key"] = key
    return client.post(BASE + "active-session/start/", body, format="json")


def complete(client, **body):
    return client.post(BASE + "active-session/complete/", body, format="json")


@pytest.mark.django_db
def test_client_declared_duration_cannot_mint_rewards(client, user):
    profile = UserProfile.objects.get(user=user)
    xp_before, gold_before = profile.xp, profile.gold

    # The old reward faucet: the sessions endpoint no longer accepts writes.
    res = client.post(
        BASE, {"mode": "work", "duration": 100000, "completed": True}, format="json"
    )
    assert res.status_code == 405
    assert not PomodoroSession.objects.filter(user=user).exists()

    # ...and out-of-range / malformed durations are rejected up front.
    for bad in (100000, 0, -5, "abc", "1.5"):
        assert start(client, minutes=bad).status_code == 400, bad

    profile.refresh_from_db()
    assert (profile.xp, profile.gold) == (xp_before, gold_before)


@pytest.mark.django_db
def test_complete_needs_a_real_active_session_and_ignores_client_duration(client, user):
    res = complete(client, duration_minutes=9999, rating=8)
    assert res.status_code == 409
    assert res.json()["code"] == "no_active_session"

    start(client, minutes=25)
    backdate_active_session(user)
    res = complete(client, duration_minutes=9999, mode="work", rating=8)
    assert res.status_code == 200
    # Server's own record (25 min) decides the reward, not the body's 9999.
    assert res.json()["xp_earned"] == 75
    assert res.json()["gold_earned"] == 50


@pytest.mark.django_db
def test_zero_elapsed_completion_pays_nothing_and_keeps_session(client, user):
    start(client, minutes=25)
    res = complete(client, rating=8)  # 0 seconds elapsed
    assert res.status_code == 400
    assert res.json()["code"] == "too_short"
    assert ActivePomodoroSession.objects.filter(user=user).exists()
    assert not PomodoroSession.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_early_completion_is_paid_pro_rata(client, user):
    start(client, minutes=25)
    backdate_active_session(user, minutes=10)
    res = complete(client, rating=8)
    assert res.status_code == 200
    assert res.json()["xp_earned"] == 30  # 10 real minutes * 3
    assert PomodoroSession.objects.get(user=user).duration == 10


@pytest.mark.django_db
def test_second_complete_is_rejected_no_double_reward(client, user):
    start(client, minutes=25)
    backdate_active_session(user)
    assert complete(client, rating=8).status_code == 200
    profile = UserProfile.objects.get(user=user)
    xp_after_first = profile.xp + 0
    res = complete(client, rating=8)
    assert res.status_code == 409
    profile.refresh_from_db()
    assert profile.xp == xp_after_first
    assert PomodoroSession.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_start_is_idempotent_and_does_not_reset_the_clock(client, user):
    start(client, minutes=25)
    backdate_active_session(user, minutes=5)
    before = ActivePomodoroSession.objects.get(user=user).started_at

    res = start(client, minutes=25)  # second tab / popup opens
    assert res.status_code == 200
    assert ActivePomodoroSession.objects.get(user=user).started_at == before
    assert res.json()["remaining_seconds"] <= 20 * 60 + 2

    # A different session (other duration) still replaces it.
    start(client, minutes=45)
    assert ActivePomodoroSession.objects.get(user=user).duration_minutes == 45


@pytest.mark.django_db
def test_pause_and_resume_are_idempotent_with_explicit_action(client, user):
    start(client, minutes=25)
    backdate_active_session(user, minutes=5)

    p1 = client.post(BASE + "active-session/pause/", {"action": "pause"}, format="json")
    p2 = client.post(BASE + "active-session/pause/", {"action": "pause"}, format="json")
    assert p1.json()["is_paused"] is True and p2.json()["is_paused"] is True
    assert abs(p1.json()["remaining_seconds"] - p2.json()["remaining_seconds"]) <= 1

    r1 = client.post(BASE + "active-session/pause/", {"action": "resume"}, format="json")
    r2 = client.post(BASE + "active-session/pause/", {"action": "resume"}, format="json")
    assert r1.json()["is_paused"] is False and r2.json()["is_paused"] is False
    assert r2.json()["remaining_seconds"] <= 20 * 60 + 2  # paused time not lost

    bad = client.post(BASE + "active-session/pause/", {"action": "explode"}, format="json")
    assert bad.status_code == 400


@pytest.mark.django_db
def test_breaks_are_recorded_but_never_rewarded_or_counted(client, user):
    profile = UserProfile.objects.get(user=user)
    xp_before, gold_before = profile.xp, profile.gold

    start(client, minutes=5, mode="break")
    backdate_active_session(user)
    res = complete(client)
    assert res.status_code == 200
    assert res.json()["xp_earned"] == 0 and res.json()["gold_earned"] == 0

    profile.refresh_from_db()
    assert (profile.xp, profile.gold) == (xp_before, gold_before)
    assert PomodoroSession.objects.filter(user=user, mode="break").count() == 1

    stats = client.get(BASE + "stats/").json()
    assert stats["total_pomodoros"] == 0
    assert stats["current_streak"] == 0
    assert client.get(BASE + "heatmap/").json() == {}

    from api.models import UserStats
    from api.services.title_service import _evaluate_title_unlock

    # A break-only history must not progress "Deep Work Master" (5 sessions).
    for _ in range(6):
        PomodoroSession.objects.create(user=user, mode="break", duration=5, completed=True)
    stats, _ = UserStats.objects.get_or_create(user=user)
    profile = UserProfile.objects.get(user=user)
    unlocked, pct, _label = _evaluate_title_unlock(
        user, "deep_work_master", stats, profile, {}
    )
    assert unlocked is False and pct == 0

    # ...while real focus sessions do.
    for _ in range(5):
        PomodoroSession.objects.create(user=user, mode="work", duration=25, completed=True)
    unlocked, _pct, _label = _evaluate_title_unlock(
        user, "deep_work_master", stats, profile, {}
    )
    assert unlocked is True


@pytest.mark.django_db
def test_pomodoro_api_requires_premium_on_the_server(user):
    profile = UserProfile.objects.get(user=user)
    profile.is_premium = False
    profile.save(update_fields=["is_premium"])
    user.refresh_from_db()

    free = APIClient()
    free.force_authenticate(user=User.objects.get(pk=user.pk))
    assert free.get(BASE + "active-session/").status_code == 403
    assert free.get(BASE + "stats/").status_code == 403
    assert start(free).status_code == 403


@pytest.mark.django_db
def test_linked_activity_key_is_validated(client, user):
    # A random string no longer counts as its own "subject".
    res = start(client, key="totally-made-up-" + "x" * 20)
    assert res.status_code == 200
    assert res.json()["linked_activity_key"] == "other"

    # A custom task must exist and belong to the caller.
    assert start(client, key="custom_task_424242").status_code == 400
    assert start(client, key="x" * 500).status_code == 400


@pytest.mark.django_db
def test_daily_rewarded_minutes_are_capped(client, user):
    # 16h of focus already logged today -> no more reward today.
    today = timezone.now().astimezone(ZoneInfo("UTC")).date()
    PomodoroSession.objects.create(
        user=user, date=today, mode="work", duration=16 * 60, completed=True
    )
    start(client, minutes=25)
    backdate_active_session(user)
    res = complete(client, rating=8)
    assert res.status_code == 200
    assert res.json().get("capped") is True
    assert res.json()["xp_earned"] == 0


@pytest.mark.django_db
def test_abandoned_sessions_expire(client, user):
    start(client, minutes=25)
    backdate_active_session(user, minutes=25 + 7 * 60)  # ended 7h ago, never touched
    assert client.get(BASE + "active-session/").json() == {"active": False}
    assert not ActivePomodoroSession.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_today_uses_the_users_timezone(client, user):
    profile = UserProfile.objects.get(user=user)
    profile.timezone = "Pacific/Kiritimati"  # UTC+14, the earliest day on Earth
    profile.save(update_fields=["timezone"])

    start(client, minutes=25)
    backdate_active_session(user)
    assert complete(client, rating=8).status_code == 200

    local_today = timezone.now().astimezone(ZoneInfo("Pacific/Kiritimati")).date()
    session = PomodoroSession.objects.get(user=user)
    assert session.date == local_today
    stats = client.get(BASE + "stats/").json()
    assert stats["today_pomodoros"] == 1


@pytest.mark.django_db
def test_history_supports_page_size_and_kind_filter(client, user):
    for i in range(30):
        PomodoroSession.objects.create(user=user, mode="work", duration=25, completed=True)
    PomodoroSession.objects.create(user=user, mode="break", duration=5, completed=True)

    default_page = client.get(BASE).json()
    assert len(default_page["results"]) == 25  # unchanged default

    big = client.get(BASE + "?kind=work&page_size=200").json()
    assert len(big["results"]) == 30
    assert all(r["mode"] == "work" for r in big["results"])
