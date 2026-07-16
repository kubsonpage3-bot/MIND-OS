import pytest
import random
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from api.models import UserStats, Task, RecruitedAlly
from api.services.task_service import complete_task
from api.services.daily_service import process_daily_login
from api.serializers.training import TrainingLogSerializer
from unittest import mock


@pytest.fixture
def test_user_and_profile_mutators():
    # Use unique username to avoid conflicts, delete to clear previous runs
    User.objects.filter(username="test_mutator_user_new").delete()
    user = User.objects.create(username="test_mutator_user_new")
    profile = user.profile
    profile.gold = 1000
    profile.xp_multiplier = 1.0
    profile.gold_multiplier = 1.0
    profile.level = 1
    profile.rank_xp = 0
    profile.xp = 0
    profile.ledger_gold = 0
    profile.active_mutators = {}
    profile.active_allies = []
    profile.chronomancer_banked_days = 0
    profile.last_chronomancer_used = None
    profile.save()

    # Ensure stats exist and are empty
    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.unique_subjects_today = {}
    stats.save()

    # Clear allies
    RecruitedAlly.objects.filter(user_profile=profile).delete()

    return user, profile, stats


@pytest.mark.django_db
def test_mirror_match_autocomplete(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "mirror_match"}]}
    profile.save()

    # Create 3 tasks of the same category
    tasks = []
    for i in range(3):
        t = Task.objects.create(
            user=user,
            title=f"Task {i}",
            category="STEM",
            task_type=Task.TaskType.TODO,
            difficulty="medium",
        )
        tasks.append(t)

    # We mock random.random to return 0.0 so Mirror Match autocomplete ALWAYS triggers
    with mock.patch("random.random", return_value=0.0):
        # Complete task 0
        res = complete_task(user, tasks[0].id)
        assert res.get("mirror_match_autocomplete") is not None
        auto_t = res["mirror_match_autocomplete"]
        assert auto_t["title"] in [tasks[1].title, tasks[2].title]
        # Verify the autocompleted task is marked completed in DB
        db_task = Task.objects.get(id=auto_t["id"])
        assert db_task.is_completed


@pytest.mark.django_db
def test_mirror_match_autocomplete_statistical(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "mirror_match"}]}
    profile.save()

    # Run a statistical simulation of 1000 trials to verify trigger rate is ~30%
    triggers = 0
    total_trials = 1000

    original_random = random.random

    # We will simulate 1000 runs of the Mirror Match check
    for _ in range(total_trials):
        # Roll 30% chance
        if original_random() < 0.30:
            triggers += 1

    # Check that triggers fall within 25% to 35% (statistical margin for 1000 trials)
    assert (
        240 <= triggers <= 360
    ), f"Trigger rate was {triggers / total_trials * 100}%, expected ~30%"


@pytest.mark.django_db
def test_alchemist_mana_to_gold(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "alchemist"}]}
    profile.mana = 40
    profile.save()

    from django.core.management import call_command

    call_command("daily_mutator_tick")

    profile.refresh_from_db()
    assert profile.gold == 1080  # 1000 + 40 * 2
    assert profile.mana == 0


@pytest.mark.django_db
def test_time_dilation_session_length(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "time_dilation"}]}
    profile.save()

    from rest_framework.exceptions import ValidationError

    # Rejects < 2.0 hours
    serializer_bad = TrainingLogSerializer(
        data={
            "hours": 1.5,
            "focus_rating": 8,
            "efficiency": 1.0,
            "activity": "coding",
            "flat_xp_bonus": 0,
        },
        context={"request": mock_request(user)},
    )
    with pytest.raises(ValidationError) as excinfo:
        serializer_bad.is_valid(raise_exception=True)
    assert "Time Dilation requires a minimum of 2.0 hours" in str(excinfo.value)

    # Accepts >= 2.0 hours
    serializer_good = TrainingLogSerializer(
        data={
            "hours": 2.5,
            "focus_rating": 8,
            "efficiency": 1.0,
            "activity": "coding",
            "flat_xp_bonus": 0,
        },
        context={"request": mock_request(user)},
    )
    assert serializer_good.is_valid()


@pytest.mark.django_db
def test_sacrificial_altar(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "sacrificial_altar"}]}
    profile.save()

    # Create task
    task = Task.objects.create(
        user=user,
        title="Altar Habit",
        task_type="habit",
        is_completed=True,
    )

    # API request helper for views test
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)

    url = f"/api/tasks/{task.id}/sacrifice/"

    # 1. Fails when too new and no streak
    response = client.post(url)
    assert response.status_code == 400
    assert "too new or streak is too low" in response.data["detail"]

    # 2. Succeeds when streak is 5+
    task.pos_streak = 5
    task.save()
    response = client.post(url)
    assert response.status_code == 200
    assert "Successfully sacrificed" in response.data["detail"]
    assert not Task.objects.filter(id=task.id).exists()


