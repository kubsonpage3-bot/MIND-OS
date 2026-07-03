"""
Party serializers — public-only profile fields exposed to party members.

Public field list (approved in Phase 0 audit):
  username, level, rank_xp, streak, character_class,
  prestige_count, hp, max_hp, rank_info.current_id
"""

from rest_framework import serializers
from api.models import Party, UserProfile


class PartyMemberProfileSerializer(serializers.ModelSerializer):
    """
    Read-only public profile for a party member.
    Deliberately excludes: gold, xp, mana, gf/gc/ps/vm, rival_data,
    active_mutators, email, inventory, and all multipliers.
    """

    username = serializers.CharField(source="user.username", read_only=True)
    max_hp = serializers.SerializerMethodField()
    rank_info = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "username",
            "level",
            "rank_xp",
            "streak",
            "character_class",
            "prestige_count",
            "hp",
            "max_hp",
            "rank_info",
        )
        read_only_fields = fields

    def get_max_hp(self, obj) -> int:
        return obj.max_hp

    def get_rank_info(self, obj) -> dict:
        from api.services.profile_service import get_rank_info

        info = get_rank_info(obj)
        # Only expose the rank ID — not the full thresholds list
        return {"current_id": info.get("current_id", "F")}


class PartySerializer(serializers.ModelSerializer):
    """
    Full party representation including the list of member public profiles.
    """

    members = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = ("id", "name", "invite_code", "created_at", "member_count", "members")
        read_only_fields = fields

    def get_members(self, obj):
        profiles = UserProfile.objects.filter(
            user__party_membership__party=obj
        ).select_related("user")
        return PartyMemberProfileSerializer(profiles, many=True).data

    def get_member_count(self, obj) -> int:
        return obj.memberships.count()
