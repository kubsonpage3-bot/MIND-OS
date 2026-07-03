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
