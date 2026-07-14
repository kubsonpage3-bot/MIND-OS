import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from django.contrib.auth.models import User
from api.models import UserProfile, Task
import time


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    u = User.objects.create_user(username="testuser", password="testpassword")
    return u


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.hp = 10
    p.gold = 500
    p.xp = 200
    p.level = 5
    p.save()
    return p


@pytest.mark.django_db
def test_reset_data_view_persistence(api_client, user, profile):
    # Setup some dummy data to ensure it gets reset
    Task.objects.create(
        user=user, title="Dummy Task", task_type="todo", difficulty="medium"
    )

    # Authenticate
    api_client.force_authenticate(user=user)

    # Assert state before reset
    assert profile.gold == 500
    assert profile.hp == 10
    assert Task.objects.count() == 1

    # Trigger Reset
    url = reverse("profile-reset")
    response = api_client.post(url, {"reset_type": "nuclear"}, format="json")
    assert response.status_code == 200

    # Verify DB immediately after
    profile.refresh_from_db()
    assert profile.gold == 0
    assert profile.hp == 100
    assert profile.level == 1
    assert Task.objects.count() == 0

    # Simulate time delay (though DB won't change itself, this verifies the endpoint
    # doesn't have some weird async task reverting it, and ensures HTTP cache isn't
    # returning a stale Profile endpoint response).
    time.sleep(0.5)

    # Fetch profile again via API to check for caching issues
    profile_url = reverse("user-profile")  # Assuming this is the name
    profile_resp = api_client.get(profile_url)
    assert profile_resp.status_code == 200
    assert profile_resp.data["gold"] == 0
    assert profile_resp.data["hp"] == 100

    # Re-verify DB
    profile.refresh_from_db()
    assert profile.gold == 0
    assert profile.hp == 100


@pytest.mark.django_db
def test_mark_guide_seen(api_client, user):
    api_client.force_authenticate(user=user)

    # Check default
    profile_resp = api_client.get(reverse("user-profile"))
    assert profile_resp.data["seen_guides"] == {}

    # Mark seen
    url = reverse("profile-mark-guide-seen")
    resp = api_client.post(url, {"guide_id": "mutators"})
    assert resp.status_code == 200
    assert resp.data["seen_guides"]["mutators"] is True

    # Mark another
    resp2 = api_client.post(url, {"guide_id": "tasks"})
    assert resp2.status_code == 200
    assert resp2.data["seen_guides"]["mutators"] is True
    assert resp2.data["seen_guides"]["tasks"] is True

    # Ensure duplicate is fine
    resp3 = api_client.post(url, {"guide_id": "mutators"})
    assert resp3.status_code == 200

    # Verify via DB
    user.profile.refresh_from_db()
    assert user.profile.seen_guides == {"mutators": True, "tasks": True}


@pytest.mark.django_db
def test_pomodoro_settings_api(api_client, user, profile):
    api_client.force_authenticate(user=user)

    # 1. Check default value
    profile_url = reverse("user-profile")
    resp = api_client.get(profile_url)
    assert resp.status_code == 200
    assert resp.data["pomodoro_settings"] == {}

    # 2. Patch new settings
    new_settings = {"work": 45, "break": 10, "longBreak": 20, "cycles": 5}
    patch_resp = api_client.patch(
        profile_url, {"pomodoro_settings": new_settings}, format="json"
    )
    assert patch_resp.status_code == 200
    assert patch_resp.data["pomodoro_settings"] == new_settings

    # 3. Verify DB update
    profile.refresh_from_db()
    assert profile.pomodoro_settings == new_settings


@pytest.mark.django_db
def test_active_allies_validation_and_representation(api_client, user, profile):
    from api.models import RecruitedAlly

    api_client.force_authenticate(user=user)
    profile_url = reverse("user-profile")

    # 1. Try setting active_allies with unrecruited ally
    resp = api_client.patch(
        profile_url, {"active_allies": ["kira"]}, format="json"
    )
    assert resp.status_code == 400
    assert "Cannot activate unrecruited allies" in resp.data[0]

    # 2. Recruit kira
    RecruitedAlly.objects.create(user_profile=profile, ally_code="kira", level=1)

    # 3. Try setting active_allies with recruited ally (should succeed)
    resp = api_client.patch(
        profile_url, {"active_allies": ["kira"]}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["active_allies"] == ["kira"]

    # 4. Directly corrupt the database field with an unrecruited ally
    profile.active_allies = ["kira", "invalid_ally"]
    profile.save()

    # 5. Fetch profile - it should self-heal the representation and DB
    resp = api_client.get(profile_url)
    assert resp.status_code == 200
    assert resp.data["active_allies"] == ["kira"]

    # 6. Verify the database was indeed cleaned up
    profile.refresh_from_db()
    assert profile.active_allies == ["kira"]

