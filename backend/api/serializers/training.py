from rest_framework import serializers


ALLOWED_ACTIVITIES = {
    "mathematics",
    "physics",
    "chess",
    "coding",
    "exercise",
    "running",
    "english",
    "german",
    "languages",
    "prayer",
    "reading",
    "philosophy",
    "history",
    "biology",
    "chemistry",
    "meditation",
    "other",
}


class TrainingLogSerializer(serializers.Serializer):
    """
    Validates incoming payload for POST /api/training/log/.
    Prevents XP farming via server-side efficiency recalculation.
    """

    hours = serializers.FloatField(
        min_value=0.1,
        max_value=16.0,  # max 16 hours per session — realistic limit
    )
    focus_rating = serializers.IntegerField(
        min_value=1,
        max_value=10,
    )
    efficiency = serializers.FloatField(
        min_value=0.0,
        required=False,
        default=1.0,
    )
    activity = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )
    notes = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
    )
    flat_xp_bonus = serializers.IntegerField(
        required=False,
        default=0,
    )

    def validate(self, data):
        request = self.context.get("request")
        if not request or not hasattr(request, "user"):
            return data

        from api.models import UserProfile, TrainingSession
        from django.utils import timezone
        from django.db.models import Sum
        from api.services.mechanics import calculate_training_efficiency

        profile = UserProfile.objects.get(user=request.user)
        today = timezone.now().date()

        hours = data.get("hours", 0.0)

        # Enforce Time Dilation floor (2.0 hours)
        active_mutators = profile.active_mutators or {}
        active_list = (
            active_mutators.get("active", [])
            if isinstance(active_mutators, dict)
            else []
        )
        active_ids = [m.get("id") if isinstance(m, dict) else m for m in active_list]
        if "time_dilation" in active_ids and hours < 2.0:
            raise serializers.ValidationError(
                {"hours": "Time Dilation requires a minimum of 2.0 hours per session."}
            )
        focus = float(data.get("focus_rating", 7))
        from api.models import ActiveEffect

        meditation_effect = ActiveEffect.objects.filter(
            user=profile.user, skill_id="meditation"
        ).first()
        if meditation_effect and meditation_effect.data.get("sessionsRemaining", 0) > 0:
            focus = min(10.0, focus * 1.30)
            data["focus_rating"] = focus

        activity = data.get("activity", "other")
        client_eff = data.get("efficiency", 1.0)
        streak_days = profile.streak

        hours_today = (
            TrainingSession.objects.filter(
                user_profile=profile, created_at__date=today
            ).aggregate(Sum("hours"))["hours__sum"]
            or 0.0
        )

        subject_hours_today = (
            TrainingSession.objects.filter(
                user_profile=profile, activity_key=activity, created_at__date=today
            ).aggregate(Sum("hours"))["hours__sum"]
            or 0.0
        )

        computed_eff = calculate_training_efficiency(
            profile, focus, hours, streak_days, hours_today, subject_hours_today
        )

        if abs(client_eff - computed_eff) > 0.02:
            raise serializers.ValidationError(
                {
                    "efficiency": f"Efficiency mismatch. Server calculated {computed_eff}, client submitted {client_eff}."
                }
            )

        return data

    def validate_activity(self, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned.startswith("custom_task_"):
            return value
        if cleaned not in ALLOWED_ACTIVITIES:
            return "other"
        return cleaned
