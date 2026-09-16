"""
Two bugs found while auditing streak logic and Pomodoro/Activity-Log parity:

1. "transcendence" (the old activation name for the Enlightenment skill) was
   checked literally as an ActiveEffect skill_id in 4 places (missed-daily
   streak protection in task_service.py x3, rival XP freeze in
   rival_service.py), but activate_skill() always resolves aliases to the
   canonical id before storing the effect -- so no ActiveEffect ever actually
   has skill_id="transcendence", and the protection never fired.
2. UserStats (total_tasks_completed/total_gold_earned/prayer_sessions -- used
   by title_service's milestone titles) only updated on Task completions,
   never on Activity Log or linked Pomodoro sessions, silently excluding
   session-only players from those titles.
"""
import pytest
from api.models import UserProfile, Task, ActiveEffect, UserStats
from api.services.task_service import apply_missed_daily_penalty
from api.services.skill_service import activate_skill
from rest_framework.test import APIClient


@pytest.fixture
def user(db):
    from django.contrib.auth.models import User

    u = User.objects.create(username="streak_audit_user", password="pw")
    return u


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.character_class = "ascetic"
    p.mana = 100
    p.hp = 100
    p.save()
    return p


@pytest.mark.django_db
def test_transcendence_alias_resolves_to_stored_effect(user, profile):
    # activate_skill("transcendence") must store the effect under the
    # canonical "enlightenment", not the literal input name.
    success, _, _, _ = activate_skill(user, "transcendence")
    assert success is True
    assert not ActiveEffect.objects.filter(user=user, skill_id="transcendence").exists()
    assert ActiveEffect.objects.filter(user=user, skill_id="enlightenment").exists()


@pytest.mark.django_db
def test_enlightenment_protects_daily_streak_from_reset_on_miss(user, profile):
    daily = Task.objects.create(
        user=user, title="Streak Test Daily", task_type=Task.TaskType.DAILY, streak=5
    )

    success, _, _, _ = activate_skill(user, "transcendence")
    assert success is True

    transcendence_active = ActiveEffect.objects.filter(
        user=user, skill_id__in=["transcendence", "enlightenment"]
    ).exists()
    assert transcendence_active is True  # would have been False before the fix

    apply_missed_daily_penalty(
        user=user, profile=profile, task=daily, streak_protected=transcendence_active
    )
    daily.refresh_from_db()
    assert daily.streak == 5  # NOT reset to 0


@pytest.mark.django_db
def test_daily_streak_still_resets_without_protection(user, profile):
    # Baseline: without the skill active, a miss must still reset the streak
    # -- confirms the fix didn't accidentally make protection unconditional.
    daily = Task.objects.create(
        user=user, title="Unprotected Daily", task_type=Task.TaskType.DAILY, streak=5
    )
    apply_missed_daily_penalty(
        user=user, profile=profile, task=daily, streak_protected=False
    )
    daily.refresh_from_db()
    assert daily.streak == 0


@pytest.mark.django_db
def test_activity_log_session_updates_userstats(user, profile):
    from api.services.mechanics import calculate_training_efficiency

    client = APIClient()
    client.force_authenticate(user=user)

    stats_before, _ = UserStats.objects.get_or_create(user=user)
    tasks_before = stats_before.total_tasks_completed
    gold_before = stats_before.total_gold_earned

    hours, focus = 1.0, 8.0
    eff = calculate_training_efficiency(
        profile, focus=focus, hours=hours, streak_days=profile.streak,
        hours_today=0.0, subject_hours_today=0.0,
    )
    res = client.post(
        "/api/training/log/",
        {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
        format="json",
    )
    assert res.status_code == 200, res.data

    stats = UserStats.objects.get(user=user)
    assert stats.total_tasks_completed == tasks_before + 1
    assert stats.total_gold_earned >= gold_before


@pytest.mark.django_db
def test_linked_pomodoro_session_updates_userstats(user, profile):
    client = APIClient()
    client.force_authenticate(user=user)

    stats_before, _ = UserStats.objects.get_or_create(user=user)
    tasks_before = stats_before.total_tasks_completed

    client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": "mathematics", "duration_minutes": 60},
        format="json",
    )
    res = client.post(
        "/api/pomodoro/sessions/active-session/complete/", {"rating": 8}, format="json"
    )
    assert res.status_code == 200, res.data

    stats = UserStats.objects.get(user=user)
    assert stats.total_tasks_completed == tasks_before + 1
