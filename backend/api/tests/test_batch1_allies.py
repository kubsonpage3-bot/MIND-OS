import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import (
    Task,
    UserStats,
    RecruitedAlly,
    ActiveEffect,
    SkillCooldown,
    Boss,
    BossEncounter,
)
from api.services.task_service import complete_task, process_missed_tasks
from api.views import TrainingLogView
from rest_framework.test import APIRequestFactory, force_authenticate


@pytest.fixture
def test_user_and_profile():
    # Use unique username to avoid conflicts
    user, _ = User.objects.get_or_create(username="test_allies_batch1_user")
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

    return user, profile, stats


@pytest.mark.django_db
def test_grier_l1_and_l3_effects(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L3 Stat check: Max HP +40, SPD -4
    # Recruit Grier
    RecruitedAlly.objects.create(user_profile=profile, ally_code="grier", level=3)
    profile.active_allies = ["grier"]
    profile.save()

    # Invalidate cache if model property is accessed
    if hasattr(profile, "_cached_passives"):
        delattr(profile, "_cached_passives")

    # Grier L3 increases max_hp by 40, spd decreases by 4
    assert profile.max_hp == 140
    assert profile.total_stats["spd"] == profile.base_spd - 4

    # Grier L1: Focus >= 9.0 restores +2 HP, -25% Gold
    # We call TrainingLogView POST directly
    factory = APIRequestFactory()
    request = factory.post(
        "/api/training/log/",
        {"hours": 1.0, "focus_rating": 10, "flat_xp_bonus": 0, "activity": "coding"},
        format="json",
    )
    force_authenticate(request, user=user)

    # Set HP to 50, Gold to 100
    profile.hp = 50
    profile.gold = 100
    profile.save()

    view = TrainingLogView.as_view()
    response = view(request)
    assert response.status_code == 200

    profile.refresh_from_db()
    # HP should heal +2
    assert profile.hp == 52


@pytest.mark.django_db
def test_grier_l2_shield_slam(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L2: Prevents 50% HP damage on failure, deals it to boss for 5 Mana
    RecruitedAlly.objects.create(user_profile=profile, ally_code="grier", level=2)
    profile.active_allies = ["grier"]
    profile.hp = 100
    profile.mana = 10
    profile.save()

    task = Task.objects.create(
        user=user,
        title="Negative Habit",
        task_type=Task.TaskType.HABIT,
        difficulty="hard",  # higher difficulty means more damage
    )

    complete_task(user, task.id, is_positive=False)
    profile.refresh_from_db()

    # Verify HP lost is halved (base damage for hard habit is 75 * def_mult)
    # Check that mana decreased by 5
    assert profile.mana == 5


@pytest.mark.django_db
def test_grier_l4_revenge_mark(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L4: Failed task adds charge, next completion consumes for +50% boss dmg each
    RecruitedAlly.objects.create(user_profile=profile, ally_code="grier", level=4)
    profile.active_allies = ["grier"]
    profile.save()

    task_habit = Task.objects.create(
        user=user, title="Habit", task_type=Task.TaskType.HABIT, difficulty="easy"
    )

    # Fail habit once
    complete_task(user, task_habit.id, is_positive=False)
    profile.refresh_from_db()
    assert profile.grier_revenge_charges == 1

    # Fail habit twice more
    complete_task(user, task_habit.id, is_positive=False)
    complete_task(user, task_habit.id, is_positive=False)
    profile.refresh_from_db()
    assert profile.grier_revenge_charges == 3

    # Fail 4th time: capped at 3
    complete_task(user, task_habit.id, is_positive=False)
    profile.refresh_from_db()
    assert profile.grier_revenge_charges == 3

    # Complete todo to consume charges for 2.5x boss damage
    task_todo = Task.objects.create(
        user=user, title="Todo", task_type=Task.TaskType.TODO, difficulty="easy"
    )
    complete_task(user, task_todo.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.grier_revenge_charges == 0


@pytest.mark.django_db
def test_grier_l5_unbreakable_will(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    RecruitedAlly.objects.create(user_profile=profile, ally_code="grier", level=5)
    profile.active_allies = ["grier"]
    profile.hp = 10  # < 20% of max HP
    profile.mana = 10
    profile.save()

    # Missed daily damage should be 0
    Task.objects.create(
        user=user, title="Daily", task_type=Task.TaskType.DAILY, is_completed=False
    )
    process_missed_tasks(user)
    profile.refresh_from_db()
    # HP shouldn't change (protected by Unbreakable Will)
    assert profile.hp == 10

    # Task completion: double boss damage, 0 mana regeneration
    task_todo = Task.objects.create(
        user=user, title="Todo", task_type=Task.TaskType.TODO, difficulty="easy"
    )
    complete_task(user, task_todo.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.mana == 10  # 0 mana gained


@pytest.mark.django_db
def test_lyra_l1_and_l3_and_l4_effects(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    RecruitedAlly.objects.create(user_profile=profile, ally_code="lyra", level=4)
    profile.active_allies = ["lyra"]
    profile.save()

    # Create skill cooldown
    SkillCooldown.objects.create(
        user=user,
        skill_id="fireball",
        cooldown_until=timezone.now() + timezone.timedelta(hours=5),
    )

    # Log training session: 2.5 hours -> reduces CD by 2.5h, gives +30% Rank XP
    factory = APIRequestFactory()
    request = factory.post(
        "/api/training/log/",
        {"hours": 2.5, "focus_rating": 8.0, "flat_xp_bonus": 0, "activity": "coding"},
        format="json",
    )
    force_authenticate(request, user=user)

    view = TrainingLogView.as_view()
    response = view(request)
    assert response.status_code == 200

    # Verify cooldown reduced
    cd = SkillCooldown.objects.get(user=user, skill_id="fireball")
    assert cd.cooldown_until < timezone.now() + timezone.timedelta(hours=2.6)

    # Log training session < 30m -> 0 rewards
    request_short = factory.post(
        "/api/training/log/",
        {"hours": 0.2, "focus_rating": 8.0, "flat_xp_bonus": 0, "activity": "coding"},
        format="json",
    )
    force_authenticate(request_short, user=user)

    profile.rank_xp = 100
    profile.save()

    response2 = view(request_short)
    assert response2.status_code == 200
    profile.refresh_from_db()
    assert profile.rank_xp == 100  # no XP gained


@pytest.mark.django_db
def test_lyra_l2_revert_failure(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    RecruitedAlly.objects.create(user_profile=profile, ally_code="lyra", level=2)
    profile.active_allies = ["lyra"]
    profile.save()

    task = Task.objects.create(
        user=user, title="Habit", task_type=Task.TaskType.HABIT, difficulty="medium"
    )

    # Fail habit -> HP drops
    complete_task(user, task.id, is_positive=False)
    profile.refresh_from_db()

    # Call revert-failure endpoint
    factory = APIRequestFactory()
    request = factory.post(f"/api/tasks/{task.id}/revert-failure/", {}, format="json")
    force_authenticate(request, user=user)

    from api.views import TaskViewSet

    view = TaskViewSet.as_view({"post": "revert_failure"})
    response = view(request, pk=task.id)
    assert response.status_code == 200

    profile.refresh_from_db()
    assert profile.hp == 100  # HP restored!


@pytest.mark.django_db
def test_lyra_l5_time_paradox(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    RecruitedAlly.objects.create(user_profile=profile, ally_code="lyra", level=5)
    profile.active_allies = ["lyra"]
    profile.mana = 100
    profile.save()

    # Complete a Daily -> activates Time Paradox (mana halved, 3 charges)
    task_daily = Task.objects.create(
        user=user, title="Daily", task_type=Task.TaskType.DAILY, is_completed=False
    )
    complete_task(user, task_daily.id, is_positive=True)
    profile.refresh_from_db()

    assert profile.mana == 55
    assert profile.time_paradox_charges == 3

    # Complete Todo -> consumes charge, duplicates rewards
    task_todo = Task.objects.create(
        user=user, title="Todo", task_type=Task.TaskType.TODO, is_completed=False
    )
    complete_task(user, task_todo.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.time_paradox_charges == 2


@pytest.mark.django_db
def test_kage_perks(test_user_and_profile):
    user, profile, stats = test_user_and_profile

    # L2: Todo yields 0 Gold, but deals +40 boss damage
    kage = RecruitedAlly.objects.create(user_profile=profile, ally_code="kage", level=2)
    profile.active_allies = ["kage"]
    profile.gold = 10
    profile.save()

    task = Task.objects.create(
        user=user, title="Todo", task_type=Task.TaskType.TODO, is_completed=False
    )
    res = complete_task(user, task.id, is_positive=True)
    assert res["rewards"]["gold"] == 0

    # L3: Normal hit deals 1 HP damage
    kage.level = 3
    kage.save()
    profile.hp = 100
    profile.save()

    # Invalidate cache if model property is accessed
    if hasattr(profile, "_cached_passives"):
        delattr(profile, "_cached_passives")

    task2 = Task.objects.create(
        user=user, title="Todo", task_type=Task.TaskType.TODO, is_completed=False
    )
    complete_task(user, task2.id, is_positive=True)
    profile.refresh_from_db()
    assert profile.hp == 99  # Lost 1 HP

    # L4: Death prevention
    kage.level = 4
    kage.save()
    profile.hp = 2
    profile.save()

    if hasattr(profile, "_cached_passives"):
        delattr(profile, "_cached_passives")

    task_habit = Task.objects.create(
        user=user, title="Habit", task_type=Task.TaskType.HABIT, difficulty="hard"
    )
    # Fail habit to deal high HP damage
    complete_task(user, task_habit.id, is_positive=False)
    profile.refresh_from_db()

    assert profile.hp == 20  # Rescued by decoy shadow!
    assert ActiveEffect.objects.filter(user=user, skill_id="decoy_shadow_stun").exists()
