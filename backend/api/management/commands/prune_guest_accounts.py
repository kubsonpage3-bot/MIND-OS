from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Prunes guest accounts that have been inactive for more than 30 days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Actually perform the deletion. Without this flag, it does a dry run.",
        )

    def handle(self, *args, **options):
        confirm = options["confirm"]

        # Calculate cutoff date: 30 days ago
        cutoff_date = timezone.now() - timedelta(days=30)

        # Find users whose profile is_guest=True AND
        # (last_login is older than 30 days OR (last_login is None AND date_joined is older than 30 days))
        users_to_delete = User.objects.filter(profile__is_guest=True).filter(
            Q(last_login__lt=cutoff_date)
            | Q(last_login__isnull=True, date_joined__lt=cutoff_date)
        )

        count = users_to_delete.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS("No inactive guest accounts found to prune.")
            )
            return

        if not confirm:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Found {count} inactive guest account(s) to delete."
                )
            )
            # Find the oldest and newest last_login in the batch to give context without PII
            dates = [u.last_login or u.date_joined for u in users_to_delete]
            if dates:
                self.stdout.write(
                    f"Oldest inactive account date: {min(dates).strftime('%Y-%m-%d %H:%M:%S')}"
                )
                self.stdout.write(
                    f"Newest inactive account date: {max(dates).strftime('%Y-%m-%d %H:%M:%S')}"
                )

            self.stdout.write(
                self.style.NOTICE(
                    "\nRun the command with --confirm to actually delete them."
                )
            )
        else:
            self.stdout.write(f"Deleting {count} inactive guest account(s)...")

            # Record count for logging
            deleted_count = count

            # Since User is the main model, deleting the User deletes the UserProfile (CASCADE)
            # and other related data.
            deleted_objects, dict_count = users_to_delete.delete()

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully deleted {deleted_count} guest account(s)."
                )
            )
            logger.info(
                f"Pruned {deleted_count} inactive guest accounts. Detail: {dict_count}"
            )
