import logging
import json
from django.conf import settings
from django.utils import timezone
from pywebpush import webpush, WebPushException
from api.models import PushSubscription

logger = logging.getLogger(__name__)

# Only send streak-risk warnings in the last few hours of the UTC day, since
# that's the calendar boundary process_daily_login actually breaks streaks
# on. CronStreakWarningView fires hourly, so this caps it to a handful of
# nudges instead of one every hour, all day, for every user with a streak.
STREAK_WARNING_HOUR_UTC = 20


def get_vapid_claims():
    email = getattr(settings, "VAPID_CLAIM_EMAIL", "")
    return {"sub": email}


def send_web_push(subscription, payload_data):
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
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


def _channel_allows_push(prefs):
    """
    The Notifications settings screen lets the user pick a delivery channel
    (push / email / none). Email delivery isn't implemented yet, so until it
    is, only "push" (the default when unset) should actually deliver
    anything — otherwise picking "email" or "none" had no effect and users
    kept getting push notifications regardless of their choice.
    """
    return prefs.get("channel", "push") == "push"


def send_notification_to_user(
    user, pref_key, title, body, icon="/android-chrome-192x192.png", url="/"
):
    """
    Sends a push notification to a user if they have the specific pref_key enabled.
    """
    profile = user.profile
    prefs = profile.notification_preferences or {}

    # If the preference is explicitly false, do not send. Default is True.
    if not prefs.get(pref_key, True):
        return 0

    if not _channel_allows_push(prefs):
        return 0

    subscriptions = PushSubscription.objects.filter(user=user)
    if not subscriptions.exists():
        return 0

    payload = {"title": title, "body": body, "icon": icon, "url": url}

    sent_count = 0
    for sub in subscriptions:
        if send_web_push(sub, payload):
            sent_count += 1

    return sent_count


def send_streak_warnings():
    """
    Finds users who are at risk of losing their streak and sends a push notification.
    Returns the number of notifications successfully sent.

    This is called hourly (see CronStreakWarningView), so "at risk" has to be
    a real check — not everyone with streak_risk enabled — or every such user
    gets paged up to 24 times a day regardless of whether they've even opened
    the app. process_daily_login (daily_service.py) breaks the streak based
    on UTC calendar day + profile.last_login_date, so that's exactly what
    determines real risk here: an active streak, no login recorded yet today
    (UTC), and only in the last few hours of the UTC day so this doesn't fire
    all day long.
    """
    today = timezone.now().date()
    current_hour = timezone.now().hour
    if current_hour < STREAK_WARNING_HOUR_UTC:
        return 0

    subscriptions = PushSubscription.objects.select_related(
        "user", "user__profile"
    ).all()

    sent_count = 0
    notified_users = set()

    for sub in subscriptions:
        user = sub.user

        # Don't send multiple pushes to the same user if they have multiple devices
        if user.id in notified_users:
            continue

        profile = user.profile

        # Check notification preferences
        prefs = profile.notification_preferences or {}
        if not prefs.get("streak_risk", True):
            continue
        if not _channel_allows_push(prefs):
            continue

        # No streak to lose, or they've already logged in today (UTC) — not at risk.
        if not profile.streak or profile.streak <= 0:
            continue
        if profile.last_login_date is not None and profile.last_login_date >= today:
            continue

        payload = {
            "title": "Streak at Risk! ⚠️",
            "body": f"Your streak is at risk, {user.username}. Complete a task before midnight to keep it!",
            "icon": "/android-chrome-192x192.png",
            "url": "/",
        }

        success = send_web_push(sub, payload)
        if success:
            sent_count += 1
            notified_users.add(user.id)

    return sent_count


