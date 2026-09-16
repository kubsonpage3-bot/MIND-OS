"""
Extension app tests.
Run: pytest backend/extension/tests.py -v
"""

import pytest
from django.contrib.auth import get_user_model

from api.models import UserProfile
from extension.models import BlockedSite, ExtensionToken, PairingCode

User = get_user_model()


@pytest.fixture
def user(db):
    u = User.objects.create_user(username="hero", password="pass")
    UserProfile.objects.get_or_create(user=u)
    return u


@pytest.fixture
def ext_token(user):
    token, _ = ExtensionToken.objects.get_or_create(user=user)
    return token


# ── Pairing ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_pair_valid_code(client, user):
    code = PairingCode.objects.create(user=user)
    res = client.post(
        "/api/extension/pair/",
        {"code": code.code},
        content_type="application/json",
    )
    assert res.status_code == 200
    assert "token" in res.json()


@pytest.mark.django_db
def test_pair_invalid_code(client):
    res = client.post(
        "/api/extension/pair/",
        {"code": "INVALID000"},
        content_type="application/json",
    )
    assert res.status_code == 400
    assert res.json()["error"] == "invalid_code"


@pytest.mark.django_db
def test_pair_expired_code(client, user):
    from datetime import timedelta
    from django.utils import timezone

    code = PairingCode.objects.create(user=user)
    code.expires_at = timezone.now() - timedelta(minutes=1)
    code.save()

    res = client.post(
        "/api/extension/pair/",
        {"code": code.code},
        content_type="application/json",
    )
    assert res.status_code == 400
    assert res.json()["error"] == "code_expired_or_used"


# ── Status ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_status_requires_auth(client):
    res = client.get("/api/extension/status/")
    assert res.status_code in (401, 403)  # unauthenticated → 401 or 403


