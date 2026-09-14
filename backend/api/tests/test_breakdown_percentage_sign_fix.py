"""
The reward-breakdown "Bonuses (...) {xp_mult:+.0%}" note formatted the raw
multiplier (e.g. 0.95, a net -5%) directly as a percentage, printing "+95%"
instead of "-5%" -- the actual math was always correct (base * 0.95), only
the explanation text lied about both the sign and the magnitude. Fixed by
formatting (xp_mult - 1.0) instead. Verifies the breakdown note now matches
the sign of the real reward relative to the printed "Base" value.
"""
import pytest
from django.contrib.auth.models import User
from api.models import Task, UserActivityLog
from api.services.task_service import complete_task


@pytest.fixture
def profile_bonus_sign():
    User.objects.filter(username="test_breakdown_sign_user").delete()
    user = User.objects.create(username="test_breakdown_sign_user")
    profile = user.profile  # type: ignore
    # Bloodwork: Science sessions +20%, everything else -5%. A non-Science
    # task should net an overall reduction (xp_mult < 1.0).
    profile.active_mutators = {"active": [{"id": "bloodwork"}]}
    profile.active_allies = []
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_negative_bonus_shows_minus_sign_not_plus(profile_bonus_sign):
    user, profile = profile_bonus_sign
    task = Task.objects.create(
        user=user, title="Habit", task_type=Task.TaskType.HABIT, category="Health & Fitness"
    )
    complete_task(user, task.id, is_positive=True)

    log = UserActivityLog.objects.filter(user=user).latest("created_at")
    breakdown = log.metadata.get("breakdown", [])
    bonus_note = next((n for n in breakdown if "Bloodwork" in n), None)
    assert bonus_note is not None
    assert "-5%" in bonus_note
    assert "+95%" not in bonus_note
