from django.db import transaction
from django.utils import timezone
from api.models import UserProfile, UnlockedSkill, ActiveEffect


@transaction.atomic
def process_daily_login(user):
    """
    Checks if the user is logging in on a new calendar day.
    Updates the daily streak, handles streak resets, and triggers daily passive skills.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)
    today = timezone.now().date()

    if profile.last_daily_cron_at is None:
        profile.last_daily_cron_at = today
        profile.streak = 1
        profile.save(update_fields=["last_daily_cron_at", "streak"])
        return profile

    if profile.last_daily_cron_at >= today:
        return profile

    # New calendar day detected!
    delta = (today - profile.last_daily_cron_at).days

    if delta == 1:
        profile.streak += 1
    else:
        # Check for streak_shield
        shield = ActiveEffect.objects.filter(
            user=user, skill_id="streak_shield"
        ).first()

        if shield:
            # Consume the shield
            shield.delete()
            # Act as if they didn't miss (increment streak)
            profile.streak += 1
        else:
            profile.streak = 1

    profile.last_daily_cron_at = today

    # fortunes_favor (Gain 100G daily)
    if UnlockedSkill.objects.filter(
        user_profile=profile, skill_code="fortunes_favor"
    ).exists():
        profile.gold += 100

    # compound_returns (7-day perfect streak -> 200G)
    if (
        profile.streak % 7 == 0
        and UnlockedSkill.objects.filter(
            user_profile=profile, skill_code="compound_returns"
        ).exists()
    ):
        profile.gold += 200

    profile.save(update_fields=["last_daily_cron_at", "streak", "gold"])
    return profile
