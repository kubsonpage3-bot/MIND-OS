import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from api.constants import get_prestige_xp_required
from api.models import SkillCooldown


@pytest.mark.django_db
def test_prestige_snowball_mechanic():
    client = APIClient()
    # Create user
    from django.contrib.auth.models import User

    user = User.objects.create(username="test_prestige")
    profile = user.profile
    profile.rank_xp = 11000
    profile.prestige_count = 0
    profile.mana = 100
    profile.hp = 100
    profile.gold = 0
    profile.skill_points = 0
    profile.save()
    # Add skills
    profile.unlocked_skills.create(skill_code="focus_boost")
    profile.unlocked_skills.create(skill_code="endurance_protocol")
    SkillCooldown.objects.create(
        user=user, skill_id="blueprint", cooldown_until=timezone.now() + timedelta(hours=1)
    )

    assert profile.unlocked_skills.count() == 2

    client.force_authenticate(user=profile.user)

    # Cycle 1
    print("\n--- Prestige Cycle 1 ---")
    required = get_prestige_xp_required(profile.prestige_count)
    print(f"XP Required for Prestige 1: {required}")
    profile.rank_xp = required
    profile.save()

    response = client.post(reverse("profile-prestige"))
    assert response.status_code == 200

    profile.refresh_from_db()
    print(f"Rank XP after prestige: {profile.rank_xp}")
    print(f"Prestige Count: {profile.prestige_count}")
    print(f"Max Mana: {profile.mana_max}")
    print(f"Multiplier XP: {profile.total_stats['xp_multiplier']}")
    print(f"Multiplier Gold: {profile.total_stats['gold_multiplier']}")
    print(f"Unlocked Skills (should be 0): {profile.unlocked_skills.count()}")

    assert profile.prestige_count == 1
    assert profile.rank_xp == 0
    assert profile.unlocked_skills.count() == 0
    # Retains 6 refunded SP (from endurance_protocol) + 5 bonus prestige SP = 11
    assert profile.skill_points == 11
    assert profile.gf_ceiling == 110.0
    assert profile.gc_ceiling == 110.0
    assert profile.ps_ceiling == 110.0
    assert profile.vm_ceiling == 110.0
    # Raw fields the reward code actually reads (not total_stats, which adds
    # gear boosts on top and would pass even if these were never touched).
    assert profile.damage_multiplier == pytest.approx(1.1)
    assert profile.gold_multiplier == pytest.approx(1.15)
    assert profile.xp_multiplier == pytest.approx(1.15)
    # "All active skill cooldowns reset" is promised in the prestige UI.
    assert not SkillCooldown.objects.filter(user=user).exists()

    # Cycle 2
    print("\n--- Prestige Cycle 2 ---")
    required = get_prestige_xp_required(profile.prestige_count)
    print(f"XP Required for Prestige 2: {required}")
    profile.rank_xp = required
    profile.save()

    response = client.post(reverse("profile-prestige"))
    assert response.status_code == 200

    profile.refresh_from_db()
    print(f"Rank XP after prestige: {profile.rank_xp}")
    print(f"Prestige Count: {profile.prestige_count}")
    print(f"Max Mana: {profile.mana_max}")
    print(f"Multiplier XP: {profile.total_stats['xp_multiplier']}")
    print(f"Multiplier Gold: {profile.total_stats['gold_multiplier']}")
    assert profile.gf_ceiling == 115.0
    assert profile.gc_ceiling == 115.0
    assert profile.ps_ceiling == 115.0
    assert profile.vm_ceiling == 115.0

    # Cycle 3
    print("\n--- Prestige Cycle 3 ---")
    required = get_prestige_xp_required(profile.prestige_count)
    print(f"XP Required for Prestige 3: {required}")
    profile.rank_xp = required
    profile.save()

    response = client.post(reverse("profile-prestige"))
    assert response.status_code == 200

    profile.refresh_from_db()
    print(f"Rank XP after prestige: {profile.rank_xp}")
    print(f"Prestige Count: {profile.prestige_count}")
    print(f"Max Mana: {profile.mana_max}")
    print(f"Multiplier XP: {profile.total_stats['xp_multiplier']}")
    print(f"Multiplier Gold: {profile.total_stats['gold_multiplier']}")
    assert profile.gf_ceiling == 120.0
    assert profile.gc_ceiling == 120.0
    assert profile.ps_ceiling == 120.0
    assert profile.vm_ceiling == 120.0

    # Cycle 4
    print("\n--- Prestige Cycle 4 ---")
    required = get_prestige_xp_required(profile.prestige_count)
    print(f"XP Required for Prestige 4: {required}")
    profile.rank_xp = required
    profile.save()

    response = client.post(reverse("profile-prestige"))
    assert response.status_code == 200

    profile.refresh_from_db()
    print(f"Rank XP after prestige: {profile.rank_xp}")
    print(f"Prestige Count: {profile.prestige_count}")
    print(f"Max Mana: {profile.mana_max}")
    print(f"Multiplier XP: {profile.total_stats['xp_multiplier']}")
    print(f"Multiplier Gold: {profile.total_stats['gold_multiplier']}")
    assert profile.gf_ceiling == 125.0
    assert profile.gc_ceiling == 125.0
    assert profile.ps_ceiling == 125.0
    assert profile.vm_ceiling == 125.0


@pytest.mark.django_db
def test_ironman_forced_prestige_is_centralized_in_check_death():
    """
    Ironman's "HP hits 0 -> forced prestige" used to be duplicated as an
    "if ironman active" wrapper around check_death() at only 3 of the 8+
    call sites that can drop HP to 0 (task_service.py). Any other site
    (Meldor/Kage L3 HP costs, VivianDarkSacrificeView, CombatSyncView boss
    counter-attack, the tithe mutator) called check_death() directly and
    Ironman players got a normal death/demote instead of the promised
    forced prestige. Now centralized inside check_death() itself, so this
    is a single test instead of one per call site.
    """
    from django.contrib.auth.models import User
    from api.services.profile_service import check_death

    user = User.objects.create(username="test_ironman_death")
    profile = user.profile
    profile.prestige_count = 0
    profile.hp = 0
    profile.active_mutators = {"active": [{"id": "ironman"}], "purchased": ["ironman"]}
    profile.save()

    died = check_death(profile)

    profile.refresh_from_db()
    assert died is False  # forced prestige, not a normal death
    assert profile.prestige_count == 1
    assert profile.hp == profile.max_hp
    assert profile.level == 1
