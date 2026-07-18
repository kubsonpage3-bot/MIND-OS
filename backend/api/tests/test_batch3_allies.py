import pytest
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import (
    Task,
    Item,
    RecruitedAlly,
    SkillCooldown,
    Boss,
    BossEncounter,
    LootChest,
)
from api.services.task_service import complete_task, process_missed_tasks
from api.services.inventory_service import consume_item
from api.services.skill_service import activate_skill
from rest_framework.test import APIRequestFactory, force_authenticate
from api.views import VivianDarkSacrificeView, RheaChaosControlView


@pytest.fixture
def test_user_and_profile():
    # Use unique username to avoid conflicts
    user, _ = User.objects.get_or_create(username="test_allies_batch3_user")
    profile = user.profile
    profile.gold = 1000
    profile.rank_xp = 0
    profile.hp = 100
    profile.mana = 50
    profile.active_allies = []
    profile.grier_revenge_charges = 0
    profile.time_paradox_charges = 0
    profile.last_temporal_rewind_used = None
    profile.last_time_paradox_used = None
    profile.last_decoy_shadow_used = None
    profile.last_dark_sacrifice_used = None
    profile.last_chaos_control_used = None
    profile.tasks_completed_today = 0
    profile.active_mutators = {
        "active": [],
        "purchased": ["double_nothing", "parasite"],
    }
    profile.save()

    # Clear recruited allies
    profile.recruited_allies.all().delete()

    # Create LootChest
    LootChest.objects.get_or_create(
        chest_type="standard", defaults={"cost_gold": 100, "drop_rates": {"E": 1.0}}
    )
    # Create an E-class Item
    Item.objects.get_or_create(
        code="bronze_shield",
        defaults={
            "name": "Bronze Shield",
            "item_type": "equipment",
            "gear_class": "E",
            "slot_type": "offhand",
            "cost": 100,
        },
    )

    # Ensure no active boss encounters for user
    BossEncounter.objects.filter(user=user).delete()

    # Create dummy boss and encounter
    boss, _ = Boss.objects.get_or_create(
        id_name="test_boss_b3",
        defaults={
            "name": "Test Boss B3",
            "hp_max": 5000,
            "reward_xp": 100,
            "reward_gold": 100,
        },
    )
    BossEncounter.objects.create(user=user, boss=boss, hp_current=4000)

    # Clear skill cooldowns
    SkillCooldown.objects.filter(user=user).delete()

    return user, profile


