from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)


class Command(BaseCommand):
    help = "Emergency password reset for KubsonM"

    def handle(self, *args, **options):
        try:
            u = User.objects.get(username__iexact="KubsonM")
            self.stdout.write(
                self.style.SUCCESS(f"User found: {u.username} | Email: {u.email}")
            )
            self.stdout.write(f"Is Active: {u.is_active}")

            if not u.is_active:
                u.is_active = True
                self.stdout.write(
                    self.style.WARNING("User was inactive, reactivating...")
                )

            u.set_password("NuclearReset123!")
            u.save()
            self.stdout.write(
                self.style.SUCCESS("Password successfully reset to NuclearReset123!")
            )

            tokens = OutstandingToken.objects.filter(user=u)
            blacklisted = BlacklistedToken.objects.filter(token__in=tokens)
            count = blacklisted.count()
            if count > 0:
                blacklisted.delete()
                self.stdout.write(
                    self.style.SUCCESS(f"Cleared {count} blacklisted tokens for user.")
                )
            else:
                self.stdout.write("No blacklisted tokens found.")

        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR("User KubsonM does not exist in the database!")
            )
