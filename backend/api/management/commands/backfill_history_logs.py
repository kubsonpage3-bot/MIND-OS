"""
Management command: backfill_history_logs

Creates UserActivityLog entries for defeated BossEncounter records
that were created before the BOSS_DEFEAT activity type was introduced.

Safe to run multiple times - skips entries that already exist.
"""

import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import UserActivityLog, BossEncounter

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Backfill UserActivityLog entries for old boss defeats."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Limit backfill to a specific username (default: all users).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing to DB.",
        )

    def handle(self, *args, **options):
        username = options["username"]
        dry_run = options["dry_run"]

        if username:
            users = User.objects.filter(username=username)
            if not users.exists():
                self.stdout.write(self.style.ERROR(f"User '{username}' not found."))
                return
        else:
            users = User.objects.all()

        total_boss = 0

        for user in users:
            boss_created = self._backfill_user(user, dry_run)
            total_boss += boss_created
            if boss_created:
                self.stdout.write(
                    f"  {user.username}: +{boss_created} boss defeats"
                )

        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Done. Boss defeats backfilled: {total_boss}"
            )
        )

    @transaction.atomic
    def _backfill_user(self, user, dry_run: bool):
        existing_boss_titles = set(
            UserActivityLog.objects.filter(
                user=user,
                activity_type=UserActivityLog.ActivityType.BOSS_DEFEAT,
            ).values_list("title", flat=True)
        )

        boss_count = 0

        defeated = BossEncounter.objects.filter(
            user=user, is_defeated=True
        ).select_related("boss")
        for enc in defeated:
            boss_name = enc.boss.name
            if boss_name in existing_boss_titles:
                continue
            final_xp = int(enc.boss.reward_xp * enc.reward_multiplier)
            from api.constants import BOSS_RANK_SP, RANK_TO_LEVEL
            sp_reward = getattr(enc.boss, "reward_sp", None) or BOSS_RANK_SP.get(
                RANK_TO_LEVEL.get(enc.boss.level, "E"), 3
            )
            if not dry_run:
                UserActivityLog.objects.create(
                    user=user,
                    activity_type=UserActivityLog.ActivityType.BOSS_DEFEAT,
                    title=boss_name,
                    xp_earned=final_xp,
                    gold_earned=final_gold,
                    metadata={
                        "boss_level": enc.boss.level,
                        "sp_reward": sp_reward,
                        "backfilled": True,
                    },
                    created_at=enc.expires_at or enc.started_at,
                )
            boss_count += 1

        return boss_count
