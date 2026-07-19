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


@pytest.mark.django_db
def test_party_roles_assigned(user_a, user_b):
    """Creator gets OWNER role, joiner gets MEMBER role."""
    party = create_party(user_a, "Guild")
    membership_a = PartyMembership.objects.get(user=user_a)
    assert membership_a.role == "OWNER"

    join_party(user_b, party.invite_code)
    membership_b = PartyMembership.objects.get(user=user_b)
    assert membership_b.role == "MEMBER"


@pytest.mark.django_db
def test_owner_leave_transfers_ownership(user_a, user_b, user_c):
    """If OWNER leaves, ownership is transferred to the next oldest member."""
    party = create_party(user_a, "Guild")
    join_party(user_b, party.invite_code)
    join_party(user_c, party.invite_code)

    assert party.created_by == user_a

    leave_party(user_a)

    # Next oldest member is user_b (joined before user_c)
    party.refresh_from_db()
    assert party.created_by == user_b
    membership_b = PartyMembership.objects.get(user=user_b)
    assert membership_b.role == "OWNER"


@pytest.mark.django_db
def test_kick_member(user_a, user_b):
    """OWNER can kick a member, but MEMBER cannot kick anyone."""
    party = create_party(user_a, "Guild")
    join_party(user_b, party.invite_code)

    from api.services.party_service import kick_member

    # Non-owner tries to kick
    with pytest.raises(GameLogicError, match="Only the Party Owner can kick"):
        kick_member(user_b, user_a.id)

    # Owner kicks user_b
    kick_member(user_a, user_b.id)
    assert not PartyMembership.objects.filter(user=user_b).exists()


@pytest.mark.django_db
def test_owner_kick_self_fails(user_a):
    """OWNER cannot kick themselves."""
    create_party(user_a, "Guild")
    from api.services.party_service import kick_member

    with pytest.raises(GameLogicError, match="You cannot kick yourself"):
        kick_member(user_a, user_a.id)


@pytest.mark.django_db
def test_party_streak_decay_on_miss(user_a, user_b):
    """Party streak resets to 0 if a member misses a scheduled daily."""
    import datetime
    from unittest.mock import patch
    from api.services.task_service import process_missed_tasks
    from api.models import Task, UserProfile

    # Set up user profile timezone to UTC
    p_a = UserProfile.objects.get(user=user_a)
    p_a.timezone = "UTC"
    # Set last cron to yesterday so we fire rollover
    yesterday = datetime.date(2026, 7, 13)
    p_a.last_daily_cron_at = yesterday
    p_a.save()

    party = create_party(user_a, "Guild")
    party.streak = 5
    party.save()

    # Create daily task scheduled for yesterday
    Task.objects.create(
        user=user_a,
        title="Daily 1",
        task_type=Task.TaskType.DAILY,
        is_completed=False,
        repeat_weekdays=127,  # All days
    )

    # Mock timezone.now() to Monday (2026-07-13 is Monday, today is Tuesday 2026-07-14)
    # So process_missed_tasks evaluates yesterday's missed tasks (2026-07-13)
    target_today = datetime.datetime(2026, 7, 14, 1, 0, 0, tzinfo=datetime.timezone.utc)
    with patch("django.utils.timezone.now", return_value=target_today):
        process_missed_tasks(user_a)

    party.refresh_from_db()
    assert party.streak == 0


@pytest.mark.django_db
def test_party_streak_decay_skips_unscheduled(user_a):
    """Party streak does not decay if user has no dailies scheduled for that day."""
    import datetime
    from unittest.mock import patch
    from api.services.task_service import process_missed_tasks
    from api.models import Task, UserProfile

    p_a = UserProfile.objects.get(user=user_a)
    p_a.timezone = "UTC"
    # Monday July 13th
    yesterday = datetime.date(2026, 7, 13)
    p_a.last_daily_cron_at = yesterday
    p_a.save()

    party = create_party(user_a, "Guild")
    party.streak = 5
    party.save()

    # Create daily task NOT scheduled on Monday (2026-07-13 is a Monday, so weekday flag = 1)
    Task.objects.create(
        user=user_a,
        title="Tuesday Only Daily",
        task_type=Task.TaskType.DAILY,
        is_completed=False,
        repeat_weekdays=2,  # Tuesday only (Monday is not checked)
    )

    target_today = datetime.datetime(2026, 7, 14, 1, 0, 0, tzinfo=datetime.timezone.utc)
    with patch("django.utils.timezone.now", return_value=target_today):
        process_missed_tasks(user_a)

    party.refresh_from_db()
    assert party.streak == 5  # Unchanged!
