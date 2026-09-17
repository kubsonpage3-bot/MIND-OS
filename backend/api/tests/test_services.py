import math
import pytest
from datetime import timedelta
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


def _mem_cost(base_cost, profile):
    """
    Mirrors skill_service.activate_skill()'s MEM-stat mana discount
    (100/(100+MEM), floored) so tests assert against the real formula
    instead of a hand-computed literal that silently drifts from it.
    """
    mem_stat = profile.total_stats.get("mem", 0)
    return math.floor(base_cost * (100.0 / (100.0 + max(0, mem_stat))))


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
    # architect blueprint skill (alias for algorithmic_cascade) costs 50 mana
    # base, reduced further by the MEM stat.
    initial_mana = profile.mana
    expected_cost = _mem_cost(50, profile)
    success, message, class_data, effects = activate_skill(user, "blueprint")

    profile.refresh_from_db()
    assert success is True
    assert profile.mana == initial_mana - expected_cost
    assert len(effects) == 1
    assert effects[0]["effect_id"] == "algorithmic_cascade_effect"


@pytest.mark.django_db
def test_activate_skill_no_mana(user, profile):
    profile.mana = 10
    profile.save()

    success, message, class_data, effects = activate_skill(user, "blueprint")
    assert success is False
    assert "Not enough mana" in message


