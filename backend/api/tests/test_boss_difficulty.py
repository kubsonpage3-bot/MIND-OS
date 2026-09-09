import pytest
from unittest.mock import patch
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import UserProfile, BossEncounter
from api.services.combat_service import summon_boss


@pytest.fixture
def test_user(db):
    user = User.objects.create_user(username="diff_tester", password="password123")
    profile = user.profile
    profile.gold = 5000
    profile.save(update_fields=["gold"])
    return user


@pytest.mark.django_db
def test_summon_boss_difficulty_scaling(test_user):
    """
    Tests that EASY, NORMAL, HARD, EXTREME difficulties properly scale boss HP
    and reward_multiplier according to BOSS_DIFFICULTY_MULTIPLIERS.
    """
    profile = test_user.profile

    # 1. EASY: HP * 0.5, Reward * 0.8
    profile.boss_difficulty = "EASY"
    profile.save(update_fields=["boss_difficulty"])
    res_easy = summon_boss(test_user, "misted_wanderer")
    enc_easy = res_easy["encounter"]
    assert enc_easy.hp_current == 250  # 500 * 0.5
    assert enc_easy.reward_multiplier == 0.8
    assert enc_easy.boss.hp_max == 500

    # Defeat easy boss to clear active encounter
    enc_easy.is_defeated = True
    enc_easy.save(update_fields=["is_defeated"])

    # 2. NORMAL: HP * 1.0, Reward * 1.0
    profile.boss_difficulty = "NORMAL"
    profile.save(update_fields=["boss_difficulty"])
    res_norm = summon_boss(test_user, "misted_wanderer")
    enc_norm = res_norm["encounter"]
    assert enc_norm.hp_current == 500
    assert enc_norm.reward_multiplier == 1.0

    enc_norm.is_defeated = True
    enc_norm.save(update_fields=["is_defeated"])

    # 3. HARD: HP * 2.0, Reward * 1.5
    profile.boss_difficulty = "HARD"
    profile.save(update_fields=["boss_difficulty"])
    res_hard = summon_boss(test_user, "misted_wanderer")
    enc_hard = res_hard["encounter"]
    assert enc_hard.hp_current == 1000  # 500 * 2.0
    assert enc_hard.reward_multiplier == 1.5

    enc_hard.is_defeated = True
    enc_hard.save(update_fields=["is_defeated"])

    # 4. EXTREME: HP * 5.0, Reward * 2.5
    profile.boss_difficulty = "EXTREME"
    profile.save(update_fields=["boss_difficulty"])
    res_ext = summon_boss(test_user, "misted_wanderer")
    enc_ext = res_ext["encounter"]
    assert enc_ext.hp_current == 2500  # 500 * 5.0
    assert enc_ext.reward_multiplier == 2.5


@pytest.mark.django_db
def test_summon_boss_with_passive_hp_reduction(test_user):
    """
    Tests that passive boss_hp_reduction applies correctly on top of difficulty multiplier.
    """
    profile = test_user.profile
    profile.boss_difficulty = "HARD"  # Base HP 500 * 2.0 = 1000
    profile.save(update_fields=["boss_difficulty"])

    # Mock get_passive_multipliers to simulate a 10% boss HP reduction perk
    with patch(
        "api.services.mechanics.get_passive_multipliers",
        return_value={"boss_hp_reduction": 0.10},
    ):
        res = summon_boss(test_user, "misted_wanderer")
        enc = res["encounter"]
        # 500 * 2.0 * (1.0 - 0.10) = 900
        assert enc.hp_current == 900
        assert enc.reward_multiplier == 1.5


@pytest.mark.django_db
def test_api_summon_view_integrates_combat_service(test_user):
    """
    Ensures that POST /api/combat/summon/ invokes summon_boss and respects profile difficulty.
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    profile = test_user.profile
    profile.boss_difficulty = "HARD"
    profile.save(update_fields=["boss_difficulty"])

    response = client.post("/api/combat/summon/", {"boss_id": "nameless_bones"})
    assert response.status_code == 201
    data = response.json()
    assert "encounter" in data
    # Nameless bones has base HP 600. On HARD (2.0x), it should be 1200.
    assert data["encounter"]["hp_current"] == 1200
    assert data["encounter"]["reward_multiplier"] == 1.5


@pytest.mark.django_db
def test_profile_patch_updates_boss_difficulty(test_user):
    """
    Ensures that frontend can update boss_difficulty via PATCH /api/profile/.
    """
    client = APIClient()
    client.force_authenticate(user=test_user)

    response = client.patch("/api/profile/", {"boss_difficulty": "EXTREME"})
    assert response.status_code == 200
    assert response.json()["boss_difficulty"] == "EXTREME"

    test_user.profile.refresh_from_db()
    assert test_user.profile.boss_difficulty == "EXTREME"
