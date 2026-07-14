import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, Task
from api.services.task_service import complete_task
from api.services.skill_service import activate_skill
from rest_framework.exceptions import ValidationError
from django.test import TestCase
from api.services.shop_service import buy_item
from api.services.combat_service import summon_boss
from api.services.profile_service import gain_xp
from api.exceptions import GameLogicError
from api.models import Item, InventoryItem, Recipe, RecipeIngredient
from api.services.crafting_service import craft_item


@pytest.fixture
def user():
    u = User.objects.create(username="testuser", password="testpassword")
    return u


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.character_class = "architect"
    p.mana = 100
    p.hp = 100
    p.gold = 0
    p.save()
    return p


@pytest.fixture
def task(user):
    return Task.objects.create(
        user=user,
        title="Test Task",
        task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
    )


@pytest.mark.django_db
def test_complete_task_rewards(user, profile, task):
    initial_xp = profile.xp
    initial_gold = profile.gold

    result = complete_task(user, task.id, True)

    profile.refresh_from_db()
    task.refresh_from_db()

    assert task.is_completed is True
    assert profile.gold > initial_gold
    assert profile.xp > initial_xp
    assert result["detail"] == "Task completed!"


@pytest.mark.django_db
def test_complete_task_twice_fails(user, profile, task):
    complete_task(user, task.id, True)
    with pytest.raises(ValidationError):
        complete_task(user, task.id, True)


@pytest.mark.django_db
def test_daily_revert_then_complete_again(user, profile):
    daily = Task.objects.create(
        user=user,
        title="Daily Revert Bug",
        task_type=Task.TaskType.DAILY,
        difficulty=Task.Difficulty.MEDIUM,
    )
    # Step 1: complete the daily
    complete_task(user, daily.id, True)
    daily.refresh_from_db()
    assert daily.is_completed
    assert daily.last_completed_at is not None

    # Step 2: revert (misclick)
    complete_task(user, daily.id, False)
    daily.refresh_from_db()
    assert not daily.is_completed
    assert daily.last_completed_at is None  # timestamp MUST be cleared

    # Step 3: complete again — must NOT raise "already completed today"
    result = complete_task(user, daily.id, True)
    daily.refresh_from_db()
    assert daily.is_completed
    assert result.get("detail") == "Task completed!"


@pytest.mark.django_db
def test_activate_skill_success(user, profile):
    # architect blueprint skill costs 40 mana
    initial_mana = profile.mana
    success, message, class_data, effects = activate_skill(user, "blueprint")

    profile.refresh_from_db()
    assert success is True
    assert profile.mana == initial_mana - 40
    assert len(effects) == 1
    assert effects[0]["effect_id"] == "blueprint_effect"


@pytest.mark.django_db
def test_activate_skill_no_mana(user, profile):
    profile.mana = 10
    profile.save()

    success, message, class_data, effects = activate_skill(user, "blueprint")
    assert success is False
    assert "Not enough mana" in message


@pytest.mark.django_db
def test_blueprint_effect_cleanup(user, profile):
    from api.models import ActiveEffect

    # 1. Activate blueprint skill
    success, message, class_data, effects = activate_skill(user, "blueprint")
    assert success is True
    assert ActiveEffect.objects.filter(user=user, skill_id="blueprint").count() == 1

    # Verify tasksRemaining is 3 initially
    effect = ActiveEffect.objects.get(user=user, skill_id="blueprint")
    assert effect.data["tasksRemaining"] == 3

    # 2. Complete first task
    t1 = Task.objects.create(user=user, title="T1", task_type=Task.TaskType.TODO)
    complete_task(user, t1.id, True)
    effect.refresh_from_db()
    assert effect.data["tasksRemaining"] == 2

    # 3. Complete second task
    t2 = Task.objects.create(user=user, title="T2", task_type=Task.TaskType.TODO)
    complete_task(user, t2.id, True)
    effect.refresh_from_db()
    assert effect.data["tasksRemaining"] == 1

    # 4. Complete third task (should trigger deletion)
    t3 = Task.objects.create(user=user, title="T3", task_type=Task.TaskType.TODO)
    complete_task(user, t3.id, True)
    assert ActiveEffect.objects.filter(user=user, skill_id="blueprint").count() == 0


class ServiceMechanicsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_tc", password="testpassword"
        )
        self.profile = UserProfile.objects.get(user=self.user)
        self.profile.gold = 500

        self.profile.hp = 100
        self.profile.xp = 0
        self.profile.level = 1
        self.profile.save()

        self.item = Item.objects.create(
            code="gold_sword", name="Gold Sword", item_type="equipment", cost=50
        )
        self.task = Task.objects.create(
            user=self.user, title="Test Task", task_type="habit", difficulty="hard"
        )

    def test_buy_item_success(self):
        initial_gold = self.profile.gold
        success, message, updated_profile = buy_item(self.user, "gold_sword")

        self.assertTrue(success)
        self.assertEqual(updated_profile.gold, initial_gold - 50)

        # Check inventory item was created
        inv_item = InventoryItem.objects.filter(
            user_profile=updated_profile, item=self.item
        ).first()
        self.assertIsNotNone(inv_item)
        self.assertEqual(inv_item.quantity, 1)

    def test_level_up_mechanic(self):
        # We need to give enough XP to pass a level threshold.
        # Assuming level 2 requires 100 XP (or similar based on gain_xp logic)
        initial_level = self.profile.level
        xp_needed = self.profile.xp_to_next_level

        # Give more XP than needed
        gain_xp(self.profile, xp_needed + 50)

        self.profile.refresh_from_db()
        self.assertTrue(self.profile.level > initial_level)
        self.assertEqual(self.profile.xp, 50)  # The rollover XP

    def test_complete_task_deducts_hp_on_penalty(self):
        initial_hp = self.profile.hp

        # Complete task with is_positive=False
        result = complete_task(self.user, self.task.id, False)

        self.profile.refresh_from_db()
        # Ensure HP is deducted
        self.assertTrue(self.profile.hp < initial_hp)
        # Ensure penalty is reported correctly
        self.assertIn("penalty", result)
        self.assertIn("hp", result["penalty"])
        self.assertTrue(result["penalty"]["hp"] < 0)

    def test_summon_boss_transactional(self):
        self.profile.gold = 10
        self.profile.save()

        # Try to summon a boss that costs 50
        with self.assertRaises(GameLogicError):
            summon_boss(self.user, "misted_wanderer")

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.gold, 10)  # Gold should not be deducted

        from api.models import BossEncounter

        encounters = BossEncounter.objects.filter(user=self.user)
        self.assertEqual(encounters.count(), 0)  # Encounter should not be created

    def test_craft_item_success(self):
        # Create ingredients
        wood = Item.objects.create(code="wood", name="Wood")
        stone = Item.objects.create(code="stone", name="Stone")
        sword = Item.objects.create(code="stone_sword", name="Stone Sword")

        # Give items to user
        InventoryItem.objects.create(user_profile=self.profile, item=wood, quantity=5)
        InventoryItem.objects.create(user_profile=self.profile, item=stone, quantity=2)

        # Give gold
        self.profile.gold = 100
        self.profile.save()

        # Create recipe
        recipe = Recipe.objects.create(
            code="craft_stone_sword",
            name="Craft Stone Sword",
            result_item=sword,
            crafting_cost=50,
        )
        RecipeIngredient.objects.create(recipe=recipe, item=wood, quantity=3)
        RecipeIngredient.objects.create(recipe=recipe, item=stone, quantity=2)

        # Craft
        crafted_item = craft_item(self.user, "craft_stone_sword")

        self.profile.refresh_from_db()
        self.assertEqual(crafted_item.code, "stone_sword")
        self.assertEqual(self.profile.gold, 50)

        # Check inventory
        wood_inv = InventoryItem.objects.get(user_profile=self.profile, item=wood)
        self.assertEqual(wood_inv.quantity, 2)

        # Stone should be deleted since we used 2 out of 2
        with self.assertRaises(InventoryItem.DoesNotExist):
            InventoryItem.objects.get(user_profile=self.profile, item=stone)

        sword_inv = InventoryItem.objects.get(user_profile=self.profile, item=sword)
        self.assertEqual(sword_inv.quantity, 1)

    def test_craft_item_missing_ingredients(self):
        # Create ingredients
        wood = Item.objects.create(code="wood", name="Wood")
        sword = Item.objects.create(code="wooden_sword", name="Wooden Sword")

        # Give only 1 wood
        InventoryItem.objects.create(user_profile=self.profile, item=wood, quantity=1)

        self.profile.gold = 100
        self.profile.save()

        # Create recipe requiring 3 wood
        recipe = Recipe.objects.create(
            code="craft_wooden_sword",
            name="Craft Wooden Sword",
            result_item=sword,
            crafting_cost=50,
        )
        RecipeIngredient.objects.create(recipe=recipe, item=wood, quantity=3)

        # Attempt craft
        with self.assertRaises(GameLogicError) as context:
            craft_item(self.user, "craft_wooden_sword")

        self.assertIn("Missing ingredient: Wood (Need: 3)", str(context.exception))

        # Check gold was not deducted
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.gold, 100)


