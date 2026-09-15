"""
Regression tests for the mutator audit fixes:
  - momentum / phantom_load were 100% dead (their stored "days" /
    "yesterday_hours" data was read but never written anywhere).
  - mirror implemented a totally different mechanic (30% dodge-to-XP) than
    its description (+15% boss damage on a same-category repeat).
  - sacrificial_altar silently drained -5 HP / -5% gold on every single task
    completion, on top of its documented one-time altar action.
  - alchemist ran a second, undocumented "XP overflow -> gold" mechanic in
    addition to its described "mana -> gold at daily reset".
  - time_dilation silently added +30% incoming damage, not in its description.
  - double_nothing applied an instant -50% HP penalty on ANY single missed
    daily instead of "streak resets after 2 consecutive misses".
  - loan_shark / cursed_clock / compound / alchemist's daily tick lived in a
    management command (daily_mutator_tick) that is never scheduled anywhere
    -> moved into process_missed_tasks, the one daily-rollover hook the app
    actually invokes.
"""
import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from api.models import UserStats, Task, TrainingSession, RecruitedAlly
from api.services.mechanics import apply_active_mutators
from api.services.task_service import process_missed_tasks


@pytest.fixture
def profile_mut():
    User.objects.filter(username="test_mutator_audit_user").delete()
    user = User.objects.create(username="test_mutator_audit_user")
    profile = user.profile  # type: ignore
    profile.gold = 1000
    profile.mana = 50
    profile.hp = 100
    profile.rank_xp = 0
    profile.timezone = "UTC"
    profile.active_mutators = {}
    profile.active_allies = []
    profile.save()
    UserStats.objects.get_or_create(user=user)
    RecruitedAlly.objects.filter(user_profile=profile).delete()
    return user, profile


def yesterday_local(profile):
    return timezone.now().date() - timedelta(days=1)


def log_hours_yesterday(profile, hours):
    """Creates a TrainingSession and backdates it into yesterday (created_at
    is auto_now_add, so it must be moved after creation)."""
    ts = TrainingSession.objects.create(
        user_profile=profile, activity_key="coding", hours=hours
    )
    yesterday_dt = timezone.now() - timedelta(days=1)
    TrainingSession.objects.filter(id=ts.id).update(created_at=yesterday_dt)
    return ts


@pytest.mark.django_db
def test_momentum_was_dead_now_accumulates(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "momentum", "data": {"days": 0}}]}
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.save()

    # 1h+ logged "yesterday" -> momentum should count that day.
    log_hours_yesterday(profile, 2.0)

    process_missed_tasks(user)
    profile.refresh_from_db()

    momentum_data = next(
        m["data"] for m in profile.active_mutators["active"] if m["id"] == "momentum"
    )
    assert momentum_data["days"] == 1

    effects = apply_active_mutators(profile, {})
    assert effects["xp_mult"] == pytest.approx(1.02)  # +2% for day 1


@pytest.mark.django_db
def test_momentum_resets_on_a_day_with_no_hours(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "momentum", "data": {"days": 5}}]}
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.save()
    # No TrainingSession created -> 0 hours yesterday -> resets to 0.

    process_missed_tasks(user)
    profile.refresh_from_db()

    momentum_data = next(
        m["data"] for m in profile.active_mutators["active"] if m["id"] == "momentum"
    )
    assert momentum_data["days"] == 0


@pytest.mark.django_db
def test_phantom_load_was_dead_now_populated(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "phantom_load", "data": {}}]}
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.save()

    log_hours_yesterday(profile, 3.0)

    process_missed_tasks(user)
    profile.refresh_from_db()

    pl_data = next(
        m["data"] for m in profile.active_mutators["active"] if m["id"] == "phantom_load"
    )
    assert pl_data["yesterday_hours"] == 3.0

    # 3.0h * 30% = 90% would be uncapped; capped at 60% (see the dedicated
    # cap test below), so 3h yesterday just means "hit the cap".
    effects = apply_active_mutators(profile, {})
    assert effects["xp_mult"] == pytest.approx(1.0 + 0.60)


