from rest_framework import serializers
from api.models import PomodoroSession


class PomodoroSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PomodoroSession
        fields = ["id", "date", "started_at", "duration", "mode", "label", "completed"]
        read_only_fields = ["id", "started_at", "date"]
