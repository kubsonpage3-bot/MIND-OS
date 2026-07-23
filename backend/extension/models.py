import secrets
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class PairingCode(models.Model):
    """One-time code generated in the web app, used once to pair the extension."""

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="pairing_codes"
    )
    code = models.CharField(max_length=16, unique=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-expires_at"]

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = secrets.token_urlsafe(8).upper()[:12]
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    def __str__(self):
        return f"{self.user.username} — {self.code}"


class ExtensionToken(models.Model):
    """Long-lived scoped token stored in browser.storage.local."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="extension_token"
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(48)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} extension token"


class BlockedSite(models.Model):
    """User's site blocklist — synced to backend."""

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="blocked_sites"
    )
    domain = models.CharField(max_length=255)
    # Per-site customizable cost & duration
    unlock_cost = models.PositiveIntegerField(default=100)
    unlock_duration_minutes = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "domain")]
        ordering = ["domain"]

    def __str__(self):
        return f"{self.user.username} blocks {self.domain}"


class SiteUnlock(models.Model):
    """Active temporary unlock — paid with gold, expires automatically."""

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="site_unlocks"
    )
    domain = models.CharField(max_length=255)
    unlocked_until = models.DateTimeField()
    gold_spent = models.PositiveIntegerField()

    class Meta:
        unique_together = [("user", "domain")]

    def is_active(self):
        return timezone.now() < self.unlocked_until

    def __str__(self):
        return (
            f"{self.user.username} unlocked {self.domain} until {self.unlocked_until}"
        )
