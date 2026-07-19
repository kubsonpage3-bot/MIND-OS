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
        from django.utils import timezone
        import datetime

        yesterday = timezone.now().date() - datetime.timedelta(days=1)
        PartyMembership.objects.create(
            user=user, party=party, last_daily_completed_date=yesterday, role="OWNER"
        )
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

        from django.utils import timezone
        import datetime

        yesterday = timezone.now().date() - datetime.timedelta(days=1)
        PartyMembership.objects.create(
            user=user, party=party, last_daily_completed_date=yesterday, role="MEMBER"
        )
        logger.info("%s joined party '%s'", user.username, party.name)
        return party


def leave_party(user) -> None:
    """
    Remove the user from their current party.
    If the party becomes empty after leaving, the party itself is deleted.
    If the owner leaves, ownership is automatically transferred to the next oldest member.
    Raises GameLogicError if user is not in any party.
    """
    from api.models import PartyMembership

    with transaction.atomic():
        try:
            membership = PartyMembership.objects.select_for_update().get(user=user)
        except PartyMembership.DoesNotExist:
            raise GameLogicError("You are not in any party.")

        party = membership.party
        is_owner = membership.role == "OWNER"
        membership.delete()
        logger.info("%s left party '%s'", user.username, party.name)

        remaining_memberships = party.memberships.all()
        if remaining_memberships.count() == 0:
            logger.info("Party '%s' is empty — deleting.", party.name)
            party.delete()
        elif is_owner:
            next_owner_membership = remaining_memberships.order_by(
                "joined_at", "id"
            ).first()
            if next_owner_membership:
                next_owner_membership.role = "OWNER"
                next_owner_membership.save(update_fields=["role"])

                party.created_by = next_owner_membership.user
                party.save(update_fields=["created_by"])

                logger.info(
                    "Ownership of party '%s' transferred to %s",
                    party.name,
                    next_owner_membership.user.username,
                )

                from api.models import PartyEvent

                PartyEvent.objects.create(
                    party=party,
                    event_type="milestone",
                    message="became the new Party Owner.",
                    metadata={"username": next_owner_membership.user.username},
                )


def kick_member(owner, user_id: int):
    """
    Kicks a member from the party. Only the OWNER of the party can do this.
    The OWNER cannot kick themselves.
    """
    from api.models import PartyMembership

    with transaction.atomic():
        try:
            owner_membership = PartyMembership.objects.get(user=owner)
        except PartyMembership.DoesNotExist:
            raise GameLogicError("You are not in a party.")

        if owner_membership.role != "OWNER":
            raise GameLogicError("Only the Party Owner can kick members.")

        if owner.id == user_id:
            raise GameLogicError("You cannot kick yourself.")

        try:
            target_membership = PartyMembership.objects.select_for_update().get(
                user_id=user_id, party=owner_membership.party
            )
        except PartyMembership.DoesNotExist:
            raise GameLogicError("User is not in your party.")

        party = target_membership.party
        target_username = target_membership.user.username
        target_membership.delete()

        logger.info(
            "User %s kicked from party '%s' by Owner %s",
            target_username,
            party.name,
            owner.username,
        )

        from api.models import PartyEvent

        PartyEvent.objects.create(
            party=party,
            event_type="milestone",
            message="was kicked from the party by the Owner.",
            metadata={"username": target_username},
        )


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


def toggle_reaction(user, event_id: int, emoji: str):
    from api.models import PartyEvent, PartyEventReaction
    from django.core.exceptions import ObjectDoesNotExist

    try:
        membership = user.party_membership
        party = membership.party
    except ObjectDoesNotExist:
        raise GameLogicError("You are not in a party.")

    try:
        event = PartyEvent.objects.get(id=event_id, party=party)
    except PartyEvent.DoesNotExist:
        raise GameLogicError("Event not found in your party.")

    reaction = PartyEventReaction.objects.filter(
        event=event, user=user, emoji=emoji
    ).first()
    if reaction:
        reaction.delete()
        return {"action": "removed", "emoji": emoji}
    else:
        # Check if they have another reaction to this event
        existing = PartyEventReaction.objects.filter(event=event, user=user).first()
        if existing:
            existing.emoji = emoji
            existing.save()
            return {"action": "updated", "emoji": emoji}
        else:
            PartyEventReaction.objects.create(event=event, user=user, emoji=emoji)
            return {"action": "added", "emoji": emoji}


def send_buff(sender, receiver_username: str, effect_code: str):
    from api.models import PartyMembership, ActiveEffect
    from django.utils import timezone
    import datetime

    try:
        sender_mem = sender.party_membership
        party = sender_mem.party
    except Exception:
        raise GameLogicError("You are not in a party.")

    # Cooldown check: 24h per sender
    if (
        sender_mem.last_buff_sent_at
        and (timezone.now() - sender_mem.last_buff_sent_at).total_seconds() < 86400
    ):
        hours_left = int(
            24 - (timezone.now() - sender_mem.last_buff_sent_at).total_seconds() / 3600
        )
        raise GameLogicError(f"You can send another buff in {hours_left}h.")

    try:
        receiver_mem = PartyMembership.objects.get(
            user__username=receiver_username, party=party
        )
        receiver = receiver_mem.user
    except PartyMembership.DoesNotExist:
        raise GameLogicError(f"User {receiver_username} is not in your party.")

    if sender == receiver:
        raise GameLogicError("You cannot buff yourself.")

    # Send buff: create ActiveEffect for receiver
    ActiveEffect.objects.create(
        user=receiver,
        skill_id=effect_code,
        expires_at=timezone.now() + datetime.timedelta(hours=24),
    )

    sender_mem.last_buff_sent_at = timezone.now()
    sender_mem.save(update_fields=["last_buff_sent_at"])

    from api.models import PartyEvent

    PartyEvent.objects.create(
        party=party,
        member=sender_mem,
        event_type="buff_sent",
        message=f"sent {effect_code} to {receiver_username}",
    )

    return {"message": f"Buff sent to {receiver_username}!"}
