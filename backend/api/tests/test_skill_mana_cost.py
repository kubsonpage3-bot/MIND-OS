"""
Skill mana cost previously ignored the MEM stat entirely: CharacterTab
advertises "-X% Mana cost" under the MEM stat card (formula 100/(100+MEM)),
but skill_service.activate_skill() only ever applied Mindguard's flat 15%
and a couple of ally flat reductions -- MEM's own promised discount was
computed nowhere near the actual mana deduction. Fixed in skill_service.py;
these tests pin the real end-to-end mana charge to the same formula the UI
displays.
"""
import math

import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UnlockedSkill
from api.services.skill_service import activate_skill


@pytest.fixture
def user():
    return User.objects.create(username="mana_cost_user", password="pw")


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.character_class = "architect"
    p.mana = 200
    p.hp = 100
    # Zero out base_mem so total MEM is a small, predictable number (just
    # the Architect class bonus), independent of any default base stats.
    p.base_mem = 0
    p.save()
    return p


@pytest.mark.django_db
def test_skill_mana_cost_respects_mem_stat(user, profile):
    mem_stat = profile.total_stats["mem"]
    assert mem_stat > 0, "fixture expects the Architect class to grant a MEM bonus"

    base_cost = 50  # algorithmic_cascade's listed mana cost
    expected_cost = math.floor(base_cost * (100.0 / (100.0 + mem_stat)))
    assert expected_cost < base_cost  # sanity: the reduction must actually bite

    success, msg, _, _ = activate_skill(user, "algorithmic_cascade")
    assert success, msg

    profile.refresh_from_db()
    assert profile.mana == 200 - expected_cost


@pytest.mark.django_db
def test_higher_mem_charges_less_mana(user, profile):
    """Monotonicity check: more MEM must never cost the same or more mana."""
    low_mem_stat = profile.total_stats["mem"]
    base_cost = 50
    low_mem_cost = math.floor(base_cost * (100.0 / (100.0 + low_mem_stat)))

    profile.base_mem = 100
    profile.mana = 200
    profile.save()
    high_mem_stat = profile.total_stats["mem"]
    high_mem_cost = math.floor(base_cost * (100.0 / (100.0 + high_mem_stat)))

    assert high_mem_cost < low_mem_cost

    success, msg, _, _ = activate_skill(user, "algorithmic_cascade")
    assert success, msg
    profile.refresh_from_db()
    assert profile.mana == 200 - high_mem_cost


@pytest.mark.django_db
def test_mindguard_stacks_multiplicatively_with_mem(user, profile):
    UnlockedSkill.objects.create(user_profile=profile, skill_code="mindguard")

    mem_stat = profile.total_stats["mem"]
    base_cost = 50
    expected_cost = math.floor(
        math.floor(base_cost * (100.0 / (100.0 + mem_stat))) * 0.85
    )

    success, msg, _, _ = activate_skill(user, "algorithmic_cascade")
    assert success, msg

    profile.refresh_from_db()
    assert profile.mana == 200 - expected_cost
