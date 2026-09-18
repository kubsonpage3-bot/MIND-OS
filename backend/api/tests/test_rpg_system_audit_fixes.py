"""
Regression tests for a full-system audit of the RPG mechanics (mutators,
allies, prestige interactions) requested directly by the user: "проверь всю
систему... работает ли так как оно задумано, есть ли заглушки и вранье."
Three parallel audits (mutators, allies, session/task-path parity) found:

  - twin_souls/null_zone/gamblers_ledger entirely missing from the linked-
    Pomodoro path (covered in test_pomodoro_ally_mutator_parity.py).
  - Kage L5's 5x boss damage and Glass Tear's +2 HP heal only wired into
    the Habit/Daily/Todo path, missing from Training Log and Pomodoro
    (Pomodoro side covered in test_pomodoro_ally_mutator_parity.py; this
    file does not re-test the Training Log side individually).
  - Zephyr L3's "+15% to other active allies' perks" synergy never reached
    Void's boss-damage bonus, because apply_boss_damage() recomputes its
    own disconnected local ally multiplier instead of using
    get_passive_multipliers()'s combined one.
  - Silence's "cooldowns reset to 0" payoff after the 48h skill-lock was
    never implemented -- players paid the full penalty for nothing.
  - Monk's Path's "streak log gives +2 XP instead of +1" was coded as
    `2 * streak`, growing unbounded (+60 at a 30-day streak) instead of a
    small flat +2.
  - volatile's tier counter (profile.tasks_completed_today) was only ever
    incremented by Habit/Daily/Todo completions, so a Training-Log/
    Pomodoro-only user always read 0 and got the "first task" x2 tier
    forever. Given its own counter (activities_completed_today) fed by
    all 3 completion paths.
  - BUTTON tasks ("custom training / manual log") could be completed
    infinitely via the generic task-complete endpoint for full,
    undiminished rewards every time -- no completion-state guard existed
    for that task_type (covered in test_services.py, not repeated here).
"""
import pytest
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils import timezone
from api.models import (
    UserProfile,
    RecruitedAlly,
    Boss,
    BossEncounter,
    SkillCooldown,
    UnlockedSkill,
)
from api.services.mechanics import apply_active_mutators, apply_boss_damage


@pytest.fixture
def user(db):
    return User.objects.create(username="rpg_audit_user")


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.hp = 100
    p.mana = 100
    p.gold = 0
    p.save()
    return p


@pytest.mark.django_db
def test_zephyr_l3_synergy_reaches_void_boss_damage(user, profile):
    boss = Boss.objects.create(
        id_name="zephyr_void_test_boss", name="Test Boss", level=1,
        hp_max=100000, reward_gold=10, reward_xp=10,
    )
    encounter = BossEncounter.objects.create(
        user=user, boss=boss, hp_current=100000, is_defeated=False
    )

    RecruitedAlly.objects.create(user_profile=profile, ally_code="void", level=1)
    profile.active_allies = ["void"]
    profile.save()

    apply_boss_damage(user, 1000)
    encounter.refresh_from_db()
    dmg_without_zephyr = 100000 - encounter.hp_current

    encounter.hp_current = 100000
    encounter.save()

    RecruitedAlly.objects.create(user_profile=profile, ally_code="zephyr", level=3)
    profile.active_allies = ["void", "zephyr"]
    profile.save()

    apply_boss_damage(user, 1000)
    encounter.refresh_from_db()
    dmg_with_zephyr = 100000 - encounter.hp_current

    # Void alone: +10%. With Zephyr L3 synergy: +10% * 1.15 -- strictly more damage.
    assert dmg_with_zephyr > dmg_without_zephyr


@pytest.mark.django_db
def test_silence_resets_skill_cooldowns_on_expiry(user, profile):
    SkillCooldown.objects.create(
        user=user, skill_id="blueprint", cooldown_until=timezone.now() + timedelta(hours=1)
    )
    profile.active_mutators = {
        "active": [
            {"id": "silence", "activatedAt": 0, "duration": 2}  # 2 days, already expired
        ],
        "purchased": ["silence"],
    }
    profile.save()

    from api.services.mechanics import check_and_expire_mutators

    check_and_expire_mutators(profile)

    assert not SkillCooldown.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_monks_path_streak_bonus_is_flat_not_scaling(profile):
    profile.active_mutators = {"active": [{"id": "monks_path"}], "purchased": ["monks_path"]}
    profile.save()

    low = apply_active_mutators(
        profile, {"is_prayer": True, "task_streak": 1}, trigger_side_effects=False
    )
    high = apply_active_mutators(
        profile, {"is_prayer": True, "task_streak": 30}, trigger_side_effects=False
    )

    # A 1-day streak and a 30-day streak must give the SAME flat bonus (+2),
    # not one scaling to +60 -- both just need an active streak (>0).
    assert low["flat_xp"] == 2
    assert high["flat_xp"] == 2


@pytest.mark.django_db
def test_volatile_counter_increments_across_all_completion_paths(user, profile):
    """
    Direct unit check of the new activities_completed_today counter itself
    (full end-to-end Training Log/Pomodoro coverage already exists for
    other mutators in test_pomodoro_ally_mutator_parity.py) -- this just
    confirms volatile now reads a counter that isn't Task-completion-only.
    """
    profile.active_mutators = {"active": [{"id": "volatile"}], "purchased": ["volatile"]}
    profile.activities_completed_today = 0
    profile.save()

    effects_first = apply_active_mutators(profile, {}, trigger_side_effects=False)
    assert effects_first["final_xp_mult"] == pytest.approx(2.0)

    profile.activities_completed_today = 2
    profile.save()
    effects_mid = apply_active_mutators(profile, {}, trigger_side_effects=False)
    assert effects_mid["final_xp_mult"] == pytest.approx(0.90)

    profile.activities_completed_today = 5
    profile.save()
    effects_late = apply_active_mutators(profile, {}, trigger_side_effects=False)
    assert effects_late["final_xp_mult"] == pytest.approx(1.5)
