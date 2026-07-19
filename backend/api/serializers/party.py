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
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    joined = serializers.DateTimeField(source="user.date_joined", read_only=True)
    character_image = serializers.ImageField(source="avatar", read_only=True)
    max_hp = serializers.SerializerMethodField()
    rank_info = serializers.SerializerMethodField()
    max_streak = serializers.SerializerMethodField()
    total_tasks_completed = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "user_id",
            "username",
            "joined",
            "character_image",
            "level",
            "rank_xp",
            "streak",
            "character_class",
            "prestige_count",
            "hp",
            "max_hp",
            "rank_info",
            "total_tasks_completed",
            "max_streak",
            "weekly_xp",
            "role",
        )
        read_only_fields = fields

    def get_max_hp(self, obj) -> int:
        return obj.max_hp

    def get_max_streak(self, obj) -> int:
        try:
            stats = getattr(obj.user, "stats", None)
            stat_max = stats.max_streak if stats else 0
            return max(obj.streak or 0, stat_max or 0)
        except Exception:
            return obj.streak or 0

    def get_total_tasks_completed(self, obj) -> int:
        from api.models import Task

        return Task.objects.filter(user=obj.user, is_completed=True).count()

    def get_rank_info(self, obj) -> dict:
        from api.services.profile_service import get_rank_info

        info = get_rank_info(obj)
        current_id = info.get("current_id", "F")
        thresholds = info.get("thresholds", [])

        next_t = None
        for i, t in enumerate(thresholds):
            if t["id"] == current_id and i + 1 < len(thresholds):
                next_t = thresholds[i + 1]["min"]
                break

        return {
            "current_id": current_id,
            "next_threshold": next_t,
            "is_ascendant": info.get("is_ascendant", False),
            "ascendant_level": info.get("ascendant_level", 1),
        }

    def get_role(self, obj) -> str:
        try:
            return obj.user.party_membership.role
        except Exception:
            return "MEMBER"


class PartySerializer(serializers.ModelSerializer):
    """
    Full party representation including the list of member public profiles.
    """

    members = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    created_by = serializers.IntegerField(source="created_by.id", read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = Party
        fields = (
            "id",
            "name",
            "invite_code",
            "created_at",
            "member_count",
            "members",
            "created_by",
            "created_by_username",
        )
        read_only_fields = fields

    def get_members(self, obj):
        profiles = UserProfile.objects.filter(
            user__party_membership__party=obj
        ).select_related("user")
        return PartyMemberProfileSerializer(profiles, many=True).data

    def get_member_count(self, obj) -> int:
        return obj.memberships.count()


class PartyEventReactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        from api.models import PartyEventReaction

        model = PartyEventReaction
        fields = ("id", "username", "emoji", "created_at")
        read_only_fields = fields


class PartyEventSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    content = serializers.CharField(source="message", read_only=True)
    reactions = PartyEventReactionSerializer(many=True, read_only=True)
    user_reacted = serializers.SerializerMethodField()

    class Meta:
        from api.models import PartyEvent

        model = PartyEvent
        fields = (
            "id",
            "username",
            "event_type",
            "content",
            "created_at",
            "reactions",
            "user_reacted",
        )
        read_only_fields = fields

    def get_username(self, obj) -> str:
        if obj.member and obj.member.user:
            return obj.member.user.username
        return obj.metadata.get("username", "Unknown Member")

    def get_user_reacted(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            # We can optimize this later with Prefetch or annotation
            reaction = obj.reactions.filter(user=request.user).first()
            if reaction:
                return reaction.emoji
        return None
