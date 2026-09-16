import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import UserActivityLog
from api.services.profile_service import check_death, get_rank_info


@pytest.mark.django_db
def test_death_rank_penalty_persists_across_profile_and_history_reads():
    """
    Ensures that when a user dies, their rank is properly demoted,
    and subsequent GET requests to /api/profile/ and /api/history/
    do NOT overwrite the demoted rank_xp back to the sum of historical activities.
    """
    user = User.objects.create_user(username="valiant_knight", password="password123")
    profile = user.profile

    # Player has 350 Rank XP (Rank D, threshold 200-599)
    profile.rank_xp = 350
    profile.level = 4
    profile.hp = 0  # Fatal damage taken
    profile.save()

    # User has completed various tasks in the past totaling 350 XP
    UserActivityLog.objects.create(
        user=user,
        activity_type=UserActivityLog.ActivityType.DAILY,
        title="Morning Calisthenics",
        xp_earned=200,
    )
    UserActivityLog.objects.create(
        user=user,
        activity_type=UserActivityLog.ActivityType.STUDY,
        title="Python Mastery",
        xp_earned=150,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    # 1. Trigger death
    died = check_death(profile)
    assert died is True

    profile.refresh_from_db()
    assert profile.hp == profile.max_hp
    assert profile.level == 3  # Level dropped by 1
    assert profile.xp == 0     # Level progress reset

    # Rank D (index 1) should be demoted to Rank E (index 0, min 0)
    assert profile.rank_xp == 0
    rank_info = get_rank_info(profile)
    assert rank_info["current_id"] == "E"

    # 2. GET /api/profile/ must reflect Rank E (0 XP) and NOT revert to 350
    res_prof = client.get("/api/profile/", HTTP_HOST="localhost")
    assert res_prof.status_code == 200
    prof_data = res_prof.json()
    assert prof_data["rank_xp"] == 0
    assert prof_data["rank_info"]["current_id"] == "E"

    profile.refresh_from_db()
    assert profile.rank_xp == 0

    # 3. GET /api/history/ must also preserve Rank E (0 XP)
    res_hist = client.get("/api/history/?days=all", HTTP_HOST="localhost")
    assert res_hist.status_code == 200
    hist_data = res_hist.json()
    assert hist_data["stats"]["total_xp"] == 350  # Lifetime accomplishment history preserved
    assert hist_data["profile"]["rank_xp"] == 0   # Current rank stays demoted

    profile.refresh_from_db()
    assert profile.rank_xp == 0


@pytest.mark.django_db
def test_death_rank_penalty_from_c_to_d_tier():
    """
    Test demotion from Rank C (600+) to Rank D (200 threshold).
    """
    user = User.objects.create_user(username="veteran_warrior", password="password123")
    profile = user.profile

    profile.rank_xp = 1100  # Rank C (600 - 1499)
    profile.level = 7
    profile.hp = 0
    profile.save()

    UserActivityLog.objects.create(
        user=user,
        activity_type=UserActivityLog.ActivityType.TODO,
        title="Project Milestone",
        xp_earned=1100,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    died = check_death(profile)
    assert died is True

    profile.refresh_from_db()
    # Rank C -> Rank D floor is 200 XP
    assert profile.rank_xp == 200
    assert get_rank_info(profile)["current_id"] == "D"

    res_prof = client.get("/api/profile/", HTTP_HOST="localhost")
    assert res_prof.status_code == 200
    assert res_prof.json()["rank_xp"] == 200
    assert res_prof.json()["rank_info"]["current_id"] == "D"
