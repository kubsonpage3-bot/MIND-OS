"""
Widget sync backend (RPG Stats / Dailies / Daily Summary / Quick Actions
native Android widgets' background WorkManager sync -- see
CalendarWidgetSyncWorker for the same pattern already shipped for the
Calendar widget):

  * GET  /api/widget/sync-token/  lazily creates widget_sync_token, POST rotates it.
  * Unlike calendar_feed_token, this is NOT Premium-gated -- a non-premium
    user must still be able to get a token and read the feed.
  * GET /api/widget/sync/<token>/ returns a compact profile+dailies summary
    that must never disagree with what the app itself shows: xp/max_xp
    computed from the same (passive-scaled) rank thresholds get_rank_info()
    returns, hp/mp maxima inclusive of equipped gear (total_stats), and a
    daily only counts as "completed" if last_completed_at actually falls on
    today in the user's own timezone (TaskSerializer's rule) -- not the raw
    is_completed flag, which stays true until the next day's rollover job
    runs for a user who hasn't opened the app.
"""
import datetime
import zoneinfo

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone as dj_timezone
from rest_framework.test import APIClient

from api.models import Task, UserProfile
from api.services.profile_service import get_rank_info

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="widget_sync", password="pass")
    getattr(u, "profile", None) or UserProfile.objects.get_or_create(user=u)[0]
    return u


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_token_is_lazily_created_and_stable(client, user):
    assert user.profile.widget_sync_token == ""

    first = client.get("/api/widget/sync-token/").json()["token"]
    assert len(first) >= 20

    again = client.get("/api/widget/sync-token/").json()["token"]
    assert again == first  # GET must not rotate


@pytest.mark.django_db
def test_rotating_the_token_revokes_the_old_one(client, user):
    old = client.get("/api/widget/sync-token/").json()["token"]
    new = client.post("/api/widget/sync-token/").json()["token"]
    assert new != old

    anon = APIClient()
    assert anon.get(f"/api/widget/sync/{old}/").status_code == 404
    assert anon.get(f"/api/widget/sync/{new}/").status_code == 200


@pytest.mark.django_db
def test_unknown_or_short_token_is_404_not_500(client):
    anon = APIClient()
    assert anon.get("/api/widget/sync/not-a-real-token-at-all-00000/").status_code == 404
    assert anon.get("/api/widget/sync/short/").status_code == 404


@pytest.mark.django_db
def test_feed_does_not_require_premium(client, user):
    """The RPG/Dailies widgets aren't a Premium feature -- unlike the
    calendar feed, a free account must still get a working sync token."""
    assert user.profile.is_premium is False
    token = client.get("/api/widget/sync-token/").json()["token"]

    anon = APIClient()
    assert anon.get(f"/api/widget/sync/{token}/").status_code == 200


@pytest.mark.django_db
def test_feed_profile_matches_rank_info_and_equipped_gear(client, user):
    profile = user.profile
    profile.rank_xp = 350  # between D(200) and C(600) on the unscaled thresholds
    profile.hp = 42
    profile.gold = 777
    profile.character_class = "Ascetic"
    profile.character_name = "Kubson"
    profile.save()

    rank_info = get_rank_info(profile)
    thresholds = rank_info["thresholds"]
    idx = next(i for i, t in enumerate(thresholds) if t["id"] == rank_info["current_id"])
    expected_xp = profile.rank_xp - thresholds[idx]["min"]
    expected_max_xp = (
        thresholds[idx + 1]["min"] - thresholds[idx]["min"]
        if idx < len(thresholds) - 1
        else 10000 - thresholds[idx]["min"]
    )

    token = client.get("/api/widget/sync-token/").json()["token"]
    data = APIClient().get(f"/api/widget/sync/{token}/").json()

    p = data["profile"]
    assert p["hp"] == 42
    assert p["max_hp"] == profile.total_stats["hp_max"]  # equipment-inclusive, matches the app
    assert p["gold"] == 777
    assert p["class"] == "ascetic"
    assert p["rank"] == rank_info["current_id"]
    assert p["xp"] == expected_xp
    assert p["max_xp"] == expected_max_xp
    assert p["username"] == "Kubson"


@pytest.mark.django_db
def test_daily_completed_uses_the_users_timezone_not_the_raw_flag(client, user):
    profile = user.profile
    profile.timezone = "Europe/Berlin"
    profile.save(update_fields=["timezone"])
    tz = zoneinfo.ZoneInfo("Europe/Berlin")
    today_local = dj_timezone.now().astimezone(tz).date()
    yesterday_local = today_local - datetime.timedelta(days=1)

    done_today = Task.objects.create(
        user=user, title="Meditate", task_type=Task.TaskType.DAILY,
        is_completed=True,
        last_completed_at=datetime.datetime.combine(today_local, datetime.time(9), tzinfo=tz),
    )
    stale_flag = Task.objects.create(
        user=user, title="Stretch", task_type=Task.TaskType.DAILY,
        is_completed=True,  # flag never got reset by the rollover job yet
        last_completed_at=datetime.datetime.combine(yesterday_local, datetime.time(9), tzinfo=tz),
    )
    never_done = Task.objects.create(
        user=user, title="Journal", task_type=Task.TaskType.DAILY, is_completed=False,
    )

    token = client.get("/api/widget/sync-token/").json()["token"]
    dailies = {d["id"]: d for d in APIClient().get(f"/api/widget/sync/{token}/").json()["dailies"]}

    assert dailies[done_today.id]["completed"] is True
    assert dailies[stale_flag.id]["completed"] is False
    assert dailies[never_done.id]["completed"] is False


@pytest.mark.django_db
def test_feed_dailies_carry_category_difficulty_streak_value(client, user):
    task = Task.objects.create(
        user=user, title="Read", task_type=Task.TaskType.DAILY,
        category="Sciences", difficulty=Task.Difficulty.HARD, streak=12, value=2.0,
    )
    token = client.get("/api/widget/sync-token/").json()["token"]
    dailies = APIClient().get(f"/api/widget/sync/{token}/").json()["dailies"]
    entry = next(d for d in dailies if d["id"] == task.id)
    assert entry == {
        "id": task.id, "title": "Read", "completed": False,
        "category": "Sciences", "difficulty": "hard", "streak": 12, "value": 2.0,
    }


@pytest.mark.django_db
def test_feed_excludes_non_daily_tasks(client, user):
    Task.objects.create(user=user, title="Buy milk", task_type=Task.TaskType.TODO)
    Task.objects.create(user=user, title="Push-ups", task_type=Task.TaskType.HABIT)
    daily = Task.objects.create(user=user, title="Read", task_type=Task.TaskType.DAILY)

    token = client.get("/api/widget/sync-token/").json()["token"]
    dailies = APIClient().get(f"/api/widget/sync/{token}/").json()["dailies"]
    assert [d["id"] for d in dailies] == [daily.id]
