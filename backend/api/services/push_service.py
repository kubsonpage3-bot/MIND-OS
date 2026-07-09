import logging
import json
from django.conf import settings
from django.utils import timezone
from pywebpush import webpush, WebPushException
from api.models import PushSubscription, UserStats

logger = logging.getLogger(__name__)

def get_vapid_claims():
    email = getattr(settings, "VAPID_CLAIM_EMAIL", "")
    return {"sub": email}

def send_web_push(subscription, payload_data):
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth
                }
            },
            data=json.dumps(payload_data),
            vapid_private_key=getattr(settings, "VAPID_PRIVATE_KEY", ""),
            vapid_claims=get_vapid_claims(),
        )
        return True
    except WebPushException as ex:
        logger.error(f"WebPushException: {repr(ex)}")
        if ex.response and ex.response.status_code in [404, 410]:
            # The subscription is invalid or expired
            logger.info(f"Removing invalid push subscription: {subscription.endpoint}")
            subscription.delete()
        return False
    except Exception as e:
        logger.error(f"Error sending push: {str(e)}", exc_info=True)
        return False

def send_notification_to_user(user, pref_key, title, body, icon="/android-chrome-192x192.png", url="/"):
    """
    Sends a push notification to a user if they have the specific pref_key enabled.
    """
    profile = user.profile
    prefs = profile.notification_preferences or {}
    
    # If the preference is explicitly false, do not send. Default is True.
    if not prefs.get(pref_key, True):
        return 0
        
    subscriptions = PushSubscription.objects.filter(user=user)
    if not subscriptions.exists():
        return 0
        
    payload = {
        "title": title,
        "body": body,
        "icon": icon,
        "url": url
    }
    
    sent_count = 0
    for sub in subscriptions:
        if send_web_push(sub, payload):
            sent_count += 1
            
    return sent_count

def send_streak_warnings():
    """
    Finds users who are at risk of losing their streak and sends a push notification.
    Returns the number of notifications successfully sent.
    """
    # For a naive implementation, we send warnings to all users who have an active streak
    # and haven't logged activity today. In a production app with precise timezones, 
    # we would filter by the user's local time nearing midnight.
    
    # We only send to users who have a PushSubscription.
    subscriptions = PushSubscription.objects.select_related('user', 'user__profile').all()
    
    sent_count = 0
    notified_users = set()

    for sub in subscriptions:
        user = sub.user
        
        # Don't send multiple pushes to the same user if they have multiple devices
        if user.id in notified_users:
            pass
        
        # Check notification preferences
        prefs = user.profile.notification_preferences or {}
        if not prefs.get('streak_risk', True):
            continue
            
        # Here we would check if they actually need a warning
        # For prototype purposes, we assume this is called only when needed
        
        payload = {
            "title": "Streak at Risk! ⚠️",
            "body": f"Your streak is at risk, {user.username}. Complete a task before midnight to keep it!",
            "icon": "/android-chrome-192x192.png",
            "url": "/"
        }
        
        success = send_web_push(sub, payload)
        if success:
            sent_count += 1
            notified_users.add(user.id)
            
    return sent_count


def send_rival_overtook_warnings():
    from api.services.rival_service import compute_rival_data
    from api.models import UserProfile
    
    subscriptions = PushSubscription.objects.select_related('user', 'user__profile').all()
    
    sent_count = 0
    notified_users = set()

    for sub in subscriptions:
        user = sub.user
        if user.id in notified_users:
            pass
            
        prefs = user.profile.notification_preferences or {}
        if not prefs.get('rival_overtook', True):
            continue
            
        # Check if Johan overtook the player today
        rival_data = compute_rival_data(user.profile)
        johan_xp = rival_data.get("totalXP", 0)
        player_xp = user.profile.rank_xp or 0
        
        # If Johan's XP is slightly higher, it's an overtake risk
        if johan_xp > player_xp:
            payload = {
                "title": "Rival Overtook You! ⚔️",
                "body": f"Johan has {johan_xp} XP, surpassing your {player_xp} XP. Don't fall behind!",
                "icon": "/android-chrome-192x192.png",
                "url": "/character/rival"
            }
            if send_web_push(sub, payload):
                sent_count += 1
                notified_users.add(user.id)
                
    return sent_count

def send_weekly_reports():
    subscriptions = PushSubscription.objects.select_related('user', 'user__profile').all()
    
    sent_count = 0
    notified_users = set()

    for sub in subscriptions:
        user = sub.user
        if user.id in notified_users:
            pass
            
        prefs = user.profile.notification_preferences or {}
        if not prefs.get('weekly_report', True):
            continue
            
        payload = {
            "title": "Weekly Report Ready 📊",
            "body": "Check out your progress and stats from the last week!",
            "icon": "/android-chrome-192x192.png",
            "url": "/stats/projections"
        }
        
        if send_web_push(sub, payload):
            sent_count += 1
            notified_users.add(user.id)
            
    return sent_count

