import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from api.models import UserProfile, TrainingSession

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Applies daily mutator ticks (Loan Shark, Cursed Clock, Compound)."

    def handle(self, *args, **options):
        self.stdout.write("Starting daily mutator tick...")

        # We process all users that might have active mutators.
        # Active mutators is a JSON list
        profiles = UserProfile.objects.exclude(active_mutators__isnull=True).exclude(
            active_mutators=[]
        )

        count = 0
        today = timezone.now().date()

        for profile in profiles:
            mutators = profile.active_mutators
            if not mutators:
                continue

            active_list = (
                mutators.get("active", [])
                if isinstance(mutators, dict)
                else (mutators if isinstance(mutators, list) else [])
            )
            if not active_list:
                continue

            # Extract IDs whether it's a list of strings or list of dicts
            active_ids = [
                m.get("id") if isinstance(m, dict) else m for m in active_list
            ]

            # Check if any of the targeted mutators are active
            target_mutators = {"loan_shark", "cursed_clock", "compound"}
            if not any(m in active_ids for m in target_mutators):
                continue

            with transaction.atomic():
                # Lock the row for atomic update in python memory
                p = UserProfile.objects.select_for_update().get(id=profile.id)

                # Check if we already ran for today to avoid double-ticks
                if p.last_daily_cron_at == today:
                    continue

                initial_gold = p.gold

                # 1. Loan Shark: Deduct 30G
                if "loan_shark" in active_ids:
                    p.gold = max(0, p.gold - 30)
                    logger.info(f"Loan Shark applied for {p.user.username}: -30G")

                # 2. Cursed Clock: Deduct 2G per idle hour (14 hours max)
                if "cursed_clock" in active_ids:
                    # Sum hours from today's training sessions
                    # In a timezone-aware context, we check sessions created today
                    sessions = TrainingSession.objects.filter(
                        user_profile=p, created_at__date=today
                    )
                    logged_hours = (
                        sessions.aggregate(total_hours=Sum("hours"))["total_hours"]
                        or 0.0
                    )

                    idle_hours = max(0, 14.0 - logged_hours)
                    penalty = int(idle_hours * 2)
                    p.gold = max(0, p.gold - penalty)
                    logger.info(
                        f"Cursed Clock applied for {p.user.username}: "
                        f"{logged_hours}h logged, {idle_hours}h idle, "
                        f"penalty: -{penalty}G"
                    )

                # 3. Compound: Add +1G per 100G of the remaining balance
                if "compound" in active_ids:
                    # Calculate on the balance AFTER deductions
                    interest = (p.gold // 100) * 1
                    p.gold += interest
                    logger.info(
                        f"Compound applied for {p.user.username}: "
                        f"+{interest}G on {p.gold - interest}G balance"
                    )

                # Mark cron as run
                p.last_daily_cron_at = today
                p.save(update_fields=["gold", "last_daily_cron_at"])
                count += 1

                self.stdout.write(
                    f"Processed mutators for {p.user.username}: "
                    f"Gold changed from {initial_gold} to {p.gold}"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Finished daily mutator tick. Processed {count} users."
            )
        )
