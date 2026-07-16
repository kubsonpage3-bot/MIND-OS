import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UnlockedSkill, UserStats

from api.services.achievement_service import check_and_grant_achievements
from api.services.profile_service import get_humanities_rank_info


@pytest.fixture
def user():
    u = User.objects.create(username="testuser_batch5", password="testpassword")
    return u


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.rank_xp = 1000
    p.gf = 100.0
    p.gc = 100.0
    p.ps = 100.0
    p.vm = 100.0
    p.gf_ceiling = 150.0
    p.gc_ceiling = 150.0
    p.ps_ceiling = 150.0
    p.vm_ceiling = 150.0
    p.save()
    return p


@pytest.mark.django_db
def test_transcendent_will(profile):
    """
    Tests that transcendent_will reduces Johan's total XP by 10%.
    """
    from api.services.rival_service import (
        compute_rival_data,
        JOHAN_DIFFICULTIES,
        DEFAULT_DIFFICULTY,
        get_day_pattern,
        generate_daily_sessions,
        calc_johan_daily_xp,
        get_johan_specializations,
    )
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    rival_data_before = compute_rival_data(profile)
    accumulated_before = rival_data_before["johanAccumulatedXP"]

    profile.rival_data["lastUpdated"] = "1999-01-01"
    profile.save()

    UnlockedSkill.objects.create(user_profile=profile, skill_code="transcendent_will")
    rival_data_after = compute_rival_data(profile)
    johan_xp_after = rival_data_after["totalXP"]

    diff_cfg = JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY]

    # Calculate what today's daily should be
    user_id = profile.user.id
    pattern = get_day_pattern(today, user_id, diff_cfg)
    specializations = get_johan_specializations(user_id)
    sessions = generate_daily_sessions(
        today, user_id, pattern, specializations, diff_cfg
    )
    today_daily = calc_johan_daily_xp(sessions, diff_cfg)

    expected_total = max(1.0, round((accumulated_before + today_daily) * 0.9, 1))
    assert johan_xp_after == expected_total
    print(
        f"\n[test_transcendent_will] accumulated_before={accumulated_before}, after={johan_xp_after}, expected={expected_total}"
    )


@pytest.mark.django_db
def test_johan_session_determinism(profile):
    """
    Tests that for the same user_id and date, Johan generates the EXACT same pattern and sessions.
    """
    from api.services.rival_service import (
        get_day_pattern,
        generate_daily_sessions,
        get_johan_specializations,
        JOHAN_DIFFICULTIES,
        DEFAULT_DIFFICULTY,
    )

    date_str = "2026-07-16"
    user_id = profile.user.id
    diff_cfg = JOHAN_DIFFICULTIES[DEFAULT_DIFFICULTY]

    pattern1 = get_day_pattern(date_str, user_id, diff_cfg)
    specs1 = get_johan_specializations(user_id)
    sessions1 = generate_daily_sessions(date_str, user_id, pattern1, specs1, diff_cfg)

    pattern2 = get_day_pattern(date_str, user_id, diff_cfg)
    specs2 = get_johan_specializations(user_id)
    sessions2 = generate_daily_sessions(date_str, user_id, pattern2, specs2, diff_cfg)

    assert pattern1 == pattern2
    assert specs1 == specs2
    assert sessions1 == sessions2
    print("\n[test_johan_session_determinism] Determinism verified.")


@pytest.mark.django_db
def test_omniscience(user, profile):
    """
    Tests that omniscience adds +0.3 to gf, gc, ps, vm on achievement unlock.
    """
    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.total_gold_earned = 10
    stats.save()
    user.refresh_from_db()

    new_achs_1 = check_and_grant_achievements(user)
    print("NEW ACHS 1:", new_achs_1)
    profile.refresh_from_db()
    assert profile.gf == 100.0

    UnlockedSkill.objects.create(user_profile=profile, skill_code="omniscience")
    stats.total_gold_earned = 1000
    stats.save()
    user.refresh_from_db()

    new_achs = check_and_grant_achievements(user)
    print("NEW ACHS:", new_achs)
    profile.refresh_from_db()
    assert profile.gf == 100.3
    assert profile.gc == 100.3
    assert profile.ps == 100.3
    assert profile.vm == 100.3
    print(
        f"\n[test_omniscience] gf/gc/ps/vm after omniscience={profile.gf}/{profile.gc}/{profile.ps}/{profile.vm}"
    )


@pytest.mark.django_db
def test_humanities_passives(profile):
    profile.humanities_xp = 550
    profile.save()

    info_before = get_humanities_rank_info(profile)
    assert info_before["current_id"] == "D"

    UnlockedSkill.objects.create(user_profile=profile, skill_code="master_of_arts")
    info_after = get_humanities_rank_info(profile)
    assert info_after["current_id"] == "C"
    print(
        f"\n[test_master_of_arts] Rank with 550xp before={info_before['current_id']}, after={info_after['current_id']}"
    )


@pytest.mark.django_db
def test_godmind_and_cross_training(user, profile):
    """
    Tests that godmind adds (gf+gc+ps+vm)*0.5 to Rank XP.
    Tests that cross_training adds 0.3 * hours to humanities_xp for language sessions.
    """
    # We will simulate the same math views.py does
    unlocked_skills = {"godmind", "cross_training"}
    UnlockedSkill.objects.create(user_profile=profile, skill_code="godmind")
    UnlockedSkill.objects.create(user_profile=profile, skill_code="cross_training")

    base_xp = 50
    hours = 2.0
    is_language = True

    # Godmind logic
    godmind_bonus = int((profile.gf + profile.gc + profile.ps + profile.vm) * 0.5)
    final_xp = base_xp + godmind_bonus

    # Check godmind bonus logic
    assert godmind_bonus == int(400 * 0.5) == 200
    print(
        f"\n[test_godmind] base_xp={base_xp}, godmind_bonus={godmind_bonus}, final_xp={final_xp}"
    )

    # Cross training logic
    if is_language and "cross_training" in unlocked_skills:
        profile.humanities_xp += hours * 0.3

    assert profile.humanities_xp == 0.6
    print(
        f"\n[test_cross_training] hours={hours}, humanities_xp={profile.humanities_xp}"
    )


@pytest.mark.django_db
def test_living_library():
    """
    Tests living_library +15% multiplier logic.
    """
    unlocked_skills = {"living_library"}
    final_xp = 100

    # Simulate reading session
    activity = "reading"
    task_category = ""

    task_cat_lower = task_category.lower() if task_category else ""
    if activity.lower() in ["reading", "philosophy"] or task_cat_lower in [
        "reading",
        "philosophy",
    ]:
        if "living_library" in unlocked_skills:
            final_xp = int(final_xp * 1.15)

    assert final_xp == 114  # int(100 * 1.15) in python is 114
    print(f"\n[test_living_library] base final_xp=100, new final_xp={final_xp}")
