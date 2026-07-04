import os
import stripe
import logging
from django.conf import settings
from api.models import UserProfile
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_123")
PREMIUM_PRICE_ID = os.getenv("STRIPE_PREMIUM_PRICE_ID", "price_1TpUpODrZUajevZJMEXftH1n")
# URL configuration for frontend redirects
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def create_checkout_session(user: User) -> str:
    """
    Creates a Stripe Checkout Session for a user to subscribe to Premium.
    Returns the session URL.
    """
    profile = user.profile

    if profile.is_premium:
        raise ValueError("User is already premium.")

    # Pass the user's ID as client_reference_id so the webhook can match it
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price": PREMIUM_PRICE_ID,
                "quantity": 1,
            },
        ],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/?checkout=success",
        cancel_url=f"{FRONTEND_URL}/?checkout=cancel",
        client_reference_id=str(user.id),
        customer_email=user.email,
    )

    return session.url

def create_portal_session(user: User) -> str:
    """
    Creates a Stripe Customer Portal session for managing/canceling subscription.
    Returns the portal URL.
    """
    profile = user.profile
    customer_id = profile.stripe_customer_id

    if not customer_id:
        raise ValueError("User has no Stripe customer record.")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/",
    )

    return session.url

def handle_stripe_webhook(payload: bytes, sig_header: str) -> None:
    """
    Handles incoming Stripe webhooks.
    """
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_test_123")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise
    except stripe.error.SignatureVerificationError as e: # type: ignore
        logger.error(f"Invalid signature: {e}")
        raise

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        client_reference_id = session.get('client_reference_id')
        
        if client_reference_id:
            try:
                user = User.objects.get(id=int(client_reference_id))
                profile = user.profile
                profile.is_premium = True
                profile.stripe_customer_id = session.get('customer')
                profile.stripe_subscription_id = session.get('subscription')
                profile.save()
                logger.info(f"User {user.username} upgraded to Premium via checkout.")
            except User.DoesNotExist:
                logger.error(f"Webhook error: User with ID {client_reference_id} not found.")
                
    # Handle subscription updates
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        status = subscription.get('status')
        # We can optionally handle paused/past_due here.
        # But we definitely need to handle canceled in the deleted event.

    # Handle subscription deletion/cancellation
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.get('customer')
        
        try:
            profile = UserProfile.objects.get(stripe_customer_id=customer_id)
            profile.is_premium = False
            # Clear subscription ID but keep customer ID for future re-subscribes
            profile.stripe_subscription_id = ""
            profile.save()
            logger.info(f"User {profile.user.username} Premium subscription canceled/deleted.")
        except UserProfile.DoesNotExist:
            logger.warning(f"Webhook error: UserProfile with customer ID {customer_id} not found on subscription.deleted.")
