"""
Linked Pomodoro completion (active-session/complete with an activity_key)
claimed to apply "the same Character Stats / Allies / Mutators pipeline" as
manual Study-log submissions (TrainingLogView), but two things were missing
entirely:
  1. Allies -- RecruitedAlly was never even imported here, so Lyra
     (L1 duration requirements, L4 skill-cooldown reduction) and Zephyr
     (L1 different-subject bonus) silently did nothing for a linked
     Pomodoro, despite firing on an equivalent manual Activity Log.
  2. The "inversion" mutator (flips focus rating: 11 - focus) was applied
     in TrainingLogView but never checked here, so a session logged via
     Pomodoro under Inversion scored as if the mutator weren't active.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import UserProfile, RecruitedAlly, SkillCooldown
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="pomo_parity_user", password="pass")
    profile, _ = UserProfile.objects.get_or_create(user=u)
    profile.mana = 200
    profile.hp = 100
    profile.save()
    return u


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def start_and_complete(auth_client, duration_minutes, rating, activity_key="mathematics"):
    auth_client.post(
        "/api/pomodoro/sessions/active-session/start/",
        {"linked_activity_key": activity_key, "duration_minutes": duration_minutes},
        format="json",
    )
    res = auth_client.post(
        "/api/pomodoro/sessions/active-session/complete/",
        {"rating": rating},
        format="json",
    )
    assert res.status_code == 200, res.data
    return res.json()


@pytest.mark.django_db
def test_linked_pomodoro_lyra_l1_short_session_zeroes_rewards(auth_client, user):
    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="lyra", level=1)
    profile.active_allies = ["lyra"]
    profile.save()

    data = start_and_complete(auth_client, duration_minutes=20, rating=8)
    assert data["xp_earned"] == 0
    assert data["gold_earned"] == 0


@pytest.mark.django_db
def test_linked_pomodoro_lyra_l1_long_session_gets_xp_bonus(auth_client, user, monkeypatch):
    # Crit Focus (FOC-based) is random and would occasionally make the
    # uninverted baseline roll higher than the Lyra-boosted session by
    # chance, flaking this comparison. Pin it off so the test isolates
    # the Lyra L1 duration bonus.
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 1.0)

    profile = UserProfile.objects.get(user=user)

    baseline = start_and_complete(auth_client, duration_minutes=150, rating=8)

    RecruitedAlly.objects.create(user_profile=profile, ally_code="lyra", level=1)
    profile.active_allies = ["lyra"]
    profile.save()

    boosted = start_and_complete(auth_client, duration_minutes=150, rating=8)
    assert boosted["xp_earned"] > baseline["xp_earned"]


@pytest.mark.django_db
def test_linked_pomodoro_lyra_l4_reduces_skill_cooldowns(auth_client, user):
    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="lyra", level=4)
    profile.active_allies = ["lyra"]
    profile.save()

    cd = SkillCooldown.objects.create(
        user=user, skill_id="execution", cooldown_until=timezone.now() + timedelta(hours=5)
    )
    before = cd.cooldown_until

    start_and_complete(auth_client, duration_minutes=60, rating=8)

    cd.refresh_from_db()
    assert cd.cooldown_until < before


@pytest.mark.django_db
def test_linked_pomodoro_zephyr_l1_different_subject_bonus(auth_client, user):
    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="zephyr", level=1)
    profile.active_allies = ["zephyr"]
    profile.save()

    # Same subject twice in a row -> no bonus on the 2nd.
    start_and_complete(auth_client, duration_minutes=60, rating=8, activity_key="mathematics")
    same_subject = start_and_complete(auth_client, duration_minutes=60, rating=8, activity_key="mathematics")

    # Switch subject -> +20% XP bonus kicks in.
    different_subject = start_and_complete(auth_client, duration_minutes=60, rating=8, activity_key="coding")

    assert different_subject["xp_earned"] > same_subject["xp_earned"]


@pytest.mark.django_db
def test_linked_pomodoro_inversion_flips_focus_rating(auth_client, user):
    profile = UserProfile.objects.get(user=user)

    baseline = start_and_complete(auth_client, duration_minutes=60, rating=10)

    profile.active_mutators = {"active": [{"id": "inversion"}], "purchased": ["inversion"]}
    profile.save()

    inverted = start_and_complete(auth_client, duration_minutes=60, rating=10)
    # Reported rating=10 (great focus) but Inversion flips it to 11-10=1
    # (focus floor) -- must score noticeably worse than the uninverted baseline.
    assert inverted["xp_earned"] < baseline["xp_earned"]
