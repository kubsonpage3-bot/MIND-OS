"""Shared helpers for Pomodoro tests.

Pomodoro rewards are now computed from the SERVER's clock (how long the active
session has really been running), not from any client-declared duration, so a
test that starts a session and completes it instantly would be rejected as "too
short". These helpers let a test simulate the timer having actually run.
"""
from datetime import timedelta

from django.utils import timezone

from api.models import ActivePomodoroSession, UserProfile


def backdate_active_session(user, minutes=None):
    """Move the active session's start back `minutes` (default: its full
    duration), i.e. pretend the timer ran to completion."""
    active = ActivePomodoroSession.objects.get(user=user)
    elapsed = active.duration_minutes if minutes is None else minutes
    ActivePomodoroSession.objects.filter(pk=active.pk).update(
        started_at=timezone.now() - timedelta(minutes=elapsed)
    )


def make_premium(user):
    """Pomodoro is a Premium feature (enforced server-side)."""
    # Go through user.profile (not a fresh get_or_create) so the profile object
    # the test client later authenticates with -- cached on `user` when the
    # signal created it -- is the very one updated, not a stale sibling.
    profile = getattr(user, "profile", None)
    if profile is None:
        profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.is_premium = True
    profile.save(update_fields=["is_premium"])
    return profile
