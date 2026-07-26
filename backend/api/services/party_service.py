"""
Party service — all business logic for create / join / leave / buff / quest / settings.
Views must NOT contain any of this math.
"""

import logging
from django.db import transaction
from django.utils import timezone
from api.exceptions import GameLogicError

logger = logging.getLogger(__name__)

PARTY_MEMBER_CAP = 8  # hard maximum, per-party cap uses party.member_cap

# ─── Buff Arsenal ─────────────────────────────────────────────────────────────
# Each entry: {hp, mana, xp_mult, gold_mult, duration_h}
# duration_h = 0 → applied instantly (no ActiveEffect created)
# duration_h > 0 → creates ActiveEffect that task_service checks

PARTY_BUFFS = {
    "heal_1": {
        "label": "Small Heal",
        "icon": "💚",
        "hp": 15,
        "duration_h": 0,
    },
    "heal_2": {
        "label": "Big Heal",
        "icon": "💖",
        "hp": 30,
        "duration_h": 0,
    },
    "xp_boost_24h": {
        "label": "+25% XP",
        "icon": "⚡",
        "xp_mult": 1.25,
        "duration_h": 24,
    },
    "gold_boost_12h": {
        "label": "+20% Gold",
        "icon": "💰",
        "gold_mult": 1.20,
        "duration_h": 12,
    },
    "mana_surge": {
        "label": "+20 Mana",
        "icon": "💙",
        "mana": 20,
        "duration_h": 0,
    },
    "streak_shield": {
        "label": "Streak Shield",
        "icon": "🛡️",
        "duration_h": 36,
    },
}


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
        effective_cap = min(party.member_cap, PARTY_MEMBER_CAP)
        if member_count >= effective_cap:
            raise GameLogicError(f"Party is full ({effective_cap} members max).")

        import datetime

        yesterday = timezone.now().date() - datetime.timedelta(days=1)
        PartyMembership.objects.create(
            user=user, party=party, last_daily_completed_date=yesterday, role="MEMBER"
        )
        logger.info("%s joined party '%s'", user.username, party.name)

        # Check Full House achievement
        if party.memberships.count() >= effective_cap:
            _award_achievement(party, "full_house")

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
        existing = PartyEventReaction.objects.filter(event=event, user=user).first()
        if existing:
            existing.emoji = emoji
            existing.save()
            return {"action": "updated", "emoji": emoji}
        else:
            PartyEventReaction.objects.create(event=event, user=user, emoji=emoji)
            return {"action": "added", "emoji": emoji}


def send_buff(sender, receiver_username: str, effect_code: str):
    from api.models import PartyMembership, ActiveEffect, UserProfile

    if effect_code not in PARTY_BUFFS:
        raise GameLogicError(
            f"Unknown buff '{effect_code}'. Allowed: {', '.join(PARTY_BUFFS.keys())}"
        )

    buff_def = PARTY_BUFFS[effect_code]

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

    with transaction.atomic():
        receiver_profile = UserProfile.objects.select_for_update().get(user=receiver)

        if buff_def.get("duration_h", 0) == 0:
            # Instant buff — apply directly to profile
            if buff_def.get("hp"):
                receiver_profile.hp = min(
                    receiver_profile.hp + buff_def["hp"], receiver_profile.max_hp
                )
            if buff_def.get("mana"):
                from api.services.skill_service import CLASS_DEFS

                class_key = (receiver_profile.character_class or "").lower()
                max_mana = CLASS_DEFS.get(class_key, {}).get("max_mana", 100)
                receiver_profile.mana = min(
                    receiver_profile.mana + buff_def["mana"], max_mana
                )
            receiver_profile.save(update_fields=["hp", "mana"])
        else:
            # Timed buff — create ActiveEffect
            import datetime

            expires_at = timezone.now() + datetime.timedelta(
                hours=buff_def["duration_h"]
            )
            # Use get_or_create to avoid duplicate (update if already active)
            effect_id = f"party_buff_{effect_code}_{receiver.id}"
            ActiveEffect.objects.update_or_create(
                user=receiver,
                effect_id=effect_id,
                defaults={
                    "skill_id": effect_code,
                    "expires_at": expires_at,
                    "data": buff_def,
                },
            )

        sender_mem.last_buff_sent_at = timezone.now()
        sender_mem.save(update_fields=["last_buff_sent_at"])

    from api.models import PartyEvent

    PartyEvent.objects.create(
        party=party,
        member=sender_mem,
        event_type="buff_sent",
        message=f"sent {buff_def['icon']} {buff_def['label']} to {receiver_username}",
    )

    return {"message": f"Buff sent to {receiver_username}!"}


# ─── Weekly Quest ──────────────────────────────────────────────────────────────


