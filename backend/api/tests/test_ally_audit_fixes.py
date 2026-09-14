"""
Neko L1 (+5% Daily gold) and L2 (+8% streak XP) wrote to dead
daily_gold_mult/streak_xp_mult keys nothing ever read -- routed into the
real gold_mult/xp_mult pipeline instead. Neko L4's habit-streak shield was
wired into the DAILY miss path (process_missed_tasks) instead of Habits --
moved to the negative-habit completion path. Kage L5's "5x boss damage
below 15% HP" reward half was entirely missing (only the "+50% dmg taken on
failure" downside existed) -- added to the positive task-completion damage
calc.
"""
import pytest
from django.contrib.auth.models import User
from api.models import RecruitedAlly, Task, Boss, BossEncounter
from api.services.task_service import complete_task


@pytest.fixture
def profile_ally():
    User.objects.filter(username="test_ally_audit_user").delete()
    user = User.objects.create(username="test_ally_audit_user")
    profile = user.profile  # type: ignore
    profile.gold = 0
    profile.hp = 100
    profile.rank_xp = 0
    profile.active_mutators = {}
    profile.active_allies = []
    profile.save()
    return user, profile


@pytest.mark.django_db
def test_neko_l1_daily_gold_bonus_applies(profile_ally):
    user, profile = profile_ally
    RecruitedAlly.objects.create(user_profile=profile, ally_code="neko", level=1)
    profile.active_allies = ["neko"]
    profile.save()

    # Neko's ally-level effects live in get_passive_multipliers, not
    # apply_active_mutators -- check via that instead.
    from api.services.mechanics import get_passive_multipliers

    passives = get_passive_multipliers(profile, {"task_type": "daily"})
    assert passives["gold_mult"] == pytest.approx(1.05)
    assert "daily_gold_mult" not in passives

    passives_habit = get_passive_multipliers(profile, {"task_type": "habit"})
    assert passives_habit["gold_mult"] == 1.0  # only applies to Dailies


@pytest.mark.django_db
def test_neko_l2_streak_xp_bonus_applies(profile_ally):
    user, profile = profile_ally
    RecruitedAlly.objects.create(user_profile=profile, ally_code="neko", level=2)
    profile.active_allies = ["neko"]
    profile.save()

    from api.services.mechanics import get_passive_multipliers

    with_streak = get_passive_multipliers(profile, {"task_streak": 3})
    assert with_streak["xp_mult"] == pytest.approx(1.08)
    assert "streak_xp_mult" not in with_streak

    no_streak = get_passive_multipliers(profile, {"task_streak": 0})
    assert no_streak["xp_mult"] == 1.0


@pytest.mark.django_db
def test_neko_l4_shields_habit_not_daily(profile_ally):
    user, profile = profile_ally
    RecruitedAlly.objects.create(user_profile=profile, ally_code="neko", level=4)
    profile.active_allies = ["neko"]
    profile.save()

    habit = Task.objects.create(
        user=user, title="H", task_type=Task.TaskType.HABIT, pos_streak=5
    )
    complete_task(user, habit.id, is_positive=False)
    habit.refresh_from_db()
    assert habit.pos_streak == 5  # first miss shielded

    complete_task(user, habit.id, is_positive=False)
    habit.refresh_from_db()
    assert habit.pos_streak == 0  # second miss: shield already used


@pytest.mark.django_db
def test_kage_l5_execute_bonus_on_task_completion(profile_ally):
    user, profile = profile_ally
    RecruitedAlly.objects.create(user_profile=profile, ally_code="kage", level=5)
    profile.active_allies = ["kage"]
    profile.save()

    boss = Boss.objects.create(name="Weak Boss", level=1, hp_max=1000, reward_xp=10, reward_gold=5)
    BossEncounter.objects.create(user=user, boss=boss, hp_current=100, is_defeated=False)  # 10% HP

    task = Task.objects.create(user=user, title="T", task_type=Task.TaskType.TODO)
    complete_task(user, task.id, is_positive=True)

    encounter = BossEncounter.objects.get(user=user, boss=boss)
    # Without the 5x execute bonus, a To-Do can't possibly deal 100+ damage
    # to a fresh boss from base stats alone.
    assert encounter.hp_current == 0 or (100 - encounter.hp_current) > 50
