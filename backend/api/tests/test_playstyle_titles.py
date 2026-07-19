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
