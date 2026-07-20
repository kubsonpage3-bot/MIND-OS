import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UserStats
from api.services.title_service import get_user_playstyle_titles


@pytest.fixture
def playstyle_test_user():
    user = User.objects.create(username="playstyle_tester", email="playstyle@test.com")
    profile = UserProfile.objects.get(user=user)
    stats, _ = UserStats.objects.get_or_create(user=user)
    return user, profile, stats


@pytest.mark.django_db
def test_default_playstyle_title(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    info = get_user_playstyle_titles(profile)

    assert info["unlocked_count"] >= 1
    assert info["total_count"] == 52
    assert info["active_title"]["id"] == "awakened_one"


@pytest.mark.django_db
def test_marathoner_title_unlock(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    profile.streak = 35
    profile.save()

    info = get_user_playstyle_titles(profile)
    unlocked_ids = [t["id"] for t in info["titles"] if t["unlocked"]]

    assert "marathoner" in unlocked_ids
    assert info["active_title"]["id"] == "marathoner"


@pytest.mark.django_db
def test_equip_title(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    profile.streak = 40
    profile.equipped_title = "marathoner"
    profile.save()

    info = get_user_playstyle_titles(profile)
    assert info["active_title"]["id"] == "marathoner"
    assert info["active_title"]["is_equipped"] is True


@pytest.mark.django_db
def test_class_title_unlocks_with_lowercase_class_name(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    # Set lowercase class name
    profile.character_class = "ascetic"
    profile.save()

    # Set total_tasks_completed to 10 on UserStats
    stats.total_tasks_completed = 10
    stats.save()

    info = get_user_playstyle_titles(profile)
    unlocked_ids = [t["id"] for t in info["titles"] if t["unlocked"]]
    assert "ascetic_scholar" in unlocked_ids


@pytest.mark.django_db
def test_mutator_titles_logic(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    # 1. Initially alchemist and grand_alchemist are False, experimentalist is False
    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert not titles["alchemist"]["unlocked"]
    assert not titles["grand_alchemist"]["unlocked"]
    assert not titles["experimentalist"]["unlocked"]

    # 2. Buy 3 mutators (purchased list has 3 items)
    profile.active_mutators = {"purchased": ["m1", "m2", "m3"], "active": []}
    profile.save()

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["alchemist"]["unlocked"]
    assert not titles["grand_alchemist"]["unlocked"]
    assert not titles["experimentalist"]["unlocked"]

    # 3. Enable 2 active mutators simultaneously
    profile.active_mutators = {
        "purchased": ["m1", "m2", "m3"],
        "active": [{"id": "m1"}, {"id": "m2"}],
    }
    profile.save()

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["alchemist"]["unlocked"]
    assert titles["experimentalist"]["unlocked"]

    # Option B check: if active mutators become 0, experimentalist and alchemist remain unlocked!
    profile.active_mutators = {"purchased": [], "active": []}
    profile.save()
    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["alchemist"]["unlocked"]
    assert titles["experimentalist"]["unlocked"]


@pytest.mark.django_db
def test_rank_titles_logic(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    # Should initially be False
    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert not titles["pioneer"]["unlocked"]

    # Reach Rank C (min_xp = 600)
    profile.rank_xp = 650
    profile.save()

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["pioneer"]["unlocked"]

    # Option B check: if rank_xp falls back to 0, pioneer remains unlocked
    profile.rank_xp = 0
    profile.save()
    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["pioneer"]["unlocked"]


@pytest.mark.django_db
def test_recruited_allies_titles(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    from api.models import RecruitedAlly

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert not titles["ally_patron"]["unlocked"]
    assert not titles["beast_master"]["unlocked"]

    # Recruit 3 allies
    RecruitedAlly.objects.create(user_profile=profile, ally_code="vivian")
    RecruitedAlly.objects.create(user_profile=profile, ally_code="rhea")
    RecruitedAlly.objects.create(user_profile=profile, ally_code="kira")

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["ally_patron"]["unlocked"]
    assert titles["beast_master"]["unlocked"]


@pytest.mark.django_db
def test_category_specific_weekly_xp_titles(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    from api.models import TrainingSession

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert not titles["bookworm"]["unlocked"]
    assert not titles["architect_mind"]["unlocked"]

    # Log 120 Gc (Language/Humanities) XP in last 7 days
    TrainingSession.objects.create(
        user_profile=profile, activity_key="history", hours=1.0, xp_earned=120
    )

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["bookworm"]["unlocked"]
    assert not titles["architect_mind"]["unlocked"]


@pytest.mark.django_db
def test_warlord_guard_attacks_logic(playstyle_test_user):
    user, profile, stats = playstyle_test_user
    profile.character_class = "warlord"
    profile.save()

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert not titles["warlord_guard"]["unlocked"]

    # Perform 10 boss attacks
    stats.boss_attacks_count = 10
    stats.save()
    profile.user.stats.refresh_from_db()

    info = get_user_playstyle_titles(profile)
    titles = {t["id"]: t for t in info["titles"]}
    assert titles["warlord_guard"]["unlocked"]
