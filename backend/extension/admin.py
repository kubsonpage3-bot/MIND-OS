from django.contrib import admin
from .models import BlockedSite, ExtensionToken, PairingCode, SiteUnlock


@admin.register(ExtensionToken)
class ExtensionTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "last_used_at"]
    search_fields = ["user__username"]


@admin.register(PairingCode)
class PairingCodeAdmin(admin.ModelAdmin):
    list_display = ["user", "code", "expires_at", "used"]
    search_fields = ["user__username"]


@admin.register(BlockedSite)
class BlockedSiteAdmin(admin.ModelAdmin):
    list_display = ["user", "domain", "unlock_cost", "unlock_duration_minutes"]
    search_fields = ["user__username", "domain"]


@admin.register(SiteUnlock)
class SiteUnlockAdmin(admin.ModelAdmin):
    list_display = ["user", "domain", "unlocked_until", "gold_spent"]
    search_fields = ["user__username", "domain"]
