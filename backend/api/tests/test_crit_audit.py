import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, Boss, BossEncounter, Task
from api.services.mechanics import calculate_task_outcome, apply_boss_damage
from api.services.task_service import complete_task


@pytest.fixture
def audit_user_and_profile(db):
    user = User.objects.create_user(username="crit_tester", password="password")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.base_pwr = 10
    profile.base_foc = 10
    profile.base_spd = 10
    profile.base_lck = 10
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_boss_crit_damage_single_multiplier(audit_user_and_profile):
    """
    Ensure that a critical hit applies the crit multiplier (2.0x) exactly once
    to boss damage, and apply_boss_damage does NOT double-dip with another 2.0x.
    """
    user, profile = audit_user_and_profile
    boss = Boss.objects.create(
        id_name="audit_boss", name="Audit Boss", hp_max=1000, reward_gold=100, reward_xp=50
    )
    encounter = BossEncounter.objects.create(user=user, boss=boss, hp_current=1000)

    # Force always_crit via passive_effects
    outcome = calculate_task_outcome(
        user=user,
        task_type="daily",
        base_xp=10,
        base_gold=10,
        is_positive=True,
        passive_effects={"always_crit": True, "crit_damage_mult": 2.0},
    )

    assert outcome["is_crit"] is True
    # Base damage_dealt is 10 + pwr = 10 + 10 = 20. Crit 2x -> 40.
    assert outcome["damage_dealt"] == 40

    # Call apply_boss_damage with final_damage_dealt = 40, is_crit = True
    combat_result = apply_boss_damage(user, outcome["damage_dealt"], is_crit=True)
    assert combat_result is not None
    assert combat_result["damage_dealt"] == 40

    encounter.refresh_from_db()
    # Boss HP should be 1000 - 40 = 960 (NOT 1000 - 80)
    assert encounter.hp_current == 960


@pytest.mark.django_db
def test_boss_defeat_rewards_segregated(audit_user_and_profile):
    """
    Ensure that when a boss is defeated during task completion,
    the task's gold_earned represents task gold, while boss defeat gold is in boss_gold.
    """
    user, profile = audit_user_and_profile
    profile.gold = 50
    profile.save()

    boss = Boss.objects.create(
        id_name="weak_boss", name="Weak Boss", hp_max=50, reward_gold=200, reward_xp=100
    )
    # Boss with 10 HP will be defeated on task completion
    BossEncounter.objects.create(user=user, boss=boss, hp_current=10)

    task = Task.objects.create(
        user=user,
        title="Defeat Boss Task",
        task_type=Task.TaskType.TODO,
        difficulty="medium",
        repeat_weekdays=127,
    )

    res = complete_task(user, task.id, is_positive=True)

    profile.refresh_from_db()
    # Task base medium reward gives ~6 gold (+ stats)
    task_gold = res["gold_earned"]
    assert task_gold < 50  # Pure task gold, not mixed with 200 boss gold

    # Boss defeat rewards
    assert res["combat"]["boss_defeated"] is True
    assert res["rewards"]["boss_gold"] == 200
    assert res["combat"]["rewards"]["boss_gold"] == 200

    # Achievement gold if any (e.g. first_blood gives 30G)
    from api.services.achievement_service import ACHIEVEMENTS_SSOT

    achievement_gold = sum(
        ACHIEVEMENTS_SSOT.get(code, {}).get("gold", 0)
        for code in res.get("newly_unlocked_achievements", [])
    )

    # Total profile gold received task gold + boss gold + achievement rewards
    assert profile.gold == 50 + task_gold + 200 + achievement_gold


@pytest.mark.django_db
def test_lck_gold_diminishing_returns(audit_user_and_profile):
    """
    Verify LCK gold scaling has soft diminishing returns above 100 LCK to prevent runaway inflation.
    """
    user, profile = audit_user_and_profile
    profile.base_spd = 0

    # LCK = 0
    profile.base_lck = 0
    profile.save()
    out_0 = calculate_task_outcome(user=user, task_type="daily", base_gold=10, is_positive=True)
    # base 10 * 1.0 (spd=0) * 1.0 (lck=0) = 10
    assert out_0["gold_earned"] == 10

    # LCK = 100
    profile.base_lck = 100
    profile.save()
    out_100 = calculate_task_outcome(user=user, task_type="daily", base_gold=10, is_positive=True)
    # base 10 * 1.0 (spd=0) * 2.0 (lck=100) = 20
    assert out_100["gold_earned"] == 20

    # LCK = 200 (Soft diminishing returns: mult = 2.0 + (100 * 0.005) = 2.5x instead of 3.0x)
    profile.base_lck = 200
    profile.save()
    out_200 = calculate_task_outcome(user=user, task_type="daily", base_gold=10, is_positive=True)
    assert out_200["gold_earned"] == 25
