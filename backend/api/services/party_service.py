"""
Party service — all business logic for create / join / leave / buff / quest / settings / chat.
Views must NOT contain any of this math.
"""

import logging
import random
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
        "mana_cost": 20,
    },
    "heal_2": {
        "label": "Big Heal",
        "icon": "💖",
        "hp": 30,
        "duration_h": 0,
        "mana_cost": 40,
    },
    "xp_boost_24h": {
        "label": "+25% XP",
        "icon": "⚡",
        "xp_mult": 1.25,
        "duration_h": 24,
        "mana_cost": 50,
    },
    "gold_boost_12h": {
        "label": "+20% Gold",
        "icon": "💰",
        "gold_mult": 1.20,
        "duration_h": 12,
        "mana_cost": 35,
    },
    "mana_surge": {
        "label": "+20 Mana",
        "icon": "💙",
        "mana": 20,
        "duration_h": 0,
        "mana_cost": 25,
    },
    "streak_shield": {
        "label": "Streak Shield",
        "icon": "🛡️",
        "duration_h": 36,
        "mana_cost": 60,
    },
}

# ─── Weekly Quest Types ────────────────────────────────────────────────────────

QUEST_TYPES = [
    "tasks_completed",
    "xp_earned",
    "dailies_completed",
    "streak_maintained",
]

# Target scaling per quest type (multiplied by member count)
QUEST_TARGETS = {
    "tasks_completed": 15,    # 15 tasks per member
    "xp_earned": 300,         # 300 XP per member
    "dailies_completed": 10,  # 10 dailies per member
    "streak_maintained": 5,   # 5 streak-days per member
}

QUEST_MIN_TARGETS = {
    "tasks_completed": 30,
    "xp_earned": 500,
    "dailies_completed": 20,
    "streak_maintained": 10,
}

# ─── Quest Rewards ─────────────────────────────────────────────────────────────

QUEST_GOLD_REWARD = 200
QUEST_XP_REWARD = 500


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

    # Cooldown check: 24h per sender (based on DateField — compare dates)
    if sender_mem.last_buff_sent_at:
        today = timezone.now().date()
        days_elapsed = (today - sender_mem.last_buff_sent_at).days
        if days_elapsed < 1:
            raise GameLogicError("You can send another buff tomorrow.")

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
        sender_profile = UserProfile.objects.select_for_update().get(user=sender)
        mana_cost = buff_def.get("mana_cost", 0)
        if sender_profile.mana < mana_cost:
            raise GameLogicError(
                f"Not enough Mana ({sender_profile.mana}/{mana_cost} MP). Complete tasks to restore Mana!"
            )

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

        # Deduct sender mana
        if mana_cost > 0:
            sender_profile.mana -= mana_cost
            sender_profile.save(update_fields=["mana"])

        sender_mem.last_buff_sent_at = timezone.now().date()
        sender_mem.save(update_fields=["last_buff_sent_at"])

    # Track total buffs sent for buff_master achievement
    _check_buff_master_achievement(party)

    from api.models import PartyEvent

    PartyEvent.objects.create(
        party=party,
        member=sender_mem,
        event_type="buff_sent",
        message=f"sent {buff_def['icon']} {buff_def['label']} to {receiver_username}",
    )

    return {
        "message": f"Buff sent to {receiver_username}!",
        "buff": buff_def["label"],
        "mana_cost": mana_cost,
        "new_mana": sender_profile.mana,
    }


def send_chat(user, message: str):
    """Send a chat message to the party feed."""
    from api.models import PartyEvent

    message = message.strip()
    if not message:
        raise GameLogicError("Message cannot be empty.")
    if len(message) > 200:
        raise GameLogicError("Message too long (max 200 characters).")

    try:
        membership = user.party_membership
        party = membership.party
    except Exception:
        raise GameLogicError("You are not in a party.")

    event = PartyEvent.objects.create(
        party=party,
        member=membership,
        event_type="chat",
        message=message,
    )
    return event


# ─── Weekly Quest ──────────────────────────────────────────────────────────────


def _get_week_key() -> str:
    today = timezone.now().date()
    iso = today.isocalendar()
    return f"{str(iso[0])[-2:]}W{iso[1]:02d}"


