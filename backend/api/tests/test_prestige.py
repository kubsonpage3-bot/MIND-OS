import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from api.constants import get_prestige_xp_required


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
    profile.save()
    # Add skills
    profile.unlocked_skills.create(skill_code="focus_boost")
    profile.unlocked_skills.create(skill_code="endurance_protocol")

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
