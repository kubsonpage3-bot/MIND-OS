"""
Regression tests for the Skill Tree redesign (Batch 3): 6 weak/duplicate
skills were replaced per an explicit user-approved audit (see session notes).
Two of the old skills (transcendent_will/living_library) were an exact
duplicate mechanic ("-X% rival XP speed") copy-pasted into two branches;
three others (pain_threshold, unbreakable, loot_magnetism) were flat
bonuses so small they were barely felt; omniscience's boss-kill bonus was
almost never triggered. This file covers the new mechanics end-to-end,
via the real entry points (complete_task, process_daily_login,
calculate_task_outcome, calculate_cognitive_gains) rather than just
checking the passive_effects flags (which test_all_30_skills.py already
does).
"""
import pytest
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import UserProfile, Task, UnlockedSkill, BossEncounter
from api.services.task_service import complete_task
from api.services.daily_service import process_daily_login
from api.services.mechanics import calculate_task_outcome, calculate_cognitive_gains


@pytest.fixture
def user():
    return User.objects.create(username="skill_redesign_user")


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.character_class = "architect"
    p.mana = 100
    p.hp = 100
    p.gold = 0
    p.save()
    return p


@pytest.mark.django_db
def test_second_wind_grants_comeback_xp_only_same_day(user, profile, monkeypatch):
    """
    Second Wind (pain_threshold, redesigned): failing a Habit sets
    last_habit_fail_at; the *next* Habit completed the same day gets +50%
    XP, and the flag is consumed (a third Habit completion gets no bonus).
    """
    # A positive Habit completion's reward still flows through
    # calculate_task_outcome() downstream (FOC crit chance etc.) even
    # though the Second Wind bonus itself is applied earlier via
    # streak_mult -- pin off crit RNG so the comparison is exact.
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 1.0)
    # Any active boss encounter would let apply_boss_damage() grant a
    # boss-kill XP/Gold bonus on top of the task reward, contaminating the
    # control-vs-boosted comparison below -- make sure none is active.
    BossEncounter.objects.filter(user=user).delete()
    # gain_xp() wraps profile.xp on level-up (subtracts xp_to_next_level),
    # so a level-up landing between an xp_before/xp_after pair below would
    # make a raw diff nonsensical. Push the threshold out of reach.
    profile.xp_to_next_level = 100_000
    profile.save()

    habit_a = Task.objects.create(
        user=user, title="Control", task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.MEDIUM,
    )
    complete_task(user, habit_a.id, False)  # fail, no skill unlocked yet
    xp_before = profile.xp
    complete_task(user, habit_a.id, True)
    profile.refresh_from_db()
    control_gain = profile.xp - xp_before

    UnlockedSkill.objects.create(user_profile=profile, skill_code="pain_threshold")
    BossEncounter.objects.filter(user=user).delete()

    habit_b = Task.objects.create(
        user=user, title="Boosted", task_type=Task.TaskType.HABIT,
        difficulty=Task.Difficulty.MEDIUM,
    )
    complete_task(user, habit_b.id, False)  # fail -> sets last_habit_fail_at
    profile.refresh_from_db()
    assert profile.last_habit_fail_at is not None

    xp_before = profile.xp
    complete_task(user, habit_b.id, True)  # comeback completion: +50%
    profile.refresh_from_db()
    boosted_gain = profile.xp - xp_before

    assert boosted_gain == pytest.approx(control_gain * 1.5, abs=1)
    assert profile.last_habit_fail_at is None  # consumed

    # A second positive completion the same day gets no further bonus.
    habit_b.last_completed_at = None
    habit_b.is_completed = False
    habit_b.save(update_fields=["last_completed_at", "is_completed"])
    xp_before = profile.xp
    complete_task(user, habit_b.id, True)
    profile.refresh_from_db()
    unboosted_gain = profile.xp - xp_before
    assert unboosted_gain < boosted_gain


