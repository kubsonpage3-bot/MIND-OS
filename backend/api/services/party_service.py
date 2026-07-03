"""
Party service — all business logic for create / join / leave.
Views must NOT contain any of this math.
"""

import logging
from django.db import transaction
from api.exceptions import GameLogicError

logger = logging.getLogger(__name__)

PARTY_MEMBER_CAP = 8


def create_party(user, name: str):
    """
    Create a new party and auto-join the creator.
    Raises GameLogicError if the user is already in a party.
    Wrapped in transaction.atomic — Party + Membership created together or not at all.
    """
    from api.models import Party, PartyMembership

    with transaction.atomic():
        if hasattr(user, "party_membership"):
            raise GameLogicError("You are already in a party. Leave it first.")

        party = Party.objects.create(name=name, created_by=user)
        PartyMembership.objects.create(user=user, party=party)
        logger.info(
            "Party '%s' created by %s [code=%s]", name, user.username, party.invite_code
        )
        return party


def join_party(user, invite_code: str):
    """
    Join an existing party via invite_code.
    Raises GameLogicError for: already in party, invalid code, party full.
    """
    from api.models import Party, PartyMembership

    with transaction.atomic():
        if hasattr(user, "party_membership"):
            raise GameLogicError("You are already in a party. Leave it first.")

        try:
            party = Party.objects.select_for_update().get(
                invite_code=invite_code.upper()
            )
        except Party.DoesNotExist:
            raise GameLogicError("Invalid invite code.")

        member_count = party.memberships.count()
        if member_count >= PARTY_MEMBER_CAP:
            raise GameLogicError(f"Party is full ({PARTY_MEMBER_CAP} members max).")

        PartyMembership.objects.create(user=user, party=party)
        logger.info("%s joined party '%s'", user.username, party.name)
        return party


def leave_party(user) -> None:
    """
    Remove the user from their current party.
    If the party becomes empty after leaving, the party itself is deleted.
    Raises GameLogicError if user is not in any party.
    """
    from api.models import PartyMembership

    with transaction.atomic():
        try:
            membership = PartyMembership.objects.select_for_update().get(user=user)
        except PartyMembership.DoesNotExist:
            raise GameLogicError("You are not in any party.")

        party = membership.party
        membership.delete()
        logger.info("%s left party '%s'", user.username, party.name)

        if party.memberships.count() == 0:
            logger.info("Party '%s' is empty — deleting.", party.name)
            party.delete()


def get_party_with_members(user):
    """
    Return the party the user belongs to, or None.
    Prefetches memberships → user → profile for efficient serialization.
    """
    from api.models import PartyMembership

    try:
        membership = PartyMembership.objects.select_related("party").get(user=user)
        return membership.party
    except PartyMembership.DoesNotExist:
        return None