def send_rival_overtook_warnings():
    from api.services.rival_service import compute_rival_data

    subscriptions = PushSubscription.objects.select_related(
        "user", "user__profile"
    ).all()

    sent_count = 0
    notified_users = set()

    for sub in subscriptions:
        user = sub.user
        if user.id in notified_users:
            continue

        prefs = user.profile.notification_preferences or {}
        if not prefs.get("rival_overtook", True):
            continue
        if not _channel_allows_push(prefs):
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
                "url": "/character/rival",
            }
            if send_web_push(sub, payload):
                sent_count += 1
                notified_users.add(user.id)

    return sent_count


def send_weekly_reports():
    subscriptions = PushSubscription.objects.select_related(
        "user", "user__profile"
    ).all()

    sent_count = 0
    notified_users = set()

    for sub in subscriptions:
        user = sub.user
        if user.id in notified_users:
            continue

        prefs = user.profile.notification_preferences or {}
        if not prefs.get("weekly_report", True):
            continue
        if not _channel_allows_push(prefs):
            continue

        payload = {
            "title": "Weekly Report Ready 📊",
            "body": "Check out your progress and stats from the last week!",
            "icon": "/android-chrome-192x192.png",
            "url": "/stats/projections",
        }

        if send_web_push(sub, payload):
            sent_count += 1
            notified_users.add(user.id)

    return sent_count


def send_meal_reminders():
    """
    Отправляет напоминания о приёмах пищи пользователям у которых:
      - есть push-подписка
      - включён pref_key "meal_reminder" (по умолчанию True)
      - в NutriGoal настроено время напоминания для конкретного типа
      - текущий час UTC совпадает с настроенным часом
      - в этом типе приёма пищи ещё нет ни одной записи за сегодня

    Вызывается каждый час из CronStreakWarningView.
    Возвращает количество успешно отправленных уведомлений.
    """
    from datetime import datetime, date as dt_date
    from api.models import NutriGoal, MealEntry

    now_utc = datetime.utcnow()
    current_hour = now_utc.hour
    today = dt_date.today()

    MEAL_REMINDERS = [
        ("reminder_breakfast", "breakfast", "🌅 Завтрак", "Не забудь залогировать завтрак!"),
        ("reminder_lunch",     "lunch",     "☀️ Обед",   "Время обеда — не забудь записать!"),
        ("reminder_dinner",    "dinner",    "🌙 Ужин",   "Залогируй ужин пока не забыл!"),
    ]

    # Берём пользователей с push-подписками и настроенными целями
    goals = (
        NutriGoal.objects
        .select_related("user")
        .prefetch_related("user__push_subscriptions")
        .filter(user__push_subscriptions__isnull=False)
        .distinct()
    )

    sent_count = 0
    notified_pairs = set()  # (user_id, meal_type) — один push в час

    for goal in goals:
        user = goal.user
        prefs = getattr(user, "profile", None)
        if prefs:
            notif_prefs = prefs.notification_preferences or {}
            if not notif_prefs.get("meal_reminder", True):
                continue
            if not _channel_allows_push(notif_prefs):
                continue

        for field, meal_type, title, body in MEAL_REMINDERS:
            reminder_time = getattr(goal, field, None)
            if not reminder_time:
                continue

            # Совпадает ли час напоминания с текущим часом UTC?
            if reminder_time.hour != current_hour:
                continue

            pair_key = (user.id, meal_type)
            if pair_key in notified_pairs:
                continue

            # Уже есть записи за сегодня этого типа?
            has_entry = MealEntry.objects.filter(
                user=user, date=today, meal_type=meal_type
            ).exists()
            if has_entry:
                continue  # уже залогировано — не беспокоить

            payload = {
                "title": title,
                "body": body,
                "icon": "/android-chrome-192x192.png",
                "url": "/?tab=nutrition",
            }

            for sub in user.push_subscriptions.all():
                if send_web_push(sub, payload):
                    sent_count += 1
                    notified_pairs.add(pair_key)
                    break  # достаточно одного устройства на приём пищи

    logger.info("send_meal_reminders: sent %d notifications for hour %d UTC", sent_count, current_hour)
    return sent_count
