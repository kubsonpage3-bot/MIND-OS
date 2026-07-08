import os
import sys
import django
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mindos.settings")
django.setup()

from django.contrib.auth.models import User
from api.models import UserProfile, Task
from api.services.mechanics import apply_active_mutators
from api.services.task_service import _complete_task_logic


def run_tests():
    # Setup test user
    user, _ = User.objects.get_or_create(username="test_mutator_user")
    profile = user.profile

    # Test momentum cap
    print("Testing momentum...")
    profile.tasks_completed_today = 15  # 15 * 0.05 = 0.75, but should cap at 0.50
    profile.active_mutators = {"active": [{"id": "momentum"}]}
    profile.save()
    effects = apply_active_mutators(profile, {})
    assert (
        effects.get("final_xp_mult", 1.0) == 1.5
    ), f"Expected 1.5, got {effects.get('final_xp_mult')}"

    # Test tunnel_vision cap
    print("Testing tunnel_vision...")
    profile.same_category_streak = 10  # 10 * 0.10 = 1.0, but should cap at 0.50
    profile.active_mutators = {"active": [{"id": "tunnel_vision"}]}
    profile.save()
    effects = apply_active_mutators(profile, {"task_category": "Work"})
    assert (
        effects.get("final_xp_mult", 1.0) == 1.5
    ), f"Expected 1.5, got {effects.get('final_xp_mult')}"

    # Test diversity_lock
    print("Testing diversity_lock...")
    profile.last_completed_category = "Work"
    profile.active_mutators = {"active": [{"id": "diversity_lock"}]}
    profile.save()
    effects = apply_active_mutators(profile, {"task_category": "Work"})
    assert (
        effects.get("final_xp_mult", 1.0) == 0.0
    ), f"Expected 0.0, got {effects.get('final_xp_mult')}"

    # Test ironman
    print("Testing ironman...")
    profile.active_mutators = {"active": [{"id": "ironman"}]}
    profile.hp = 100
    profile.gold = 1000
    profile.save()

    task = Task.objects.create(user=user, title="Fail Task", task_type="habit")
    from django.db import transaction

    with transaction.atomic():
        _complete_task_logic(user, task.id, is_positive=False)
    profile.refresh_from_db()
    assert profile.gold == 900, f"Expected 900 gold, got {profile.gold}"

    # Test weight_of_history
    print("Testing weight_of_history...")
    profile.total_overdue_tasks = 60  # 60 * 0.02 = 1.20, should cap at 1.0
    profile.active_mutators = {"active": [{"id": "weight_of_history"}]}
    profile.save()
    effects = apply_active_mutators(profile, {})
    assert (
        effects.get("damage_taken_mult", 1.0) == 2.0
    ), f"Expected 2.0, got {effects.get('damage_taken_mult')}"

    # Test catalyst/resonance
    print("Testing catalyst and resonance...")
    profile.active_mutators = {"active": [{"id": "catalyst"}, {"id": "resonance"}]}
    profile.save()

    # Need a way to inject a base modifier into effects to see it amplified.
    # We can fake it by adding "night_owl" maybe?
    # Actually wait, catalyst and resonance just amplify existing effects.
    # If the effects dict starts with xp_mult > 1.0. But apply_active_mutators creates it from scratch.
    # To test this, I can temporarily add a mutator that gives xp_mult.
    profile.active_mutators = {
        "active": [{"id": "catalyst"}, {"id": "resonance"}, {"id": "early_riser"}]
    }
    profile.save()
    # Mock timezone hour to be early
    import datetime
    from unittest.mock import patch

    with patch(
        "django.utils.timezone.now",
        return_value=datetime.datetime(2023, 1, 1, 6, tzinfo=datetime.timezone.utc),
    ):
        effects = apply_active_mutators(profile, {})
    # early_riser adds +20% XP if between 4 and 9 -> xp_mult = 1.2
    # amp = 1.0 + 0.25 (catalyst) + 0.15*3 = 0.45 (resonance) = 1.70
    # xp_mult = 1.0 + (1.2 - 1.0) * 1.70 = 1.34
    assert (
        abs(effects.get("xp_mult", 1.0) - 1.34) < 0.01
    ), f"Expected 1.34, got {effects.get('xp_mult')}"

    # Test deja_vu cooldown
    print("Testing deja_vu cooldown...")
    from rest_framework.test import APIRequestFactory
    from api.views import DejaVuView

    factory = APIRequestFactory()

    profile.active_mutators = {"active": [{"id": "deja_vu"}]}
    profile.last_deja_vu_use = timezone.now() - timedelta(days=6)
    profile.save()

    request = factory.post("/api/tasks/1/deja-vu/")
    from rest_framework.test import force_authenticate

    force_authenticate(request, user=user)
    view = DejaVuView.as_view()
    response = view(request, task_id=task.id)
    assert (
        response.status_code == 400
    ), f"Should block 6 days old, got {response.status_code} - {response.data}"
    assert "cooldown" in response.data["error"].lower(), "Missing cooldown message"

    profile.last_deja_vu_use = timezone.now() - timedelta(days=8)
    profile.save()
    task.is_completed = True
    task.save()

    response = view(request, task_id=task.id)
    assert (
        response.status_code == 200
    ), f"Should succeed 8 days old, got {response.status_code}: {response.data}"

    print("All tests passed!")


if __name__ == "__main__":
    run_tests()
