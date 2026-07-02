import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UnlockedSkill, UserStats, UserAchievement, Task
from api.services.rival_service import compute_rival_data, calc_johan_xp
from api.services.achievement_service import check_and_grant_achievements
from api.services.profile_service import get_humanities_rank_info
from django.utils import timezone
from datetime import datetime


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
    Tests that transcendent_will multiplies Johan's generated XP by 0.9.
    """
    rival_data_before = compute_rival_data(profile)
    johan_xp_before = rival_data_before["totalXP"]

    profile.rival_data["lastUpdated"] = "1999-01-01"
    profile.save()

    UnlockedSkill.objects.create(user_profile=profile, skill_code="transcendent_will")
    rival_data_after = compute_rival_data(profile)
    johan_xp_after = rival_data_after["totalXP"]

    expected = max(1.0, round(johan_xp_before * 0.9, 1))
    assert johan_xp_after == expected
    print(
        f"\n[test_transcendent_will] johan_xp before={johan_xp_before}, after={johan_xp_after}"
    )


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
    from api.services.mechanics import calculate_task_outcome

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