@pytest.mark.django_db
def test_windfall_doubles_gold_on_proc(profile, monkeypatch):
    """
    Windfall (loot_magnetism, redesigned): a flat chance to double the
    final Gold reward, applied once in calculate_task_outcome() -- the
    single choke point shared by all 3 reward paths (Habit/Daily/Todo,
    Training Log, Pomodoro), so this one test covers all of them.
    """
    # calculate_task_outcome calls random.random() up to 3x in the positive
    # branch (crit check, then windfall check, then drop-chance check) --
    # always 0.99 pins off crit and drop chance so only windfall varies.
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 0.99)
    baseline = calculate_task_outcome(
        profile.user, "todo", base_xp=10, base_gold=10, is_positive=True,
        passive_effects={"windfall_chance": 0.0},
    )
    not_boosted = calculate_task_outcome(
        profile.user, "todo", base_xp=10, base_gold=10, is_positive=True,
        passive_effects={"windfall_chance": 0.05},
    )
    assert not_boosted["gold_earned"] == baseline["gold_earned"]

    calls = iter([0.99, 0.01, 0.99])  # no crit, windfall procs, no extra drop
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: next(calls))
    boosted = calculate_task_outcome(
        profile.user, "todo", base_xp=10, base_gold=10, is_positive=True,
        passive_effects={"windfall_chance": 0.05},
    )
    # abs=1: baseline's gold_earned is itself an int() truncation of a
    # float, so doubling the *pre-truncation* float in the boosted path can
    # legitimately land 1 off from a naive baseline_int * 2.
    assert boosted["gold_earned"] == pytest.approx(baseline["gold_earned"] * 2, abs=1)


@pytest.mark.django_db
def test_sanctuary_protects_streak_once_per_day(user, profile):
    """
    Sanctuary (transcendent_will, redesigned): once per day, a missed
    login streak is protected for free (same effect as a streak_shield
    item), consumed directly in daily_service.py's process_daily_login.
    A second missed-streak login the SAME day is not protected again.
    """
    UnlockedSkill.objects.create(user_profile=profile, skill_code="transcendent_will")

    profile.streak = 5
    profile.last_login_date = timezone.now().date() - timedelta(days=2)  # missed a day
    profile.save()

    process_daily_login(user)
    profile.refresh_from_db()
    assert profile.streak == 6  # protected, not reset to 1
    assert profile.last_sanctuary_used is not None

    # Simulate another missed-streak login later the same day.
    profile.last_login_date = timezone.now().date() - timedelta(days=2)
    profile.save()
    process_daily_login(user)
    profile.refresh_from_db()
    assert profile.streak == 1  # NOT protected again -- already used today


@pytest.mark.django_db
def test_omniscience_eases_growth_softcap(profile):
    """
    Omniscience (redesigned): eases the quadratic soft-cap curve near a
    cognitive stat's ceiling by 20% permanently, instead of a flat +0.2 on
    boss defeat (which almost never triggered). Verified via
    calculate_cognitive_gains: a stat sitting close to its ceiling should
    gain strictly more with Omniscience unlocked than without.
    """
    # UserProfile.save() enforces a floor of 100.0 on all 4 cognitive
    # metrics (legacy-account fix-up), so "near ceiling" here means close
    # to (but above) 100, not close to 0.
    profile.gf = 149.0
    profile.gc = 149.0
    profile.ps = 149.0
    profile.vm = 149.0
    profile.gf_ceiling = 150.0
    profile.gc_ceiling = 150.0
    profile.ps_ceiling = 150.0
    profile.vm_ceiling = 150.0
    profile.save()

    gains_before = calculate_cognitive_gains("mathematics", 1.0, 5.0, profile)
    assert gains_before["gf"] > 0

    UnlockedSkill.objects.create(user_profile=profile, skill_code="omniscience")
    gains_after = calculate_cognitive_gains("mathematics", 1.0, 5.0, profile)

    assert gains_after["gf"] > gains_before["gf"]
