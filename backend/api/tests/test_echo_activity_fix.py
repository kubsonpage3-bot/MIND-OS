"""
Regression test: the ECHO mutator writes to mutator_effects["final_xp_mult"]/
["final_gold_mult"], which used to only be read in task_service.py's
_complete_task_logic (Habit/Daily/Todo completions). The Activity/Study log
endpoint (TrainingLogView.post) never read those keys, so ECHO silently did
nothing for Activity logs despite being advertised as generally active.

Echo is now a 30% chance to proc (was a guaranteed ×2 on every category
switch -- rebalanced for being trivially spammable with zero cost/cooldown/
randomness unlike every other burst mutator). Tests force the proc via
random.random() < 0.30 where the ×2 is expected, and >= 0.30 elsewhere.
"""
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from django.urls import reverse
from django.contrib.auth.models import User
from api.models import UserProfile
from api.services.mechanics import calculate_training_efficiency


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(username="echouser", password="testpassword")


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    # Zero out FOC-driven crit so the comparison below is deterministic.
    p.base_foc = 0
    p.active_mutators = {"active": [{"id": "echo"}], "purchased": ["echo"]}
    p.save()
    return p


def _log(api_client, profile, activity, hours=1.0, focus=7.0, random_value=0.99):
    eff = calculate_training_efficiency(
        profile,
        focus=focus,
        hours=hours,
        streak_days=profile.streak,
        hours_today=0.0,
        subject_hours_today=0.0,
    )
    # random_value also gates crit/drop-chance rolls elsewhere in the pipeline;
    # base_foc=0 (crit chance 0) and the default low LCK (drop chance near 0)
    # keep those from firing even when random_value is pushed low enough to
    # win Echo's 30% roll.
    with patch("random.random", return_value=random_value):
        return api_client.post(
            reverse("training-log"),
            {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": activity},
            format="json",
        )


@pytest.mark.django_db
def test_echo_doubles_activity_log_xp_on_category_switch(api_client, user, profile):
    api_client.force_authenticate(user=user)

    # First log: no prior category, so Echo's "switched category" condition is
    # False regardless of the roll. This also seeds last_completed_category = "Sciences".
    resp1 = _log(api_client, profile, "mathematics", random_value=0.99)
    assert resp1.status_code == 200
    xp_no_echo = resp1.data["xp_earned"]
    assert xp_no_echo > 0

    # Second log: different category (Humanities & Arts) from the first
    # (Sciences) + forced roll under 0.30 -> Echo procs and doubles xp/gold.
    profile.refresh_from_db()
    resp2 = _log(api_client, profile, "history", random_value=0.1)
    assert resp2.status_code == 200
    xp_with_echo = resp2.data["xp_earned"]

    # Same hours/focus/category-mix on both calls (mathematics and history are
    # both "Other"-tier training, base_foc=0 kills crit) so the only source of
    # asymmetry between "would-be" xp and actual xp is Echo's x2.
    assert xp_with_echo == pytest.approx(2 * xp_no_echo, abs=1)


@pytest.mark.django_db
def test_echo_does_not_proc_when_roll_fails(api_client, user, profile):
    """A category switch alone must NOT be enough anymore -- the 30% roll
    also has to succeed, or Echo should behave as if it weren't active."""
    api_client.force_authenticate(user=user)

    resp1 = _log(api_client, profile, "mathematics", random_value=0.99)
    xp_no_echo = resp1.data["xp_earned"]

    profile.refresh_from_db()
    # Different category, but the roll (0.99) loses the 30% chance.
    resp2 = _log(api_client, profile, "history", random_value=0.99)
    xp_without_proc = resp2.data["xp_earned"]

    assert xp_without_proc == pytest.approx(xp_no_echo, abs=1)
