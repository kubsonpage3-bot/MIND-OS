from rest_framework import serializers
from .models import BlockedSite, SiteUnlock


class BlockedSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlockedSite
        fields = [
            "id",
            "domain",
            "unlock_cost",
            "unlock_duration_minutes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SiteUnlockSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = SiteUnlock
        fields = ["domain", "unlocked_until", "gold_spent", "is_active"]

    def get_is_active(self, obj):
        return obj.is_active()
