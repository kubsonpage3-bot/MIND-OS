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
    assert len(data["user_activities"]) >= 18


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