@pytest.mark.django_db
def test_phantom_load_bonus_is_capped(profile_mut):
    """Uncapped, yesterday_hours * 30% scaled without limit -- an 8h study
    day would have given +240% XP. Capped at +60% (reached at 2h logged
    yesterday), matching every other "scales with your effort" mutator in
    this game (its own synergy partner Momentum caps at +20%)."""
    user, profile = profile_mut

    # Below the cap: 1h -> +30%, uncapped and capped agree here.
    profile.active_mutators = {
        "active": [{"id": "phantom_load", "data": {"yesterday_hours": 1.0}}]
    }
    profile.save()
    effects = apply_active_mutators(profile, {})
    assert effects["xp_mult"] == pytest.approx(1.0 + 0.30)

    # Well past the cap: 8h would be +240% uncapped, must clamp to +60%.
    profile.active_mutators = {
        "active": [{"id": "phantom_load", "data": {"yesterday_hours": 8.0}}]
    }
    profile.save()
    effects = apply_active_mutators(profile, {})
    assert effects["xp_mult"] == pytest.approx(1.0 + 0.60)


@pytest.mark.django_db
def test_daily_settlement_loan_shark_cursed_clock_compound_alchemist(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {
        "active": [
            {"id": "loan_shark"},
            {"id": "cursed_clock"},
            {"id": "compound"},
        ]
    }
    profile.gold = 1000
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.save()
    # No hours logged yesterday -> cursed_clock idle penalty = 14h * 2G = 28G

    process_missed_tasks(user)
    profile.refresh_from_db()

    # 1000 - 30 (loan_shark) - 28 (cursed_clock idle) = 942, then +9 compound (942//100=9)
    assert profile.gold == 951


@pytest.mark.django_db
def test_alchemist_daily_reset_converts_mana_no_overflow_mechanic(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "alchemist"}]}
    profile.mana = 40
    profile.gold = 100
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.save()

    process_missed_tasks(user)
    profile.refresh_from_db()

    assert profile.gold == 180  # 100 + 40*2
    assert profile.mana == 0

    # The undocumented "XP overflow -> gold" mechanic must be gone.
    effects = apply_active_mutators(profile, {})
    assert "alchemist_overflow_rate" not in effects


@pytest.mark.django_db
def test_alchemist_preserves_mana_above_the_gold_cap(profile_mut):
    """"Converts ALL unspent Mana into Gold" -- above the 200-gold cap (100
    mana), the whole mana pool used to get zeroed regardless of how much was
    actually paid for. 150 mana only pays out for 100 of it (200g / 2); the
    other 50 must carry over, not vanish."""
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "alchemist"}]}
    profile.mana = 150
    profile.gold = 100
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.save()

    process_missed_tasks(user)
    profile.refresh_from_db()

    assert profile.gold == 300  # 100 + min(200, 150*2)=200
    assert profile.mana == 50  # 150 - (200 // 2) = 50, NOT zeroed


@pytest.mark.django_db
def test_mirror_gives_boss_damage_not_dodge_to_xp(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "mirror"}]}
    profile.last_completed_category = "Sciences"
    profile.save()

    effects = apply_active_mutators(profile, {"task_category": "Sciences"})
    assert effects["mirror_boss_dmg_mult"] == pytest.approx(1.15)
    assert "trigger_mirror" not in effects  # old (wrong) mechanic is gone

    # Different category -> no bonus.
    effects2 = apply_active_mutators(profile, {"task_category": "Body"})
    assert effects2["mirror_boss_dmg_mult"] == 1.0


@pytest.mark.django_db
def test_sacrificial_altar_no_passive_per_task_drain(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "sacrificial_altar"}]}
    profile.save()

    effects = apply_active_mutators(profile, {})
    assert "sacrificial_altar_active" not in effects
    assert effects["gold_mult"] == 1.0  # no -5% ritual cost baked in anymore


@pytest.mark.django_db
def test_time_dilation_no_undocumented_damage_penalty(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "time_dilation"}]}
    profile.save()

    effects = apply_active_mutators(
        profile, {"task_type": "training", "hours": 2.0}
    )
    assert effects["final_xp_mult"] == pytest.approx(3.0)
    assert effects["damage_taken_mult"] == 1.0  # no hidden +30%


