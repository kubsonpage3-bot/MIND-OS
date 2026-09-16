"""
Rival ("Johan") system audit fixes:

1. Dead frontend fields: RivalTab.jsx reads todaySessions/currentPattern/
   johanCooldownDays from the payload, but compute_rival_data() only ever
   sent "dailySessions" (never read anywhere) and never sent the other two
   at all -- so the "today's sessions" list, the "Johan logged a session"
   toast, and the surge/morning/night/cooldown badges were permanently
   inert. Now sent under the names/keys RivalTab.jsx actually reads.
2. A "weak" pattern type RivalTab.jsx already had a badge for, but
   get_day_pattern() never produced.
3. Johan's specializations now mirror the player's own most-trained real
   subjects (using the SAME activity_key vocabulary as
   frontend/src/lib/cognitiveEngine.js's ACTIVITIES, not a disconnected
   internal one) instead of being 3 purely random subjects.
4. New feature: beating Johan on the trailing 7-day XP window grants a free
   Mutator Chest + a free Quantum Safe chest, once per ISO calendar week.
"""
import pytest
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import UserProfile, TrainingSession, LootChest, Item, InventoryItem


@pytest.fixture
def user(db):
    return User.objects.create(username="rival_audit_user", password="pw")


@pytest.fixture
def profile(user):
    p, _ = UserProfile.objects.get_or_create(user=user)
    p.rank_xp = 0
    p.rival_data = {}
    p.save()
    return p


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_rival_payload_has_today_sessions_current_pattern_and_cooldown(auth_client, profile):
    res = auth_client.get("/api/rival/")
    assert res.status_code == 200
    data = res.json()
    # These are exactly the keys RivalTab.jsx reads -- must be present (even
    # if empty/0), not silently missing under a different name.
    assert "todaySessions" in data
    assert isinstance(data["todaySessions"], list)
    assert "currentPattern" in data
    assert data["currentPattern"] in {"skip", "surge", "weak", "morning", "night"}
    assert "johanCooldownDays" in data
    assert "dailySessions" not in data  # old, never-read key is gone


@pytest.mark.django_db
def test_weak_pattern_type_is_reachable():
    from api.services.rival_service import get_day_pattern, JOHAN_DIFFICULTIES

    diff_cfg = JOHAN_DIFFICULTIES["NORMAL"]
    seen_types = set()
    start = timezone.now().date()
    for i in range(200):
        d_str = (start - timedelta(days=i)).strftime("%Y-%m-%d")
        pat = get_day_pattern(d_str, "weak_probe_user", diff_cfg)
        seen_types.add(pat["type"])
    assert "weak" in seen_types


@pytest.mark.django_db
def test_johan_specializations_mirror_player_real_subjects(profile):
    from api.services.rival_service import get_johan_specializations

    TrainingSession.objects.create(
        user_profile=profile, activity_key="mathematics", hours=10, focus_rating=8
    )
    TrainingSession.objects.create(
        user_profile=profile, activity_key="german", hours=5, focus_rating=7
    )

    specs = get_johan_specializations(profile)
    assert "mathematics" in specs  # most-trained subject must be included
    assert "german" in specs
    assert len(specs) == 3  # topped up to 3 via the seeded random fallback


def _make_quantum_safe_chest_and_item():
    LootChest.objects.get_or_create(
        chest_type="quantum_safe",
        defaults={"name": "Quantum Safe", "cost_gold": 500, "drop_rates": {"E": 1.0}},
    )
    item, _ = Item.objects.get_or_create(
        code="test_quantum_gear",
        defaults={
            "name": "Test Quantum Gear",
            "item_type": Item.ItemType.EQUIPMENT,
            "gear_class": "E",
            "slot_type": "offhand",
        },
    )
    return item


@pytest.mark.django_db
def test_weekly_reward_grants_mutator_and_quantum_safe_when_player_ahead(profile):
    from api.services.rival_service import compute_rival_data

    _make_quantum_safe_chest_and_item()
    profile.active_mutators = {"active": [], "purchased": []}
    profile.rival_data = {}
    profile.save()
    # The weekly verdict compares real logged TrainingSession.xp_earned over
    # the trailing 7 days (not profile.rank_xp directly) against Johan's
    # simulated week -- comfortably outscore anything Johan could roll.
    TrainingSession.objects.create(
        user_profile=profile, activity_key="mathematics", hours=5,
        focus_rating=8, xp_earned=100000,
    )

    data = compute_rival_data(profile)

    assert data["weeklyReward"] is not None
    assert data["weeklyReward"]["mutator"] is not None
    assert data["weeklyReward"]["item"] is not None
    assert data["weeklyReward"]["item"]["chest_type"] == "quantum_safe"

    profile.refresh_from_db()
    purchased = profile.active_mutators.get("purchased", [])
    assert data["weeklyReward"]["mutator"]["mutator_id"] in purchased
    # DB may have many real E-class equipment items seeded via migrations,
    # so the roll isn't guaranteed to land on this test's own fixture item --
    # check inventory for whichever item the result actually says was won.
    won_code = data["weeklyReward"]["item"]["code"]
    assert InventoryItem.objects.filter(
        user_profile=profile, item__code=won_code
    ).exists()


@pytest.mark.django_db
def test_weekly_reward_not_granted_when_player_behind(profile):
    from api.services.rival_service import compute_rival_data

    _make_quantum_safe_chest_and_item()
    profile.active_mutators = {"active": [], "purchased": []}
    profile.rank_xp = 0
    profile.rival_data = {}
    profile.save()

    data = compute_rival_data(profile)
    assert data["weeklyReward"] is None


@pytest.mark.django_db
def test_weekly_reward_does_not_double_grant_same_iso_week(profile):
    from api.services.rival_service import compute_rival_data

    _make_quantum_safe_chest_and_item()
    profile.active_mutators = {"active": [], "purchased": []}
    profile.rival_data = {}
    profile.save()
    TrainingSession.objects.create(
        user_profile=profile, activity_key="mathematics", hours=5,
        focus_rating=8, xp_earned=100000,
    )

    first = compute_rival_data(profile)
    assert first["weeklyReward"] is not None
    week = first["weeklyRewardGrantedWeek"]

    # Force a recompute (as if a new day arrived) without advancing to a new
    # ISO week -- must NOT grant a second time.
    profile.refresh_from_db()
    profile.rival_data["lastUpdated"] = "2000-01-01"
    profile.save(update_fields=["rival_data"])

    second = compute_rival_data(profile)
    assert second["weeklyReward"] is None
    assert second["weeklyRewardGrantedWeek"] == week
