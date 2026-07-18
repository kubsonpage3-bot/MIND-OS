import pytest
from django.contrib.auth.models import User
from api.models import UserProfile, UserStats
from api.serializers.profile import UserProfileSerializer
from api.serializers.party import PartyMemberProfileSerializer
from api.services.daily_service import process_daily_login


@pytest.fixture
def test_user_and_profile():
    user = User.objects.create(username="streak_test_user")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    stats, _ = UserStats.objects.get_or_create(user=user)
    return user, profile, stats


@pytest.mark.django_db
def test_max_streak_sync(test_user_and_profile):
    from django.utils import timezone

    user, profile, stats = test_user_and_profile
    profile.streak = 5
    profile.last_login_date = timezone.now().date()
    profile.save()

    process_daily_login(user)

    stats.refresh_from_db()
    assert stats.max_streak >= 5

    # Serializer should return max_streak >= streak
    serializer = UserProfileSerializer(profile)
    assert serializer.data["max_streak"] == 5

    party_serializer = PartyMemberProfileSerializer(profile)
    assert party_serializer.data["max_streak"] == 5