def get_or_create_weekly_quest(party):
    """Return the current week's quest for the party, creating it if it doesn't exist.
    Quest type is randomly chosen per week from QUEST_TYPES.
    """
    from api.models import PartyWeeklyQuest

    week_key = _get_week_key()
    member_count = max(1, party.memberships.count())

    # Deterministic random: seed with party id + week key so all members see same type
    rng = random.Random(f"{party.id}-{week_key}")
    quest_type = rng.choice(QUEST_TYPES)

    base = QUEST_TARGETS.get(quest_type, 15)
    min_target = QUEST_MIN_TARGETS.get(quest_type, 30)
    target = max(min_target, member_count * base)

    quest, created = PartyWeeklyQuest.objects.get_or_create(
        party=party,
        week_key=week_key,
        defaults={"quest_type": quest_type, "target_value": target},
    )
    return quest


def add_quest_progress(party, amount: int = 1, progress_type: str = "tasks_completed"):
    """
    Increment the current week's quest progress.
    If quest reaches target, mark complete, create feed event, award achievement,
    and distribute QUEST_GOLD_REWARD gold + QUEST_XP_REWARD XP to all members.
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

    # Only count progress that matches the quest type
    if quest.quest_type != progress_type:
        return

    quest.current_value += amount
    if quest.current_value >= quest.target_value:
        quest.current_value = quest.target_value
        quest.is_completed = True
        quest.completed_at = timezone.now()
        quest.save(update_fields=["current_value", "is_completed", "completed_at"])

        # Distribute rewards to all members
        _distribute_quest_rewards(party, quest)

        PartyEvent.objects.create(
            party=party,
            event_type="milestone",
            message=f"🏆 Weekly Quest completed! {quest.quest_type.replace('_', ' ').title()} — {quest.target_value} done! All members receive {QUEST_GOLD_REWARD}💰 + {QUEST_XP_REWARD}⚡ XP!",
        )
        # Check quest achievements
        _award_achievement(party, "first_quest")
        completed_count = PartyWeeklyQuest.objects.filter(
            party=party, is_completed=True
        ).count()
        if completed_count >= 5:
            _award_achievement(party, "quest_master")

        # Update quest_streak
        party.quest_streak = (party.quest_streak or 0) + 1
        party.save(update_fields=["quest_streak"])

        if party.quest_streak >= 3:
            _award_achievement(party, "quest_streak_3")
    else:
        quest.save(update_fields=["current_value"])


def _distribute_quest_rewards(party, quest):
    """Award gold and XP to all current party members."""
    from api.models import UserProfile

    memberships = party.memberships.select_related("user__profile").all()
    for mem in memberships:
        try:
            profile = UserProfile.objects.select_for_update().get(user=mem.user)
            profile.gold = (profile.gold or 0) + QUEST_GOLD_REWARD
            profile.xp = (profile.xp or 0) + QUEST_XP_REWARD
            profile.save(update_fields=["gold", "xp"])
        except Exception as e:
            logger.warning("Failed to reward %s: %s", mem.user.username, e)


def _check_buff_master_achievement(party):
    """Count total buffs sent across party history and award buff_master if >= 50."""
    from api.models import PartyEvent

    total_buffs = PartyEvent.objects.filter(
        party=party, event_type="buff_sent"
    ).count()
    if total_buffs >= 49:  # +1 will be created after this call
        _award_achievement(party, "buff_master")


def check_all_streaks_achievement(party):
    """Award all_streaks if every member has a streak >= 7."""
    try:
        memberships = party.memberships.select_related("user__profile").all()
        if not memberships:
            return
        if all((mem.user.profile.streak or 0) >= 7 for mem in memberships):
            _award_achievement(party, "all_streaks")
    except Exception:
        pass


def check_top_scorer_achievement(party, weekly_xp: int):
    """Award top_scorer if someone earned 1000+ XP in a week."""
    if weekly_xp >= 1000:
        _award_achievement(party, "top_scorer")


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
            "buff_master": "💪 Buff Master",
            "all_streaks": "🔗 All Streaks",
            "quest_streak_3": "⚡ Quest Streak III",
            "top_scorer": "🌟 Top Scorer",
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
    # Also check all_streaks whenever party streak changes
    check_all_streaks_achievement(party)


# ─── Party Settings ───────────────────────────────────────────────────────────


def update_party_settings(
    owner,
    name: str | None = None,
    description: str | None = None,
    member_cap: int | None = None,
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
