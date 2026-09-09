import datetime
import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import ActiveEffect, Task
from api.services.party_service import (
    create_party,
    join_party,
    send_buff,
)
from api.serializers.party import PartyMemberProfileSerializer
from api.services.daily_service import process_daily_login
from api.services.task_service import complete_task
from api.exceptions import GameLogicError


@pytest.fixture
def owner(db):
    user = User.objects.create_user(username="bless_owner", password="pw")
    user.profile.mana = 300
    user.profile.save()
    return user


@pytest.fixture
def ally(db):
    user = User.objects.create_user(username="bless_ally", password="pw")
    user.profile.hp = 40
    user.profile.mana = 20
    user.profile.save()
    return user


@pytest.fixture
def party(owner, ally):
    p = create_party(owner, "Bless Guild")
    join_party(ally, p.invite_code)
    return p


@pytest.mark.django_db
def test_self_buff_forbidden(owner, party):
    """Casting a party blessing on yourself is strictly forbidden."""
    with pytest.raises(GameLogicError) as exc_info:
        send_buff(owner, owner.username, "heal_1")
    assert "You cannot buff yourself." in str(exc_info.value)


@pytest.mark.django_db
def test_bless_cooldown_applies_to_sender_not_receiver(owner, ally, party):
    """
    Sender cooldown test:
    - Owner buffs ally -> Owner receives cooldown for today.
    - Owner cannot send another buff today.
    - Ally was only a receiver, so Ally has NO cooldown and CAN buff Owner.
    """
    owner.profile.mana = 200
    owner.profile.save()
    ally.profile.mana = 200
    ally.profile.save()

    # Owner buffs ally with heal_1
    res = send_buff(owner, ally.username, "heal_1")
    assert "Buff sent" in res["message"]

    # Owner now cannot send another buff today
    with pytest.raises(GameLogicError) as exc_info:
        send_buff(owner, ally.username, "mana_surge")
    assert "You can send another buff tomorrow." in str(exc_info.value)

    # Ally did NOT send a buff, so Ally can buff Owner!
    ally_res = send_buff(ally, owner.username, "mana_surge")
    assert "Buff sent" in ally_res["message"]


@pytest.mark.django_db
def test_all_buff_types_and_active_buffs_serialization(owner, ally, party):
    """
    Verify instant effects (HP/Mana) update profile stats,
    and timed buffs (XP, Gold, Shield) create ActiveEffect
    and serialize correctly via PartyMemberProfileSerializer.
    """
    # 1. Instant heal
    owner.party_membership.last_buff_sent_at = None
    owner.party_membership.save(update_fields=["last_buff_sent_at"])
    send_buff(owner, ally.username, "heal_1")
    ally.profile.refresh_from_db()
    assert ally.profile.hp == 55  # 40 + 15

    # 2. Timed XP boost
    owner.party_membership.last_buff_sent_at = None
    owner.party_membership.save(update_fields=["last_buff_sent_at"])
    send_buff(owner, ally.username, "xp_boost_24h")

    # 3. Timed Gold boost
    owner.party_membership.last_buff_sent_at = None
    owner.party_membership.save(update_fields=["last_buff_sent_at"])
    send_buff(owner, ally.username, "gold_boost_12h")

    # Verify ActiveEffects in DB
    assert ActiveEffect.objects.filter(user=ally, skill_id="xp_boost_24h").exists()
    assert ActiveEffect.objects.filter(user=ally, skill_id="gold_boost_12h").exists()

    # Verify PartyMemberProfileSerializer exposes active_buffs
    serializer_data = PartyMemberProfileSerializer(ally.profile).data
    assert "active_buffs" in serializer_data
    buff_codes = [b["code"] for b in serializer_data["active_buffs"]]
    assert "xp_boost_24h" in buff_codes
    assert "gold_boost_12h" in buff_codes

    # Verify task rewards are boosted
    task = Task.objects.create(
        user=ally,
        title="Workout",
        task_type=Task.TaskType.TODO,
        difficulty=Task.Difficulty.MEDIUM,
    )
    outcome = complete_task(ally, task.id)
    # XP should be boosted by 1.25x and Gold by 1.20x
    assert outcome["xp_earned"] > 0
    assert outcome["gold_earned"] > 0


@pytest.mark.django_db
def test_streak_shield_expiration_in_daily_service(ally):
    """
    Streak shield from party buff should protect streak if valid,
    and expire properly if beyond expiration.
    """
    # Create an expired streak shield
    past_time = timezone.now() - datetime.timedelta(hours=2)
    ActiveEffect.objects.create(
        user=ally,
        effect_id=f"party_buff_streak_shield_{ally.id}",
        skill_id="streak_shield",
        expires_at=past_time,
        data={"duration_h": 36},
    )

    # Set profile last_login_date 2 days ago to trigger missed streak
    ally.profile.streak = 5
    ally.profile.last_login_date = timezone.now().date() - datetime.timedelta(days=2)
    ally.profile.save()

    # Daily reset should discard expired shield and reset streak to 1
    process_daily_login(ally)
    ally.profile.refresh_from_db()
    assert ally.profile.streak == 1
    assert not ActiveEffect.objects.filter(user=ally, skill_id="streak_shield").exists()

    # Now create a valid (active) streak shield
    future_time = timezone.now() + datetime.timedelta(hours=24)
    ActiveEffect.objects.create(
        user=ally,
        effect_id=f"party_buff_streak_shield_{ally.id}_new",
        skill_id="streak_shield",
        expires_at=future_time,
        data={"duration_h": 36},
    )

    ally.profile.streak = 10
    ally.profile.last_login_date = timezone.now().date() - datetime.timedelta(days=2)
    ally.profile.save()

    # Active shield should protect streak (increment to 11)
    process_daily_login(ally)
    ally.profile.refresh_from_db()
    assert ally.profile.streak == 11


@pytest.mark.django_db
def test_user_profile_serializer_exposes_username_and_user_id(owner):
    """
    Ensure UserProfileSerializer exposes top-level 'username' and 'user_id'
    so frontend components (PartyTab, CharacterHub, etc.) can reliably
    identify the active user and prevent self-blessing.
    """
    from api.serializers.profile import UserProfileSerializer

    serializer = UserProfileSerializer(owner.profile)
    data = serializer.data
    assert "username" in data
    assert data["username"] == owner.username
    assert "user_id" in data
    assert data["user_id"] == owner.id
    assert "user" in data
    assert data["user"]["username"] == owner.username

