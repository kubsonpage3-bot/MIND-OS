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
    Prevents XP farming via extreme hour/focus values.
    """

    hours = serializers.FloatField(min_value=0.083, max_value=24.0)
    focus_rating = serializers.FloatField(min_value=1.0, max_value=10.0)
    efficiency = serializers.FloatField(min_value=0.0, max_value=1.0, default=1.0)
    activity = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default="other"
    )
    flat_xp_bonus = serializers.IntegerField(min_value=0, max_value=500, default=0)

    def validate_activity(self, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned.startswith("custom_task_"):
            return value
        if cleaned not in ALLOWED_ACTIVITIES:
            return "other"
        return cleaned
