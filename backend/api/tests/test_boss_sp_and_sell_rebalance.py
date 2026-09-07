import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from api.models import (
    UserProfile,
    Boss,
    BossEncounter,
    Item,
    InventoryItem,
)
from api.services.mechanics import apply_boss_damage
from api.services.shop_service import sell_item
from api.serializers.combat import BossSerializer
from api.serializers.profile import UserProfileSerializer


@pytest.fixture
def seeded_bosses(db):
    call_command("seed_bosses")
    # Ensure items exist
    Item.objects.get_or_create(
        code="wanderers_hood",
        defaults={
            "name": "Wanderer's Hood",
            "item_type": "equipment",
            "slot_type": "headware",
            "gear_class": "E",
            "boss_rank": "E",
            "cost": 70,
            "source": "boss_drop",
            "is_purchasable": False,
        },
    )
    Item.objects.get_or_create(
        code="mask_nameless",
        defaults={
            "name": "Mask of the Nameless",
            "item_type": "equipment",
            "slot_type": "headware",
            "gear_class": "SSS",
            "boss_rank": "SSS",
            "cost": 48000,
            "source": "boss_drop",
            "is_purchasable": False,
        },
    )


@pytest.mark.django_db
def test_boss_reward_sp_and_defeat_sync(seeded_bosses):
    """Verify that defeating an E-rank boss grants exactly 3 SP (not 1 or 5)."""
    user = User.objects.create_user(username="boss_sp_tester", password="password")
    profile = user.profile
    profile.skill_points = 0
    profile.save()

    # E-rank boss
    boss_e = Boss.objects.get(id_name="misted_wanderer")
    assert boss_e.reward_sp == 3
    assert boss_e.level == 1

    BossEncounter.objects.create(
        user=user, boss=boss_e, hp_current=boss_e.hp_max, is_defeated=False
    )

    result = apply_boss_damage(user, final_damage_dealt=boss_e.hp_max)
    assert result is not None
    assert result["boss_defeated"] is True
    assert result["rewards"]["boss_sp"] == 3

    profile.refresh_from_db()
    assert profile.skill_points == 3


@pytest.mark.django_db
def test_sss_boss_reward_sp(seeded_bosses):
    """Verify SSS rank boss awards 75 SP on defeat."""
    user = User.objects.create_user(username="sss_boss_tester", password="password")
    profile = user.profile
    profile.skill_points = 0
    profile.save()

    boss_sss = Boss.objects.get(id_name="nameless_god")
    assert boss_sss.reward_sp == 75

    BossEncounter.objects.create(
        user=user, boss=boss_sss, hp_current=boss_sss.hp_max, is_defeated=False
    )

    result = apply_boss_damage(user, final_damage_dealt=boss_sss.hp_max)
    assert result is not None
    assert result["boss_defeated"] is True
    assert result["rewards"]["boss_sp"] == 75

    profile.refresh_from_db()
    assert profile.skill_points == 75


@pytest.mark.django_db
def test_boss_drop_item_sell_rebalance(seeded_bosses):
    """Verify boss drop items sell for balanced amounts (~21-22G for E-rank)
    rather than the previous broken 180G.
    """
    user = User.objects.create_user(username="sell_rebalance_tester", password="password")
    profile = user.profile
    profile.gold = 0
    profile.save()

    item_hood = Item.objects.get(code="wanderers_hood")
    assert item_hood.gear_class == "E"
    assert item_hood.boss_rank == "E"
    assert item_hood.cost == 70

    InventoryItem.objects.create(
        user_profile=profile, item=item_hood, quantity=1
    )

    # Base sell rate is 30%: 70 * 0.30 = 21 Gold
    success, msg, p = sell_item(user, "wanderers_hood", quantity=1)
    assert success is True
    profile.refresh_from_db()
    assert profile.gold == 21


@pytest.mark.django_db
def test_boss_serializer_includes_reward_sp(seeded_bosses):
    """Verify BossSerializer returns reward_sp."""
    boss_e = Boss.objects.get(id_name="misted_wanderer")
    data = BossSerializer(boss_e).data
    assert "reward_sp" in data
    assert data["reward_sp"] == 3


@pytest.mark.django_db
def test_user_profile_inventory_includes_cost_and_boss_rank(seeded_bosses):
    """Verify UserProfileSerializer includes cost and boss_rank in inventory list."""
    user = User.objects.create_user(username="profile_inv_tester", password="password")
    profile = user.profile
    item_hood = Item.objects.get(code="wanderers_hood")
    InventoryItem.objects.create(user_profile=profile, item=item_hood, quantity=1)

    serializer = UserProfileSerializer(profile)
    inv = serializer.data["inventory"]
    assert len(inv) == 1
    assert inv[0]["code"] == "wanderers_hood"
    assert inv[0]["cost"] == 70
    assert inv[0]["boss_rank"] == "E"
    assert inv[0]["gear_class"] == "E"