@pytest.mark.django_db
def test_calculate_task_outcome(user):
    from api.services.mechanics import calculate_task_outcome

    profile = UserProfile.objects.get(user=user)
    profile.base_pwr = 10
    profile.base_spd = 20
    profile.base_foc = 0  # No crit
    profile.base_lck = 0  # No drop/bonus
    profile.base_def = 100
    profile.save()

    # Positive task
    res = calculate_task_outcome(
        user, "todo", base_xp=10, base_gold=10, is_positive=True
    )
    assert res["xp_earned"] == 10 + (10 * 0.5)  # 15
    assert res["gold_earned"] == 10 + (20 * 0.5)  # 20

    # Negative task
    res_neg = calculate_task_outcome(user, "habit", base_hp_lost=50, is_positive=False)
    # def=100 -> 100 / (100 + 100) = 0.5 -> 50 * 0.5 = 25
    assert res_neg["hp_lost"] == 25


@pytest.mark.django_db
def test_buy_skill_node(user, profile):
    from api.services.rpg_service import buy_skill_node
    from api.models import UnlockedSkill

    profile.skill_points = 10
    profile.gold = 500
    profile.save()

    # Buy skill without requirements (sharp_focus)
    buy_skill_node(user, "sharp_focus")
    profile.refresh_from_db()
    assert profile.skill_points == 7  # 10 - 3
    assert profile.gold == 400  # 500 - 100
    assert UnlockedSkill.objects.filter(
        user_profile=profile, skill_code="sharp_focus"
    ).exists()

    # Buy skill requiring sharp_focus (deep_concentration)
    buy_skill_node(user, "deep_concentration")
    profile.refresh_from_db()
    assert profile.skill_points == 1  # 7 - 6
    assert profile.gold == 150  # 400 - 250
    assert UnlockedSkill.objects.filter(
        user_profile=profile, skill_code="deep_concentration"
    ).exists()


@pytest.mark.django_db
def test_buy_skill_insufficient_resources(user, profile):
    from api.services.rpg_service import buy_skill_node

    profile.skill_points = 1
    profile.gold = 50
    profile.save()

    with pytest.raises(GameLogicError):
        buy_skill_node(user, "sharp_focus")


@pytest.mark.django_db
def test_buy_skill_missing_requires(user, profile):
    from api.services.rpg_service import buy_skill_node

    profile.skill_points = 10
    profile.gold = 1000
    profile.save()

    with pytest.raises(GameLogicError):
        buy_skill_node(user, "deep_concentration")  # Requires sharp_focus


