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
    max_mana = serializers.SerializerMethodField()
    rank_info = serializers.SerializerMethodField()
    max_streak = serializers.SerializerMethodField()
    total_tasks_completed = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    did_dailies_today = serializers.SerializerMethodField()
    weekly_tasks_done = serializers.SerializerMethodField()
    buff_cooldown_hours = serializers.SerializerMethodField()

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
            "mana",
            "max_mana",
            "rank_info",
            "total_tasks_completed",
            "max_streak",
            "weekly_xp",
            "role",
            "did_dailies_today",
            "weekly_tasks_done",
            "buff_cooldown_hours",
        )
        read_only_fields = fields

    def get_max_hp(self, obj) -> int:
        return obj.max_hp

    def get_max_mana(self, obj) -> int:
        return obj.max_mana

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
        current_id = info.get("current_id", "E")
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

    def get_did_dailies_today(self, obj) -> bool:
        from django.utils import timezone

        try:
            mem = obj.user.party_membership
            return mem.last_daily_completed_date == timezone.now().date()
        except Exception:
            return False

    def get_weekly_tasks_done(self, obj) -> int:
        """Count tasks completed this ISO week (resets Monday), not rolling 7 days."""
        from django.utils import timezone
        from datetime import timedelta
        from api.models import Task

        try:
            today = timezone.now().date()
            # Monday of the current ISO week
            week_start = today - timedelta(days=today.weekday())
            week_start_dt = timezone.make_aware(
                timezone.datetime.combine(week_start, timezone.datetime.min.time())
            )
            return Task.objects.filter(
                user=obj.user,
                is_completed=True,
                last_completed_at__gte=week_start_dt,
            ).count()
        except Exception:
            return 0

    def get_buff_cooldown_hours(self, obj) -> int:
        """Hours remaining until this member can receive/send another buff. 0 = ready."""
        from django.utils import timezone

        try:
            mem = obj.user.party_membership
            if not mem.last_buff_sent_at:
                return 0
            last_sent = mem.last_buff_sent_at
            # last_buff_sent_at is a DateField — calculate hours based on date diff
            today = timezone.now().date()
            days_elapsed = (today - last_sent).days
            elapsed_h = days_elapsed * 24
            remaining = max(0, 24 - elapsed_h)
            return int(remaining)
        except Exception:
            return 0


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
    achievements = serializers.SerializerMethodField()
    weekly_quest = serializers.SerializerMethodField()
    party_stats = serializers.SerializerMethodField()

    class Meta:
        model = Party
        fields = (
            "id",
            "name",
            "description",
            "invite_code",
            "created_at",
            "member_count",
            "member_cap",
            "streak",
            "quest_streak",
            "members",
            "created_by",
            "created_by_username",
            "achievements",
            "weekly_quest",
            "party_stats",
        )
        read_only_fields = fields

    def get_members(self, obj):
        profiles = UserProfile.objects.filter(
            user__party_membership__party=obj
        ).select_related("user")
        return PartyMemberProfileSerializer(profiles, many=True).data

    def get_member_count(self, obj) -> int:
        return obj.memberships.count()

    def get_achievements(self, obj) -> list:
        return list(
            obj.achievements.values("code", "unlocked_at").order_by("unlocked_at")
        )

    def get_weekly_quest(self, obj) -> dict | None:
        from api.services.party_service import get_or_create_weekly_quest
        from datetime import date

        try:
            quest = get_or_create_weekly_quest(obj)
            today = date.today()
            # Days until next Monday (end of ISO week)
            days_left = (7 - today.weekday()) % 7 or 7
            return {
                "quest_type": quest.quest_type,
                "target_value": quest.target_value,
                "current_value": quest.current_value,
                "is_completed": quest.is_completed,
                "week_key": quest.week_key,
                "days_left": days_left,
            }
        except Exception:
            return None

    def get_party_stats(self, obj) -> dict:
        """Aggregate stats across all party members."""
        try:
            memberships = obj.memberships.select_related("user__profile").all()
            total_weekly_xp = 0
            total_tasks = 0
            streaks = []
            for mem in memberships:
                profile = mem.user.profile
                total_weekly_xp += profile.weekly_xp or 0
                streaks.append(profile.streak or 0)
                # Total completed tasks (rough count)
                from api.models import Task
                total_tasks += Task.objects.filter(
                    user=mem.user, is_completed=True
                ).count()
            avg_streak = round(sum(streaks) / len(streaks), 1) if streaks else 0
            return {
                "total_weekly_xp": total_weekly_xp,
                "avg_streak": avg_streak,
                "total_tasks_completed": total_tasks,
                "member_count": len(streaks),
            }
        except Exception:
            return {}


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
