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
  3. Same gap, three more allies: Sakura L3 (+5 mana on a language
     session), Grier L1 (+2 HP on Focus >= 9.0), and Nene L2 (+30G for
     logging 3+ subjects/day, whose unique-subject-count return value was
     tracked here but discarded instead of checked) -- all read/computed
     correctly by get_passive_multipliers(), but the consuming code that
     actually applies them only existed in TrainingLogView.
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
def test_linked_pomodoro_zephyr_l1_different_subject_bonus(auth_client, user, monkeypatch):
    # See the Lyra L1 test above: pin off Crit Focus randomness so the
    # same-subject roll can't outscore the different-subject roll by chance.
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 1.0)

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
def test_linked_pomodoro_inversion_flips_focus_rating(auth_client, user, monkeypatch):
    monkeypatch.setattr("api.services.mechanics.random.random", lambda: 1.0)

    profile = UserProfile.objects.get(user=user)

    baseline = start_and_complete(auth_client, duration_minutes=60, rating=10)

    profile.active_mutators = {"active": [{"id": "inversion"}], "purchased": ["inversion"]}
    profile.save()

    inverted = start_and_complete(auth_client, duration_minutes=60, rating=10)
    # Reported rating=10 (great focus) but Inversion flips it to 11-10=1
    # (focus floor) -- must score noticeably worse than the uninverted baseline.
    assert inverted["xp_earned"] < baseline["xp_earned"]


@pytest.mark.django_db
def test_linked_pomodoro_sakura_l3_language_mana_bonus(auth_client, user):
    """
    Sakura L3's "+5 mana per language session" was applied in
    TrainingLogView but never checked in the linked-Pomodoro completion
    path, so it silently did nothing for a language session logged that way.
    """
    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="sakura", level=3)
    profile.active_allies = ["sakura"]
    profile.mana = 50
    profile.save()

    start_and_complete(auth_client, duration_minutes=60, rating=8, activity_key="german")

    profile.refresh_from_db()
    assert profile.mana == 55


@pytest.mark.django_db
def test_linked_pomodoro_grier_l1_heal_on_high_focus(auth_client, user):
    """
    Grier L1's "+2 HP on Focus >= 9.0" had the same TrainingLogView-only gap
    as Sakura L3 above.
    """
    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="grier", level=1)
    profile.active_allies = ["grier"]
    profile.hp = 50
    profile.save()

    start_and_complete(auth_client, duration_minutes=60, rating=9)

    profile.refresh_from_db()
    assert profile.hp == 52


@pytest.mark.django_db
def test_linked_pomodoro_nene_l2_triple_subject_gold_bonus(auth_client, user):
    """
    Nene L2's "+30G for logging 3+ subjects in a day" tracked the unique-
    subject count here too, but discarded the return value instead of
    checking it, so the gold bonus never fired for Pomodoro sessions.
    """
    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="nene", level=2)
    profile.active_allies = ["nene"]
    profile.save()

    start_and_complete(auth_client, duration_minutes=30, rating=7, activity_key="mathematics")
    start_and_complete(auth_client, duration_minutes=30, rating=7, activity_key="physics")
    gold_before_third = UserProfile.objects.get(user=user).gold

    start_and_complete(auth_client, duration_minutes=30, rating=7, activity_key="coding")

    profile.refresh_from_db()
    assert profile.gold >= gold_before_third + 30


@pytest.mark.django_db
def test_linked_pomodoro_glass_tear_heals_on_completion(auth_client, user):
    """
    Glass Tear's "+2 HP on each task completion" was only wired into
    _complete_task_logic (Habit/Daily/Todo) -- a linked Pomodoro session is
    a task completion too and reads every other generic passive, so this
    was silently missing here (and in TrainingLogView).
    """
    from api.models import Item, InventoryItem

    profile = UserProfile.objects.get(user=user)
    glass_tear, _ = Item.objects.get_or_create(
        code="glass_tear", defaults={"name": "Glass Tear", "slot_type": "amulet"}
    )
    InventoryItem.objects.create(
        user_profile=profile, item=glass_tear, is_equipped=True
    )
    profile.hp = 50
    profile.save()

    start_and_complete(auth_client, duration_minutes=30, rating=7)

    profile.refresh_from_db()
    assert profile.hp == 52


@pytest.mark.django_db
def test_linked_pomodoro_kage_l5_executioner_boss_damage(auth_client, user):
    """
    Kage L5's "5x damage to boss below 15% HP" was only wired into the
    Habit/Daily/Todo boss-damage calc -- Training Log and linked Pomodoro
    sessions deal boss damage through the identical apply_boss_damage()
    choke point, so this was silently missing from both.
    """
    from api.models import Boss, BossEncounter, RecruitedAlly

    profile = UserProfile.objects.get(user=user)
    RecruitedAlly.objects.create(user_profile=profile, ally_code="kage", level=5)
    profile.active_allies = ["kage"]
    profile.save()

    boss = Boss.objects.create(
        id_name="kage_test_boss", name="Kage Test Boss", level=1,
        hp_max=10000, reward_gold=10, reward_xp=10,
    )
    BossEncounter.objects.create(
        user=user, boss=boss, hp_current=1000, is_defeated=False  # 10% HP, under the 15% threshold
    )

    start_and_complete(auth_client, duration_minutes=60, rating=8)

    encounter = BossEncounter.objects.get(user=user, boss=boss)
    # Base damage for an 8-rating hour-long session is far below 1000 --
    # only the 5x multiplier can drop the boss this far in one hit.
    assert encounter.hp_current < 700


@pytest.mark.django_db
def test_linked_pomodoro_null_zone_and_gamblers_ledger_wired(auth_client, user):
    """
    twin_souls, null_zone, and gamblers_ledger were correctly wired into
    _complete_task_logic and TrainingLogView, but entirely absent from the
    linked-Pomodoro completion path -- a Gambler's-Ledger/Null-Zone user
    got normal, un-redirected Gold/XP from every Pomodoro session while the
    other two paths correctly diverted it.
    """
    profile = UserProfile.objects.get(user=user)
    profile.active_mutators = {
        "active": [{"id": "null_zone"}], "purchased": ["null_zone"]
    }
    profile.save()

    gold_before = profile.gold
    data = start_and_complete(auth_client, duration_minutes=30, rating=7)

    assert data["xp_earned"] == 0
    profile.refresh_from_db()
    assert profile.gold > gold_before  # raw XP converted to Gold instead

    # Gambler's Ledger: Gold gets redirected into the ledger, not granted directly.
    profile.active_mutators = {
        "active": [{"id": "gamblers_ledger"}], "purchased": ["gamblers_ledger"]
    }
    profile.gold = 0
    profile.ledger_gold = 0
    profile.save()

    start_and_complete(auth_client, duration_minutes=60, rating=9)
    profile.refresh_from_db()
    assert profile.gold == 0
    assert profile.ledger_gold > 0
