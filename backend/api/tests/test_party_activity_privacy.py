import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from api.models import PartyEvent
from api.services.party_service import create_party, join_party
from api.serializers.party import PartyEventSerializer


@pytest.fixture
def user_a(db):
    user = User.objects.create_user(username="secret_agent", password="pw")
    return user


@pytest.fixture
def user_b(db):
    user = User.objects.create_user(username="warband_buddy", password="pw")
    return user


@pytest.fixture
def party(user_a, user_b):
    p = create_party(user_a, "Shadow Guild")
    join_party(user_b, p.invite_code)
    return p


@pytest.mark.django_db
def test_party_task_privacy_setting_and_serialization(user_a, user_b, party):
    """
    Verify that when hide_party_task_names is enabled:
    - The creator sees their actual task title with is_private=True.
    - An ally sees 'a task' with is_private=True.
    - When disabled, both see the actual task title.
    """
    # 1. Create a task completion event
    event = PartyEvent.objects.create(
        party=party,
        member=user_a.party_membership,
        event_type="task",
        message="Confidential Workout 100",
    )

    # 2. When privacy is OFF (default)
    user_a.profile.hide_party_task_names = False
    user_a.profile.save()

    # Ally view
    req_b = type("Req", (), {"user": user_b})()
    data_b = PartyEventSerializer(event, context={"request": req_b}).data
    assert data_b["content"] == "Confidential Workout 100"
    assert data_b["is_private"] is False

    # Owner view
    req_a = type("Req", (), {"user": user_a})()
    data_a = PartyEventSerializer(event, context={"request": req_a}).data
    assert data_a["content"] == "Confidential Workout 100"
    assert data_a["is_private"] is False

    # 3. Enable privacy for user_a
    user_a.profile.hide_party_task_names = True
    user_a.profile.save()

    # Ally view: task title should now be hidden as 'a task'
    data_b_private = PartyEventSerializer(event, context={"request": req_b}).data
    assert data_b_private["content"] == "a task"
    assert data_b_private["is_private"] is True

    # Owner view: owner can still see their own title, with is_private=True
    data_a_private = PartyEventSerializer(event, context={"request": req_a}).data
    assert data_a_private["content"] == "Confidential Workout 100"
    assert data_a_private["is_private"] is True


@pytest.mark.django_db
def test_profile_api_patch_hide_party_task_names(user_a):
    """Verify that hide_party_task_names can be updated via PATCH /api/profile/."""
    client = APIClient()
    client.force_authenticate(user=user_a)

    assert user_a.profile.hide_party_task_names is False

    # Toggle to True
    res = client.patch("/api/profile/", {"hide_party_task_names": True}, format="json")
    assert res.status_code == 200
    user_a.profile.refresh_from_db()
    assert user_a.profile.hide_party_task_names is True

    # Toggle back to False
    res2 = client.patch("/api/profile/", {"hide_party_task_names": False}, format="json")
    assert res2.status_code == 200
    user_a.profile.refresh_from_db()
    assert user_a.profile.hide_party_task_names is False
