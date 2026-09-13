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
from api.services.mechanics import apply_active_mutators, calculate_task_outcome
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

    effects = apply_active_mutators(profile, {})
    assert effects["xp_mult"] == pytest.approx(1.0 + 3.0 * 0.30)


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

    effects = apply_active_mutators(profile, {})
    assert effects["final_xp_mult"] == pytest.approx(3.0)
    assert effects["damage_taken_mult"] == 1.0  # no hidden +30%


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
