from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from api.models import UserProfile, UnlockedSkill, ActiveEffect


def _sync_max_streak(user, profile):
    try:
        from api.models import UserStats

        stats, _ = UserStats.objects.get_or_create(user=user)
        if profile.streak > stats.max_streak:
            stats.max_streak = profile.streak
            stats.save(update_fields=["max_streak"])
    except Exception:
        pass


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
        _sync_max_streak(user, profile)
        return profile

    if profile.last_login_date >= today:
        _sync_max_streak(user, profile)
        return profile

    # New calendar day detected!
    delta = (today - profile.last_login_date).days

    # Check if party streak broke
    try:
        membership = user.party_membership
        yesterday = today - timedelta(days=1)
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
        # Check Chronomancer first (cooldown 14 days, freezes streak)
        chronomancer_triggered = False
        active_list = (
            profile.active_mutators.get("active", [])
            if isinstance(profile.active_mutators, dict)
            else []
        )
        active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]
        if "chronomancer" in active_ids:
            cooldown_passed = True
            if profile.last_chronomancer_used:
                cooldown_passed = (
                    timezone.now() - profile.last_chronomancer_used
                ).days >= 14
            if cooldown_passed:
                profile.chronomancer_banked_days = 1
                profile.last_chronomancer_used = timezone.now()
                chronomancer_triggered = True

        if not chronomancer_triggered:
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

    # Weekly reset check
    current_iso_week = f"{today.year}-W{today.isocalendar()[1]}"
    if profile.last_weekly_reset != current_iso_week:
        profile.last_weekly_reset = current_iso_week
        from api.services.mechanics import get_passive_multipliers

        passives = get_passive_multipliers(profile, {})
        weekly_free_mana = passives.get("weekly_free_mana", False)
        if weekly_free_mana:
            profile.mana = profile.total_stats.get("mana_max", 100)

        # Gambler's Ledger weekly payout (+50% bonus)
        if profile.ledger_gold > 0:
            payout = int(profile.ledger_gold * 1.5)
            profile.gold += payout
            profile.ledger_gold = 0

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

    _sync_max_streak(user, profile)

    profile.save(
        update_fields=[
            "last_login_date",
            "streak",
            "gold",
            "last_weekly_reset",
            "mana",
            "ledger_gold",
            "last_chronomancer_used",
            "chronomancer_banked_days",
        ]
    )
    return profile