@pytest.mark.django_db
def test_status_returns_gold_and_hp(client, user, ext_token):
    profile = UserProfile.objects.get(user=user)
    profile.gold = 500
    profile.hp = 80
    profile.save()

    res = client.get(
        "/api/extension/status/",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["gold"] == 500
    assert data["hp"] == 80
    assert "user_activities" in data
    from api.constants.activities import ACTIVITY_CATALOG

    assert len(data["user_activities"]) == len(ACTIVITY_CATALOG)


@pytest.mark.django_db
def test_status_user_activities_excludes_hidden(client, user, ext_token):
    """
    Hiding an activity on the Training tab (UserProfile.hidden_activities)
    must also drop it from the extension's Linked-Pomodoro picker -- the two
    surfaces share one list now instead of the extension showing its own
    fixed catalog regardless of what the player actually uses.
    """
    profile = UserProfile.objects.get(user=user)
    profile.hidden_activities = ["chess", "running"]
    profile.save()

    res = client.get(
        "/api/extension/status/",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 200
    keys = [a["key"] for a in res.json()["user_activities"]]
    assert "chess" not in keys
    assert "running" not in keys
    assert "mathematics" in keys


@pytest.mark.django_db
def test_status_user_activities_includes_custom_task(client, user, ext_token):
    from api.models import Task

    task = Task.objects.create(
        user=user, title="Chemistry", task_type="button", icon="💎"
    )

    res = client.get(
        "/api/extension/status/",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 200
    keys = {a["key"]: a["label"] for a in res.json()["user_activities"]}
    assert keys.get(f"custom_task_{task.id}") == "Chemistry"


@pytest.mark.django_db
def test_extension_activity_catalog_matches_frontend_cognitive_engine():
    """
    Guards against the drift that caused this catalog to exist in the first
    place: the backend's ACTIVITY_CATALOG (which builds the extension's
    Linked-Pomodoro picker) must have exactly the same keys as ACTIVITIES in
    frontend/src/lib/cognitiveEngine.js (the real Training-tab source of
    truth). If this fails, either a new activity was added to one side only,
    or a stale key was left behind on one side -- keep them in lockstep
    rather than letting the extension quietly pick up ghost/ different
    activities again.
    """
    import re
    from pathlib import Path
    from django.conf import settings
    from api.constants.activities import ACTIVITY_CATALOG_KEYS

    frontend_file = (
        Path(settings.BASE_DIR).parent
        / "frontend"
        / "src"
        / "lib"
        / "cognitiveEngine.js"
    )
    if not frontend_file.exists():
        pytest.skip("frontend/ not checked out alongside backend/ in this environment")

    src = frontend_file.read_text(encoding="utf-8")
    match = re.search(r"export const ACTIVITIES = \{([\s\S]*?)\n\};", src)
    assert match, "Could not locate ACTIVITIES block in cognitiveEngine.js"
    frontend_keys = set(re.findall(r"^\s{2}([a-z_]+):\s*\{", match.group(1), re.MULTILINE))

    assert frontend_keys == ACTIVITY_CATALOG_KEYS


@pytest.mark.django_db
def test_hidden_activities_round_trips_through_profile_patch(client, user):
    """
    The Training tab (web) writes hidden_activities via PATCH /api/profile/;
    the extension reads it back via GET /api/extension/status/. Confirms
    the two actually share the one persisted list end-to-end.
    """
    from rest_framework.test import APIClient

    api_client = APIClient()
    api_client.force_authenticate(user=user)

    res = api_client.patch(
        "/api/profile/", {"hidden_activities": ["exercise"]}, format="json"
    )
    assert res.status_code == 200

    profile = UserProfile.objects.get(user=user)
    assert profile.hidden_activities == ["exercise"]


# ── Unlock site ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_unlock_site_insufficient_gold(client, user, ext_token):
    """Negative scenario: player has 0 gold → must get 400."""
    profile = UserProfile.objects.get(user=user)
    profile.gold = 0
    profile.save()

    BlockedSite.objects.create(
        user=user, domain="youtube.com", unlock_cost=111, unlock_duration_minutes=30
    )

    res = client.post(
        "/api/extension/unlock-site/",
        {"domain": "youtube.com"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 400
    assert res.json()["error"] == "insufficient_gold"
    # Gold must NOT have changed
    profile.refresh_from_db()
    assert profile.gold == 0


@pytest.mark.django_db
def test_unlock_site_deducts_gold(client, user, ext_token):
    """Positive scenario: enough gold → deducted, unlock created."""
    profile = UserProfile.objects.get(user=user)
    profile.gold = 500
    profile.save()

    BlockedSite.objects.create(
        user=user, domain="twitter.com", unlock_cost=111, unlock_duration_minutes=30
    )

    res = client.post(
        "/api/extension/unlock-site/",
        {"domain": "twitter.com"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["gold"] == 389  # 500 - 111
    profile.refresh_from_db()
    assert profile.gold == 389


@pytest.mark.django_db
def test_unlock_site_not_in_blocklist(client, user, ext_token):
    """Domain not in user's blocklist → 400, no gold deducted."""
    profile = UserProfile.objects.get(user=user)
    profile.gold = 500
    profile.save()

    res = client.post(
        "/api/extension/unlock-site/",
        {"domain": "notblocked.com"},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 400
    assert res.json()["error"] == "site_not_in_blocklist"


# ── Blocklist CRUD ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_add_and_list_blocked_site(client, user, ext_token):
    res = client.post(
        "/api/extension/blocklist/",
        {"domain": "instagram.com", "unlock_cost": 200, "unlock_duration_minutes": 15},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 201

    res = client.get(
        "/api/extension/blocklist/",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 200
    sites = res.json()
    assert any(s["domain"] == "instagram.com" for s in sites)


@pytest.mark.django_db
def test_update_blocked_site_cost(client, user, ext_token):
    site = BlockedSite.objects.create(
        user=user, domain="reddit.com", unlock_cost=111, unlock_duration_minutes=30
    )
    res = client.patch(
        f"/api/extension/blocklist/{site.id}/",
        {"unlock_cost": 222},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 200
    site.refresh_from_db()
    assert site.unlock_cost == 222


@pytest.mark.django_db
def test_delete_blocked_site(client, user, ext_token):
    site = BlockedSite.objects.create(
        user=user, domain="tiktok.com", unlock_cost=111, unlock_duration_minutes=30
    )
    res = client.delete(
        f"/api/extension/blocklist/{site.id}/",
        HTTP_AUTHORIZATION=f"Bearer {ext_token.token}",
    )
    assert res.status_code == 204
    assert not BlockedSite.objects.filter(id=site.id).exists()