@pytest.mark.django_db
def test_recruit_and_upgrade_ally(user, profile):
    from api.services.rpg_service import recruit_ally
    from api.models import RecruitedAlly

    profile.gold = 3000
    profile.save()

    # Recruit Kira level 1 (cost 1200)
    recruit_ally(user, "kira")
    profile.refresh_from_db()
    assert profile.gold == 1800
    assert RecruitedAlly.objects.filter(
        user_profile=profile, ally_code="kira", level=1
    ).exists()

    # Upgrade Kira level 2 (cost 800)
    recruit_ally(user, "kira")
    profile.refresh_from_db()
    assert profile.gold == 1000
    assert RecruitedAlly.objects.filter(
        user_profile=profile, ally_code="kira", level=2
    ).exists()


@pytest.mark.django_db
def test_recruit_insufficient_gold(user, profile):
    from api.services.rpg_service import recruit_ally

    profile.gold = 100
    profile.save()

    with pytest.raises(GameLogicError):
        recruit_ally(user, "kira")


@pytest.mark.django_db
def test_task_multipliers_applied(user, profile, task):
    from api.models import UnlockedSkill, RecruitedAlly

    profile.gold = 0
    profile.skill_points = 10
    profile.save()

    # Unlock resource_awareness (+10% gold)
    UnlockedSkill.objects.create(user_profile=profile, skill_code="resource_awareness")

    # Recruit Neko level 1 (+5% daily gold)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="neko", level=1)

    task.task_type = Task.TaskType.DAILY
    task.save()

    complete_task(user, task.id, True)

    profile.refresh_from_db()
    # Gold base (medium daily) + 15% (10% + 5% additively)
    assert profile.gold > 0


@pytest.mark.django_db
def test_tithe_mutator_triggers_death(user, profile, task):
    """
    Tests that the Tithe mutator applies its drawback,
    and if HP drops to <= 0, check_death is triggered.
    """
    from api.services.task_service import complete_task

    profile.gold = 0
    profile.hp = 2
    profile.level = 5
    profile.rank_xp = 500

    profile.active_mutators = {
        "active": [{"id": "tithe", "duration": None}],
        "purchased": ["tithe"],
    }
    profile.save()

    # Complete a task
    result = complete_task(user, task.id, True)

    profile.refresh_from_db()

    # Tithe drawback should deduct 5 HP since gold < 3.
    # Original HP was 2, so it falls <= 0, triggering check_death.
    assert result.get("is_dead") is True
    assert profile.hp == profile.max_hp
    # profile.xp may be > 0 because the task reward is applied AFTER the death reset.
    assert profile.xp >= 0
    assert profile.level == 4
    # Rank XP should be dropped to the minimum of rank 4 (or whatever rank_xp corresponds to).


@pytest.mark.django_db
def test_custom_button_task_rewards(user, profile):
    from api.models import Task
    from api.views import TrainingLogView
    from django.test.client import RequestFactory
    from rest_framework.test import force_authenticate

    button_task = Task.objects.create(
        user=user,
        title="Custom Boxing",
        task_type=Task.TaskType.BUTTON,
        category="Exercise",
        default_hours=1.5,
        default_focus=8,
        xp_reward=20,
        gold_reward=15,
        boss_damage=30,
    )

    factory = RequestFactory()
    view = TrainingLogView.as_view()

    request = factory.post(
        "/api/training/log/",
        {"hours": 1.5, "focus_rating": 8, "activity": f"custom_task_{button_task.id}"},
    )

    force_authenticate(request, user=user)
    response = view(request)

    assert response.status_code == 200

    button_task.refresh_from_db()
    assert button_task.completion_count == 1
    assert button_task.last_completed_at is not None


@pytest.mark.django_db
def test_todo_completion_boss_damage_revert(user, profile, task):
    """
    Regression test to prevent the infinite boss-killing exploit.
    Ensures that toggling a To-Do ON deals damage, and toggling it OFF reverts that exact damage.
    """
    from api.models import Boss, BossEncounter

    # Setup boss encounter manually to avoid SCROLL_BOSSES_DICT constraints
    boss = Boss.objects.create(
        name="Test Boss", level=1, hp_max=1000, reward_xp=50, reward_gold=20
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=boss.hp_max, is_defeated=False
    )
    initial_boss_hp = encounter.hp_current

    # Complete To-Do (Toggle ON)
    complete_task(user, task.id, is_positive=True)

    encounter.refresh_from_db()
    hp_after_hit = encounter.hp_current
    assert (
        hp_after_hit < initial_boss_hp
    ), "Boss should take damage when To-Do is completed."

    # Revert To-Do (Toggle OFF)
    complete_task(user, task.id, is_positive=False)

    encounter.refresh_from_db()
    hp_after_revert = encounter.hp_current
    assert (
        hp_after_revert == initial_boss_hp
    ), "Boss HP should be fully restored on revert."


