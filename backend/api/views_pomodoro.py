import logging
from datetime import date, timedelta
from django.db.models import Count, Sum
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action

from django.db import transaction
from django.utils import timezone
from api.models import ActivePomodoroSession, PomodoroSession, UserProfile
from api.serializers.pomodoro import PomodoroSessionSerializer

logger = logging.getLogger(__name__)


class PomodoroSessionViewSet(viewsets.ModelViewSet):
    """
    Endpoints for Pomodoro Sessions:
    - GET /api/pomodoro/sessions/
    - POST /api/pomodoro/sessions/
    - GET /api/pomodoro/sessions/heatmap/?days=365
    - GET /api/pomodoro/sessions/stats/
    """

    serializer_class = PomodoroSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PomodoroSession.objects.filter(user=self.request.user).order_by(
            "-started_at"
        )

    def perform_create(self, serializer):
        session = serializer.save(user=self.request.user)
        if session.completed and session.mode == "work":
            ActivePomodoroSession.objects.filter(user=self.request.user).delete()
            profile = UserProfile.objects.filter(user=self.request.user).first()
            if profile:
                duration = session.duration or 25
                gold_earned = max(10, int(duration * 2))
                xp_earned = max(15, int(duration * 3))
                profile.gold += gold_earned
                profile.xp += xp_earned
                profile.rank_xp = max(0, profile.rank_xp + xp_earned)
                profile.save(update_fields=["gold", "xp", "rank_xp"])

                try:
                    from api.models import UserActivityLog

                    UserActivityLog.objects.create(
                        user=self.request.user,
                        activity_type=UserActivityLog.ActivityType.POMODORO,
                        task=None,
                        title=session.label if session.label else f"Pomodoro ({duration}m)",
                        category="Focus",
                        icon="⏱️",
                        hours=round(duration / 60.0, 2),
                        xp_earned=xp_earned,
                        gold_earned=gold_earned,
                        metadata={"duration_minutes": duration, "mode": session.mode},
                    )
                except Exception as e:
                    logger.warning("Failed to create UserActivityLog for pomodoro: %s", e)


    @action(detail=False, methods=["get"])
    def heatmap(self, request):
        """
        Returns an aggregation for GitHub-style heatmap.
        Format: { "YYYY-MM-DD": count, ... }
        """
        days = int(request.query_params.get("days", 365))
        start_date = date.today() - timedelta(days=days)

        # Aggregate counts by date
        data = (
            self.get_queryset()
            .filter(date__gte=start_date, completed=True)
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
        Returns stats: total pomodoros, total hours, etc.
        """
        qs = self.get_queryset().filter(completed=True)
        today = date.today()

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
        active = ActivePomodoroSession.objects.filter(user=request.user).first()
        if not active:
            return Response({"active": False})

        rem = active.remaining_seconds()
        return Response(
            {
                "active": True,
                "linked_activity_key": active.linked_activity_key,
                "duration_minutes": active.duration_minutes,
                "mode": active.mode,
                "is_paused": active.is_paused,
                "remaining_seconds": rem,
                "started_at": active.started_at,
            }
        )

    @action(detail=False, methods=["post"], url_path="active-session/start")
    def active_session_start(self, request):
        activity_key = request.data.get("linked_activity_key")
        duration = int(request.data.get("duration_minutes", 25))
        mode = request.data.get("mode", "work")

        with transaction.atomic():
            active, _ = ActivePomodoroSession.objects.select_for_update().update_or_create(
                user=request.user,
                defaults={
                    "linked_activity_key": activity_key,
                    "duration_minutes": duration,
                    "mode": mode,
                    "started_at": timezone.now(),
                    "is_paused": False,
                    "paused_remaining_seconds": 0,
                },
            )

        return Response(
            {
                "active": True,
                "linked_activity_key": active.linked_activity_key,
                "duration_minutes": active.duration_minutes,
                "mode": active.mode,
                "is_paused": False,
                "remaining_seconds": active.remaining_seconds(),
                "started_at": active.started_at,
            }
        )

    @action(detail=False, methods=["post"], url_path="active-session/pause")
    def active_session_pause(self, request):
        with transaction.atomic():
            active = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            if not active:
                return Response({"active": False}, status=400)

            if active.is_paused:
                # Resume
                remaining = active.paused_remaining_seconds
                total_sec = active.duration_minutes * 60
                elapsed = max(0, total_sec - remaining)
                active.started_at = timezone.now() - timedelta(seconds=elapsed)
                active.is_paused = False
                active.paused_remaining_seconds = 0
            else:
                # Pause
                rem = active.remaining_seconds()
                active.is_paused = True
                active.paused_remaining_seconds = rem

            active.save()

        return Response(
            {
                "active": True,
                "is_paused": active.is_paused,
                "remaining_seconds": active.remaining_seconds(),
            }
        )

    @action(detail=False, methods=["post"], url_path="active-session/reset")
    def active_session_reset(self, request):
        with transaction.atomic():
            ActivePomodoroSession.objects.filter(user=request.user).delete()
        return Response({"active": False})

    @action(detail=False, methods=["post"], url_path="active-session/complete")
    def active_session_complete(self, request):
        rating = int(request.data.get("rating", 7))
        rating = max(1, min(10, rating))

        with transaction.atomic():
            active = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            duration = int(
                request.data.get("duration_minutes")
                or (active.duration_minutes if active else 25)
            )
            mode = request.data.get("mode") or (active.mode if active else "work")
            activity_key = (
                request.data.get("activity_key")
                or request.data.get("linked_activity_key")
                or (active.linked_activity_key if active else None)
            )
            if active:
                active.delete()

            session = PomodoroSession.objects.create(
                user=request.user,
                duration=duration,
                mode=mode,
                label=activity_key or "Focus Session",
                completed=True,
            )

            # Award Gold and XP directly to UserProfile
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            hours = round(duration / 60.0, 2)
            base_gold = max(10, int(duration * 2))
            base_xp = max(15, int(duration * 3))

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

                # Deep concentration: focus minimum counts as 7.0
                eff_rating = max(float(rating), passive_effects.get("min_focus", 0.0))

                xp_mult = mutator_effects.get("xp_mult", 1.0) + passive_effects.get("xp_mult", 1.0) - 1.0
                gold_mult = mutator_effects.get("gold_mult", 1.0) + passive_effects.get("gold_mult", 1.0) - 1.0
                flat_xp_bonus = mutator_effects.get("flat_xp", 0) + passive_effects.get("flat_xp", 0)

                # Reward breakdown -- same shape as TrainingLogView/_complete_task_logic,
                # so History shows *why* a linked Pomodoro paid out what it did.
                from api.services.mechanics import describe_active_sources

                breakdown = [f"Base +{int(base_xp)} XP"]
                breakdown.extend(describe_active_sources(profile))
                if xp_mult != 1.0:
                    breakdown.append(f"Bonuses (mutators/allies/gear/skills) {xp_mult:+.0%}")
                if flat_xp_bonus:
                    breakdown.append(f"Flat bonus +{flat_xp_bonus:g} XP")

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
                    base_gold = int(base_gold * final_gold_mult)

                eff_total = min(1.0, max(0.2, eff_rating / 10.0))
                gains = calculate_cognitive_gains(
                    activity_key, hours, eff_total, profile,
                    mastery_category=task.mastery_category if task else "",
                )

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

                pwr_pct = min(0.50, profile.total_stats.get("pwr", 0) * 0.005)
                if pwr_pct > 0:
                    breakdown.append(f"PWR +{pwr_pct:.1%}")
                if outcome.get("is_crit"):
                    crit_mult = passive_effects.get("crit_damage_mult", 2.0)
                    foc_crit_chance = min(1.0, profile.total_stats.get("foc", 0) * 0.005)
                    breakdown.append(f"Crit! (×{crit_mult:g}, {foc_crit_chance:.1%} chance)")
                if profile.xp_multiplier != 1.0:
                    breakdown.append(f"Gear/Prestige ×{profile.xp_multiplier:.2f}")

                # Godmind: IQ contribution to Rank XP
                if passive_effects.get("godmind_active", False):
                    godmind_bonus = int(
                        (profile.gf + profile.gc + profile.ps + profile.vm) * 0.5
                    )
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

                # Polymath: track unique subjects today
                try:
                    from api.models import UserStats
                    from api.services.mechanics import add_unique_subject_today

                    stats, _ = UserStats.objects.get_or_create(user=request.user)
                    subj = activity_key or (task.category if task else None)
                    if subj:
                        add_unique_subject_today(stats, subj)
                except Exception:
                    pass

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

                # Boss damage -- a linked Pomodoro is a study session like any
                # other and should deal damage like one; previously it dealt none.
                from api.services.rewards_service import training_rewards
                from api.services.mechanics import apply_boss_damage

                dmg_rewards = training_rewards("medium", hours, eff_rating)
                pwr_dmg = outcome.get("damage_dealt", 10)
                final_damage_dealt = int(
                    (dmg_rewards["dmg"] + pwr_dmg)
                    * profile.damage_multiplier
                    * mutator_effects.get("mirror_boss_dmg_mult", 1.0)
                )
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

                pom_title = task.title if task else (activity_key or f"Pomodoro ({duration}m)")
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
