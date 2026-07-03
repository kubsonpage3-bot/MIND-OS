from rest_framework import serializers
from api.models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = (
            "id",
            "title",
            "description",
            "date",
            "start_time",
            "end_time",
            "color",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
