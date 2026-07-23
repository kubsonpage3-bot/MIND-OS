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
        serializer.save(user=self.request.user)

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
        rating = int(request.data.get("rating", 3))
        rating = max(1, min(5, rating))

        with transaction.atomic():
            active = (
                ActivePomodoroSession.objects.select_for_update()
                .filter(user=request.user)
                .first()
            )
            duration = active.duration_minutes if active else 25
            mode = active.mode if active else "work"
            activity_key = active.linked_activity_key if active else None
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
            gold_earned = max(10, duration * 2)
            xp_earned = max(15, duration * 3)
            profile.gold += gold_earned
            profile.xp += xp_earned
            profile.save(update_fields=["gold", "xp"])

        return Response(
            {
                "success": True,
                "session_id": session.id,
                "gold_earned": gold_earned,
                "xp_earned": xp_earned,
            }
        )