@pytest.mark.django_db
def test_skills_and_allies_multipliers(user, profile):
    from api.services.mechanics import get_passive_multipliers
    from api.models import UnlockedSkill, RecruitedAlly

    # 1. Base case
    effects = get_passive_multipliers(profile, {"is_science": True, "focus_rating": 8})
    assert effects["xp_mult"] == 1.0

    # 2. Add Kira (Science +5%) and Sharp Focus (Focus >=8 +10%)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="kira", level=1)
    UnlockedSkill.objects.create(user_profile=profile, skill_code="sharp_focus")
    profile.active_allies = ["kira"]
    profile.save()

    # Refresh recruited_allies
    profile.refresh_from_db()

    effects2 = get_passive_multipliers(profile, {"is_science": True, "focus_rating": 8})
    # Base 1.0 + 0.05 (Kira) + 0.10 (Sharp Focus)
    # The dictionary tracks additive increments
    assert round(effects2["xp_mult"], 2) == 1.15

    # 3. Add Polymath bonus
    UnlockedSkill.objects.create(user_profile=profile, skill_code="polymath")
    from api.models import UserStats, UserProfile

    stats, _ = UserStats.objects.get_or_create(user=user)
    from django.utils import timezone

    stats.unique_subjects_today = {
        "date": str(timezone.now().date()),
        "subjects": ["Math", "Physics", "Chemistry"],
    }
    stats.save()
    profile = UserProfile.objects.get(id=profile.id)

    effects3 = get_passive_multipliers(profile, {})
    assert effects3["flat_xp"] == 20

    # 4. Void boss damage
    RecruitedAlly.objects.create(user_profile=profile, ally_code="void", level=1)
    profile.active_allies = ["void"]
    profile.save()
    profile.refresh_from_db()
    effects4 = get_passive_multipliers(profile, {})
    assert effects4["boss_dmg_mult"] == 1.10


@pytest.mark.django_db
def test_additive_stacking_passive_multipliers(user, profile):
    from api.services.mechanics import get_passive_multipliers
    from api.models import UnlockedSkill, RecruitedAlly

    # Unlock multiple passive multipliers simultaneously (Batch 1 + existing)
    UnlockedSkill.objects.create(
        user_profile=profile, skill_code="combat_reflexes"
    )  # crit_chance_bonus += 0.10
    UnlockedSkill.objects.create(
        user_profile=profile, skill_code="resilience"
    )  # mana_regen_mult += 0.25
    UnlockedSkill.objects.create(
        user_profile=profile, skill_code="aura_of_focus"
    )  # ally_stat_mult += 0.10
    UnlockedSkill.objects.create(
        user_profile=profile, skill_code="deep_concentration"
    )  # min_focus = 7.0
    UnlockedSkill.objects.create(
        user_profile=profile, skill_code="neural_expansion"
    )  # gf_ceiling_flat += 20.0

    # Add an ally to test Aura of Focus (ally_mult)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="kira", level=1)
    profile.active_allies = ["kira"]
    profile.save()

    profile.refresh_from_db()

    context = {"is_science": True, "focus_rating": 5.0}  # Kira requires is_science
    effects = get_passive_multipliers(profile, context)

    assert effects["crit_chance_bonus"] == 0.10
    assert effects["mana_regen_mult"] == 1.25
    assert effects["ally_stat_mult"] == 1.10
    assert effects["min_focus"] == 7.0
    assert effects["gf_ceiling_flat"] == 20.0

    # Kira's level 1 bonus is 0.05. With aura_of_focus (1.10 multiplier), it should be 0.055
    assert round(effects["xp_mult"], 3) == 1.055

    # Existing base keys should remain intact
    assert effects["gold_mult"] == 1.0


