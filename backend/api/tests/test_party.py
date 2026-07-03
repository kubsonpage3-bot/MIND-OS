"""
Tests for the Party System (Phase 1).
Covers: create, join, leave, edge cases (duplicate join, invalid code, full party),
and privacy verification (public fields only in members response).
"""

import pytest
from django.contrib.auth.models import User
from api.models import Party, PartyMembership
from api.services.party_service import (
    create_party,
    join_party,
    leave_party,
    PARTY_MEMBER_CAP,
)
from api.exceptions import GameLogicError


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def user_a(db):
    u = User.objects.create_user(username="party_user_a", password="pw")
    return u


@pytest.fixture
def user_b(db):
    u = User.objects.create_user(username="party_user_b", password="pw")
    return u


@pytest.fixture
def user_c(db):
    u = User.objects.create_user(username="party_user_c", password="pw")
    return u


# ─── Tests ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_create_party(user_a):
    """Creator gets a party with a 6-char invite code and is auto-joined."""
    party = create_party(user_a, "Alpha Squad")

    assert party.name == "Alpha Squad"
    assert len(party.invite_code) == 6
    assert party.invite_code.isalnum()
    assert party.created_by == user_a

    # Creator is auto-joined
    assert PartyMembership.objects.filter(user=user_a, party=party).exists()
    assert party.memberships.count() == 1


@pytest.mark.django_db
def test_join_party_valid_code(user_a, user_b):
    """Second user joins via valid invite_code and appears in members list."""
    party = create_party(user_a, "Alpha Squad")
    code = party.invite_code

    joined_party = join_party(user_b, code)

    assert joined_party.pk == party.pk
    assert PartyMembership.objects.filter(user=user_b, party=party).exists()
    assert party.memberships.count() == 2


@pytest.mark.django_db
def test_join_invalid_code(user_a):
    """Joining with a garbage code raises GameLogicError."""
    with pytest.raises(GameLogicError, match="Invalid invite code"):
        join_party(user_a, "XXXXXX")


@pytest.mark.django_db
def test_join_when_already_in_party(user_a, user_b):
    """A user who is already in a party cannot join another."""
    party_a = create_party(user_a, "Alpha Squad")
    create_party(user_b, "Beta Squad")  # user_b is now in Beta Squad

    with pytest.raises(GameLogicError, match="already in a party"):
        join_party(user_b, party_a.invite_code)


@pytest.mark.django_db
def test_join_full_party(user_a):
    """Joining a full party (8 members) raises GameLogicError."""
    party = create_party(user_a, "Full House")

    # Fill remaining 7 slots
    for i in range(PARTY_MEMBER_CAP - 1):
        extra = User.objects.create_user(username=f"filler_{i}", password="pw")
        join_party(extra, party.invite_code)

    assert party.memberships.count() == PARTY_MEMBER_CAP

    # One more should fail
    overflow_user = User.objects.create_user(username="overflow_user", password="pw")
    with pytest.raises(GameLogicError, match="full"):
        join_party(overflow_user, party.invite_code)


@pytest.mark.django_db
def test_leave_party(user_a, user_b):
    """User can leave a party; membership record is deleted."""
    party = create_party(user_a, "Alpha Squad")
    join_party(user_b, party.invite_code)

    assert party.memberships.count() == 2

    leave_party(user_b)

    assert not PartyMembership.objects.filter(user=user_b).exists()
    assert party.memberships.count() == 1


@pytest.mark.django_db
def test_leave_empty_party_deletes_party(user_a):
    """When the last member leaves, the Party record itself is deleted."""
    party = create_party(user_a, "Solo Party")
    party_pk = party.pk

    leave_party(user_a)

    assert not Party.objects.filter(pk=party_pk).exists()
    assert not PartyMembership.objects.filter(user=user_a).exists()


@pytest.mark.django_db
def test_leave_when_not_in_party(user_a):
    """Leaving when not in any party raises GameLogicError."""
    with pytest.raises(GameLogicError, match="not in any party"):
        leave_party(user_a)


@pytest.mark.django_db
def test_members_shows_only_public_fields(user_a, user_b, client):
    """
    GET /api/party/members/ response must NOT leak private fields:
    gold, xp, mana, gf, gc, ps, vm, rival_data, email.
    """
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    party = create_party(user_a, "Privacy Test Party")
    join_party(user_b, party.invite_code)

    api_client = APIClient()
    refresh = RefreshToken.for_user(user_a)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

    response = api_client.get("/api/party/members/")
    assert response.status_code == 200

    data = response.json()
    assert "invite_code" in data
    assert "members" in data

    member_keys = set(data["members"][0].keys())

    # Public fields must be present
    for expected in (
        "username",
        "level",
        "rank_xp",
        "streak",
        "character_class",
        "prestige_count",
        "hp",
        "max_hp",
        "rank_info",
    ):
        assert expected in member_keys, f"Missing public field: {expected}"

    # Private fields must NOT be present
    for forbidden in (
        "gold",
        "xp",
        "mana",
        "gf",
        "gc",
        "ps",
        "vm",
        "rival_data",
        "active_mutators",
        "email",
        "xp_to_next_level",
    ):
        assert forbidden not in member_keys, f"Leaked private field: {forbidden}"