def _get_week_key() -> str:
    today = timezone.now().date()
    iso = today.isocalendar()
    return f"{str(iso[0])[-2:]}W{iso[1]:02d}"


def get_or_create_weekly_quest(party):
    """Return the current week's quest for the party, creating it if it doesn't exist."""
    from api.models import PartyWeeklyQuest

    week_key = _get_week_key()
    member_count = party.memberships.count()
    # Scale target with party size: 50 tasks per member, minimum 30
    target = max(30, member_count * 15)

    quest, created = PartyWeeklyQuest.objects.get_or_create(
        party=party,
        week_key=week_key,
        defaults={"quest_type": "tasks_completed", "target_value": target},
    )
    return quest


def add_quest_progress(party, amount: int = 1):
    """
    Increment the current week's quest progress.
    If quest reaches target, mark complete, create feed event, and award achievement.
    Safe to call from task_service — any exception is caught upstream.
    """
    from api.models import PartyWeeklyQuest, PartyEvent

    week_key = _get_week_key()
    try:
        quest = PartyWeeklyQuest.objects.select_for_update().get(
            party=party, week_key=week_key
        )
    except PartyWeeklyQuest.DoesNotExist:
        # Lazily create if not yet exists
        quest = get_or_create_weekly_quest(party)
        if not quest:
            return

    if quest.is_completed:
        return  # Already done this week

    quest.current_value += amount
    if quest.current_value >= quest.target_value:
        quest.current_value = quest.target_value
        quest.is_completed = True
        quest.completed_at = timezone.now()
        quest.save(update_fields=["current_value", "is_completed", "completed_at"])

        PartyEvent.objects.create(
            party=party,
            event_type="milestone",
            message=f"🏆 Weekly Quest completed! {quest.quest_type.replace('_', ' ').title()} — {quest.target_value} done!",
        )
        # Check quest achievements
        _award_achievement(party, "first_quest")
        completed_count = PartyWeeklyQuest.objects.filter(
            party=party, is_completed=True
        ).count()
        if completed_count >= 5:
            _award_achievement(party, "quest_master")
    else:
        quest.save(update_fields=["current_value"])


# ─── Achievements ─────────────────────────────────────────────────────────────


def _award_achievement(party, code: str):
    """Award an achievement to a party if they don't have it yet. Silent on duplicate."""
    from api.models import PartyAchievement, PartyEvent

    created = False
    try:
        _, created = PartyAchievement.objects.get_or_create(party=party, code=code)
    except Exception:
        return

    if created:
        LABELS = {
            "streak_7": "🔥 7-Day Streak",
            "streak_30": "🏆 30-Day Streak",
            "streak_100": "💀 100-Day Streak",
            "full_house": "👑 Full House",
            "first_quest": "✅ First Weekly Quest",
            "quest_master": "🎯 Quest Master",
        }
        label = LABELS.get(code, code)
        PartyEvent.objects.create(
            party=party,
            event_type="milestone",
            message=f"unlocked the achievement: {label}!",
        )
        logger.info("Party '%s' unlocked achievement: %s", party.name, code)


def check_streak_achievements(party):
    """Called whenever party.streak increments."""
    if party.streak >= 7:
        _award_achievement(party, "streak_7")
    if party.streak >= 30:
        _award_achievement(party, "streak_30")
    if party.streak >= 100:
        _award_achievement(party, "streak_100")


# ─── Party Settings ───────────────────────────────────────────────────────────


def update_party_settings(
    owner, name: str = None, description: str = None, member_cap: int = None
):
    try:
        membership = owner.party_membership
    except Exception:
        raise GameLogicError("You are not in a party.")

    if membership.role != "OWNER":
        raise GameLogicError("Only the Party Owner can change settings.")

    party = membership.party
    update_fields = []

    if name is not None:
        name = name.strip()
        if not name:
            raise GameLogicError("Party name cannot be empty.")
        if len(name) > 64:
            raise GameLogicError("Party name must be 64 characters or less.")
        party.name = name
        update_fields.append("name")

    if description is not None:
        if len(description) > 140:
            raise GameLogicError("Description must be 140 characters or less.")
        party.description = description
        update_fields.append("description")

    if member_cap is not None:
        if not (2 <= member_cap <= 8):
            raise GameLogicError("Member cap must be between 2 and 8.")
        current_count = party.memberships.count()
        if member_cap < current_count:
            raise GameLogicError(
                f"Cannot set cap to {member_cap} — party already has {current_count} members."
            )
        party.member_cap = member_cap
        update_fields.append("member_cap")

    if update_fields:
        party.save(update_fields=update_fields)

    logger.info(
        "Party '%s' settings updated by %s: %s",
        party.name,
        owner.username,
        update_fields,
    )
    return party
