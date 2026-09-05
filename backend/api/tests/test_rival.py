from unittest.mock import patch
import pytest
from datetime import datetime, timezone, timedelta
from django.contrib.auth.models import User
from api.models import UserProfile
from api.services.rival_service import compute_rival_data


@pytest.fixture
def user():
    return User.objects.create(username="testuser_rival", password="password")


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.rival_data = {}
    p.save()
    return p


@pytest.mark.django_db
def test_rival_xp_accumulation_exact_math(profile):
    """
    Verifies exact math for johanAccumulatedXP with mocked 10.0 XP/day.
    Tests days_missed = 0 (same day repeat), 1 (next day), and 3 (three days ago).
    """
    today_dt = datetime.now(timezone.utc)
    yesterday_str = (today_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    three_days_ago_str = (today_dt - timedelta(days=3)).strftime("%Y-%m-%d")

    with patch("api.services.rival_service.calc_johan_daily_xp", return_value=10.0):
        # 1. Initial run -> 0.0 + 10.0 = 10.0
        data1 = compute_rival_data(profile)
        assert data1["johanAccumulatedXP"] == 10.0

        # 2. Same day repeat -> short-circuit returns exact stored value (10.0)
        data1_repeat = compute_rival_data(profile)
        assert data1_repeat["johanAccumulatedXP"] == 10.0

        # 3. Next day login (days_missed = 1) -> 100.0 + 10.0 = 110.0
        profile.rival_data["lastUpdated"] = yesterday_str
        profile.rival_data["johanAccumulatedXP"] = 100.0
        profile.save(update_fields=["rival_data"])

        data2 = compute_rival_data(profile)
        assert data2["johanAccumulatedXP"] == 110.0

        # 4. Missed 3 days (days_missed = 3) -> 100.0 + (3 * 10.0) = 130.0 EXACT
        profile.rival_data["lastUpdated"] = three_days_ago_str
        profile.rival_data["johanAccumulatedXP"] = 100.0
        profile.save(update_fields=["rival_data"])

        data3 = compute_rival_data(profile)
        assert data3["johanAccumulatedXP"] == 130.0


@pytest.mark.django_db
def test_weekly_comparison_fields_are_populated(profile):
    """
    RivalTab's Weekly Comparison card reads johanWeekHours/johanAvgFocus/
    johanSubjectsWeek/johanWeekRankXP straight off the top-level payload.
    Regression test for these being entirely absent (defaulting to 0, or 1
    for subjects on the frontend) — which made the player "win" every row
    of the head-to-head comparison unconditionally, regardless of either
    side's actual activity.
    """
    data = compute_rival_data(profile)

    assert data["johanWeekHours"] > 0
    assert data["johanAvgFocus"] > 0
    assert data["johanSubjectsWeek"] >= 1
    assert data["johanWeekRankXP"] > 0

    # Must be internally consistent with the pre-existing weeklyStats block
    # (same underlying week, same difficulty) rather than diverging from it.
    assert data["johanWeekHours"] == data["weeklyStats"]["johanHours"]
    assert data["johanWeekRankXP"] == data["weeklyStats"]["johanXP"]
