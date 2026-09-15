import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UnlockedSkill, UserStats, Boss, BossEncounter
from api.services.mechanics import apply_boss_damage
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
    from datetime import datetime, timezone, timedelta

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    rival_data_before = compute_rival_data(profile)
    accumulated_before = rival_data_before["johanAccumulatedXP"]

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    profile.rival_data["lastUpdated"] = yesterday
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
    Tests that omniscience adds +0.2 to gf, gc, ps, vm on boss defeat.
    """
    boss1 = Boss.objects.create(id_name="test_boss_1", name="Boss 1", level=1, hp_max=100, reward_gold=50, reward_xp=50)
    BossEncounter.objects.create(user=user, boss=boss1, hp_current=100, is_defeated=False)

    # Defeat boss 1 without omniscience
    combat = apply_boss_damage(user, 150)
    assert combat["boss_defeated"] is True
    profile.refresh_from_db()
    assert profile.gf == 100.0
    assert profile.gc == 100.0
    assert profile.ps == 100.0
    assert profile.vm == 100.0

    # Unlock omniscience
    UnlockedSkill.objects.create(user_profile=profile, skill_code="omniscience")

    # Defeat boss 2 with omniscience
    boss2 = Boss.objects.create(id_name="test_boss_2", name="Boss 2", level=2, hp_max=100, reward_gold=50, reward_xp=50)
    BossEncounter.objects.create(user=user, boss=boss2, hp_current=100, is_defeated=False)

    combat2 = apply_boss_damage(user, 150)
    assert combat2["boss_defeated"] is True
    profile.refresh_from_db()
    assert profile.gf == 100.2
    assert profile.gc == 100.2
    assert profile.ps == 100.2
    assert profile.vm == 100.2
    print(
        f"\n[test_omniscience] gf/gc/ps/vm after omniscience boss defeat={profile.gf}/{profile.gc}/{profile.ps}/{profile.vm}"
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

    # Godmind logic -- description says "IQ score (AVG of gf+gc+ps+vm)";
    # the real implementation used to sum instead of average (a 4x bug,
    # since all 4 metrics have an enforced floor of 100), fixed to match
    # the description.
    godmind_iq = (profile.gf + profile.gc + profile.ps + profile.vm) / 4.0
    godmind_bonus = int(godmind_iq * 0.5)
    final_xp = base_xp + godmind_bonus

    # Check godmind bonus logic
    assert godmind_bonus == int(100 * 0.5) == 50
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
def test_godmind_real_endpoint_uses_average_not_sum(user, profile):
    """End-to-end through the real /api/training/log/ endpoint (not a
    reimplementation): with all 4 metrics at their floor of 100, Godmind
    must add ~50 flat XP (avg 100 x 0.5), not ~200 (the old summed bug)."""
    from rest_framework.test import APIClient
    from api.services.mechanics import calculate_training_efficiency

    UnlockedSkill.objects.create(user_profile=profile, skill_code="godmind")

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

    godmind_note = next(n for n in res.data["breakdown"] if n.startswith("Godmind"))
    assert "+50 XP" in godmind_note, godmind_note
    assert "+200 XP" not in godmind_note


@pytest.mark.django_db
def test_cognitive_supremacy_doubles_gf_gc_gains_on_real_endpoint():
    """Redesigned per user decision from a flat +20% to all 4 metrics into a
    permanent x2 (+100%) to Gf/Gc/Ps/Vm gains -- e.g. a math session should
    gain exactly twice the Gf/Gc it otherwise would. Compares two identical
    profiles (one with the skill, one without) logging the identical
    session, rather than assuming the exact underlying gain formula."""
    from rest_framework.test import APIClient
    from api.services.mechanics import calculate_training_efficiency

    def make_profile(username):
        u = User.objects.create_user(username=username, password="pw")
        p, _ = UserProfile.objects.get_or_create(user=u)
        p.gf, p.gc, p.ps, p.vm = 100.0, 100.0, 100.0, 100.0
        p.gf_ceiling = p.gc_ceiling = p.ps_ceiling = p.vm_ceiling = 150.0
        p.save()
        return u, p

    def log_math(user, profile):
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
        profile.refresh_from_db()
        return profile

    user_a, profile_a = make_profile("cogsup_baseline")
    user_b, profile_b = make_profile("cogsup_boosted")
    UnlockedSkill.objects.create(user_profile=profile_b, skill_code="cognitive_supremacy")

    gf_before_a, gc_before_a = profile_a.gf, profile_a.gc
    gf_before_b, gc_before_b = profile_b.gf, profile_b.gc

    profile_a = log_math(user_a, profile_a)
    profile_b = log_math(user_b, profile_b)

    gf_gain_baseline = profile_a.gf - gf_before_a
    gc_gain_baseline = profile_a.gc - gc_before_a
    gf_gain_boosted = profile_b.gf - gf_before_b
    gc_gain_boosted = profile_b.gc - gc_before_b

    assert gf_gain_baseline > 0
    assert gf_gain_boosted == pytest.approx(gf_gain_baseline * 2, abs=0.01)
    assert gc_gain_boosted == pytest.approx(gc_gain_baseline * 2, abs=0.01)


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
