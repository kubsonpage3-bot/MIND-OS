"""
Management command: backfill_history_logs

Creates UserActivityLog entries for existing UserAchievement
and defeated BossEncounter records that were created before
the ACHIEVEMENT / BOSS_DEFEAT activity types were introduced.

Safe to run multiple times - skips entries that already exist.
"""

import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import UserActivityLog, UserAchievement, BossEncounter
from api.services.achievement_service import ACHIEVEMENTS_SSOT

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Backfill UserActivityLog entries for old achievements and boss defeats."

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

        total_ach = 0
        total_boss = 0

        for user in users:
            ach_created, boss_created = self._backfill_user(user, dry_run)
            total_ach += ach_created
            total_boss += boss_created
            if ach_created or boss_created:
                self.stdout.write(
                    f"  {user.username}: +{ach_created} achievements, +{boss_created} boss defeats"
                )

        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}Done. Achievements: {total_ach}, Boss defeats: {total_boss}"
            )
        )

    @transaction.atomic
    def _backfill_user(self, user, dry_run: bool):
        # ── Existing log keys to avoid duplicates ──────────────────────────
        existing_ach_titles = set(
            UserActivityLog.objects.filter(
                user=user,
                activity_type=UserActivityLog.ActivityType.ACHIEVEMENT,
            ).values_list("title", flat=True)
        )
        existing_boss_titles = set(
            UserActivityLog.objects.filter(
                user=user,
                activity_type=UserActivityLog.ActivityType.BOSS_DEFEAT,
            ).values_list("title", flat=True)
        )

        ach_count = 0
        boss_count = 0

        # ── Achievements ───────────────────────────────────────────────────
        for ua in UserAchievement.objects.filter(user=user).select_related():
            ach_id = ua.achievement_id
            if ach_id in existing_ach_titles:
                continue
            ach_data = ACHIEVEMENTS_SSOT.get(ach_id, {})
            gold = ach_data.get("gold", 0) if isinstance(ach_data, dict) else 0
            if not dry_run:
                UserActivityLog.objects.create(
                    user=user,
                    activity_type=UserActivityLog.ActivityType.ACHIEVEMENT,
                    title=ach_id,
                    gold_earned=gold,
                    xp_earned=0,
                    created_at=ua.unlocked_at,
                )
            ach_count += 1

        # ── Boss defeats ───────────────────────────────────────────────────
        defeated = BossEncounter.objects.filter(
            user=user, is_defeated=True
        ).select_related("boss")
        for enc in defeated:
            boss_name = enc.boss.name
            if boss_name in existing_boss_titles:
                continue
            final_xp = int(enc.boss.reward_xp * enc.reward_multiplier)
            final_gold = int(enc.boss.reward_gold * enc.reward_multiplier)
            sp_reward = 3 + enc.boss.level * 2
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

        return ach_count, boss_count
