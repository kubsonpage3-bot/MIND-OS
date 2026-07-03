from django.core.management.base import BaseCommand
from django.db.models import Count
from api.models import FeatureEvent


class Command(BaseCommand):
    help = "Summarize FeatureEvent counts by event_name"

    def handle(self, *args, **options):
        events = (
            FeatureEvent.objects.values("event_name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        self.stdout.write("Feature Event Summary:")
        self.stdout.write("-" * 40)

        if not events:
            self.stdout.write("No events logged yet.")
            return

        for event in events:
            self.stdout.write(f"{event['event_name']:<30} | {event['count']}")
        self.stdout.write("-" * 40)
