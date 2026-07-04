import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from api.models import UserProfile, User
from api.services.billing_service import handle_stripe_webhook
from unittest.mock import patch


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def non_premium_user():
    user = User.objects.create_user(
        username="freeuser", email="free@example.com", password="password"
    )
    profile = UserProfile.objects.get(user=user)
    return user, profile


@pytest.fixture
def premium_user():
    user = User.objects.create_user(
        username="premiumuser", email="premium@example.com", password="password"
    )
    profile = UserProfile.objects.get(user=user)
    profile.is_premium = True
    profile.stripe_customer_id = "cus_test_123"
    profile.save()
    user.refresh_from_db()  # Clear cached profile
    return user, profile


@pytest.mark.django_db
def test_premium_class_gating(api_client, non_premium_user, premium_user):
    free_u, free_p = non_premium_user
    prem_u, prem_p = premium_user

    # 1. Non-premium user attempts to switch to premium class
    api_client.force_authenticate(user=free_u)
    url = reverse("user-profile")

    # Try updating to warlord (premium class)
    response = api_client.patch(url, {"character_class": "warlord"}, format="json")
    # Should be rejected with 400
    assert response.status_code == 400
    assert "premium" in str(response.data).lower()

    # Check that they can switch to ascetic (free class)
    response = api_client.patch(url, {"character_class": "ascetic"}, format="json")
    assert response.status_code == 200
    free_p.refresh_from_db()
    assert free_p.character_class == "ascetic"

    # 2. Premium user attempts to switch to premium class
    api_client.force_authenticate(user=prem_u)
    response = api_client.patch(url, {"character_class": "warlord"}, format="json")
    assert response.status_code == 200
    prem_p.refresh_from_db()
    assert prem_p.character_class == "warlord"


@pytest.mark.django_db
def test_premium_calendar_gating(api_client, non_premium_user, premium_user):
    free_u, free_p = non_premium_user
    prem_u, prem_p = premium_user

    url = "/api/calendar/events/"  # Router registers it at calendar/events/

    # 1. Non-premium user access
    api_client.force_authenticate(user=free_u)
    response = api_client.get(url)
    assert response.status_code == 403
    assert "premium" in str(response.data).lower()

    # 2. Premium user access
    api_client.force_authenticate(user=prem_u)
    response = api_client.get(url)
    print("PREMIUM USER RESPONSE:", response.data)
    assert response.status_code == 200


@pytest.mark.django_db
def test_billing_webhooks(non_premium_user):
    user, profile = non_premium_user
    assert profile.is_premium is False
    assert not profile.stripe_subscription_id

    # Simulate checkout.session.completed
    checkout_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": str(user.id),
                "customer": "cus_new_123",
                "subscription": "sub_new_123",
            }
        },
    }

    # We call the service function but mock stripe.Webhook.construct_event
    with patch("stripe.Webhook.construct_event") as mock_construct:
        mock_construct.return_value = checkout_event
        handle_stripe_webhook(b"payload", "sig")

    profile.refresh_from_db()
    assert profile.is_premium is True
    assert profile.stripe_customer_id == "cus_new_123"
    assert profile.stripe_subscription_id == "sub_new_123"

    # Simulate customer.subscription.deleted
    deleted_event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_new_123"}},
    }

    with patch("stripe.Webhook.construct_event") as mock_construct:
        mock_construct.return_value = deleted_event
        handle_stripe_webhook(b"payload", "sig")

    profile.refresh_from_db()
    assert profile.is_premium is False
    # Subscription ID should be cleared, but customer ID might remain
    assert profile.stripe_subscription_id == ""
    assert profile.stripe_customer_id == "cus_new_123"
