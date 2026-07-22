import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UserStats, Party, PartyMembership, RecruitedAlly, InventoryItem, Item, SkillCooldown, PomodoroSession
from api.services.title_service import TITLES_CATALOG, _evaluate_title_unlock, get_user_playstyle_titles


@pytest.mark.django_db
def test_all_52_titles_in_catalog_registered():
    """Verify that TITLES_CATALOG contains exactly 52 titles."""
    assert len(TITLES_CATALOG) == 52, f"Expected 52 titles, found {len(TITLES_CATALOG)}"
    title_ids = set(t["id"] for t in TITLES_CATALOG)
    assert len(title_ids) == 52, "Duplicate title IDs found in TITLES_CATALOG"


@pytest.mark.django_db
def test_evaluate_title_unlock_coverage():
    """Test _evaluate_title_unlock for every single title in TITLES_CATALOG."""
    user = User.objects.create_user(username="title_tester", password="password")
    profile = user.profile
    stats = user.stats

    task_stats = {
        "night_count": 5,
        "morning_count": 5,
        "noon_count": 10,
        "evening_count": 15,
        "weekend_count": 10,
        "midnight_exact": 1,
        "max_day_tasks": 15,
    }

    # Verify each title responds with a valid tuple (is_unlocked, progress_pct, progress_text)
    for title_def in TITLES_CATALOG:
        t_id = title_def["id"]
        res = _evaluate_title_unlock(user, t_id, stats, profile, task_stats)
        assert isinstance(res, tuple) and len(res) == 3, f"Title {t_id} returned invalid response shape"
        unlocked, pct, text = res
        assert isinstance(unlocked, bool), f"Title {t_id} is_unlocked is not bool"
        assert isinstance(pct, (int, float)), f"Title {t_id} progress_pct is not numeric"
        assert isinstance(text, str), f"Title {t_id} progress_text is not string"


@pytest.mark.django_db
def test_specific_titles_unlock_conditions():
    """Test specific unlock thresholds across multiple title domains."""
    user = User.objects.create_user(username="title_tester_2", password="password")
    profile = user.profile
    stats = user.stats

    # 1. Awakened One (Default)
    unlocked, _, _ = _evaluate_title_unlock(user, "awakened_one", stats, profile, {})
    assert unlocked is True

    # 2. Streak Titles (ignited = 7 days)
    profile.streak = 7
    profile.save()
    unlocked, pct, _ = _evaluate_title_unlock(user, "ignited", stats, profile, {})
    assert unlocked is True
    assert pct == 100.0

    # 3. Class Specialization (ascetic_scholar with 10 tasks)
    profile.character_class = "Ascetic"
    profile.save()
    stats.total_tasks_completed = 10
    stats.save()
    unlocked, _, _ = _evaluate_title_unlock(user, "ascetic_scholar", stats, profile, {})
    assert unlocked is True

    # 4. Wealth Titles (gold_digger = 250 gold)
    stats.total_gold_earned = 300
    stats.save()
    unlocked, _, _ = _evaluate_title_unlock(user, "gold_digger", stats, profile, {})
    assert unlocked is True

    # 5. Combat Titles (boss_slayer = 1 boss)
    stats.bosses_defeated = 1
    stats.save()
    unlocked, _, _ = _evaluate_title_unlock(user, "boss_slayer", stats, profile, {})
    assert unlocked is True


@pytest.mark.django_db
def test_sync_user_titles_service():
    """Test get_user_playstyle_titles generates playstyle info without error."""
    user = User.objects.create_user(username="title_sync_user", password="password")
    profile = user.profile
    
    playstyle = get_user_playstyle_titles(profile)
    assert "active_title" in playstyle
    assert "titles" in playstyle
    assert "unlocked_count" in playstyle
    assert playstyle["total_count"] == 52
    assert playstyle["unlocked_count"] >= 1  # "awakened_one" unlocked by default
