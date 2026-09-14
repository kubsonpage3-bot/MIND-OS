"""
Linked Pomodoro completion (active-session/complete with an activity_key) had
4 gaps versus manual Study-log submissions (TrainingLogView), despite the
code explicitly claiming to apply "the same Character Stats / Allies /
Mutators pipeline":
  1. final_xp_mult/final_gold_mult (echo, gambler, volatile, time_dilation,
     diversity_lock) were computed but never applied.
  2. Zero boss damage was ever dealt for a linked Pomodoro, unlike every
     other rewarded action in the game.
  3. last_completed_category/same_category_streak were never updated, so a
     Pomodoro was invisible to Echo/Mirror/Diversity Lock's "same or
     different subject as last time" tracking -- and task_category was
     derived differently (resolve_mastery_category's lowercase scheme)
     than TrainingLogView's ACTIVITY_CATEGORY_MAP, so even a fix here
     would have disagreed with Study-log sessions of the same subject.
  4. No reward breakdown was recorded for History.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import Boss, BossEncounter, UserActivityLog, UserProfile

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="pomo_audit_user", password="pass")
    profile, _ = UserProfile.objects.get_or_create(user=u)
    profile.active_mutators = {"active": [{"id": "time_dilation"}]}
    profile.last_completed_category = ""
    profile.save()
    return u


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_linked_pomodoro_applies_final_xp_mult(auth_client, user):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "mathematics", "duration_minutes": 30},
        format="json",
    )
    res = auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/", {"rating": 5}, format="json"
    )
    assert res.status_code == 200
    data = res.json()
    # base_xp for 30min would be ~90 (duration*3); time_dilation is x3 on top
    # of everything else -- just assert it's a large multiple of the flat
    # baseline (90), not a lucky roll.
    assert data["xp_earned"] >= 90 * 2
    assert any("Mutator burst" in note for note in data["breakdown"])


@pytest.mark.django_db
def test_linked_pomodoro_deals_boss_damage(auth_client, user):
    boss = Boss.objects.create(name="Pomo Boss", level=1, hp_max=100000, reward_xp=10, reward_gold=5)
    BossEncounter.objects.create(user=user, boss=boss, hp_current=100000, is_defeated=False)

    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "mathematics", "duration_minutes": 30},
        format="json",
    )
    res = auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/", {"rating": 7}, format="json"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["combat"] is not None
    assert data["combat"]["damage_dealt"] > 0

    encounter = BossEncounter.objects.get(user=user, boss=boss)
    assert encounter.hp_current < 100000


@pytest.mark.django_db
def test_linked_pomodoro_updates_category_tracking(auth_client, user):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "mathematics", "duration_minutes": 30},
        format="json",
    )
    auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/", {"rating": 5}, format="json"
    )
    profile = UserProfile.objects.get(user=user)
    assert profile.last_completed_category == "Sciences"  # matches ACTIVITY_CATEGORY_MAP
    assert profile.same_category_streak == 1


@pytest.mark.django_db
def test_linked_pomodoro_records_breakdown_in_history(auth_client, user):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "mathematics", "duration_minutes": 30},
        format="json",
    )
    res = auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/", {"rating": 5}, format="json"
    )
    assert res.status_code == 200
    assert len(res.json()["breakdown"]) > 0

    log = UserActivityLog.objects.filter(
        user=user, activity_type=UserActivityLog.ActivityType.POMODORO
    ).latest("created_at")
    assert "breakdown" in log.metadata
    assert len(log.metadata["breakdown"]) > 0


@pytest.mark.django_db
def test_unlinked_pomodoro_still_flat_no_regression(auth_client, user):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"duration_minutes": 25},  # no linked_activity_key
        format="json",
    )
    res = auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/", {"rating": 5}, format="json"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["gold_earned"] == max(10, 25 * 2)
    assert data["xp_earned"] == max(15, 25 * 3)
    assert data["combat"] is None