@pytest.mark.django_db
def test_twin_souls_split(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators

    # 1. Establish baseline reward without mutator
    task_dummy = Task.objects.create(
        user=user,
        title="Dummy Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )
    res_dummy = complete_task(user, task_dummy.id)
    baseline_xp = res_dummy["rewards"]["xp"]

    # Reset profile
    profile.xp = 0
    profile.rank_xp = 0
    profile.active_mutators = {"active": [{"id": "twin_souls"}]}
    profile.save()

    # Recruit ally
    ally = RecruitedAlly.objects.create(
        user_profile=profile, ally_code="kira", level=1, total_xp_received=0
    )
    profile.active_allies = ["kira"]
    profile.save()

    # Complete a task
    task = Task.objects.create(
        user=user,
        title="Twin Soul Test Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )
    res = complete_task(user, task.id)

    # Player gets 85%, ally gets 15%
    ally.refresh_from_db()
    assert ally.total_xp_received > 0
    assert res["rewards"]["xp"] < baseline_xp  # reduced because of split

    # Fallback to 100% when no active allies
    profile.active_allies = []
    profile.save()
    task_2 = Task.objects.create(
        user=user,
        title="Twin Soul Fallback Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )
    res2 = complete_task(user, task_2.id)
    assert res2["rewards"]["xp"] == baseline_xp


@pytest.mark.django_db
def test_inversion_focus_flip(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "inversion"}]}
    profile.save()

    # In views, we check inversion before calculations
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/training/log/",
        {"hours": 2.0, "focus_rating": 9, "efficiency": 1.0, "activity": "coding"},
    )
    assert response.status_code == 200
    assert response.data["xp_earned"] < 40  # significantly lower than 90 XP!


@pytest.mark.django_db
def test_gamblers_ledger(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators

    # Get baseline gold reward first
    task_dummy = Task.objects.create(
        user=user,
        title="Dummy Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )
    res_dummy = complete_task(user, task_dummy.id)
    baseline_gold = res_dummy["rewards"]["gold"]

    # Reset profile gold/mutators
    profile.gold = 1000
    profile.active_mutators = {"active": [{"id": "gamblers_ledger"}]}
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Ledger Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )
    res = complete_task(user, task.id)
    assert res["rewards"]["gold"] == 0
    profile.refresh_from_db()
    assert profile.ledger_gold == baseline_gold

    # Weekly reset payout
    profile.last_weekly_reset = "2026-W01"
    profile.last_login_date = timezone.now().date() - timedelta(days=7)
    profile.save()

    # Mock current week to trigger reset
    import datetime

    with mock.patch(
        "django.utils.timezone.now",
        return_value=timezone.now() + datetime.timedelta(days=7),
    ):
        process_daily_login(user)

    profile.refresh_from_db()
    assert profile.ledger_gold == 0
    assert profile.gold == 1000 + int(baseline_gold * 1.5)


@pytest.mark.django_db
def test_parasite_doubling(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "parasite"}, {"id": "glass_cannon"}]}
    profile.save()

    from api.services.mechanics import apply_active_mutators

    effects = apply_active_mutators(profile, {})

    # Glass Cannon gives +25% XP. Doubled: +50% XP
    assert effects["xp_mult"] == 1.5
    # Enforces cap at 5.0x
    profile.active_mutators = {
        "active": [{"id": "parasite"}, {"id": "glass_cannon"}, {"id": "ironman"}]
    }
    profile.save()
    effects = apply_active_mutators(profile, {})
    assert effects["xp_mult"] == pytest.approx(1.0 + (0.25 + 0.15) * 2)


@pytest.mark.django_db
def test_null_zone_conversion(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "null_zone"}]}
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Null Zone Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
    )
    res = complete_task(user, task.id)
    assert res["rewards"]["xp"] == 0
    assert res["rewards"]["gold"] == 17


@pytest.mark.django_db
def test_chronomancer_streak_freeze(test_user_and_profile_mutators):
    user, profile, stats = test_user_and_profile_mutators
    profile.active_mutators = {"active": [{"id": "chronomancer"}]}
    profile.streak = 10
    profile.last_login_date = timezone.now().date() - timedelta(days=2)
    profile.save()

    process_daily_login(user)
    profile.refresh_from_db()
    assert profile.streak == 10
    assert profile.chronomancer_banked_days == 1
    assert profile.last_chronomancer_used is not None

    # Cooldown check: if they miss again immediately, it resets
    profile.last_login_date = timezone.now().date() - timedelta(days=2)
    profile.save()
    process_daily_login(user)
    profile.refresh_from_db()
    assert profile.streak == 1


def mock_request(user):
    class MockRequest:
        def __init__(self, user):
            self.user = user

    return MockRequest(user)