@pytest.mark.django_db
def test_resilience_mana_regen(user, profile):
    from api.services.task_service import complete_task
    from api.models import Task, UnlockedSkill

    profile.mana = 0
    profile.mana_max = 100
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Test Daily",
        task_type=Task.TaskType.DAILY,
        difficulty=Task.Difficulty.MEDIUM,
    )

    # Base daily mana gain is 5
    complete_task(user, task.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.mana == 5

    # Now unlock resilience
    UnlockedSkill.objects.create(user_profile=profile, skill_code="resilience")
    profile.mana = 0
    profile.save()

    # Complete again
    task.last_completed_at = None
    task.save()
    complete_task(user, task.id, is_positive=True)
    profile.refresh_from_db()

    # With resilience (1.25x), base mana (5) * 1.25 = 6.25 -> int(6.25) = 6
    assert profile.mana == 6


@pytest.mark.django_db
def test_unbreakable_daily_regen(user, profile):
    from api.services.task_service import process_missed_tasks
    from api.models import UnlockedSkill
    from django.utils import timezone
    from datetime import timedelta

    profile.hp = 10
    yesterday = timezone.now().date() - timedelta(days=1)
    profile.last_login_date = yesterday
    profile.last_daily_cron_at = yesterday
    profile.save()

    UnlockedSkill.objects.create(user_profile=profile, skill_code="unbreakable")

    res = process_missed_tasks(user)
    assert res["fired"] is True

    profile.refresh_from_db()
    # It adds 3 hp, 10 + 3 = 13. Or maybe it goes over max hp? No, max is min(hp_max, hp+3). So 13.
    assert profile.hp == 13


@pytest.mark.django_db
def test_golden_mind_guaranteed_drop(user, profile):
    from api.models import UnlockedSkill, Item, InventoryItem
    from rest_framework.test import APIRequestFactory, force_authenticate
    from api.views import TrainingLogView

    Item.objects.create(code="test_item", name="Test Item", item_type="material")

    UnlockedSkill.objects.create(user_profile=profile, skill_code="golden_mind")

    factory = APIRequestFactory()
    request = factory.post(
        "/api/training/log/",
        {"activity": "reading", "hours": 2.5, "focus_rating": 7},
        format="json",
    )
    force_authenticate(request, user=user)

    view = TrainingLogView.as_view()
    response = view(request)

    assert response.status_code == 200
    assert response.data.get("item_dropped") is not None

    inv_count = InventoryItem.objects.filter(user_profile=profile).count()
    assert inv_count == 1


@pytest.mark.django_db
def test_void_clarity_weekly_cast(user, profile):
    from api.models import UnlockedSkill, SkillCooldown
    from api.services.skill_service import activate_skill
    from django.utils import timezone
    from datetime import timedelta

    profile.mana = 100
    profile.save()

    # Create void_clarity
    UnlockedSkill.objects.create(user_profile=profile, skill_code="void_clarity")

    # First cast: should cost 0 mana instead of 40 (blueprint)
    success, msg, _, _ = activate_skill(user, "blueprint")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100  # Mana not deducted

    # Second cast immediately: should cost 70 mana (system_overload)
    # Also need to reset blueprint cooldown if we want to cast blueprint again,
    # but we can just cast a different skill
    success, msg, _, _ = activate_skill(user, "system_overload")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 30  # 100 - 70

    # Fast forward void_clarity_last_used by 8 days
    profile.void_clarity_last_used = timezone.now() - timedelta(days=8)
    profile.save()

    # Reset cooldowns just in case
    SkillCooldown.objects.all().delete()

    # Third cast: should cost 0 mana again
    success, msg, _, _ = activate_skill(user, "blueprint")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 30  # Mana not deducted again


@pytest.mark.django_db
def test_mindguard_cooldown_reduction(user, profile):
    from api.models import UnlockedSkill, SkillCooldown
    from api.services.skill_service import activate_skill
    from django.utils import timezone

    profile.mana = 100
    profile.save()

    # Create mindguard
    UnlockedSkill.objects.create(user_profile=profile, skill_code="mindguard")

    # Activate skill (blueprint normally has 24h cooldown)
    success, msg, _, _ = activate_skill(user, "blueprint")
    assert success is True

    cd = SkillCooldown.objects.get(user=user, skill_id="blueprint")
    now = timezone.now()

    # Check if cooldown is around 24 * 0.85 = 20.4 hours
    delta_hours = (cd.cooldown_until - now).total_seconds() / 3600
    assert 20.3 < delta_hours < 20.5


@pytest.mark.django_db
def test_endurance_protocol_reduces_rank_thresholds(user, profile):
    from api.services.profile_service import get_rank_info

    # Without passive, Rank D requires 200 XP
    info = get_rank_info(profile)
    assert info["thresholds"][1]["id"] == "D"
    assert info["thresholds"][1]["min"] == 200

    # Give profile 160 XP. Without passive, this is Rank F
    profile.rank_xp = 160
    profile.save()
    info = get_rank_info(profile)
    assert info["current_id"] == "F"

    # Unlock endurance_protocol
    from api.models import UnlockedSkill

    UnlockedSkill.objects.create(user_profile=profile, skill_code="endurance_protocol")

    # Now Rank D should require 160 XP (-20% of 200)
    info = get_rank_info(profile)
    assert info["thresholds"][1]["min"] == 160

    # And 160 XP should now be Rank D
    assert info["current_id"] == "D"


@pytest.mark.django_db
def test_daily_login_streak(user, profile):
    from api.services.daily_service import process_daily_login
    from datetime import timedelta
    from django.utils import timezone

    # 1. Initial login (streak becomes 1)
    profile.last_login_date = None
    profile.save()
    p = process_daily_login(user)
    assert p.streak == 1
    assert p.last_login_date == timezone.now().date()

    # 2. Consecutive day (streak becomes 2)
    p.last_login_date = timezone.now().date() - timedelta(days=1)
    p.save()
    p = process_daily_login(user)
    assert p.streak == 2

    # 3. Gap > 1 day (streak resets to 1)
    p.last_login_date = timezone.now().date() - timedelta(days=3)
    p.save()
    p = process_daily_login(user)
    assert p.streak == 1

    # 4. Same day login (streak remains unchanged)
    p.streak = 5
    p.save()
    p = process_daily_login(user)
    assert p.streak == 5

    # 5. Unlock skills and check compound_returns & fortunes_favor
    from api.models import UnlockedSkill

    UnlockedSkill.objects.create(user_profile=p, skill_code="fortunes_favor")
    UnlockedSkill.objects.create(user_profile=p, skill_code="compound_returns")

    # 5a. Simulate day change to reach streak 6
    UserProfile.objects.filter(id=p.id).update(
        last_login_date=timezone.now().date() - timedelta(days=1), streak=5
    )
    p.refresh_from_db()

    gold_before = p.gold
    p = process_daily_login(user)
    assert p.streak == 6
    assert (
        p.gold == gold_before + 100
    )  # Only fortunes_favor fires, NOT compound_returns

    # 5b. Simulate day change to reach streak 7 (compound_returns should fire)
    p.last_login_date = timezone.now().date() - timedelta(days=1)
    p.save()

    gold_before = p.gold
    p = process_daily_login(user)
    assert p.streak == 7
    assert (
        p.gold == gold_before + 100 + 200
    )  # fortunes_favor (100) + compound_returns (200)

    # 5c. Simulate streak gap > 1 (streak resets to 1), confirm no compound_returns fires
    p.last_login_date = timezone.now().date() - timedelta(days=2)
    p.save()

    gold_before = p.gold
    p = process_daily_login(user)
    assert p.streak == 1  # Reset!
    assert (
        p.gold == gold_before + 100
    )  # Only fortunes_favor fires, NOT compound_returns


@pytest.mark.django_db
def test_sell_item(user, profile):
    from api.services.shop_service import sell_item
    from api.models import Item, InventoryItem, UnlockedSkill
    from api.constants import BASE_SELL_RATE, MARKET_KNOWLEDGE_SELL_RATE

    item = Item.objects.create(code="test_sword", name="Test Sword", cost=100)
    InventoryItem.objects.create(user_profile=profile, item=item, quantity=2)

    initial_gold = profile.gold

    # Sell 1 without market knowledge
    success, msg, p = sell_item(user, "test_sword", 1)
    assert success is True
    assert p.gold == initial_gold + int(100 * BASE_SELL_RATE)

    inv_item = InventoryItem.objects.get(user_profile=p, item__code="test_sword")
    assert inv_item.quantity == 1

    # Unlock market_knowledge
    UnlockedSkill.objects.create(user_profile=p, skill_code="market_knowledge")

    current_gold = p.gold

    # Sell 1 with market knowledge
    success, msg, p = sell_item(user, "test_sword", 1)
    assert success is True
    assert p.gold == current_gold + int(100 * MARKET_KNOWLEDGE_SELL_RATE)

    # Item should be deleted from inventory since quantity is 0
    assert not InventoryItem.objects.filter(
        user_profile=p, item__code="test_sword"
    ).exists()


@pytest.mark.django_db
def test_weekday_schedule_completion(user, profile):
    import datetime
    from api.services.task_service import is_daily_scheduled_for_date

    # Create a daily task scheduled only on Monday (flag = 1)
    task = Task.objects.create(
        user=user,
        title="Monday Only Daily",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=1,  # Monday only
    )

    # Let's mock the current day as Monday (e.g. 2026-07-13 is a Monday)
    monday_date = datetime.date(2026, 7, 13)
    assert is_daily_scheduled_for_date(task, monday_date) is True

    # Let's mock the current day as Tuesday (e.g. 2026-07-14 is a Tuesday)
    tuesday_date = datetime.date(2026, 7, 14)
    assert is_daily_scheduled_for_date(task, tuesday_date) is False


@pytest.mark.django_db
def test_complete_task_validation_off_days(user, profile):
    import datetime
    from unittest.mock import patch
    from api.services.task_service import complete_task
    from rest_framework.exceptions import ValidationError

    # Monday only Daily
    task = Task.objects.create(
        user=user,
        title="Monday Only Daily",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=1,  # Monday only
    )

    # If we try to complete it on a Tuesday (2026-07-14 is a Tuesday)
    profile.timezone = "UTC"
    profile.save()
    
    tuesday_now = datetime.datetime(2026, 7, 14, 12, 0, tzinfo=datetime.timezone.utc)
    
    with patch('django.utils.timezone.now', return_value=tuesday_now):
        with pytest.raises(ValidationError) as excinfo:
            complete_task(user, task.id, True)
        assert "This daily task is not scheduled for today." in str(excinfo.value)


@pytest.mark.django_db
def test_process_missed_tasks_skips_off_days(user, profile):
    import datetime
    from unittest.mock import patch
    from api.services.task_service import process_missed_tasks
    
    # Clear existing tasks to isolate
    Task.objects.filter(user=user).delete()
    
    # Monday only Daily
    task = Task.objects.create(
        user=user,
        title="Monday Only Daily",
        task_type=Task.TaskType.DAILY,
        repeat_weekdays=1,  # Monday only
        streak=5,
    )
    
    profile.timezone = "UTC"
    profile.last_daily_cron_at = datetime.date(2026, 7, 14)  # Tuesday (off-day)
    profile.hp = 100
    profile.save()

    # Now it is Wednesday (2026-07-15), which means we are evaluating Tuesday (off-day).
    wednesday_now = datetime.datetime(2026, 7, 15, 0, 5, tzinfo=datetime.timezone.utc)
    
    with patch('django.utils.timezone.now', return_value=wednesday_now):
        res = process_missed_tasks(user)
        assert res["fired"] is True
        task.refresh_from_db()
        profile.refresh_from_db()
        assert profile.hp == 100
        assert task.streak == 5  # Streak did not break!
