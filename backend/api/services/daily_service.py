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

    if profile.last_login_date is None:
        profile.last_login_date = today
        profile.streak = 1
        profile.save(update_fields=["last_login_date", "streak"])
        return profile

    if profile.last_login_date >= today:
        return profile

    # New calendar day detected!
    delta = (today - profile.last_login_date).days

    # Check if party streak broke
    try:
        membership = user.party_membership
        yesterday = today - timezone.timedelta(days=1)
        if (
            membership.last_daily_completed_date is None
            or membership.last_daily_completed_date < yesterday
        ):
            party = membership.party
            if party.streak > 0:
                party.streak = 0
                party.save(update_fields=["streak"])
                from api.models import PartyEvent

                PartyEvent.objects.create(
                    party=party,
                    member=membership,
                    event_type="milestone",
                    message="missed a daily, resetting the party streak.",
                )
    except Exception:
        pass

    if delta == 1:
        profile.streak += 1
    else:
        # Check for streak_shield
        shield = ActiveEffect.objects.filter(
            user=user, skill_id="streak_shield"
        ).first()

        if shield:
            if shield.data and "uses_left" in shield.data:
                shield.data["uses_left"] -= 1
                if shield.data["uses_left"] <= 0:
                    shield.delete()
                else:
                    shield.save()
            else:
                shield.delete()
            # Act as if they didn't miss (increment streak)
            profile.streak += 1
        else:
            profile.streak = 1

    profile.last_login_date = today

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

    profile.save(update_fields=["last_login_date", "streak", "gold"])
    return profile