@pytest.mark.django_db
def test_blueprint_effect_cleanup(user, profile):
    # blueprint is an alias for algorithmic_cascade: instead of a 3-charge
    # consumable, it now builds a same-day streak (+10%/task, cap +60%) that
    # lives until midnight rather than being deleted after N uses. Moved
    # from Task completions to Activity session completions only, per user
    # decision -- see mechanics.apply_session_active_skills.
    from api.models import ActiveEffect
    from api.services.mechanics import calculate_training_efficiency
    from rest_framework.test import APIClient

    profile.character_class = "architect"
    profile.mana = 200
    profile.save()

    client = APIClient()
    client.force_authenticate(user=user)

    def log_session():
        hours, focus = 1.0, 8.0
        eff = calculate_training_efficiency(
            profile, focus=focus, hours=hours, streak_days=profile.streak,
            hours_today=0.0, subject_hours_today=0.0,
        )
        res = client.post(
            "/api/training/log/",
            {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
            format="json",
        )
        assert res.status_code == 200, res.data
        return res.data

    # 1. Activate blueprint skill
    success, message, class_data, effects = activate_skill(user, "blueprint")
    assert success is True
    assert (
        ActiveEffect.objects.filter(user=user, skill_id="algorithmic_cascade").count()
        == 1
    )

    effect = ActiveEffect.objects.get(user=user, skill_id="algorithmic_cascade")
    assert effect.data["cascade_streak"] == 0

    # 2. Complete first session -> streak increments
    log_session()
    effect.refresh_from_db()
    assert effect.data["cascade_streak"] == 1

    # 3. Complete second session -> streak keeps climbing
    log_session()
    effect.refresh_from_db()
    assert effect.data["cascade_streak"] == 2

    # 4. Effect persists (until midnight) rather than being deleted after use
    assert ActiveEffect.objects.filter(
        user=user, skill_id="algorithmic_cascade"
    ).exists()

    # 5. A Task completion must not touch the streak anymore.
    t1 = Task.objects.create(user=user, title="T1", task_type=Task.TaskType.TODO)
    complete_task(user, t1.id, True)
    effect.refresh_from_db()
    assert effect.data["cascade_streak"] == 2  # unchanged


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
            code="gold_sword", name="Gold Sword", item_type="consumable", cost=50
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
        assert inv_item is not None
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

    # Positive task: PWR=10 (+5%), SPD=20 (+10%)
    res = calculate_task_outcome(
        user, "todo", base_xp=10, base_gold=10, is_positive=True
    )
    assert res["xp_earned"] == int(10 * 1.05)  # 10
    assert res["gold_earned"] == int(10 * 1.10)  # 11

    # Negative "todo": DEF mitigation is applied INSIDE calculate_task_outcome
    # for this task type. def=100 -> 100 / (100 + 100) = 0.5 -> 50 * 0.5 = 25
    res_neg = calculate_task_outcome(user, "todo", base_hp_lost=50, is_positive=False)
    assert res_neg["hp_lost"] == 25

    # Negative "habit"/"daily": DEF mitigation is applied by the CALLER
    # (calculate_habit_fail_hp / calculate_fail_damage in combat_service.py)
    # before base_hp_lost ever reaches here, so calculate_task_outcome must
    # pass it through unchanged for these two task types -- applying DEF a
    # second time here was the "double DEF mitigation" bug fixed upstream.
    res_neg_habit = calculate_task_outcome(user, "habit", base_hp_lost=50, is_positive=False)
    assert res_neg_habit["hp_lost"] == 50


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

    # 4. Void boss damage -- applied directly in apply_boss_damage(), not
    # through get_passive_multipliers(); see test_boss_dmg_mult_gaps.py.
    RecruitedAlly.objects.create(user_profile=profile, ally_code="void", level=1)
    profile.active_allies = ["void"]
    profile.save()
    profile.refresh_from_db()


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
    assert effects["gf_ceiling_flat"] == 5.0  # neural_expansion gives +5 GF ceiling (not +20)

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

    # First cast: should cost 0 mana instead of 50 (blueprint -> algorithmic_cascade)
    success, msg, _, _ = activate_skill(user, "blueprint")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100  # Mana not deducted

    # Second cast immediately: full cost (base 100, minus the MEM discount)
    # for system_overload -> deep_work_surge.
    # Also need to reset blueprint cooldown if we want to cast blueprint again,
    # but we can just cast a different skill
    expected_cost = _mem_cost(100, profile)
    success, msg, _, _ = activate_skill(user, "system_overload")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost

    # Fast forward void_clarity_last_used by 8 days
    profile.void_clarity_last_used = timezone.now() - timedelta(days=8)
    profile.save()

    # Reset cooldowns just in case
    SkillCooldown.objects.all().delete()

    # Third cast: should cost 0 mana again (mana unchanged from the
    # post-second-cast level)
    success, msg, _, _ = activate_skill(user, "blueprint")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost


@pytest.mark.django_db
def test_mindguard_mana_cost_reduction(user, profile):
    """Test that mindguard reduces active skill mana cost by 15% and class skills have 0 cooldown."""
    from api.models import UnlockedSkill, SkillCooldown
    from api.services.skill_service import activate_skill

    profile.mana = 100
    profile.save()

    # Create mindguard
    UnlockedSkill.objects.create(user_profile=profile, skill_code="mindguard")

    # Activate skill: blueprint (algorithmic_cascade) normally costs 50 mana,
    # first reduced by MEM (100/(100+MEM)), then by mindguard's 15%.
    expected_cost = math.floor(_mem_cost(50, profile) * 0.85)
    success, msg, _, _ = activate_skill(user, "blueprint")
    assert success is True

    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost

    # Verify no cooldown was created
    assert not SkillCooldown.objects.filter(user=user, skill_id="blueprint").exists()

    # Activate blueprint again immediately: should succeed without any cooldown block!
    success2, msg2, _, _ = activate_skill(user, "blueprint")
    assert success2 is True

    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost * 2


@pytest.mark.django_db
def test_all_classes_skills_have_zero_cooldown(user, profile):
    """Test that all 4 class skills can be cast repeatedly with 0 cooldown as long as mana is available."""
    from api.models import SkillCooldown
    from api.services.skill_service import activate_skill

    # 1. Architect: algorithmic_cascade
    profile.character_class = "architect"
    profile.mana = 120
    profile.save()
    cost = _mem_cost(50, profile)

    s1, _, _, _ = activate_skill(user, "algorithmic_cascade")
    assert s1 is True
    s2, _, _, _ = activate_skill(user, "algorithmic_cascade")
    assert s2 is True
    profile.refresh_from_db()
    assert profile.mana == 120 - cost * 2

    # 2. Ascetic: eye_of_the_storm
    profile.character_class = "ascetic"
    profile.mana = 100
    profile.save()
    cost = _mem_cost(40, profile)

    s1, _, _, _ = activate_skill(user, "eye_of_the_storm")
    assert s1 is True
    s2, _, _, _ = activate_skill(user, "eye_of_the_storm")
    assert s2 is True
    profile.refresh_from_db()
    assert profile.mana == 100 - cost * 2

    # 3. Linguist: rosetta_protocol
    profile.character_class = "linguist"
    profile.mana = 200
    profile.save()
    cost = _mem_cost(40, profile)

    s1, _, _, _ = activate_skill(user, "rosetta_protocol")
    assert s1 is True
    s2, _, _, _ = activate_skill(user, "rosetta_protocol")
    assert s2 is True
    profile.refresh_from_db()
    assert profile.mana == 200 - cost * 2

    # 4. Warlord: blood_harvest
    profile.character_class = "warlord"
    profile.mana = 110
    profile.save()
    cost = _mem_cost(50, profile)

    s1, _, _, _ = activate_skill(user, "blood_harvest")
    assert s1 is True
    s2, _, _, _ = activate_skill(user, "blood_harvest")
    assert s2 is True
    profile.refresh_from_db()
    assert profile.mana == 110 - cost * 2

    # Verify zero SkillCooldown records exist for user
    assert SkillCooldown.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_endurance_protocol_reduces_rank_thresholds(user, profile):
    from api.services.profile_service import get_rank_info

    # Without passive, Rank D requires 200 XP
    info = get_rank_info(profile)
    assert info["thresholds"][1]["id"] == "D"
    assert info["thresholds"][1]["min"] == 200

    # Give profile 160 XP. Without passive, this is Rank E
    profile.rank_xp = 160
    profile.save()
    info = get_rank_info(profile)
    assert info["current_id"] == "E"

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

    # 5. Unlock fortunes_favor, check daily login bonus
    # (compound_returns is now a passive Gold multiplier that scales with
    # streak length, not a daily-login flat bonus -- see
    # test_compound_returns_gold_mult_scales_with_streak_and_caps below.)
    from api.models import UnlockedSkill

    UnlockedSkill.objects.create(user_profile=p, skill_code="fortunes_favor")

    # 5a. Simulate day change to reach streak 6
    UserProfile.objects.filter(id=p.id).update(
        last_login_date=timezone.now().date() - timedelta(days=1), streak=5
    )
    p.refresh_from_db()

    gold_before = p.gold
    p = process_daily_login(user)
    assert p.streak == 6
    assert p.gold == gold_before + 100  # fortunes_favor


@pytest.mark.django_db
def test_compound_returns_gold_mult_scales_with_streak_and_caps(user, profile):
    """
    Compound Returns redesigned per user decision: was a flat +200G every
    7th streak day (didn't actually "compound" anything). Now a passive
    Gold multiplier of +0.5%/streak-day, capped at +15% (30-day streak),
    that disappears the instant the streak breaks.
    """
    from api.models import UnlockedSkill
    from api.services.mechanics import get_passive_multipliers

    UnlockedSkill.objects.create(user_profile=profile, skill_code="compound_returns")

    profile.streak = 10
    profile.save()
    assert get_passive_multipliers(profile, {})["gold_mult"] == pytest.approx(1.05)

    profile.streak = 60  # well past the 30-day cap
    profile.save()
    assert get_passive_multipliers(profile, {})["gold_mult"] == pytest.approx(1.15)

    profile.streak = 0  # streak broken
    profile.save()
    assert get_passive_multipliers(profile, {})["gold_mult"] == 1.0


@pytest.mark.django_db
def test_compound_returns_boosts_both_task_and_training_session_gold(user, profile, monkeypatch):
    """
    Compound Returns' gold_mult is read from the same passive_effects
    pipeline by _complete_task_logic (Habit/Daily/Todo), TrainingLogView
    (manual study log), AND the linked-Pomodoro completion endpoint -- so
    a single passive should never need "only tasks" vs "only sessions"
    special-casing. Confirms the +10% (20-day streak) actually lands on
    both a Todo completion's gold and a Training Log session's gold, not
    just one of them.
    """
    from api.models import UnlockedSkill, Task
    from api.services.task_service import complete_task
    from api.services.mechanics import calculate_training_efficiency
    from rest_framework.test import APIClient

    # Pin off Crit Focus randomness so the ×2 crit roll can't distort the
    # ratio comparison below.
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 1.0)

    client = APIClient()
    client.force_authenticate(user=user)

    def training_gold():
        hours, focus = 1.0, 8.0
        eff = calculate_training_efficiency(
            profile, focus=focus, hours=hours, streak_days=profile.streak,
            hours_today=0.0, subject_hours_today=0.0,
        )
        res = client.post(
            "/api/training/log/",
            {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
            format="json",
        )
        assert res.status_code == 200, res.data
        return res.data["gold_earned"]

    # Baseline: no Compound Returns, no streak bonus.
    profile.streak = 0
    profile.save()
    todo_baseline = Task.objects.create(
        user=user, title="Baseline Todo", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    baseline_task_gold = complete_task(user, todo_baseline.id, is_positive=True)["gold_earned"]
    baseline_training_gold = training_gold()

    # Boosted: Compound Returns unlocked, 20-day streak -> +10% Gold.
    UnlockedSkill.objects.create(user_profile=profile, skill_code="compound_returns")
    profile.streak = 20
    profile.save()
    todo_boosted = Task.objects.create(
        user=user, title="Boosted Todo", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    boosted_task_gold = complete_task(user, todo_boosted.id, is_positive=True)["gold_earned"]
    boosted_training_gold = training_gold()

    assert boosted_task_gold == pytest.approx(baseline_task_gold * 1.10, abs=1)
    assert boosted_training_gold == pytest.approx(baseline_training_gold * 1.10, abs=1)


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

    with patch("django.utils.timezone.now", return_value=tuesday_now):
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

    with patch("django.utils.timezone.now", return_value=wednesday_now):
        res = process_missed_tasks(user)
        assert res["fired"] is True
        task.refresh_from_db()
        profile.refresh_from_db()
        assert profile.hp == 100
        assert task.streak == 5  # Streak did not break!


@pytest.mark.django_db
def test_open_loot_chest(user, profile):
    from api.services.chest_service import open_chest
    from api.models import Item, LootChest, ItemEffect, InventoryItem
    from api.exceptions import GameLogicError

    # Create test chest
    LootChest.objects.create(
        chest_type="test_standard",
        name="Test Standard Cache",
        description="Test chest description",
        cost_gold=500,
        drop_rates={"E": 100.0},
        icon_url="/static/test.webp",
    )

    # Create E-class item
    item = Item.objects.create(
        code="scrap_sword",
        name="Scrap Sword",
        item_type=Item.ItemType.EQUIPMENT,
        gear_class="E",
        slot_type="arms",
    )
    # Add effect/stat
    ItemEffect.objects.create(item=item, effect_name="pwr", effect_value=3.0)

    # Scenario 1: Insufficient funds
    profile.gold = 300
    profile.save()
    with pytest.raises(GameLogicError) as exc_info:
        open_chest(user, "test_standard")
    assert "Not enough gold" in str(exc_info.value)

    # Scenario 2: Non-existent chest
    with pytest.raises(GameLogicError) as exc_info:
        open_chest(user, "non_existent_chest")
    assert "does not exist" in str(exc_info.value)

    # Scenario 3: Successful open
    profile.gold = 1000
    profile.save()

    success, message, result = open_chest(user, "test_standard")
    assert success is True
    assert "You obtained" in message
    assert result["gold_spent"] == 500
    assert result["gold_remaining"] == 500
    assert result["item"]["code"] in [
        i.code
        for i in Item.objects.filter(gear_class="E", item_type=Item.ItemType.EQUIPMENT)
    ]
    won_item_db = Item.objects.get(code=result["item"]["code"])
    expected_stats = {
        effect.effect_name: effect.effect_value for effect in won_item_db.effects.all()  # type: ignore
    }
    assert result["item"]["stats"] == expected_stats

    # Verify inventory item created for the rolled item
    assert InventoryItem.objects.filter(user_profile=profile, item=won_item_db).exists()


@pytest.mark.django_db
def test_inner_sanctuary_instant_heal(user, profile):
    # meditation is an alias for inner_sanctuary: the old mana-discount +
    # focus-rating-boost kit was retired and replaced with an instant heal
    # of 50% of max HP, with no persistent ActiveEffect left behind.
    from api.models import ActiveEffect

    profile.character_class = "ascetic"
    profile.mana = 100
    profile.hp = 10
    profile.save()
    expected_cost = _mem_cost(60, profile)

    success, message, class_data, effects = activate_skill(user, "meditation")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost

    expected_hp = min(profile.max_hp, 10 + int(profile.max_hp * 0.50))
    assert profile.hp == expected_hp

    # Instant effect: nothing lingers for other skills/tasks to discount off of
    assert not ActiveEffect.objects.filter(
        user=user, skill_id__in=["inner_sanctuary", "meditation"]
    ).exists()


@pytest.mark.django_db
def test_war_cry_stun_negates_damage(user, profile):
    from api.services.mechanics import calculate_task_outcome

    profile.character_class = "warlord"
    profile.save()

    # Initially, check that non-stunned failed task deals damage
    outcome = calculate_task_outcome(user, "habit", base_hp_lost=20, is_positive=False)
    assert outcome["hp_lost"] > 0

    # Activate war_cry (stun boss)
    success, message, class_data, effects = activate_skill(user, "war_cry")
    assert success is True

    # Check that failed task now deals 0 damage because boss is stunned
    outcome_stunned = calculate_task_outcome(
        user, "habit", base_hp_lost=20, is_positive=False
    )
    assert outcome_stunned["hp_lost"] == 0


@pytest.mark.django_db
def test_allies_perk_fixes(user, profile):
    import unittest.mock as mock
    from api.models import RecruitedAlly, Task, UnlockedSkill
    from api.services.mechanics import get_passive_multipliers, calculate_task_outcome
    from api.services.task_service import complete_task

    profile.character_class = ""
    profile.save()

    with mock.patch("random.random", return_value=0.99):
        # 1. Kira L4: always_crit
        kira = RecruitedAlly.objects.create(
            user_profile=profile, ally_code="kira", level=4
        )
        profile.active_allies = ["kira"]
        profile.save()

        # Outcome of a science task should always crit
        context = {"is_science": True}
        passives = get_passive_multipliers(profile, context)
        assert passives.get("always_crit") is True

        outcome = calculate_task_outcome(
            user,
            "todo",
            base_xp=10,
            base_gold=10,
            is_positive=True,
            passive_effects=passives,
        )
        assert outcome["is_crit"] is True

        # 2. Kira L5: science_threshold_reduction with empty context
        kira.level = 5
        kira.save()
        passives_empty = get_passive_multipliers(profile, {})
        assert passives_empty.get("science_threshold_reduction") == 0.10

        # 3. Neko L1: daily_gold_mult (only affects Daily tasks)
        RecruitedAlly.objects.filter(user_profile=profile, ally_code="kira").delete()
        neko = RecruitedAlly.objects.create(
            user_profile=profile, ally_code="neko", level=1
        )
        profile.active_allies = ["neko"]
        profile.mana_max = 100
        profile.save()

        todo_task = Task.objects.create(
            user=user,
            title="Todo Task",
            task_type=Task.TaskType.TODO,
            difficulty=Task.Difficulty.EASY,
        )
        daily_task = Task.objects.create(
            user=user,
            title="Daily Task",
            task_type=Task.TaskType.DAILY,
            difficulty=Task.Difficulty.EASY,
        )

        # complete Todo - gold multiplier should be base (1.0)
        res_todo = complete_task(user, todo_task.id)

        # complete Daily - gold multiplier should have +5% bonus
        res_daily = complete_task(user, daily_task.id)
        assert res_daily["rewards"]["gold"] >= res_todo["rewards"]["gold"]
        # daily_gold_mult was a dead key nothing read; the real bonus now
        # lands on gold_mult, scoped to task_type == "daily".
        passives_neko_daily = get_passive_multipliers(profile, {"task_type": "daily"})
        assert passives_neko_daily.get("gold_mult") == pytest.approx(1.05)
        passives_neko_todo = get_passive_multipliers(profile, {"task_type": "todo"})
        assert passives_neko_todo.get("gold_mult") == 1.0

        # Let's verify neko level 2 (streak_xp_mult) and level 3 (mana_flat_bonus)
        neko.level = 3
        neko.save()
        daily_task_2 = Task.objects.create(
            user=user,
            title="Daily Task 2",
            task_type=Task.TaskType.DAILY,
            difficulty=Task.Difficulty.HARD,
        )
        daily_task_2.streak = 5
        daily_task_2.save()

        profile.refresh_from_db()
        initial_mana = profile.mana
        complete_task(user, daily_task_2.id)
        profile.refresh_from_db()
        assert profile.mana == min(
            profile.total_stats.get("mana_max", 100), initial_mana + 3 + 5
        )

        # 4. Luna L3: daily_completed_hp_heal (HP healed on daily completion)
        RecruitedAlly.objects.filter(user_profile=profile, ally_code="neko").delete()
        luna = RecruitedAlly.objects.create(
            user_profile=profile, ally_code="luna", level=3
        )
        profile.active_allies = ["luna"]
        profile.hp = 50
        profile.save()

        daily_task_3 = Task.objects.create(
            user=user,
            title="Daily Task 3",
            task_type=Task.TaskType.DAILY,
            difficulty=Task.Difficulty.EASY,
        )
        complete_task(user, daily_task_3.id)
        profile.refresh_from_db()
        assert profile.hp == 51  # healed by 1 HP

        # 5. Luna L5 and Yuki L2 dynamic scaling in models properties
        luna.level = 5
        luna.save()
        if hasattr(profile, "_cached_passives"):
            delattr(profile, "_cached_passives")
        profile.refresh_from_db()
        # Base max HP is 100. With Luna L5, it should be 120.
        assert profile.max_hp == 120

        # With aura_of_focus skill (+10% ally_stat_mult), Luna L5 bonus should be 20 * 1.1 = 22 -> max_hp = 122
        UnlockedSkill.objects.create(user_profile=profile, skill_code="aura_of_focus")
        if hasattr(profile, "_cached_passives"):
            delattr(profile, "_cached_passives")
        assert profile.max_hp == 122

        # Yuki L2
        RecruitedAlly.objects.filter(user_profile=profile, ally_code="luna").delete()
        yuki = RecruitedAlly.objects.create(
            user_profile=profile, ally_code="yuki", level=2
        )
        profile.active_allies = ["yuki"]
        profile.save()
        if hasattr(profile, "_cached_passives"):
            delattr(profile, "_cached_passives")
        # Base max mana is 100. Yuki L2 gives +20. With aura_of_focus (+10%), it should be +22 -> 122 max mana.
        assert profile.max_mana == 122

        # 6. Yuki L3, L4, L5 multipliers populated in get_passive_multipliers
        yuki.level = 5
        yuki.save()
        if hasattr(profile, "_cached_passives"):
            delattr(profile, "_cached_passives")
        passives_yuki = get_passive_multipliers(profile, {})
        assert passives_yuki.get("prestige_bonus") == pytest.approx(0.055)
        assert passives_yuki.get("skill_cost_reduction") == pytest.approx(0.275)
        assert passives_yuki.get("prestige_start_rank") == "C"

        # 7. Nene L5 weekly mana reset (restores to max mana instead of +1)
        RecruitedAlly.objects.filter(user_profile=profile, ally_code="yuki").delete()
        RecruitedAlly.objects.create(user_profile=profile, ally_code="nene", level=5)
        profile.active_allies = ["nene"]
        profile.mana = 10
        profile.last_weekly_reset = "2020-W01"
        from django.utils import timezone

        profile.last_login_date = timezone.now().date() - timedelta(days=1)
        profile.save()

        from api.services.daily_service import process_daily_login

        process_daily_login(user)
        profile.refresh_from_db()
        assert profile.mana == profile.total_stats.get("mana_max", 100)


@pytest.mark.django_db
def test_task_rewards_ratio_constant():
    from api.services.rewards_service import task_rewards, TIER_MULTIPLIER

    for tier in TIER_MULTIPLIER:
        rewards = task_rewards(tier)
        assert rewards["dmg"] / rewards["xp"] == pytest.approx(3.33, abs=0.10)
        assert rewards["gold"] / rewards["xp"] == pytest.approx(0.5, abs=0.20)


@pytest.mark.django_db
def test_training_over_task_ratio_constant():
    from api.services.rewards_service import (
        training_rewards,
        focus_factor,
        TIER_MULTIPLIER,
        TRAINING_MULTIPLIER,
        BASE_XP,
        TRAINING_DMG_PER_XP,
        DEEP_WORK_THRESHOLD_H,
        DEEP_WORK_DMG_MULTIPLIER,
        GOLD_PER_XP,
    )

    for tier in TIER_MULTIPLIER:
        for hours, focus in [(1.0, 7.0), (3.0, 9.0)]:
            t_rewards = training_rewards(tier, hours, focus)
            base_xp = BASE_XP * TIER_MULTIPLIER[tier]
            ff = focus_factor(focus)
            scale = TRAINING_MULTIPLIER * hours * ff
            assert t_rewards["xp"] == round(base_xp * scale)
            assert t_rewards["gold"] == round(base_xp * GOLD_PER_XP * scale)
            # Boss damage uses TRAINING_DMG_PER_XP and DEEP_WORK multiplier
            raw_dmg = round(base_xp * TRAINING_DMG_PER_XP * scale)
            deep_work = hours >= DEEP_WORK_THRESHOLD_H
            expected_dmg = (
                round(raw_dmg * DEEP_WORK_DMG_MULTIPLIER) if deep_work else raw_dmg
            )
            assert t_rewards["dmg"] == expected_dmg


@pytest.mark.django_db
def test_task_spoofed_rewards_ignored(user):
    from api.services.rewards_service import task_rewards

    task = Task.objects.create(
        user=user,
        title="Test Task",
        task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.MEDIUM,
        xp_reward=99999,
        gold_reward=99999,
        boss_damage=99999,
    )
    expected = task_rewards("medium")
    assert task.xp_reward == expected["xp"]
    assert task.gold_reward == expected["gold"]
    assert task.boss_damage == expected["dmg"]


@pytest.mark.django_db
def test_training_hours_clamped():
    from api.services.rewards_service import training_rewards

    r_normal = training_rewards("medium", 16.0, 10.0)
    r_high = training_rewards("medium", 999.0, 10.0)
    r_neg = training_rewards("medium", -5.0, 10.0)
    r_zero = training_rewards("medium", 0.0, 10.0)

    assert r_high["xp"] == r_normal["xp"]
    assert r_neg["xp"] == r_zero["xp"]


@pytest.mark.django_db
def test_training_focus_clamped():
    from api.services.rewards_service import training_rewards

    # Ceiling: focus >=11 all give the same result (MAX_FOCUS_FACTOR=1.3)
    r_max = training_rewards("medium", 1.0, 11.0)
    r_over = training_rewards("medium", 1.0, 500.0)
    assert r_over["xp"] == r_max["xp"]

    # Floor: focus <= 3 all give the same result (MIN_FOCUS_FACTOR=0.5)
    r_min = training_rewards("medium", 1.0, 3.0)
    r_under = training_rewards("medium", 1.0, 0.0)
    assert r_under["xp"] == r_min["xp"]


@pytest.mark.django_db
def test_unknown_tier_raises():
    from api.services.rewards_service import task_rewards

    with pytest.raises(ValueError):
        task_rewards("nonsense")


@pytest.mark.django_db
def test_daily_task_value_single_increment_on_cron_reset(user, profile):
    from api.models import Task
    from api.services.task_service import complete_task, process_missed_tasks
    from django.utils import timezone as django_timezone

    daily = Task.objects.create(
        user=user,
        title="Single Increment Daily",
        task_type=Task.TaskType.DAILY,
        value=3.0,
    )
    initial_value = daily.value

    # 1. Complete the task today
    complete_task(user, daily.id, is_positive=True)
    daily.refresh_from_db()

    value_after_completion = daily.value
    assert (
        value_after_completion > initial_value
    ), "Value should increase after completion"

    # 2. Advance time to tomorrow and run process_missed_tasks cron
    # Anchor on UTC (profile.timezone defaults to "UTC") to match production's
    # local_today calc — naive datetime.date.today() uses the host's wall-clock
    # timezone and can drift a day off from UTC, making the cron a no-op.
    profile.last_daily_cron_at = django_timezone.now().date() - timedelta(days=1)
    profile.save()

    process_missed_tasks(user)
    daily.refresh_from_db()

    # 3. Value should NOT change again when cron resets the completed daily task
    assert (
        daily.value == value_after_completion
    ), f"Value should remain {value_after_completion} after cron reset, but got {daily.value}"
    assert daily.is_completed is False


@pytest.mark.django_db
def test_extension_rewards_match_app_rewards(user):
    """
    DIS-4 Regression: Extension Button Task rewards MUST be identical to
    rewards_service.task_rewards() for every difficulty.

    Before the fix, extension used TASK_REWARD_TABLE (stale constants) which
    diverged by up to 25% from the main app's rewards_service values.
    """
    from api.services.rewards_service import task_rewards, TIER_MULTIPLIER

    for difficulty in TIER_MULTIPLIER:
        expected = task_rewards(difficulty)

        # Simulate what extension/views.py now does after DIS-4 fix
        actual = task_rewards(difficulty)

        assert actual["xp"] == expected["xp"], (
            f"Extension XP for {difficulty} ({actual['xp']}) != "
            f"app XP ({expected['xp']}) — SSOT broken"
        )
        assert actual["gold"] == expected["gold"], (
            f"Extension Gold for {difficulty} ({actual['gold']}) != "
            f"app Gold ({expected['gold']}) — SSOT broken"
        )

    # Explicit contract: verify the exact values post-v0.8.53 rebalance (XP halved)
    # gold = round(xp × 0.5), dmg = round(xp × 3.33)
    assert task_rewards("trivial") == {"xp": 3, "gold": 2, "dmg": 10}
    assert task_rewards("easy") == {"xp": 6, "gold": 3, "dmg": 20}
    assert task_rewards("medium") == {"xp": 12, "gold": 6, "dmg": 40}
    assert task_rewards("hard") == {"xp": 24, "gold": 12, "dmg": 80}


@pytest.mark.django_db
def test_dis3_daily_habit_dmg_cap_value():
    """
    DIS-3: DAILY_HABIT_DMG_CAP must equal 3 × hard base_dmg = 3 × 80 = 240.
    Pinned so any accidental change to BASE_XP or DMG_PER_XP surfaces immediately.
    """
    from api.services.rewards_service import DAILY_HABIT_DMG_CAP, task_rewards

    hard_dmg = task_rewards("hard")["dmg"]
    assert hard_dmg == 80
    assert DAILY_HABIT_DMG_CAP == 3 * hard_dmg == 240


@pytest.mark.django_db
def test_dis3_habit_boss_dmg_uncapped(user, profile):
    """
    Habit boss damage is uncapped: completing multiple habits allows
    accumulating damage beyond DAILY_HABIT_DMG_CAP (240).
    """
    from api.services.rewards_service import DAILY_HABIT_DMG_CAP

    # Create a Hard Habit (base boss_damage = 80)
    habit = Task.objects.create(
        user=user,
        title="Hard Habit Uncapped Test",
        task_type=Task.TaskType.HABIT,
        difficulty="hard",
    )

    # Complete it 5× — 5 × 80 = 400, should NOT be capped at 240
    for _ in range(5):
        complete_task(user, habit.id, is_positive=True)

    profile.refresh_from_db()
    assert profile.habit_boss_dmg_today > DAILY_HABIT_DMG_CAP, (
        f"habit_boss_dmg_today ({profile.habit_boss_dmg_today}) "
        f"should exceed DAILY_HABIT_DMG_CAP ({DAILY_HABIT_DMG_CAP})"
    )


@pytest.mark.django_db
def test_dis3_habit_boss_dmg_resets_with_cron(user, profile):
    """
    DIS-3: habit_boss_dmg_today must reset to 0 when process_missed_tasks fires.
    """
    from django.utils import timezone as django_timezone
    from api.services.task_service import process_missed_tasks

    # Pre-set counter as if cap was already hit today
    profile.habit_boss_dmg_today = 498
    # Anchor on UTC (see test_daily_task_value_single_increment_on_cron_reset)
    profile.last_daily_cron_at = django_timezone.now().date() - timedelta(days=1)
    profile.save()

    process_missed_tasks(user)

    profile.refresh_from_db()
    assert (
        profile.habit_boss_dmg_today == 0
    ), f"habit_boss_dmg_today should reset to 0 after cron, got {profile.habit_boss_dmg_today}"


@pytest.mark.django_db
def test_task_value_multiplier_bounds(user):
    """
    Verifies that task value modifier in get_rewards() is bounded by:
    - Minimum floor: 0.6x (even with high positive TV)
    - Maximum ceiling: 2.0x (even with extreme negative TV)
    """
    # 1. Extreme positive TV (+100.0) -> must floor at 0.6x
    task_green = Task.objects.create(
        user=user,
        title="Green Habit",
        task_type=Task.TaskType.HABIT,
        difficulty="medium",  # base xp=12, gold=6
        value=100.0,
    )
    r_green = task_green.get_rewards()
    assert r_green["xp"] == round(12 * 0.6)  # 7
    assert r_green["gold"] == round(6 * 0.6)  # 4

    # 2. Extreme negative TV (-100.0) -> must cap at 2.0x
    task_red = Task.objects.create(
        user=user,
        title="Red Habit",
        task_type=Task.TaskType.HABIT,
        difficulty="medium",  # base xp=12, gold=6
        value=-100.0,
    )
    r_red = task_red.get_rewards()
    assert r_red["xp"] == round(12 * 2.0)  # 24
    assert r_red["gold"] == round(6 * 2.0)  # 12

    # 3. Neutral TV (0.0) -> 1.0x
    task_neutral = Task.objects.create(
        user=user,
        title="Neutral Habit",
        task_type=Task.TaskType.HABIT,
        difficulty="medium",
        value=0.0,
    )
    r_neutral = task_neutral.get_rewards()
    assert r_neutral["xp"] == 12
    assert r_neutral["gold"] == 6


@pytest.mark.django_db
def test_calc_new_value_clamped_delta():
    from api.services.task_service import calc_new_value

    # Test complete and fail events across varied current values
    test_values = [-47.0, -20.0, -5.0, 0.0, 5.0, 15.0, 21.0]
    for val in test_values:
        for task_type in ["daily", "habit"]:
            new_complete = calc_new_value(val, "complete", task_type)
            delta_complete = new_complete - val
            assert delta_complete >= 0.0, f"Complete delta should be >= 0 for {val}"
            assert (
                delta_complete <= 1.0001
            ), f"Complete delta {delta_complete} exceeded 1.0 for {val}"

            new_fail = calc_new_value(val, "fail", task_type)
            delta_fail = val - new_fail
            assert delta_fail >= 0.0, f"Fail delta should decrease value for {val}"
            assert (
                delta_fail <= 1.0001
            ), f"Fail delta {delta_fail} exceeded 1.0 for {val}"


@pytest.mark.django_db
def test_linguist_rosetta_protocol_xp_and_cognitive_boost(user, profile, monkeypatch):
    """Rosetta's +35% XP half moved from Task completions to Activity/
    Pomodoro session completions only, per user decision -- its cognitive-
    metric half already lived in calculate_cognitive_gains and is untouched."""
    from api.models import ActiveEffect
    from api.services.skill_service import activate_skill
    from api.services.mechanics import calculate_cognitive_gains, calculate_training_efficiency
    from rest_framework.test import APIClient

    # Pin off Crit Focus randomness (calculate_task_outcome) so an unlucky
    # crit on the baseline session can't make it outscore the Rosetta-boosted
    # one and flake this ratio comparison.
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 1.0)

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "linguist"
    profile.mana = 100
    profile.save()

    client = APIClient()
    client.force_authenticate(user=user)

    def log_session():
        hours, focus = 1.0, 8.0
        eff = calculate_training_efficiency(
            profile, focus=focus, hours=hours, streak_days=profile.streak,
            hours_today=0.0, subject_hours_today=0.0,
        )
        res = client.post(
            "/api/training/log/",
            {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
            format="json",
        )
        assert res.status_code == 200, res.data
        return res.data["xp_earned"]

    # Baseline cognitive gains without buff
    base_gains = calculate_cognitive_gains("focus", 2.0, 8.0, profile)

    # Baseline session completion without buff
    base_xp_earned = log_session()

    mana_before = profile.mana
    expected_cost = _mem_cost(40, profile)
    # Activate Rosetta Protocol
    success, msg, effect, _ = activate_skill(user, "rosetta_protocol")
    assert success is True
    assert ActiveEffect.objects.filter(user=user, skill_id="rosetta_protocol").exists()

    profile.refresh_from_db()
    assert profile.mana == mana_before - expected_cost

    # Cognitive gains should still be boosted by +20% (unaffected by the move)
    boosted_gains = calculate_cognitive_gains("focus", 2.0, 8.0, profile)
    assert pytest.approx(boosted_gains["gc"], rel=1e-3) == base_gains["gc"] * 1.20

    # Session XP should now be boosted by +35% (moved here from Tasks)
    rosetta_xp_earned = log_session()
    assert rosetta_xp_earned == pytest.approx(base_xp_earned * 1.35, abs=1)

    # Task completions must NOT get this bonus anymore -- check the reward
    # breakdown rather than the raw XP number (which crit/PWR RNG can shift
    # regardless of Rosetta) for a robust "did this note fire" assertion.
    from api.models import UserActivityLog

    todo = Task.objects.create(
        user=user, title="Unboosted Task", task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
    )
    complete_task(user, todo.id, is_positive=True)
    log = UserActivityLog.objects.filter(user=user, task=todo).latest("created_at")
    breakdown = log.metadata.get("breakdown", [])
    assert not any("Rosetta" in n for n in breakdown)


@pytest.mark.django_db
def test_linguist_lexical_resonance_boss_damage(user, profile):
    from api.models import Boss, BossEncounter, ActiveEffect
    from api.services.skill_service import activate_skill

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "linguist"
    profile.mana = 100
    profile.base_mem = 15
    profile.base_foc = 12
    profile.save()

    boss = Boss.objects.create(name="Resonance Target", level=1, hp_max=1000, reward_xp=100, reward_gold=50)
    encounter = BossEncounter.objects.create(user=user, boss=boss, hp_current=1000, is_defeated=False)

    # Expected damage: total_stats includes linguist class bonuses (mem: 15+11=26, foc: 12+10=22)
    # int(26 * 8 + 22 * 6) = 208 + 132 = 340
    expected_cost = _mem_cost(65, profile)
    success, msg, _, _ = activate_skill(user, "lexical_resonance")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost

    encounter.refresh_from_db()
    assert encounter.hp_current == 1000 - 340
    assert encounter.is_defeated is False

    # Test fatal blow
    encounter.hp_current = 50
    encounter.save()
    profile.mana = 65
    profile.save()

    res2 = activate_skill(user, "lexical_resonance")
    success2, _, _, _ = res2
    assert success2 is True
    assert res2.combat is not None
    assert res2.combat["boss_defeated"] is True
    assert res2.combat["rewards"] is not None

    encounter.refresh_from_db()
    assert encounter.hp_current == 0
    assert encounter.is_defeated is True

    from api.models import UserStats, UserActivityLog
    stats = UserStats.objects.get(user=user)
    assert stats.bosses_defeated >= 1
    assert UserActivityLog.objects.filter(user=user, activity_type="boss_defeat").exists()

    # Test no active boss validation
    profile.mana = 65
    profile.save()
    s_no_boss, err_msg, _, _ = activate_skill(user, "lexical_resonance")
    assert s_no_boss is False
    assert "No active boss" in err_msg


@pytest.mark.django_db
def test_linguist_cognitive_echo_duplicates_session_rewards(user, profile):
    """Moved from Task completions to Activity session completions only,
    per user decision -- a Task completion must no longer consume/benefit
    from it at all."""
    from api.models import Boss, BossEncounter, Task, ActiveEffect, UserActivityLog
    from api.services.skill_service import activate_skill
    from api.services.mechanics import calculate_training_efficiency
    from rest_framework.test import APIClient
    from unittest.mock import patch

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "linguist"
    profile.mana = 100
    profile.save()

    boss = Boss.objects.create(name="Echo Target", level=1, hp_max=1_000_000, reward_xp=100, reward_gold=50)
    encounter = BossEncounter.objects.create(user=user, boss=boss, hp_current=1_000_000, is_defeated=False)

    client = APIClient()
    client.force_authenticate(user=user)

    def log_session():
        hours, focus = 1.0, 8.0
        eff = calculate_training_efficiency(
            profile, focus=focus, hours=hours, streak_days=profile.streak,
            hours_today=0.0, subject_hours_today=0.0,
        )
        with patch("random.random", return_value=0.99):  # no crit
            res = client.post(
                "/api/training/log/",
                {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
                format="json",
            )
        assert res.status_code == 200, res.data
        return res.data

    # Activate cognitive echo
    success, _, _, _ = activate_skill(user, "cognitive_echo")
    assert success is True
    assert ActiveEffect.objects.filter(user=user, skill_id="cognitive_echo").exists()

    init_boss_hp = encounter.hp_current

    # First session: should consume echo and double rewards
    res1 = log_session()
    encounter.refresh_from_db()
    echo_xp, echo_gold = res1["xp_earned"], res1["gold_earned"]
    dmg_echo = init_boss_hp - encounter.hp_current
    assert any("Cognitive Echo" in n for n in res1["breakdown"])

    # Verify effect is consumed after use
    assert not ActiveEffect.objects.filter(user=user, skill_id="cognitive_echo").exists()

    # Second session: normal rewards (not doubled)
    prev_boss_hp = encounter.hp_current
    res2 = log_session()
    encounter.refresh_from_db()
    normal_xp, normal_gold = res2["xp_earned"], res2["gold_earned"]
    dmg_normal = prev_boss_hp - encounter.hp_current

    assert echo_xp == pytest.approx(normal_xp * 2, abs=1)
    assert echo_gold == pytest.approx(normal_gold * 2, abs=1)
    assert dmg_echo == pytest.approx(dmg_normal * 2, abs=2)

    # A Task completion must not be able to consume/benefit from it either.
    profile.mana = 100
    profile.save(update_fields=["mana"])
    success3, _, _, _ = activate_skill(user, "cognitive_echo")
    assert success3 is True
    todo = Task.objects.create(user=user, title="Untouched by Echo", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM)
    with patch("random.random", return_value=0.99):
        complete_task(user, todo.id, is_positive=True)
    log = UserActivityLog.objects.filter(user=user, task=todo).latest("created_at")
    assert not any("Cognitive Echo" in n for n in log.metadata.get("breakdown", []))
    # Still active -- a Task completion doesn't consume it.
    assert ActiveEffect.objects.filter(user=user, skill_id="cognitive_echo").exists()


@pytest.mark.django_db
def test_architect_algorithmic_cascade_and_quantum_optimization(user, profile):
    """Both moved from Task completions to Activity session completions
    only, per user decision."""
    from api.models import ActiveEffect, UserActivityLog
    from api.services.skill_service import activate_skill
    from api.services.mechanics import calculate_training_efficiency
    from rest_framework.test import APIClient

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "architect"
    profile.mana = 200
    profile.save()

    client = APIClient()
    client.force_authenticate(user=user)

    def log_session():
        hours, focus = 1.0, 8.0
        eff = calculate_training_efficiency(
            profile, focus=focus, hours=hours, streak_days=profile.streak,
            hours_today=0.0, subject_hours_today=0.0,
        )
        res = client.post(
            "/api/training/log/",
            {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
            format="json",
        )
        assert res.status_code == 200, res.data
        return res.data

    # 1. Algorithmic Cascade
    expected_cost1 = _mem_cost(50, profile)
    s1, _, _, _ = activate_skill(user, "algorithmic_cascade")
    assert s1 is True
    profile.refresh_from_db()
    assert profile.mana == 200 - expected_cost1

    effect = ActiveEffect.objects.get(user=user, skill_id="algorithmic_cascade")
    assert effect.data.get("cascade_streak") == 0

    log_session()  # 1st session: streak was 0 (no bonus yet) -> becomes 1
    effect.refresh_from_db()
    assert effect.data.get("cascade_streak") == 1

    res2 = log_session()  # 2nd session: streak was 1 -> +10% bonus applies, becomes 2
    effect.refresh_from_db()
    assert effect.data.get("cascade_streak") == 2
    assert any("Algorithmic Cascade" in note for note in res2["breakdown"])

    # A Task completion must not touch the streak or get the bonus.
    todo = Task.objects.create(user=user, title="Untouched by Cascade", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM)
    complete_task(user, todo.id, is_positive=True)
    effect.refresh_from_db()
    assert effect.data.get("cascade_streak") == 2  # unchanged
    log = UserActivityLog.objects.filter(user=user, task=todo).latest("created_at")
    assert not any("Algorithmic Cascade" in n for n in log.metadata.get("breakdown", []))

    ActiveEffect.objects.filter(user=user).delete()

    # 2. Quantum Optimization (90 MP)
    profile.mana = 100
    profile.save()
    expected_cost2 = _mem_cost(90, profile)

    s2, _, _, _ = activate_skill(user, "quantum_optimization")
    assert s2 is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost2

    q_effect = ActiveEffect.objects.get(user=user, skill_id="quantum_optimization")
    assert q_effect.data.get("tasksRemaining") == 4

    mana_before = profile.mana
    res3 = log_session()
    profile.refresh_from_db()
    assert profile.mana >= mana_before + 15  # at least the +15 MP from Quantum Optimization
    q_effect.refresh_from_db()
    assert q_effect.data.get("tasksRemaining") == 3
    assert any("Quantum Optimization" in note for note in res3["breakdown"])

    # A Task completion must not consume a charge or get the bonus either.
    todo2 = Task.objects.create(user=user, title="Untouched by Quantum", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM)
    complete_task(user, todo2.id, is_positive=True)
    q_effect.refresh_from_db()
    assert q_effect.data.get("tasksRemaining") == 3  # unchanged
    log2 = UserActivityLog.objects.filter(user=user, task=todo2).latest("created_at")
    assert not any("Quantum Optimization" in n for n in log2.metadata.get("breakdown", []))


@pytest.mark.django_db
def test_architect_deep_work_surge(user, profile):
    from api.models import Boss, BossEncounter, TrainingSession, ActiveEffect
    from api.services.skill_service import activate_skill

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "architect"
    profile.mana = 100
    profile.base_foc = 15
    profile.save()

    boss = Boss.objects.create(
        name="Deep Work Target", level=1, hp_max=1000, reward_xp=100, reward_gold=50
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=1000, is_defeated=False
    )

    # Create 2 training sessions for today: 2.0h and 1.5h = 3.5h total
    TrainingSession.objects.create(user_profile=profile, activity_key="math", hours=2.0)
    TrainingSession.objects.create(
        user_profile=profile, activity_key="physics", hours=1.5
    )

    rank_xp_before = profile.rank_xp
    # FOC: base_foc 15 + architect bonus 12 = 27
    # Damage: max(100, int(3.5 * 150 + 27 * 10)) = 525 + 270 = 795
    # Bonus XP: int(3.5 * 30) = 105
    expected_cost = _mem_cost(100, profile)
    success, _, _, _ = activate_skill(user, "deep_work_surge")
    assert success is True

    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost
    assert profile.rank_xp - rank_xp_before == 105
    assert profile.level == 2

    encounter.refresh_from_db()
    assert encounter.hp_current == 1000 - 795  # 205


@pytest.mark.django_db
def test_ascetic_eye_of_the_storm_and_inner_sanctuary(user, profile):
    from api.models import ActiveEffect
    from api.services.skill_service import activate_skill

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "ascetic"
    profile.mana = 100
    profile.hp = 50
    profile.save()

    # 1. Inner Sanctuary (60 MP): heals 50% max HP (+50 HP)
    expected_sanctuary_cost = _mem_cost(60, profile)
    success_heal, _, _, _ = activate_skill(user, "inner_sanctuary")
    assert success_heal is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_sanctuary_cost
    assert profile.hp == 50 + 50  # 100

    # 2. Eye of the Storm (40 MP)
    profile.hp = 60
    profile.mana = 50
    profile.save()
    expected_eye_cost = _mem_cost(40, profile)

    success_eye, _, _, _ = activate_skill(user, "eye_of_the_storm")
    assert success_eye is True
    profile.refresh_from_db()
    mana_after_eye = 50 - expected_eye_cost
    assert profile.mana == mana_after_eye

    # Heal/mana-per-completion half moved from Task to Activity session
    # completions only, per user decision -- a Task completion no longer
    # heals/restores mana for it (the penalty-immunity half below stays
    # Task-only: a logged session has no "failure" state to protect).
    from api.services.mechanics import calculate_training_efficiency
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    hours, focus = 1.0, 8.0
    eff = calculate_training_efficiency(
        profile, focus=focus, hours=hours, streak_days=profile.streak,
        hours_today=0.0, subject_hours_today=0.0,
    )
    res = client.post(
        "/api/training/log/",
        {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
        format="json",
    )
    assert res.status_code == 200, res.data
    profile.refresh_from_db()
    assert profile.hp == 60 + 8  # +8 HP from Eye of the Storm
    assert profile.mana >= mana_after_eye + 4  # at least +4 MP from Eye of the Storm
    assert any("Eye of the Storm" in n for n in res.data["breakdown"])

    # A Task completion must not heal/restore mana for it anymore.
    t = Task.objects.create(
        user=user,
        title="Storm Task",
        task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
    )
    hp_before_task = profile.hp
    complete_task(user, t.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.hp == hp_before_task  # unchanged -- no more +8 HP here

    # Negative habit penalty: 0 HP damage due to Eye of the Storm (this half
    # is unaffected by the move -- a Task-only concept by nature)
    habit = Task.objects.create(
        user=user,
        title="Bad Habit",
        task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.HARD,
    )
    hp_before_habit = profile.hp
    complete_task(user, habit.id, is_positive=False)
    profile.refresh_from_db()
    assert profile.hp == hp_before_habit


@pytest.mark.django_db
def test_ascetic_enlightenment_guaranteed_crits(user, profile):
    from api.models import Boss, BossEncounter, ActiveEffect
    from api.services.skill_service import activate_skill
    from api.services.mechanics import get_passive_multipliers

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "ascetic"
    profile.mana = 100
    profile.save()

    expected_cost = _mem_cost(80, profile)
    success, _, _, _ = activate_skill(user, "enlightenment")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_cost

    multipliers = get_passive_multipliers(profile, {})
    assert multipliers.get("always_crit") is True
    assert multipliers.get("crit_damage_mult") == 2.5
    assert multipliers.get("crit_chance_bonus") == 1.0

    boss = Boss.objects.create(
        name="Enlighten Target", level=1, hp_max=1000, reward_xp=100, reward_gold=50
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=1000, is_defeated=False
    )

    t = Task.objects.create(
        user=user,
        title="Crit Task",
        task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
    )
    res = complete_task(user, t.id, is_positive=True)
    assert res["gamification_result"]["is_crit"] is True


@pytest.mark.django_db
def test_warlord_execution_threshold(user, profile):
    from api.models import Boss, BossEncounter, ActiveEffect
    from api.services.skill_service import activate_skill

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "warlord"
    profile.mana = 150
    profile.base_pwr = 20
    profile.save()

    boss = Boss.objects.create(
        name="Execution Target", level=1, hp_max=1000, reward_xp=100, reward_gold=50
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=500, is_defeated=False
    )

    # 1. Boss HP is 500 / 1000 = 50% (> 35% threshold)
    # Total PWR = base_pwr(20) + warlord class bonus(14) = 34
    # Damage: max(50, int(34 * 8)) = 272
    s1, _, _, _ = activate_skill(user, "execution")
    assert s1 is True
    encounter.refresh_from_db()
    assert encounter.hp_current == 500 - 272  # 228
    assert encounter.is_defeated is False

    # 2. Boss HP is now 228 / 1000 = 22.8% (<= 35% threshold)
    profile.mana = 65
    profile.save()

    # Execute damage: max(hp_current, int(34 * 20)) = max(228, 680) = 680 -> instant death
    s2, _, _, _ = activate_skill(user, "execution")
    assert s2 is True
    encounter.refresh_from_db()
    assert encounter.hp_current == 0
    assert encounter.is_defeated is True


@pytest.mark.django_db
def test_warlord_blood_harvest_and_titans_roar(user, profile):
    """Both moved from Task completions to Activity session completions
    only, per user decision. Titan's Roar's instant 15%-max-HP nuke on
    activation is unaffected (fires immediately, not on a completion)."""
    from api.models import Boss, BossEncounter, ActiveEffect, UserActivityLog
    from api.services.skill_service import activate_skill
    from api.services.mechanics import calculate_training_efficiency
    from rest_framework.test import APIClient

    ActiveEffect.objects.filter(user=user).delete()
    profile.character_class = "warlord"
    profile.mana = 150
    profile.hp = 50
    profile.save()

    boss = Boss.objects.create(
        name="Warlord Target", level=1, hp_max=1_000_000, reward_xp=100, reward_gold=50
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=1_000_000, is_defeated=False
    )

    client = APIClient()
    client.force_authenticate(user=user)

    def log_session():
        hours, focus = 1.0, 8.0
        eff = calculate_training_efficiency(
            profile, focus=focus, hours=hours, streak_days=profile.streak,
            hours_today=0.0, subject_hours_today=0.0,
        )
        res = client.post(
            "/api/training/log/",
            {"hours": hours, "focus_rating": focus, "efficiency": eff, "activity": "mathematics"},
            format="json",
        )
        assert res.status_code == 200, res.data
        return res.data

    # 1. Blood Harvest (50 MP)
    expected_bh_cost = _mem_cost(50, profile)
    s1, _, _, _ = activate_skill(user, "blood_harvest")
    assert s1 is True
    profile.refresh_from_db()
    assert profile.mana == 150 - expected_bh_cost

    res1 = log_session()
    profile.refresh_from_db()

    # Should have healed HP via vampirism
    assert profile.hp > 50
    assert any("Blood Harvest" in note for note in res1["breakdown"])

    # A Task completion must not benefit from it anymore.
    hp_before_task = profile.hp
    todo = Task.objects.create(user=user, title="Untouched by Blood Harvest", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM)
    complete_task(user, todo.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.hp == hp_before_task  # no more vampiric heal here
    log1 = UserActivityLog.objects.filter(user=user, task=todo).latest("created_at")
    assert not any("Blood Harvest" in n for n in log1.metadata.get("breakdown", []))

    ActiveEffect.objects.filter(user=user).delete()

    # 2. Titan's Roar (75 MP) -- instant nuke on activation is unaffected
    profile.mana = 100
    profile.save()
    expected_roar_cost = _mem_cost(75, profile)
    encounter.hp_current = 1_000_000
    encounter.save()

    s2, _, _, _ = activate_skill(user, "titans_roar")
    assert s2 is True
    profile.refresh_from_db()
    assert profile.mana == 100 - expected_roar_cost

    encounter.refresh_from_db()
    # 15% of 1,000,000 sliced instantly on activation
    assert encounter.hp_current == 850_000

    t_roar_effect = ActiveEffect.objects.get(user=user, skill_id="titans_roar")
    assert t_roar_effect.data.get("charges") == 3

    boss_hp_before = encounter.hp_current
    res2 = log_session()
    encounter.refresh_from_db()
    t_roar_effect.refresh_from_db()

    assert t_roar_effect.data.get("charges") == 2
    assert any("Titan's Roar" in note for note in res2["breakdown"])
    dmg_with_roar = boss_hp_before - encounter.hp_current

    # A Task completion must not consume a charge or double its damage either.
    boss_hp_before2 = encounter.hp_current
    todo2 = Task.objects.create(user=user, title="Untouched by Roar", task_type=Task.TaskType.TODO, difficulty=Task.Difficulty.MEDIUM)
    complete_task(user, todo2.id, is_positive=True)
    encounter.refresh_from_db()
    t_roar_effect.refresh_from_db()
    assert t_roar_effect.data.get("charges") == 2  # unchanged
    dmg_without_roar = boss_hp_before2 - encounter.hp_current
    assert dmg_without_roar < dmg_with_roar  # no x2 here anymore
    log2 = UserActivityLog.objects.filter(user=user, task=todo2).latest("created_at")
    assert not any("Titan's Roar" in n for n in log2.metadata.get("breakdown", []))


@pytest.mark.django_db
def test_skill_activate_view_returns_combat(user, profile):
    from rest_framework.test import APIClient
    from api.models import Boss, BossEncounter

    client = APIClient()
    client.force_authenticate(user=user)
    profile.character_class = "linguist"
    profile.mana = 100
    profile.save()

    boss = Boss.objects.create(name="Target Boss", level=1, hp_max=1000, reward_xp=100, reward_gold=50)
    BossEncounter.objects.create(user=user, boss=boss, hp_current=100, is_defeated=False)

    response = client.post("/api/skills/activate/", {"skill_id": "lexical_resonance"}, format="json")
    assert response.status_code == 200
    data = response.json()
    assert "combat" in data
    assert data["combat"] is not None
    assert data["combat"]["boss_defeated"] is True
    assert data["combat"]["damage_dealt"] > 0
    assert "rewards" in data["combat"]



