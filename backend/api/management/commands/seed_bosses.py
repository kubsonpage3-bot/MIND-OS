from typing import Any
from django.core.management.base import BaseCommand
from api.models import Boss

from api.constants import SCROLL_BOSSES

SCROLLS = SCROLL_BOSSES


RANK_TO_LEVEL = {
    "E": 1,
    "D": 2,
    "C": 3,
    "B": 4,
    "A": 5,
    "S": 6,
    "SS": 7,
    "SSS": 8,
}


class Command(BaseCommand):
    help = "Seeds initial boss templates"

    def handle(self, *args, **kwargs):
        created_count = 0
        for b_raw in SCROLLS:
            b: dict[str, Any] = b_raw  # type: ignore[assignment]
            boss, created = Boss.objects.update_or_create(
                id_name=b["id"],
                defaults={
                    "name": b["name"],
                    "hp_max": b["bossHP"],
                    "level": RANK_TO_LEVEL.get(b["rank"], 1),
                    "reward_gold": b["reward"]["gold"],
                    "reward_xp": b["reward"]["xp"],
                    "drop_item_id": b["uniqueItem"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {created_count} new Boss templates!"
            )
        )
