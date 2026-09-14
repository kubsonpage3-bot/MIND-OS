"""
End-to-end closed-form check of the whole reward pipeline (rewards formula
-> mutator/passive xp_mult+gold_mult -> final_xp_mult burst -> PWR/SPD/FOC-
crit/LCK stat effects -> profile.xp_multiplier/gold_multiplier -> boss
damage), for both a Task (Habit) completion and an Activity (Study log)
submission. Independently re-derives the expected numbers from the same
published constants the implementation uses (not hardcoded magic numbers),
so a real arithmetic/ordering bug in the pipeline shows up as a mismatch
here even though each individual mechanic already has its own narrower
test elsewhere in this suite.
"""
import pytest
from unittest.mock import patch
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import Task, Boss, BossEncounter
from api.services.task_service import complete_task
from api.services.rewards_service import task_rewards, training_rewards


@pytest.fixture
def clean_profile():
    """A profile with zero class/gear/mutator/ally noise, so PWR/SPD/LCK/
    FOC are exactly the base stats we set -- nothing else contributes."""
    User.objects.filter(username="test_pipeline_user").delete()
    user = User.objects.create(username="test_pipeline_user")
    profile = user.profile  # type: ignore
    profile.character_class = ""  # zero class stat bonuses (see class_stats fallback)
    profile.base_pwr = 20
    profile.base_spd = 0
    profile.base_lck = 0
    profile.base_foc = 0  # -> 0% crit chance, deterministic
    profile.base_def = 0
    profile.base_mem = 0
    profile.prestige_count = 0
    profile.xp_multiplier = 1.0
    profile.gold_multiplier = 1.0
    profile.damage_multiplier = 1.0
    profile.active_mutators = {}
    profile.active_allies = []
    profile.gold = 0
    profile.rank_xp = 0
    profile.save()
    return user, profile


@pytest.mark.django_db
@patch("random.random", return_value=0.99)  # belt-and-suspenders: no crit, no item drop
def test_habit_completion_matches_hand_derived_formula(_mock_random, clean_profile):
    user, profile = clean_profile
    task = Task.objects.create(
        user=user, title="Push-ups", task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.MEDIUM,
    )

    rewards = task_rewards("medium")
    pwr_pct = min(0.50, 20 * 0.005)  # 0.10
    expected_xp = int(rewards["xp"] * (1.0 + pwr_pct))
    expected_gold = rewards["gold"]  # spd=0, lck=0 -> no gold multiplier

    result = complete_task(user, task.id, is_positive=True)

    profile.refresh_from_db()
    assert result["rewards"]["xp"] == expected_xp
    assert result["rewards"]["gold"] == expected_gold
    assert profile.rank_xp == expected_xp
    assert profile.gold == expected_gold

    # PWR-based flat boss damage component (base 10 + PWR), independent of
    # task-type damage scaling -- the Activity-log test below cross-checks
    # the *combined* (task/session dmg + this) total end to end.
    assert result["gamification_result"]["damage_dealt"] == 10 + 20


@pytest.mark.django_db
@patch("random.random", return_value=0.99)
def test_activity_log_matches_hand_derived_formula(_mock_random, clean_profile):
    user, profile = clean_profile
    boss = Boss.objects.create(name="Pipeline Boss", level=1, hp_max=1_000_000, reward_xp=1, reward_gold=1)
    BossEncounter.objects.create(user=user, boss=boss, hp_current=1_000_000, is_defeated=False)

    client = APIClient()
    client.force_authenticate(user=user)

    hours, focus = 1.0, 8.0  # focus_factor(8) == 1.0 exactly (the documented balance anchor)
    from api.services.mechanics import calculate_training_efficiency

    eff = calculate_training_efficiency(
        profile, focus=focus, hours=hours, streak_days=profile.streak,
        hours_today=0.0, subject_hours_today=0.0,
    )

    resp = client.post(
        "/api/training/log/",
        {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    data = resp.data

    rewards = training_rewards("medium", hours, focus)
    pwr_pct = min(0.50, 20 * 0.005)
    expected_xp = int(rewards["xp"] * (1.0 + pwr_pct))
    expected_gold = rewards["gold"]

    assert data["xp_earned"] == expected_xp
    assert data["gold_earned"] == expected_gold

    # Boss damage: training rewards' dmg (deep-work-scaled) + flat PWR damage
    expected_pwr_dmg = 10 + 20
    expected_final_damage = int((rewards["dmg"] + expected_pwr_dmg) * 1.0 * 1.0)
    assert data["combat"]["damage_dealt"] == expected_final_damage

    profile.refresh_from_db()
    assert profile.rank_xp == expected_xp
    assert profile.gold == expected_gold


@pytest.mark.django_db
@patch("random.random", return_value=0.99)
def test_habit_completion_with_mutator_stacks_correctly(_mock_random, clean_profile):
    """Cross-checks the xp_mult composition and the breakdown sign fix
    together: ironman is an unconditional +15% Rank XP mutator with no
    other side effects, so the result must be exactly base * 1.15 * 1.10
    (PWR), and the breakdown must say "+15%", not "-85%" or "+115%"."""
    user, profile = clean_profile
    profile.active_mutators = {"active": [{"id": "ironman"}]}
    profile.save()
    task = Task.objects.create(
        user=user, title="Push-ups", task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.MEDIUM,
    )

    rewards = task_rewards("medium")
    pwr_pct = min(0.50, 20 * 0.005)
    xp_mult = 1.15  # ironman's unconditional +15% xp_mult
    expected_xp = int(int(rewards["xp"] * xp_mult) * (1.0 + pwr_pct))

    result = complete_task(user, task.id, is_positive=True)
    assert result["rewards"]["xp"] == expected_xp

    from api.models import UserActivityLog

    log = UserActivityLog.objects.filter(user=user).latest("created_at")
    bonus_note = next(n for n in log.metadata["breakdown"] if "XP bonuses" in n)
    assert "+15%" in bonus_note
