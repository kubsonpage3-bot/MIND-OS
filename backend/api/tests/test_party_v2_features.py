"""
Tests for Party System v2 features:
- Weekly Quest generation & progress tracking
- 6-type Buff Arsenal (instant HP/Mana, ActiveEffect for XP/Gold/Shield)
- Party Settings (Name, Description, Member Cap update)
- Party Achievements (unique constraint, streak milestones, full house)
- Enforcing custom member_cap on party join
"""

import pytest
from django.contrib.auth.models import User
from api.models import ActiveEffect
from api.services.party_service import (
    create_party,
    join_party,
    send_buff,
    update_party_settings,
    get_or_create_weekly_quest,
    add_quest_progress,
    check_streak_achievements,
)
from api.exceptions import GameLogicError


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner_user", password="pw")


@pytest.fixture
def member(db):
    return User.objects.create_user(username="member_user", password="pw")


@pytest.fixture
def party(owner):
    return create_party(owner, "V2 Guild")


@pytest.mark.django_db
def test_party_settings_update_owner_only(owner, member, party):
    """Owner can update settings; non-owner gets GameLogicError."""
    # Member joins
    join_party(member, party.invite_code)

    # Member attempts update -> fails
    with pytest.raises(GameLogicError, match="Only the Party Owner"):
        update_party_settings(member, name="Hacked Name")

    # Owner updates name, description, member_cap
    updated_party = update_party_settings(
        owner,
        name="Legendary Guild",
        description="We fight for glory!",
        member_cap=5,
    )

    assert updated_party.name == "Legendary Guild"
    assert updated_party.description == "We fight for glory!"
    assert updated_party.member_cap == 5


@pytest.mark.django_db
def test_join_party_custom_member_cap(owner, party):
    """Joining a party respects custom member_cap."""
    # Set member cap to 2
    update_party_settings(owner, member_cap=2)

    # 2nd user joins -> succeeds (reaches cap 2)
    u2 = User.objects.create_user(username="user2", password="pw")
    join_party(u2, party.invite_code)

    # Full House achievement should be unlocked
    assert party.achievements.filter(code="full_house").exists()

    # 3rd user joins -> fails because cap is 2
    u3 = User.objects.create_user(username="user3", password="pw")
    with pytest.raises(GameLogicError, match="Party is full"):
        join_party(u3, party.invite_code)


@pytest.mark.django_db
def test_buff_arsenal_all_types(owner, member, party):
    """Test all 6 buff types sent from owner to member, resetting cooldown between sends."""
    join_party(member, party.invite_code)
    sender_mem = owner.party_membership
    owner.profile.mana = 500
    owner.profile.save()

    def send_and_reset_cooldown(code):
        sender_mem.last_buff_sent_at = None
        sender_mem.save(update_fields=["last_buff_sent_at"])
        send_buff(owner, member.username, code)

    # 1. heal_1 (+15 HP, costs 20 MP)
    member.profile.hp = 50
    member.profile.save()
    send_and_reset_cooldown("heal_1")
    member.profile.refresh_from_db()
    assert member.profile.hp == 65

    # 2. heal_2 (+30 HP, costs 40 MP)
    send_and_reset_cooldown("heal_2")
    member.profile.refresh_from_db()
    assert member.profile.hp == 95

    # 3. mana_surge (+20 MP, costs 25 MP)
    member.profile.mana = 10
    member.profile.save()
    send_and_reset_cooldown("mana_surge")
    member.profile.refresh_from_db()
    assert member.profile.mana == 30

    # 4. xp_boost_24h (creates ActiveEffect, costs 50 MP)
    send_and_reset_cooldown("xp_boost_24h")
    assert ActiveEffect.objects.filter(user=member, skill_id="xp_boost_24h").exists()

    # 5. gold_boost_12h (creates ActiveEffect, costs 35 MP)
    send_and_reset_cooldown("gold_boost_12h")
    assert ActiveEffect.objects.filter(user=member, skill_id="gold_boost_12h").exists()

    # 6. streak_shield (creates ActiveEffect, costs 60 MP)
    send_and_reset_cooldown("streak_shield")
    assert ActiveEffect.objects.filter(user=member, skill_id="streak_shield").exists()


@pytest.mark.django_db
def test_buff_insufficient_mana(owner, member, party):
    """Test that sending a buff fails when sender has insufficient mana."""
    join_party(member, party.invite_code)
    owner.profile.mana = 10  # heal_1 costs 20 MP
    owner.profile.save()

    with pytest.raises(GameLogicError) as exc_info:
        send_buff(owner, member.username, "heal_1")
    assert "Not enough Mana" in str(exc_info.value)


@pytest.mark.django_db
def test_weekly_quest_generation_and_progress(owner, party):
    """Weekly quest created, progress added, completed when target reached."""
    quest = get_or_create_weekly_quest(party)
    target = quest.target_value
    assert quest.current_value == 0
    assert target == max(30, party.memberships.count() * 15)
    assert not quest.is_completed

    # Add half progress
    half_target = target // 2
    add_quest_progress(party, half_target)
    quest.refresh_from_db()
    assert quest.current_value == half_target
    assert not quest.is_completed

    # Add remaining progress -> completes
    add_quest_progress(party, target - half_target)
    quest.refresh_from_db()
    assert quest.current_value == target
    assert quest.is_completed
    assert quest.completed_at is not None

    # Quest master or first quest achievement unlocked
    assert party.achievements.filter(code="first_quest").exists()


@pytest.mark.django_db
def test_streak_achievements(party):
    """Check streak milestone achievements unlock correctly."""
    party.streak = 7
    party.save()
    check_streak_achievements(party)
    assert party.achievements.filter(code="streak_7").exists()

    party.streak = 30
    party.save()
    check_streak_achievements(party)
    assert party.achievements.filter(code="streak_30").exists()