@pytest.mark.django_db
def test_time_dilation_only_applies_to_2h_plus_sessions(profile_mut):
    """Description: "Sessions require a minimum of 2.0 hours to submit, but
    grant 3.0x". The 2h floor was only ever enforced as a hard block on the
    manual Study Log form -- it never touched task_type="training" completions
    logged through a linked Pomodoro (no such check there), and did nothing
    to stop an instant Habit/Daily/Todo click (task_type != "training", no
    "hours" concept at all) from getting the x3 for free."""
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "time_dilation"}]}
    profile.save()

    # Regular task completion: task_type isn't "training" at all.
    effects_habit = apply_active_mutators(profile, {"task_type": "habit"})
    assert effects_habit["final_xp_mult"] == 1.0
    effects_daily = apply_active_mutators(profile, {"task_type": "daily", "hours": 5})
    assert effects_daily["final_xp_mult"] == 1.0

    # A "session" under 2h (e.g. a short linked Pomodoro) -- no bonus.
    effects_short = apply_active_mutators(
        profile, {"task_type": "training", "hours": 0.5}
    )
    assert effects_short["final_xp_mult"] == 1.0

    # A real 2h+ session -- bonus applies.
    effects_long = apply_active_mutators(
        profile, {"task_type": "training", "hours": 2.5}
    )
    assert effects_long["final_xp_mult"] == pytest.approx(3.0)


@pytest.mark.django_db
def test_night_owl_bonus_and_penalty_windows(profile_mut):
    """Description: "Sessions after 21:00 give +30%. Before 09:00: -10%."
    The bonus window used to swallow the whole overnight stretch (>=21:00 OR
    <9:00 both counted as bonus, the exact window that should be a penalty),
    and 9:00-21:00 was wrongly penalized instead of neutral."""
    import zoneinfo
    from unittest.mock import patch

    user, profile = profile_mut
    profile.timezone = "UTC"
    profile.active_mutators = {"active": [{"id": "night_owl"}]}
    profile.save()

    def at_hour(h):
        return timezone.now().astimezone(zoneinfo.ZoneInfo("UTC")).replace(
            hour=h, minute=0, second=0, microsecond=0
        )

    with patch("django.utils.timezone.now", return_value=at_hour(22)):
        assert apply_active_mutators(profile, {})["xp_mult"] == pytest.approx(1.30)

    with patch("django.utils.timezone.now", return_value=at_hour(5)):
        assert apply_active_mutators(profile, {})["xp_mult"] == pytest.approx(0.90)

    with patch("django.utils.timezone.now", return_value=at_hour(14)):
        assert apply_active_mutators(profile, {})["xp_mult"] == pytest.approx(1.0)


@pytest.mark.django_db
def test_double_nothing_survives_one_miss_resets_on_second(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "double_nothing"}]}
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.hp = 100
    profile.save()

    daily = Task.objects.create(
        user=user, title="Daily", task_type=Task.TaskType.DAILY, streak=5
    )

    # First miss: grace day, streak survives, and HP only takes the normal
    # fail-damage hit (a few HP) -- NOT the old code's extra -50% penalty
    # (which would have dropped a 100 HP profile to 50).
    process_missed_tasks(user)
    daily.refresh_from_db()
    profile.refresh_from_db()
    assert daily.streak == 5
    assert profile.hp > 80

    dn_data = next(
        m["data"] for m in profile.active_mutators["active"] if m["id"] == "double_nothing"
    )
    assert dn_data["missed_once"] is True

    # Second consecutive miss: streak actually resets now.
    profile.last_daily_cron_at = timezone.now().date() - timedelta(days=1)
    profile.save()
    process_missed_tasks(user)
    daily.refresh_from_db()
    assert daily.streak == 0


# ─────────────────────────────────────────────────────────────────────────────
# Previously `disabled: true` mutators (unreachable via shop/chest either way,
# but fixed to match their descriptions so they're correct if ever re-enabled)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_ascetic_loop_scales_with_streak_not_flat(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "ascetic_loop"}]}
    profile.save()

    effects_streak_10 = apply_active_mutators(
        profile, {"task_type": "daily", "task_streak": 10}
    )
    assert effects_streak_10["flat_xp"] == pytest.approx(2.0)  # 10 * 0.2

    effects_streak_0 = apply_active_mutators(
        profile, {"task_type": "daily", "task_streak": 0}
    )
    assert effects_streak_0["flat_xp"] == 0  # streak broke -> bonus gone


@pytest.mark.django_db
def test_miser_blocks_shop_and_grants_daily_xp(profile_mut):
    from api.services.shop_service import buy_item
    from api.models import Item

    user, profile = profile_mut
    Item.objects.update_or_create(
        code="test_miser_item",
        defaults={"name": "Test Item", "cost": 50, "item_type": "consumable"},
    )
    profile.active_mutators = {"active": [{"id": "miser"}]}
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.rank_xp = 0
    profile.save()

    success, msg, _ = buy_item(user, "test_miser_item")
    assert not success
    assert "cannot spend" in msg.lower()

    process_missed_tasks(user)
    profile.refresh_from_db()
    assert profile.rank_xp == 5


