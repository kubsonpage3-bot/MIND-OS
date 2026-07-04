import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User
from django.urls import reverse
from api.models import Party, PartyMembership


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def party():
    return Party.objects.create(name="Test Party")


@pytest.fixture
def user_a(party):
    u = User.objects.create_user(username="usera", password="123")
    PartyMembership.objects.create(user=u, party=party)
    return u


@pytest.fixture
def user_b(party):
    u = User.objects.create_user(username="userb", password="123")
    PartyMembership.objects.create(user=u, party=party)
    return u


@pytest.fixture
def user_c():
    return User.objects.create_user(username="userc", password="123")


@pytest.mark.django_db
def test_fetch_fellow_member_profile_success(api_client, user_a, user_b):
    # Case 1: A user IN the party can successfully fetch a fellow member's profile
    api_client.force_authenticate(user=user_a)
    url = reverse("party-member-profile", kwargs={"user_id": user_b.id})
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "user_id" in data
    assert data["user_id"] == user_b.id
    assert "username" in data
    assert data["username"] == "userb"
    assert "hp" in data
    assert "hp_max" in data
    assert "xp" in data
    assert "xp_to_next_level" in data
    assert "mana" in data
    assert "mana_max" in data
    assert "total_tasks_completed" in data
    assert "max_streak" in data
    assert "allies" in data
    assert isinstance(data["allies"], list)


@pytest.mark.django_db
def test_fetch_profile_not_in_party_forbidden(api_client, party, user_b, user_c):
    # Case 2: A user NOT in the party gets 403 when attempting to fetch a profile
    api_client.force_authenticate(user=user_c)
    url = reverse("party-member-profile", kwargs={"user_id": user_b.id})
    response = api_client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    data = response.json()
    assert "error" in data


@pytest.mark.django_db
def test_fetch_own_profile_success(api_client, user_a):
    # Case 3: A user attempting to fetch their OWN profile via this endpoint works correctly
    api_client.force_authenticate(user=user_a)
    url = reverse("party-member-profile", kwargs={"user_id": user_a.id})
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["user_id"] == user_a.id
    assert data["username"] == "usera"


@pytest.mark.django_db
def test_fetch_nonexistent_user_returns_404(api_client, user_a):
    # Case 4: A request with a user_id that doesn't exist at all returns a clean 404, not a 500
    api_client.force_authenticate(user=user_a)
    # Using a large ID that certainly doesn't exist
    url = reverse("party-member-profile", kwargs={"user_id": 999999})
    response = api_client.get(url)

    assert response.status_code == status.HTTP_404_NOT_FOUND
