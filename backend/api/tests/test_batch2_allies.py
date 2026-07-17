import pytest
import random
import time
from django.contrib.auth.models import User
from unittest import mock
from api.models import (
    Task,
    Item,
    UserStats,
    RecruitedAlly,
    ActiveEffect,
    SkillCooldown,
    Boss,
    BossEncounter,
    InventoryItem,
    UnlockedSkill,
)
from api.services.task_service import complete_task
from api.services.shop_service import buy_item, sell_item
from api.services.chest_service import open_chest
from api.services.skill_service import activate_skill
from api.services.mechanics import apply_active_mutators, get_passive_multipliers


@pytest.fixture
def test_user_and_profile():
    # Use unique username to avoid conflicts
    user, _ = User.objects.get_or_create(username="test_allies_batch2_user")
    profile = user.profile
    profile.gold = 1000
    profile.rank_xp = 0
    profile.hp = 100
    profile.mana = 50
    profile.active_allies = []
    profile.active_mutators = {}
    profile.character_class = "ascetic"
    profile.save()

    # Ensure recruited allies are cleared for test
    profile.recruited_allies.all().delete()

    # Ensure stats exist and are empty
    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.unique_subjects_today = {}
    stats.save()

    # Ensure no active boss encounters for user
    BossEncounter.objects.filter(user=user).delete()

    # Create dummy boss and encounter
    boss, _ = Boss.objects.get_or_create(
        id_name="test_boss",
        defaults={
            "name": "Test Boss",
            "hp_max": 1000,
            "reward_xp": 100,
            "reward_gold": 100,
        },
    )
    BossEncounter.objects.create(user=user, boss=boss, hp_current=1000)

    # Clear skill cooldowns
    SkillCooldown.objects.filter(user=user).delete()

    # Clear items
    InventoryItem.objects.filter(user_profile=profile).delete()

    # Create dummy items
    Item.objects.get_or_create(
        code="test_sword",
        defaults={"name": "Test Sword", "item_type": "equipment", "cost": 100},
    )
    Item.objects.get_or_create(
        code="test_potion",
        defaults={"name": "Test Potion", "item_type": "consumable", "cost": 50},
    )
    Item.objects.get_or_create(
        code="test_iron",
        defaults={"name": "Iron Ore", "item_type": "material", "cost": 10},
    )

    # Unlock a skill to test activation
    UnlockedSkill.objects.get_or_create(user_profile=profile, skill_code="meditation")

    return user, profile, stats