@pytest.mark.django_db
def test_ironman_forced_prestige_on_hp_zero_no_artificial_floor(profile_mut):
    user, profile = profile_mut
    profile.active_mutators = {"active": [{"id": "ironman"}]}
    profile.hp = 1  # one more hit finishes it off
    profile.gold = 500
    profile.last_daily_cron_at = yesterday_local(profile)
    profile.prestige_count = 0
    profile.save()

    daily = Task.objects.create(
        user=user, title="Daily", task_type=Task.TaskType.DAILY, streak=3
    )

    process_missed_tasks(user)
    profile.refresh_from_db()
    daily.refresh_from_db()

    # Forced prestige happened (not the old artificial "floor HP at 1, -10%
    # gold" fudge that made HP=0 unreachable in the first place).
    assert profile.prestige_count == 1
    assert profile.hp == profile.max_hp
    assert profile.gold == 500  # untouched by the old undocumented -10% cut


@pytest.mark.django_db
def test_zero_hour_zeroes_gold_and_accumulates_withheld_amount(profile_mut):
    """Description: "No Gold earned for 7 days. Afterwards: receive 3x of
    everything you would have earned." Only the zeroing half ever existed --
    completing a task with Zero Hour active must both pay 0 Gold AND record
    the would-be amount so it can be paid out 3x on expiry (see the payout
    test below)."""
    from api.services.task_service import complete_task

    user, profile = profile_mut
    profile.active_mutators = {
        "active": [{"id": "zero_hour", "duration": 7, "data": {}}]
    }
    profile.save()

    task = Task.objects.create(
        user=user, title="Todo", task_type=Task.TaskType.TODO, difficulty="medium"
    )
    res = complete_task(user, task.id, is_positive=True)
    profile.refresh_from_db()

    assert res["rewards"]["gold"] == 0
    zh_data = next(
        m["data"] for m in profile.active_mutators["active"] if m["id"] == "zero_hour"
    )
    assert zh_data["withheld_gold"] > 0


@pytest.mark.django_db
def test_zero_hour_pays_3x_withheld_gold_on_expiry(profile_mut):
    """The payout half, previously missing entirely: once the 7-day window
    expires, the player receives 3x the Gold that was withheld -- not just
    the mutator quietly disappearing with nothing to show for the week of
    0-Gold tasks."""
    from api.services.mechanics import check_and_expire_mutators
    import time

    user, profile = profile_mut
    profile.gold = 100
    activated_8_days_ago = (time.time() - 8 * 24 * 3600) * 1000
    profile.active_mutators = {
        "active": [
            {
                "id": "zero_hour",
                "duration": 7,
                "activatedAt": activated_8_days_ago,
                "data": {"withheld_gold": 250},
            }
        ]
    }
    profile.save()

    check_and_expire_mutators(profile)
    profile.refresh_from_db()

    assert profile.gold == 100 + 250 * 3
    assert profile.active_mutators.get("active", []) == []  # mutator removed


@pytest.mark.django_db
def test_activity_log_zero_hour_accumulates_withheld_gold(profile_mut):
    """Same accumulation, through the Activity/Study log endpoint
    (TrainingLogView) rather than a Task completion."""
    from rest_framework.test import APIClient
    from api.services.mechanics import calculate_training_efficiency

    user, profile = profile_mut
    profile.active_mutators = {
        "active": [{"id": "zero_hour", "duration": 7, "data": {}}]
    }
    profile.save()

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
    assert res.data["gold_earned"] == 0

    profile.refresh_from_db()
    zh_data = next(
        m["data"] for m in profile.active_mutators["active"] if m["id"] == "zero_hour"
    )
    assert zh_data["withheld_gold"] > 0


@pytest.mark.django_db
def test_zero_hour_expires_with_no_withheld_gold_pays_nothing(profile_mut):
    """No tasks completed during the 7 days -> nothing withheld -> nothing
    paid out, and no crash from a missing/zero withheld_gold key."""
    from api.services.mechanics import check_and_expire_mutators
    import time

    user, profile = profile_mut
    profile.gold = 100
    activated_8_days_ago = (time.time() - 8 * 24 * 3600) * 1000
    profile.active_mutators = {
        "active": [
            {
                "id": "zero_hour",
                "duration": 7,
                "activatedAt": activated_8_days_ago,
                "data": {},
            }
        ]
    }
    profile.save()

    check_and_expire_mutators(profile)
    profile.refresh_from_db()

    assert profile.gold == 100
    assert profile.active_mutators.get("active", []) == []
