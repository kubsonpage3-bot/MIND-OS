"""
Management command: purge_achievements

Completely purges all user achievement records from history and database.
Can be targeted to a specific user by email or username, or run globally.
"""

import logging
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from api.models import UserActivityLog

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Purge all achievement history records globally or for a specific user (e.g. kubsonpage3@gmail.com)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default=None,
            help="Purge achievements for user with this email (e.g. kubsonpage3@gmail.com).",
        )
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help="Purge achievements for user with this username.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            default=True,
            help="Purge achievement records globally for all users (default).",
        )

    def handle(self, *args, **options):
        email = options.get("email")
        username = options.get("username")

        with transaction.atomic():
            # 1. Target users filter if specified
            target_users = None
            if email or username:
                query = User.objects.all()
                if email and username:
                    query = query.filter(email=email, username=username)
                elif email:
                    query = query.filter(email__iexact=email)
                elif username:
                    query = query.filter(username__iexact=username)
                target_users = query

                if not target_users.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f"User with email='{email}' / username='{username}' not found in current database. Purging global achievement logs..."
                        )
                    )

            # 2. Delete UserActivityLog entries where activity_type == 'achievement'
            log_qs = UserActivityLog.objects.filter(activity_type="achievement")
            if target_users and target_users.exists():
                log_qs = log_qs.filter(user__in=target_users)

            deleted_logs_count, _ = log_qs.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Deleted {deleted_logs_count} UserActivityLog entries with activity_type='achievement'."
                )
            )

            # 3. Clean up database table api_userachievement if it still exists
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='api_userachievement';"
                    )
                    row = cursor.fetchone()
                    if row:
                        if target_users and target_users.exists():
                            user_ids = list(target_users.values_list("id", flat=True))
                            if user_ids:
                                placeholders = ",".join(["%s"] * len(user_ids))
                                cursor.execute(
                                    f"DELETE FROM api_userachievement WHERE user_id IN ({placeholders});",
                                    user_ids,
                                )
                        else:
                            cursor.execute("DELETE FROM api_userachievement;")
                        self.stdout.write(
                            self.style.SUCCESS("Purged rows from table api_userachievement.")
                        )
            except Exception as e:
                self.stdout.write(
                    self.style.NOTICE(f"Note: api_userachievement table cleanup skipped or already removed: {e}")
                )

            # 4. Explicit verification for kubsonpage3@gmail.com
            kubson_users = User.objects.filter(email__iexact="kubsonpage3@gmail.com")
            if not kubson_users.exists():
                kubson_users = User.objects.filter(username__icontains="kubson")

            for ku in kubson_users:
                user_logs = UserActivityLog.objects.filter(user=ku, activity_type="achievement").count()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[VERIFICATION] User '{ku.username}' (email: {ku.email}): {user_logs} achievement logs remaining."
                    )
                )

            # Global verification
            global_remaining = UserActivityLog.objects.filter(activity_type="achievement").count()
            self.stdout.write(
                self.style.SUCCESS(
                    f"[VERIFICATION] Global remaining achievement activity logs: {global_remaining}."
                )
            )
            self.stdout.write(self.style.SUCCESS("Achievement purge completed successfully."))
