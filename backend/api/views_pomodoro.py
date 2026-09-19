import logging
import zoneinfo
from datetime import timedelta
from django.db.models import Count, Sum
from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.decorators import action

from django.db import transaction
from django.utils import timezone
from api.models import ActivePomodoroSession, PomodoroSession, UserProfile
from api.serializers.pomodoro import PomodoroSessionSerializer

logger = logging.getLogger(__name__)

# Modes that count as a real focus session. Breaks are recorded (so the cycle
# history is complete) but must never count toward stats, streaks, titles or
# rewards -- a day of 4 focus + 4 break sessions is 4 Pomodoros, not 8.
WORK_MODES = ("work", "focus")
BREAK_MODES = ("break", "longBreak", "long_break")
VALID_MODES = WORK_MODES + BREAK_MODES

MIN_DURATION_MIN = 1
MAX_DURATION_MIN = 480  # matches the extension's longest custom timer
MIN_LOG_ELAPSED_SEC = 60  # a focus session shorter than this is not logged
COMPLETE_GRACE_SEC = 15  # <= this much time left counts as a full session
ABANDON_RUNNING_AFTER_SEC = 6 * 3600  # expired + untouched this long -> dropped
ABANDON_PAUSED_AFTER_SEC = 24 * 3600
DAILY_REWARDED_MINUTES_CAP = 16 * 60  # same 16h ceiling the Training Log enforces


def _parse_int(value, name, default=None, lo=None, hi=None):
    """int() that answers 400 (not 500) on bad input and enforces bounds."""
    if value is None or value == "":
        if default is None:
            raise ValidationError({name: "This field is required."})
        return default
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ValidationError({name: "Must be an integer."})
    if lo is not None and n < lo:
        raise ValidationError({name: f"Must be at least {lo}."})
    if hi is not None and n > hi:
        raise ValidationError({name: f"Must be at most {hi}."})
    return n


def _user_tz(user):
    profile = getattr(user, "profile", None)
    tz_name = getattr(profile, "timezone", None) or "UTC"
    try:
        return zoneinfo.ZoneInfo(tz_name)
    except Exception:
        return zoneinfo.ZoneInfo("UTC")


def _user_today(user):
    """'Today' in the user's own timezone (profile.timezone), the same day
    boundary the daily cron/streaks use -- not the server's clock."""
    return timezone.now().astimezone(_user_tz(user)).date()


def _clean_activity_key(user, raw):
    """Normalise a linked activity key the way the Training Log does: a known
    activity, a custom task the user really owns, or 'other' -- never an
    arbitrary client string (each random key used to count as a new subject)."""
    if raw is None or raw == "":
        return None
    if not isinstance(raw, str) or len(raw) > 100:
        raise ValidationError({"linked_activity_key": "Invalid activity."})
    cleaned = raw.strip().lower()
    if cleaned.startswith("custom_task_"):
        from api.models import Task

        try:
            task_id = int(cleaned.replace("custom_task_", ""))
        except ValueError:
            raise ValidationError({"linked_activity_key": "Invalid custom task."})
        if not Task.objects.filter(
            id=task_id, user=user, task_type=Task.TaskType.BUTTON
        ).exists():
            raise ValidationError({"linked_activity_key": "Unknown custom task."})
        return cleaned
    from api.serializers.training import ALLOWED_ACTIVITIES

    return cleaned if cleaned in ALLOWED_ACTIVITIES else "other"


def _is_abandoned(active):
    now = timezone.now()
    if active.is_paused:
        paused_at = active.paused_at
        return bool(
            paused_at and (now - paused_at).total_seconds() > ABANDON_PAUSED_AFTER_SEC
        )
    end = active.started_at + timedelta(minutes=active.duration_minutes)
    return (now - end).total_seconds() > ABANDON_RUNNING_AFTER_SEC


def _active_payload(active):
    return {
        "active": True,
        "linked_activity_key": active.linked_activity_key,
        "duration_minutes": active.duration_minutes,
        "mode": active.mode,
        "is_paused": active.is_paused,
        "remaining_seconds": active.remaining_seconds(),
        "started_at": active.started_at,
    }


class IsPremiumUser(permissions.BasePermission):
    """Pomodoro is a Premium feature -- the dashboard only blurred it with CSS,
    so the API (and the browser extension's timer) stayed open to everyone."""

    message = "Premium subscription required to access Pomodoro."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        profile = getattr(user, "profile", None)
        return bool(profile and profile.is_premium)


class PomodoroPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500


class PomodoroSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoints for Pomodoro Sessions (rewards are granted ONLY by
    active-session/complete, which trusts the server's clock, never the
    client's claimed duration -- POST/PATCH/DELETE on sessions are gone):
    - GET /api/pomodoro/sessions/?kind=work&page_size=200
    - GET /api/pomodoro/sessions/heatmap/?days=365
    - GET /api/pomodoro/sessions/stats/
    - GET  active-session/ ; POST active-session/{start,pause,reset,complete}/
    """

    serializer_class = PomodoroSessionSerializer
    permission_classes = [IsPremiumUser]
    pagination_class = PomodoroPagination

    def get_queryset(self):
        qs = PomodoroSession.objects.filter(user=self.request.user).order_by(
            "-started_at"
        )
        kind = self.request.query_params.get("kind")
        if kind == "work":
            qs = qs.filter(mode__in=WORK_MODES, completed=True)
        elif kind == "break":
            qs = qs.filter(mode__in=BREAK_MODES)
        return qs

    @action(detail=False, methods=["get"])
    def heatmap(self, request):
        """
        Returns an aggregation for GitHub-style heatmap.
        Format: { "YYYY-MM-DD": count, ... }
        """
        days = _parse_int(
            request.query_params.get("days"), "days", default=365, lo=1, hi=3660
        )
        start_date = _user_today(request.user) - timedelta(days=days)

        # Aggregate counts by date (focus sessions only -- not breaks)
        data = (
            self.get_queryset()
            .filter(date__gte=start_date, completed=True, mode__in=WORK_MODES)
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )

        heatmap_data = {
            item["date"].strftime("%Y-%m-%d"): item["count"] for item in data
        }
        return Response(heatmap_data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        Returns stats: total pomodoros, total hours, etc. Focus sessions only.
        """
        qs = self.get_queryset().filter(completed=True, mode__in=WORK_MODES)
        today = _user_today(request.user)

        today_qs = qs.filter(date=today)

        total_pomodoros = qs.count()
        total_minutes = qs.aggregate(total=Sum("duration"))["total"] or 0
        total_hours = round(total_minutes / 60, 1)

        today_pomodoros = today_qs.count()
        today_minutes = today_qs.aggregate(total=Sum("duration"))["total"] or 0
        today_hours = round(today_minutes / 60, 1)

        # Active days
        active_days = qs.values("date").distinct().count()

        # Current Streak calculation
        # Find consecutive days counting backwards from today or yesterday
        dates = list(qs.values_list("date", flat=True).distinct().order_by("-date"))
        streak = 0
        current_date = today

        # Check if they did a pomodoro today or yesterday to continue streak
        if dates and dates[0] == today:
            streak_dates = dates
        elif dates and dates[0] == today - timedelta(days=1):
            streak_dates = dates
            current_date = today - timedelta(days=1)
        else:
            streak_dates = []

        for d in streak_dates:
            if d == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break

        # Best streak (all-time longest consecutive days)
        all_dates = list(qs.values_list("date", flat=True).distinct().order_by("date"))
        best_streak = 0
        current_run = 0
        prev_date = None
        for d in all_dates:
            if prev_date and (d - prev_date).days == 1:
                current_run += 1
            else:
                current_run = 1
            best_streak = max(best_streak, current_run)
            prev_date = d

        return Response(
            {
                "total_pomodoros": total_pomodoros,
                "total_hours": total_hours,
                "today_pomodoros": today_pomodoros,
                "today_hours": today_hours,
                "active_days": active_days,
                "current_streak": streak,
                "best_streak": best_streak,
            }
        )

    @action(detail=False, methods=["get"], url_path="active-session")
    def active_session_get(self, request):
        with transaction.atomic():
            active = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            if active and _is_abandoned(active):
                # Never completed / never resumed: don't let a dead session
                # pop a rating overlay days later or block a fresh start.
                active.delete()
                active = None
        if not active:
            return Response({"active": False})
        return Response(_active_payload(active))

    @action(detail=False, methods=["post"], url_path="active-session/start")
    def active_session_start(self, request):
        activity_key = _clean_activity_key(
            request.user, request.data.get("linked_activity_key")
        )
        duration = _parse_int(
            request.data.get("duration_minutes"),
            "duration_minutes",
            default=25,
            lo=MIN_DURATION_MIN,
            hi=MAX_DURATION_MIN,
        )
        mode = request.data.get("mode") or "work"
        if mode not in VALID_MODES:
            raise ValidationError({"mode": f"Must be one of {', '.join(VALID_MODES)}."})

        with transaction.atomic():
            existing = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            if existing and _is_abandoned(existing):
                existing.delete()
                existing = None

            # Idempotent start: the same session already running (or paused)
            # is adopted as-is instead of having its clock reset -- opening a
            # second tab/popup/device used to restart the server timer.
            if (
                existing
                and existing.linked_activity_key == activity_key
                and existing.duration_minutes == duration
                and existing.mode == mode
                and (existing.is_paused or existing.remaining_seconds() > 0)
            ):
                return Response(_active_payload(existing))

            active, _ = ActivePomodoroSession.objects.update_or_create(
                user=request.user,
                defaults={
                    "linked_activity_key": activity_key,
                    "duration_minutes": duration,
                    "mode": mode,
                    "started_at": timezone.now(),
                    "is_paused": False,
                    "paused_remaining_seconds": 0,
                    "paused_at": None,
                },
            )

        return Response(_active_payload(active))

    @action(detail=False, methods=["post"], url_path="active-session/pause")
    def active_session_pause(self, request):
        """
        Pause/resume. Send {"action": "pause"} or {"action": "resume"} for an
        idempotent call (a retried request can't undo itself); with no action
        it toggles, as before.
        """
        action_param = request.data.get("action") or "toggle"
        if action_param not in ("pause", "resume", "toggle"):
            raise ValidationError({"action": "Must be pause, resume or toggle."})

        with transaction.atomic():
            active = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            if not active or _is_abandoned(active):
                if active:
                    active.delete()
                return Response({"active": False}, status=400)

            want_paused = (
                (not active.is_paused)
                if action_param == "toggle"
                else action_param == "pause"
            )

            if want_paused and not active.is_paused:
                active.paused_remaining_seconds = active.remaining_seconds()
                active.is_paused = True
                active.paused_at = timezone.now()
                active.save()
            elif not want_paused and active.is_paused:
                remaining = active.paused_remaining_seconds
                total_sec = active.duration_minutes * 60
                elapsed = max(0, total_sec - remaining)
                active.started_at = timezone.now() - timedelta(seconds=elapsed)
                active.is_paused = False
                active.paused_remaining_seconds = 0
                active.paused_at = None
                active.save()
            # else: already in the requested state -> no-op

        return Response(_active_payload(active))

    @action(detail=False, methods=["post"], url_path="active-session/reset")
    def active_session_reset(self, request):
        with transaction.atomic():
            ActivePomodoroSession.objects.filter(user=request.user).delete()
        return Response({"active": False})

    @action(detail=False, methods=["post"], url_path="active-session/complete")
    def active_session_complete(self, request):
        """
        Completes the user's ACTIVE session. Everything that decides the
        reward -- mode, linked activity, and above all how long it really ran
        -- comes from the server's own record and clock; the request body only
        contributes the focus rating. (It used to trust a client-declared
        duration, accepted a completion with no session at all, and paid full
        rewards at 0 seconds elapsed.)
        """
        rating = _parse_int(request.data.get("rating"), "rating", default=7)
        rating = max(1, min(10, rating))
        # Cosmetic only (the "what are you focusing on?" text): never affects rewards.
        focus_label = str(request.data.get("label") or "").strip()[:200]

        with transaction.atomic():
            active = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            if active and _is_abandoned(active):
                active.delete()
                active = None
            if not active:
                # Also what a double-submit / second tab / retry sees: the first
                # completion already consumed the session, so nothing pays twice.
                return Response(
                    {
                        "detail": "No active Pomodoro session to complete.",
                        "code": "no_active_session",
                    },
                    status=409,
                )

            mode = active.mode
            activity_key = active.linked_activity_key
            is_work = mode in WORK_MODES
            planned = active.duration_minutes
            remaining = active.remaining_seconds()
            elapsed_sec = planned * 60 - remaining
            if remaining <= COMPLETE_GRACE_SEC:
                duration = planned
            else:
                duration = elapsed_sec // 60

            if is_work and (elapsed_sec < MIN_LOG_ELAPSED_SEC or duration < 1):
                # Leave the session running -- the user can just keep going.
                return Response(
                    {
                        "detail": "Session too short to log yet.",
                        "code": "too_short",
                        "elapsed_seconds": max(0, elapsed_sec),
                        "min_seconds": MIN_LOG_ELAPSED_SEC,
                    },
                    status=400,
                )

            active.delete()
            today = _user_today(request.user)

            if not is_work:
                # A finished break: kept for the cycle history, never rewarded
                # and never counted as a Pomodoro (stats/titles filter on mode).
                session = None
                if duration >= 1:
                    session = PomodoroSession.objects.create(
                        user=request.user,
                        date=today,
                        duration=duration,
                        mode=mode,
                        label="Break",
                        completed=True,
                    )
                return Response(
                    {
                        "success": True,
                        "session_id": session.id if session else None,
                        "training_session_id": None,
                        "gold_earned": 0,
                        "xp_earned": 0,
                        "hours_logged": 0,
                        "combat": None,
                        "breakdown": [],
                    }
                )

            # Same 16h/day ceiling the Training Log enforces per entry: only the
            # minutes still under today's allowance are rewarded.
            already_today = (
                PomodoroSession.objects.filter(
                    user=request.user,
                    date=today,
                    mode__in=WORK_MODES,
                    completed=True,
                ).aggregate(total=Sum("duration"))["total"]
                or 0
            )
            duration = min(duration, max(0, DAILY_REWARDED_MINUTES_CAP - already_today))
            if duration < 1:
                return Response(
                    {
                        "success": True,
                        "session_id": None,
                        "training_session_id": None,
                        "gold_earned": 0,
                        "xp_earned": 0,
                        "hours_logged": 0,
                        "combat": None,
                        "breakdown": ["Daily focus-time cap reached -- no reward"],
                        "capped": True,
                    }
                )

            session = PomodoroSession.objects.create(
                user=request.user,
                date=today,
                duration=duration,
                mode=mode,
                label=activity_key or focus_label or "Focus Session",
                completed=True,
            )

            # Award Gold and XP directly to UserProfile
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            hours = round(duration / 60.0, 2)
            base_gold = max(1, int(duration * 2))
            base_xp = max(1, int(duration * 3))

            training_session = None
            task = None
            gf_gain = gc_gain = ps_gain = vm_gain = 0.0

            if activity_key:
                # Look up custom task if applicable
                from api.models import Task, TrainingSession
                if isinstance(activity_key, str) and activity_key.startswith("custom_task_"):
                    try:
                        task_id = int(activity_key.replace("custom_task_", ""))
                        task = Task.objects.filter(
                            id=task_id, user=request.user, task_type=Task.TaskType.BUTTON
                        ).first()
                    except (ValueError, AttributeError):
                        pass

                if task:
                    task.completion_count += 1
                    task.last_completed_at = timezone.now()
                    task.save(update_fields=["completion_count", "last_completed_at"])

                # ── Apply the same Character Stats / Allies / Mutators pipeline
                # as manual training-log submissions (TrainingLogView), so a
                # linked Pomodoro session isn't a flat, unaffected reward path.
                from api.services.mechanics import (
                    calculate_cognitive_gains,
                    resolve_mastery_category,
                    apply_active_mutators,
                    get_passive_multipliers,
                    calculate_task_outcome,
                    ACTIVITY_CATEGORY_MAP,
                )

                mastery = resolve_mastery_category(
                    activity=activity_key,
                    task_category=task.category if task else None,
                    task_mastery_category=task.mastery_category if task else None,
                )
                # Same task_category derivation as TrainingLogView (falls back
                # to ACTIVITY_CATEGORY_MAP for a plain activity_key, not just a
                # linked custom task) -- Echo/Mirror/Diversity Lock compare this
                # across calls, so a Study log and a Pomodoro of the same
                # subject must resolve to the same category string.
                task_category = (
                    task.category if task else ACTIVITY_CATEGORY_MAP.get(activity_key, "Other")
                )
                context = {
                    "is_science": mastery == "sciences",
                    "is_language": mastery == "languages",
                    "is_exercise": mastery == "body",
                    "is_prayer": mastery == "spirit",
                    "task_type": "training",
                    "hours": hours,
                    "focus_rating": float(rating),
                    "activity": activity_key,
                    "task_category": task_category,
                    "task_mastery_category": task.mastery_category if task else "",
                }

                mutator_effects = apply_active_mutators(profile, context)
                passive_effects = get_passive_multipliers(profile, context)

                active_list = (
                    profile.active_mutators.get("active", [])
                    if isinstance(profile.active_mutators, dict)
                    else []
                )
                active_ids = [
                    m.get("id") if isinstance(m, dict) else m for m in active_list
                ]

                # Allies -- same lookup as TrainingLogView, so a linked
                # Pomodoro isn't invisible to Lyra/Zephyr's training-specific
                # perks below.
                from api.models import RecruitedAlly

                active_codes = profile.active_allies or []
                recruited_allies = {
                    a.ally_code: a.level
                    for a in RecruitedAlly.objects.filter(
                        user_profile=profile, ally_code__in=active_codes
                    )
                }

                # Lyra Level 3 Decaying Focus -- same curve as TrainingLogView.
                if passive_effects.get("decaying_focus", False) and hours > 0:
                    chunks = max(1, int(hours / 0.25))
                    total_focus = 0.0
                    for c in range(chunks):
                        t_start = c * 0.25
                        if t_start < 0.5:
                            val = 10.0
                        else:
                            decay_steps = int((t_start - 0.5) / 0.25) + 1
                            val = max(1.0, 10.0 - 1.5 * decay_steps)
                        total_focus += val
                    eff_rating = total_focus / chunks
                else:
                    # Deep concentration: focus minimum counts as 7.0
                    eff_rating = max(float(rating), passive_effects.get("min_focus", 0.0))

                # Inversion focus quality flip
                if "inversion" in active_ids:
                    eff_rating = 11.0 - eff_rating

                # Reward base -- same training_rewards() formula as a manual
                # Activity Log (TrainingLogView), instead of the old flat
                # "3 XP/min" rate: a linked Pomodoro session is a study
                # session like any other and must score the same as logging
                # the same activity/duration/focus by hand.
                from api.services.rewards_service import training_rewards

                tier = task.difficulty if task else "medium"
                training_reward_calc = training_rewards(tier, hours, eff_rating)
                base_xp = training_reward_calc["xp"]
                base_gold = training_reward_calc["gold"]

                xp_mult = mutator_effects.get("xp_mult", 1.0) + passive_effects.get("xp_mult", 1.0) - 1.0
                gold_mult = mutator_effects.get("gold_mult", 1.0) + passive_effects.get("gold_mult", 1.0) - 1.0
                flat_xp_bonus = mutator_effects.get("flat_xp", 0) + passive_effects.get("flat_xp", 0)

                # Sakura L3: mana regen on a language session -- was applied
                # in TrainingLogView but never here, so a language session
                # logged via a linked Pomodoro never restored it.
                if context.get("is_language"):
                    lang_mana_bonus = passive_effects.get("language_mana_bonus", 0)
                    if lang_mana_bonus > 0:
                        profile.mana = min(profile.max_mana, profile.mana + lang_mana_bonus)

                # Grier L1: Focus >= 9.0 restores +2 HP -- same TrainingLogView
                # gap as above.
                if passive_effects.get("grier_l1_heal", False):
                    profile.hp = min(profile.total_stats.get("hp_max", 100), profile.hp + 2)

                # Glass Tear: "+2 HP on each task completion" -- was only
                # wired into the Habit/Daily/Todo path; a linked Pomodoro
                # session is a task completion too.
                glass_tear_heal = passive_effects.get("task_completion_hp_heal", 0)
                if glass_tear_heal > 0:
                    profile.hp = min(
                        profile.total_stats.get("hp_max", 100),
                        profile.hp + glass_tear_heal,
                    )

                # Lyra Level 1 duration requirements
                lyra_level = recruited_allies.get("lyra", 0)
                lyra_zero_rewards = False
                if lyra_level >= 1:
                    if hours > 2.0:
                        xp_mult += 0.30
                    elif hours < 0.5:
                        lyra_zero_rewards = True
                        xp_mult = 0.0
                        gold_mult = 0.0
                        flat_xp_bonus = 0

                # Zephyr Level 1: different focus subject gives +20% Rank XP
                zephyr_level = recruited_allies.get("zephyr", 0)
                if zephyr_level >= 1:
                    last_session = (
                        TrainingSession.objects.filter(user_profile=profile)
                        .order_by("-created_at")
                        .first()
                    )
                    is_different_subject = True
                    if last_session and last_session.activity_key == activity_key:
                        is_different_subject = False
                    if is_different_subject:
                        xp_mult += 0.20

                # Lyra Level 4 active skill cooldowns reduction
                if lyra_level >= 4 and hours > 0:
                    from api.models import SkillCooldown

                    cooldowns = SkillCooldown.objects.filter(user=request.user)
                    for cd in cooldowns:
                        cd.cooldown_until -= timedelta(hours=hours)
                        cd.save(update_fields=["cooldown_until"])

                # Reward breakdown -- same shape as TrainingLogView/_complete_task_logic:
                # precisely which mutator/ally/gear/skill-tree source actually
                # fired on THIS Pomodoro, not just what's toggled on.
                breakdown = [f"Base +{int(base_xp)} XP"]
                breakdown.extend(mutator_effects.get("_sources", []))
                breakdown.extend(passive_effects.get("_sources", []))
                if flat_xp_bonus:
                    breakdown.append(f"Flat bonus +{flat_xp_bonus:g} XP")
                if xp_mult != 1.0 and not any("XP" in n or "%" in n for n in breakdown[1:]):
                    breakdown.append(f"Other XP bonuses {xp_mult - 1.0:+.0%}")
                if gold_mult != 1.0 and not any("Gold" in n for n in breakdown):
                    breakdown.append(f"Other Gold bonuses {gold_mult - 1.0:+.0%}")

                base_xp = (base_xp + flat_xp_bonus) * xp_mult
                base_gold = base_gold * gold_mult

                # "Final" multiplicative mutators (echo, gambler, volatile,
                # time_dilation, diversity_lock, zero_hour) -- same fix as
                # TrainingLogView; without this a linked Pomodoro session
                # never triggered these mutators at all.
                final_xp_mult = mutator_effects.get("final_xp_mult", 1.0)
                final_gold_mult = mutator_effects.get("final_gold_mult", 1.0)
                if final_xp_mult != 1.0:
                    base_xp = int(base_xp * final_xp_mult)
                    breakdown.append(f"Mutator burst ×{final_xp_mult:g}")
                if final_gold_mult != 1.0:
                    if final_gold_mult == 0.0:
                        from api.services.mechanics import record_zero_hour_gold

                        _active_mutators_now = profile.active_mutators or {}
                        _active_ids_now = [
                            m.get("id") if isinstance(m, dict) else m
                            for m in (
                                _active_mutators_now.get("active", [])
                                if isinstance(_active_mutators_now, dict)
                                else []
                            )
                        ]
                        record_zero_hour_gold(profile, _active_ids_now, base_gold)
                    base_gold = int(base_gold * final_gold_mult)

                eff_total = min(1.0, max(0.2, eff_rating / 10.0))
                gains = calculate_cognitive_gains(
                    activity_key, hours, eff_total, profile,
                    mastery_category=task.mastery_category if task else "",
                )
                if lyra_zero_rewards:
                    gains = {k: 0.0 for k in gains}

                gf_mult = passive_effects.get("gf_mult", 1.0)
                gc_mult = passive_effects.get("gc_mult", 1.0)
                ps_mult = passive_effects.get("ps_mult", 1.0)
                vm_mult = passive_effects.get("vm_mult", 1.0)
                # NOTE: mutator_effects["gc_flat"] belongs on Gc, not Gf.
                gf_flat_bonus = passive_effects.get("gf_flat_bonus", 0.0)
                gc_flat_bonus = mutator_effects.get("gc_flat", 0.0) + passive_effects.get("gc_flat_bonus", 0.0)

                gf_gain = gains.get("gf", 0.0)
                gc_gain = gains.get("gc", 0.0)
                ps_gain = gains.get("ps", 0.0)
                vm_gain = gains.get("vm", 0.0)

                effective_gf_ceiling = profile.gf_ceiling + passive_effects.get("gf_ceiling_flat", 0.0)
                profile.gf = min(effective_gf_ceiling, profile.gf + gf_gain * gf_mult + gf_flat_bonus)
                profile.gc = min(profile.gc_ceiling, profile.gc + gc_gain * gc_mult + gc_flat_bonus)
                profile.ps = min(profile.ps_ceiling, profile.ps + ps_gain * ps_mult)
                profile.vm = min(profile.vm_ceiling, profile.vm + vm_gain * vm_mult)

                outcome = calculate_task_outcome(
                    request.user,
                    "training",
                    base_xp=base_xp,
                    base_gold=base_gold,
                    is_positive=True,
                    passive_effects=passive_effects,
                )
                xp_earned = max(0, int(outcome["xp_earned"] * profile.xp_multiplier))
                gold_earned = max(0, int(outcome["gold_earned"] * profile.gold_multiplier))
                if lyra_zero_rewards:
                    xp_earned = 0
                    gold_earned = 0

                # Session-scoped class skills (Algorithmic Cascade, Quantum
                # Optimization, Eye of the Storm's heal/mana, Rosetta
                # Protocol's XP half, Cognitive Echo, Blood Harvest, Titan's
                # Roar) -- moved here from Task completions only, per user
                # decision. Mutates profile.mana/hp directly.
                from api.services.mechanics import apply_session_active_skills

                session_skills = apply_session_active_skills(request.user, profile)
                if session_skills["xp_mult"] != 1.0:
                    xp_earned = int(xp_earned * session_skills["xp_mult"])
                if session_skills["gold_mult"] != 1.0:
                    gold_earned = int(gold_earned * session_skills["gold_mult"])
                breakdown.extend(session_skills["notes"])

                pwr_pct = min(0.50, profile.total_stats.get("pwr", 0) * 0.005)
                if pwr_pct > 0:
                    breakdown.append(f"PWR +{pwr_pct:.1%}")
                if outcome.get("is_crit"):
                    crit_mult = passive_effects.get("crit_damage_mult", 2.0)
                    foc_crit_chance = min(1.0, profile.total_stats.get("foc", 0) * 0.005)
                    breakdown.append(f"Crit! (×{crit_mult:g}, {foc_crit_chance:.1%} chance)")
                if profile.xp_multiplier != 1.0:
                    breakdown.append(f"Gear/Prestige ×{profile.xp_multiplier:.2f}")

                # Godmind: IQ contribution to Rank XP. Bug: summed all 4
                # metrics instead of averaging them (see views.py's
                # TrainingLogView for the full explanation) -- fixed to a
                # true average, matching the skill's own description.
                if passive_effects.get("godmind_active", False):
                    godmind_iq = (
                        profile.gf + profile.gc + profile.ps + profile.vm
                    ) / 4.0
                    godmind_bonus = int(godmind_iq * 0.5)
                    xp_earned += godmind_bonus
                    breakdown.append(f"Godmind +{godmind_bonus} XP")

                # Cross-training: language sessions give +30% humanities XP
                if context.get("is_language") and profile.unlocked_skills.filter(skill_code="cross_training").exists():
                    profile.humanities_xp += (
                        hours * 0.3 * passive_effects.get("humanities_xp_mult", 1.0)
                    )

                # Golden mind / task loot drops
                if outcome.get("item_dropped"):
                    from api.models import Item, InventoryItem

                    item_obj = Item.objects.filter(code=outcome["item_dropped"]).first()
                    if item_obj:
                        inv_item, created = InventoryItem.objects.get_or_create(
                            user_profile=profile, item=item_obj
                        )
                        if not created:
                            inv_item.quantity += 1
                            inv_item.save(update_fields=["quantity"])

                # Flow state: record training date
                profile.last_training_at = timezone.now().date()

                # Polymath: track unique subjects today. Nene L2's "log 3+
                # subjects/day" gold bonus reads this same count -- was
                # wired into TrainingLogView but the return value was
                # discarded here, so it never fired for a linked Pomodoro.
                try:
                    from api.models import UserStats
                    from api.services.mechanics import add_unique_subject_today

                    stats, _ = UserStats.objects.get_or_create(user=request.user)
                    subj = activity_key or (task.category if task else None)
                    if subj:
                        unique_subjects_count = add_unique_subject_today(stats, subj)
                        if unique_subjects_count == 3:
                            triple_gold = passive_effects.get("triple_subject_gold_bonus", 0)
                            if triple_gold > 0:
                                profile.gold += triple_gold
                except Exception:
                    pass

                # Twin Souls split, Null Zone conversion, Gambler's Ledger
                # redirect -- were correctly wired into _complete_task_logic
                # and TrainingLogView, but never into this path at all, so a
                # linked Pomodoro session silently ignored all 3 mutators.
                if "twin_souls" in active_ids and active_codes:
                    from api.models import RecruitedAlly

                    active_recruited = RecruitedAlly.objects.filter(
                        user_profile=profile, ally_code__in=active_codes
                    )
                    least_xp_ally = active_recruited.order_by(
                        "total_xp_received", "recruited_at"
                    ).first()
                    if least_xp_ally is not None:
                        ally_xp_share = int(xp_earned * 0.15)
                        ally_gold_share = int(gold_earned * 0.15)

                        xp_earned -= ally_xp_share
                        gold_earned -= ally_gold_share

                        least_xp_ally.total_xp_received += ally_xp_share
                        least_xp_ally.save(update_fields=["total_xp_received"])

                if "null_zone" in active_ids:
                    gold_earned += int(xp_earned * 0.5)
                    xp_earned = 0

                if "gamblers_ledger" in active_ids:
                    profile.ledger_gold += gold_earned
                    gold_earned = 0

                training_session = TrainingSession.objects.create(
                    user_profile=profile,
                    activity_key=activity_key,
                    hours=hours,
                    focus_rating=float(eff_rating),
                    efficiency=eff_total,
                    xp_earned=xp_earned,
                    gf_gain=gf_gain,
                    gc_gain=gc_gain,
                    ps_gain=ps_gain,
                    vm_gain=vm_gain,
                )

                from api.services.profile_service import gain_xp

                gain_xp(profile, xp_earned)
                profile.rank_xp = max(0, profile.rank_xp + xp_earned)
                profile.gold += gold_earned

                # UserStats -- same counters _complete_task_logic updates for
                # Task completions (total_tasks_completed/total_gold_earned/
                # prayer_sessions feed title_service's milestone titles); a
                # linked Pomodoro session is real progress too and was
                # silently excluded from them before.
                from api.models import UserStats as _UserStats

                _stats, _ = _UserStats.objects.get_or_create(user=request.user)
                _stats.total_tasks_completed += 1
                _stats.total_gold_earned += gold_earned
                if task_category == "Prayer/Meditation":
                    _stats.prayer_sessions += 1
                _stats.save(
                    update_fields=["total_tasks_completed", "total_gold_earned", "prayer_sessions"]
                )

                # Category streak tracking -- Echo/Mirror/Diversity Lock/Deja Vu
                # all key off this; without it a linked Pomodoro was invisible
                # to "did the last session use the same/different category" checks.
                if mastery:
                    today_str = str(timezone.now().date())
                    streaks = dict(profile.category_streaks or {})
                    cat_data = streaks.get(mastery)
                    if not isinstance(cat_data, dict):
                        cat_data = {"days": 1, "last_active_date": today_str}
                    else:
                        last_active_str = cat_data.get("last_active_date")
                        if last_active_str and last_active_str != today_str:
                            try:
                                from datetime import datetime as _dt

                                last_active_date = _dt.strptime(
                                    str(last_active_str), "%Y-%m-%d"
                                ).date()
                                yesterday = timezone.now().date() - timedelta(days=1)
                                cat_data["days"] = (
                                    cat_data.get("days", 0) + 1
                                    if last_active_date == yesterday
                                    else 1
                                )
                            except Exception:
                                cat_data["days"] = 1
                            cat_data["last_active_date"] = today_str
                    streaks[mastery] = cat_data
                    profile.category_streaks = streaks

                if task_category:
                    if profile.last_completed_category == task_category:
                        profile.same_category_streak += 1
                    else:
                        profile.same_category_streak = 1
                        profile.last_completed_category = task_category

                # volatile mutator's tier counter -- see activities_completed_today
                profile.activities_completed_today += 1

                # Boss damage -- a linked Pomodoro is a study session like any
                # other and should deal damage like one; previously it dealt none.
                # Reuses training_reward_calc (real tier) instead of a
                # hardcoded "medium", consistent with the XP/Gold above.
                from api.services.mechanics import apply_boss_damage

                pwr_dmg = outcome.get("damage_dealt", 10)
                final_damage_dealt = int(
                    (training_reward_calc["dmg"] + pwr_dmg)
                    * profile.damage_multiplier
                    * mutator_effects.get("mirror_boss_dmg_mult", 1.0)
                    * session_skills["boss_dmg_mult"]
                )
                # Kage L5 Executioner: 5x damage to boss below 15% HP -- same
                # gap as Training Log had (only wired into the Habit/Daily/
                # Todo path originally).
                if recruited_allies.get("kage", 0) >= 5:
                    from api.models import BossEncounter as _BossEncounter

                    _kage_encounter = _BossEncounter.objects.filter(
                        user=request.user, is_defeated=False
                    ).first()
                    if (
                        _kage_encounter
                        and _kage_encounter.boss
                        and _kage_encounter.hp_current
                        < _kage_encounter.boss.hp_max * 0.15
                    ):
                        final_damage_dealt *= 5

                if session_skills["blood_harvest_active"]:
                    vamp_heal = max(1, int(final_damage_dealt * 0.20))
                    profile.hp = min(profile.max_hp, profile.hp + vamp_heal)

                combat_result = apply_boss_damage(
                    request.user, final_damage_dealt, outcome.get("is_crit", False)
                )

                profile.save(
                    update_fields=[
                        "gold",
                        "rank_xp",
                        "gf",
                        "gc",
                        "ps",
                        "vm",
                        "last_training_at",
                        "humanities_xp",
                        "category_streaks",
                        "last_completed_category",
                        "same_category_streak",
                        "activities_completed_today",
                        # record_zero_hour_gold() above mutates
                        # profile.active_mutators in place (accumulating
                        # withheld Gold) -- must be in update_fields or the
                        # save silently drops it.
                        "active_mutators",
                        # apply_session_active_skills() (Quantum Optimization/
                        # Eye of the Storm mana+heal) and the Blood Harvest
                        # vampiric heal just above both mutate hp/mana in
                        # place -- same silent-drop risk as active_mutators.
                        "hp",
                        "mana",
                        # Gambler's Ledger redirects Gold into ledger_gold
                        # instead of granting it directly -- same silent-drop
                        # risk: without this, the redirect happened in memory
                        # but never reached the database.
                        "ledger_gold",
                    ]
                )
            else:
                # Standalone (unlinked) session: no activity/allies/mutators context
                # to apply stats against, so keep the flat baseline reward.
                gold_earned = base_gold
                xp_earned = base_xp
                breakdown = []
                combat_result = None

                from api.services.profile_service import gain_xp

                gain_xp(profile, xp_earned)
                profile.rank_xp = max(0, profile.rank_xp + xp_earned)
                profile.gold += gold_earned
                profile.save(update_fields=["gold", "rank_xp"])

            try:
                from api.models import UserActivityLog

                pom_title = task.title if task else (activity_key or focus_label or f"Pomodoro ({duration}m)")
                pom_cat = task.category if task else "Focus"
                UserActivityLog.objects.create(
                    user=request.user,
                    activity_type=UserActivityLog.ActivityType.POMODORO,
                    task=task,
                    title=pom_title,
                    category=pom_cat,
                    icon="⏱️",
                    hours=hours,
                    focus_rating=float(rating) if rating else None,
                    xp_earned=xp_earned,
                    gold_earned=gold_earned,
                    boss_damage=combat_result.get("damage_dealt", 0) if combat_result else 0,
                    cognitive_gains={
                        "gf": gf_gain if activity_key else 0,
                        "gc": gc_gain if activity_key else 0,
                        "ps": ps_gain if activity_key else 0,
                        "vm": vm_gain if activity_key else 0,
                    }
                    if activity_key
                    else {},
                    metadata={
                        "duration_minutes": duration,
                        "activity_key": activity_key,
                        "breakdown": breakdown,
                    },
                )
            except Exception as e:
                logger.warning("Failed to create UserActivityLog for pomodoro: %s", e)

        return Response(
            {
                "success": True,
                "session_id": session.id,
                "training_session_id": training_session.id if training_session else None,
                "gold_earned": gold_earned,
                "xp_earned": xp_earned,
                "hours_logged": hours,
                "combat": combat_result,
                "breakdown": breakdown,
            }
        )
