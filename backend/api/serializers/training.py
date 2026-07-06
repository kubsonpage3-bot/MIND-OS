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
        max_value=1.0,
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

    def validate_activity(self, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned.startswith("custom_task_"):
            return value
        if cleaned not in ALLOWED_ACTIVITIES:
            return "other"
        return cleaned