@pytest.mark.django_db
def test_meldor_l1_todo_drop(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L1: Todo completion has 10% chance to drop ingredient but costs 2 HP
    meldor = RecruitedAlly.objects.create(
        user_profile=profile, ally_code="meldor", level=1
    )
    profile.active_allies = ["meldor"]
    profile.save()

    task = Task.objects.create(
        user=user, title="Todo Task", task_type=Task.TaskType.TODO, is_completed=False
    )

    with mock.patch("random.random", return_value=0.0):
        res = complete_task(user, task.id)
        profile.refresh_from_db()
        assert profile.hp == 98
        assert res["gamification_result"]["item_dropped"] == "test_iron"


@pytest.mark.django_db
def test_meldor_l2_mutator_boost(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L2: Increases active mutators' effects by +25% flat (+100% and +25% flat stacked with Parasite, max 5x cap)
    meldor = RecruitedAlly.objects.create(
        user_profile=profile, ally_code="meldor", level=2
    )
    profile.active_allies = ["meldor"]
    profile.active_mutators = {"active": [{"id": "miser"}]}
    profile.save()

    # Miser: shop cost multiplier = 0.8
    # With Meldor L2 (+25% deviation): deviation is -0.2 -> -0.2 * 1.25 = -0.25 -> shop_cost_mult becomes 0.75
    effects = apply_active_mutators(profile, {}, trigger_side_effects=False)
    assert effects["shop_cost_mult"] == 0.75

    # With Parasite: deviation is -0.2 -> -0.2 * 2.25 = -0.45 -> shop_cost_mult becomes 0.55
    profile.active_mutators = {"active": [{"id": "miser"}, {"id": "parasite"}]}
    profile.save()
    effects = apply_active_mutators(profile, {}, trigger_side_effects=False)
    assert effects["shop_cost_mult"] == 0.55


@pytest.mark.django_db
def test_meldor_l3_and_l5_sell(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    meldor = RecruitedAlly.objects.create(
        user_profile=profile, ally_code="meldor", level=3
    )
    profile.active_allies = ["meldor"]
    profile.save()

    # Give item to inventory
    sword = Item.objects.get(code="test_sword")
    InventoryItem.objects.create(user_profile=profile, item=sword, quantity=2)

    # Sell with 10% chance to yield ingredient instead of gold
    profile.gold = 100
    profile.save()
    with mock.patch("random.random", return_value=0.0):
        success, msg, profile = sell_item(user, "test_sword", quantity=1)
        profile.refresh_from_db()
        assert profile.gold == 100  # no gold added
        assert InventoryItem.objects.filter(
            user_profile=profile, item__item_type="material"
        ).exists()

    # Meldor L5: item sales yield 0 Gold
    meldor.level = 5
    meldor.save()
    InventoryItem.objects.filter(user_profile=profile).delete()
    InventoryItem.objects.create(user_profile=profile, item=sword, quantity=1)
    profile.gold = 100
    profile.save()
    with mock.patch("random.random", return_value=0.5):  # no ingredient drop
        success, msg, profile = sell_item(user, "test_sword", quantity=1)
        profile.refresh_from_db()
        assert profile.gold == 100  # 0 gold


@pytest.mark.django_db
def test_meldor_l4_expiration(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    meldor = RecruitedAlly.objects.create(
        user_profile=profile, ally_code="meldor", level=4
    )
    profile.active_allies = ["meldor"]
    # Add expired mutator: activated 10 days ago with duration 2 days
    now_ms = time.time() * 1000
    ten_days_ago_ms = now_ms - (10 * 24 * 3600 * 1000)
    profile.active_mutators = {
        "active": [{"id": "miser", "activatedAt": ten_days_ago_ms, "duration": 2}]
    }
    profile.mana = 20
    profile.save()

    # Trigger expiration check
    apply_active_mutators(profile, {}, trigger_side_effects=True)

    profile.refresh_from_db()
    # Expired miser mutator should be removed
    assert len(profile.active_mutators.get("active", [])) == 0
    # Mana deducted
    assert profile.mana == 5
    # Boss took 200 damage
    encounter = BossEncounter.objects.get(user=user)
    assert encounter.hp_current == 800


@pytest.mark.django_db
def test_bran_l1_and_l2(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L1: +8% drop chance, -10% Rank XP
    # L2: 15% shop/chest discount
    bran = RecruitedAlly.objects.create(user_profile=profile, ally_code="bran", level=2)
    profile.active_allies = ["bran"]
    profile.save()

    passives = get_passive_multipliers(profile, {})
    assert passives["drop_chance_bonus"] == 0.08
    assert passives["xp_mult"] == 0.90
    assert passives["shop_cost_mult"] == 0.85

    # Buy item with 15% discount
    profile.gold = 100
    profile.save()
    success, msg, profile = buy_item(user, "test_potion")  # base cost 50 -> 42
    profile.refresh_from_db()
    assert profile.gold == 58  # 100 - 42 = 58


@pytest.mark.django_db
def test_bran_l3_sell_equipment(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L3: sells gear for double gold, 20% ingredient drop
    bran = RecruitedAlly.objects.create(user_profile=profile, ally_code="bran", level=3)
    profile.active_allies = ["bran"]
    profile.save()

    sword = Item.objects.get(code="test_sword")
    InventoryItem.objects.create(user_profile=profile, item=sword, quantity=1)

    profile.gold = 100
    profile.save()
    # Base ratio is 0.4. Gear cost 100 -> sell value 40. Double makes it 80.
    with mock.patch("random.random", return_value=0.0):  # trigger 20% drop
        success, msg, profile = sell_item(user, "test_sword", quantity=1)
        profile.refresh_from_db()
        assert profile.gold == 160
        assert InventoryItem.objects.filter(
            user_profile=profile, item__item_type="material"
        ).exists()


@pytest.mark.django_db
def test_bran_l4_skill_hp_cost(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    bran = RecruitedAlly.objects.create(user_profile=profile, ally_code="bran", level=4)
    profile.active_allies = ["bran"]
    profile.hp = 100
    profile.mana = 100
    profile.save()

    success, message, class_data, effects = activate_skill(user, "meditation")
    assert success
    profile.refresh_from_db()
    assert profile.hp == 99


@pytest.mark.django_db
def test_bran_l5_chest_refund(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    from api.models import LootChest

    LootChest.objects.get_or_create(
        chest_type="standard",
        defaults={"name": "Standard Chest", "cost_gold": 100, "drop_rates": {"E": 1.0}},
    )

    bran = RecruitedAlly.objects.create(user_profile=profile, ally_code="bran", level=5)
    profile.active_allies = ["bran"]
    profile.gold = 100
    profile.save()

    with mock.patch("random.random", return_value=0.0):  # trigger 12% refund
        res = open_chest(user, "standard")
        profile.refresh_from_db()
        assert profile.gold == 100  # refunded completely