@pytest.mark.django_db
def test_zephyr_l4_and_l5(test_user_and_profile):
    user, profile = test_user_and_profile

    # Recruit Zephyr Level 5
    RecruitedAlly.objects.create(user_profile=profile, ally_code="zephyr", level=5)
    profile.active_allies = ["zephyr"]
    profile.save()

    # Complete 3 Todo tasks: should yield -15% gold reward (tasks 1-3)
    task1 = Task.objects.create(
        user=user, title="Todo 1", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    complete_task(user, task1.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.tasks_completed_today == 1

    task2 = Task.objects.create(
        user=user, title="Todo 2", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    complete_task(user, task2.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.tasks_completed_today == 2

    task3 = Task.objects.create(
        user=user, title="Todo 3", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    complete_task(user, task3.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.tasks_completed_today == 3

    # Complete 4th Todo task: should grant a free chest (bronze_shield drops)
    task4 = Task.objects.create(
        user=user, title="Todo 4", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    res4 = complete_task(user, task4.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.tasks_completed_today == 4
    assert res4["rewards"]["gold"] > 0  # 4th task has normal gold rewards
    # Check that bronze_shield is in inventory
    assert profile.inventory_items.filter(item__code="bronze_shield").exists()

    # Zephyr L5: Grand Finale
    # Create two Daily tasks scheduled for today
    daily1 = Task.objects.create(
        user=user, title="Daily 1", task_type=Task.TaskType.DAILY, repeat_weekdays=127
    )
    daily2 = Task.objects.create(
        user=user, title="Daily 2", task_type=Task.TaskType.DAILY, repeat_weekdays=127
    )

    # Set mana to 10
    profile.mana = 10
    profile.save()

    # Complete daily 1
    complete_task(user, daily1.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.mana < profile.max_mana  # Not fully restored yet

    # Complete daily 2 (all active dailies now completed)
    encounter = BossEncounter.objects.get(user=user, is_defeated=False)
    hp_before = encounter.hp_current

    complete_task(user, daily2.id, is_positive=True)
    profile.refresh_from_db()

    # Check that mana is fully restored and boss took 600 damage
    assert profile.mana == profile.total_stats["mana_max"]
    encounter.refresh_from_db()
    assert encounter.hp_current <= hp_before - 600


@pytest.mark.django_db
def test_vivian_perks(test_user_and_profile):
    user, profile = test_user_and_profile

    vivian = RecruitedAlly.objects.create(
        user_profile=profile, ally_code="vivian", level=3
    )
    profile.active_allies = ["vivian"]
    profile.hp = 100
    profile.mana = 5  # Insufficient mana for iron_fast (requires 35 mana)
    profile.character_class = "ascetic"
    profile.save()

    # Verify potion block:
    potion, _ = Item.objects.get_or_create(
        code="health_potion",
        defaults={
            "name": "Health Potion",
            "item_type": "consumable",
            "hp_boost": 50,
            "cost": 50,
        },
    )
    profile.inventory_items.create(item=potion, quantity=2)

    success, msg, _ = consume_item(user, "health_potion")
    assert success is False
    assert "Blood Magic" in msg

    # Verify HP-casting:
    SkillCooldown.objects.filter(user=user, skill_id="iron_fast").delete()

    success, msg, _, _ = activate_skill(user, "iron_fast")
    assert success is True
    profile.refresh_from_db()
    assert profile.mana == 0
    assert profile.hp == 85  # Lost 15 HP

    task = Task.objects.create(
        user=user, title="Todo 1", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    complete_task(user, task.id, is_positive=True)
    profile.refresh_from_db()
    # 85 + 2 (Crimson Surge L3) + 5 (Iron Fast active skill heal) = 92 HP
    assert profile.hp == 92

    # Now level up Vivian to Level 4 to test Life Drain
    vivian.level = 4
    vivian.save()
    task2 = Task.objects.create(
        user=user, title="Todo 2", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    complete_task(user, task2.id, is_positive=True)
    profile.refresh_from_db()
    # 92 + 5 (Life Drain L4 is 10% of 50 boss damage) = 97 HP (or full 100 HP if skill heal triggers again)
    assert profile.hp >= 96

    # Vivian L2 Active Endpoint: Dark Sacrifice
    profile.hp = 50
    profile.save()
    # Add a cooldown for iron_fast
    SkillCooldown.objects.update_or_create(
        user=user,
        skill_id="iron_fast",
        defaults={"cooldown_until": timezone.now() + timedelta(hours=5)},
    )

    factory = APIRequestFactory()
    request = factory.post("/api/allies/vivian/dark-sacrifice/", {}, format="json")
    force_authenticate(request, user=user)

    view = VivianDarkSacrificeView.as_view()
    response = view(request)
    assert response.status_code == 200
    profile.refresh_from_db()
    assert profile.hp == 35  # Cost 15 HP
    assert not SkillCooldown.objects.filter(user=user, skill_id="iron_fast").exists()


@pytest.mark.django_db
def test_rhea_perks(test_user_and_profile):
    user, profile = test_user_and_profile

    # Recruit Rhea Level 5
    RecruitedAlly.objects.create(user_profile=profile, ally_code="rhea", level=5)
    profile.active_allies = ["rhea"]
    profile.active_mutators = {
        "active": ["double_nothing"],
        "purchased": ["double_nothing"],
    }
    profile.save()

    # Rhea L1 Cosmic Shuffle:
    stats1 = profile.total_stats
    assert "pwr" in stats1
    assert "foc" in stats1

    # Rhea L3: Gravity Well 4h daily extension & +30% miss damage
    Task.objects.create(
        user=user, title="Daily 1", task_type=Task.TaskType.DAILY, repeat_weekdays=127
    )
    profile.last_daily_cron_at = timezone.now().date() - timedelta(days=1)
    profile.hp = 100
    profile.save()

    process_missed_tasks(user)
    profile.refresh_from_db()
    assert profile.hp < 100

    # Rhea L2 active endpoint: Chaos Control
    factory = APIRequestFactory()
    request = factory.post("/api/allies/rhea/chaos-control/", {}, format="json")
    force_authenticate(request, user=user)

    view = RheaChaosControlView.as_view()
    response = view(request)
    assert response.status_code == 200
    profile.refresh_from_db()
    active_muts = profile.active_mutators.get("active", [])
    assert len(active_muts) == 1
    assert active_muts[0]["id"] != "double_nothing"
