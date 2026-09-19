import datetime

from rest_framework import serializers
from api.models import CalendarEvent

ALL_DAY_START = datetime.time(0, 0)
ALL_DAY_END = datetime.time(23, 59)


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
            "all_day",
            "color",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {
            # An all-day event has no meaningful times.
            "start_time": {"required": False},
            "end_time": {"required": False},
        }

    def validate(self, attrs):
        def current(name):
            if name in attrs:
                return attrs[name]
            return getattr(self.instance, name, None) if self.instance else None

        if current("all_day"):
            attrs["start_time"] = ALL_DAY_START
            attrs["end_time"] = ALL_DAY_END
            return attrs

        start, end = current("start_time"), current("end_time")
        if start is None or end is None:
            raise serializers.ValidationError(
                {"start_time": "Start and end time are required for a timed event."}
            )
        # Events live within a single day: an end at/before the start (22:00-02:00,
        # 09:00-09:00) rendered as an unusable sliver and broke overlap layout.
        if end <= start:
            raise serializers.ValidationError(
                {"end_time": "End time must be after the start time."}
            )
        return attrs
