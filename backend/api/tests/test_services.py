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
    assert daily.is_completed is True
    assert daily.last_completed_at is not None

    # Step 2: revert (misclick)
    complete_task(user, daily.id, False)
    daily.refresh_from_db()
    assert daily.is_completed is False
    assert daily.last_completed_at is None  # timestamp MUST be cleared

    # Step 3: complete again — must NOT raise "already completed today"
    result = complete_task(user, daily.id, True)
    daily.refresh_from_db()
    assert daily.is_completed is True
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
def test_custom_button_task_rewards(user, profile):
    from api.models import Task

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

    from django.test.client import RequestFactory
    from api.views import TrainingLogView
    from rest_framework.test import force_authenticate

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
    from api.services.combat_service import summon_boss

    # Setup boss encounter manually to avoid SCROLL_BOSSES_DICT constraints
    boss = Boss.objects.create(
        name="Test Boss", level=1, hp_max=1000, reward_xp=50, reward_gold=20
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=boss.hp_max, is_defeated=False
    )
    initial_boss_hp = encounter.hp_current

    # Complete To-Do (Toggle ON)
    result_on = complete_task(user, task.id, is_positive=True)

    encounter.refresh_from_db()
    hp_after_hit = encounter.hp_current
    assert (
        hp_after_hit < initial_boss_hp
    ), "Boss should take damage when To-Do is completed."

    # Revert To-Do (Toggle OFF)
    result_off = complete_task(user, task.id, is_positive=False)

    encounter.refresh_from_db()
    hp_after_revert = encounter.hp_current
    assert (
        hp_after_revert == initial_boss_hp
    ), "Boss HP should be fully restored on revert."
