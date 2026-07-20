import random
from django.core.management.base import BaseCommand
from api.models import Boss, Item, InventoryItem


class Command(BaseCommand):
    help = "Syncs Boss Drop flags and retroactively rolls stats for players who have these items."

    def handle(self, *args, **options):
        RANK_TO_LEVEL = {
            1: "E",
            2: "D",
            3: "C",
            4: "B",
            5: "A",
            6: "S",
            7: "SS",
            8: "SSS",
        }

        BOSS_RANK_STATS = {
            "E": {"count": 1, "min": 1, "max": 1},
            "D": {"count": 1, "min": 1, "max": 2},
            "C": {"count": 2, "min": 2, "max": 2},
            "B": {"count": 2, "min": 2, "max": 3},
            "A": {"count": 3, "min": 3, "max": 3},
            "S": {"count": 3, "min": 3, "max": 4},
            "SS": {"count": 4, "min": 4, "max": 4},
            "SSS": {"count": 4, "min": 4, "max": 5},
        }
        POSSIBLE_STATS = ["pwr", "def", "foc", "mem", "spd", "lck"]

        bosses = Boss.objects.all()
        if not bosses.exists():
            self.stdout.write(
                self.style.WARNING("No Bosses found. Have you run seed_bosses?")
            )
            return

        synced_items = 0
        backfilled_invs = 0

        for boss in bosses:
            if not boss.drop_item_id:
                continue

            try:
                item = Item.objects.get(code=boss.drop_item_id)
                item.is_purchasable = False
                item.source = "boss_drop"
                rank = RANK_TO_LEVEL.get(boss.level, "E")
                item.boss_rank = rank
                item.save()
                synced_items += 1

                # Backfill existing InventoryItem rows so players keep stats
                # This is idempotent because we check if stat_bonuses is already set
                for inv in InventoryItem.objects.filter(item=item):
                    if not inv.stat_bonuses:
                        rules = BOSS_RANK_STATS[rank]
                        chosen_stats = random.sample(POSSIBLE_STATS, rules["count"])
                        rolled_stats = {
                            s: random.randint(rules["min"], rules["max"])
                            for s in chosen_stats
                        }
                        inv.stat_bonuses = rolled_stats
                        inv.save(update_fields=["stat_bonuses"])
                        backfilled_invs += 1
            except Item.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f"Item {boss.drop_item_id} for boss {boss.id} not found."
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(f"Successfully synced {synced_items} boss drop items.")
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Backfilled stat_bonuses on {backfilled_invs} existing inventory items."
            )
        )
