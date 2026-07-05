from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from api.models import UserProfile
from .auth import UserSerializer
from api.constants import get_prestige_xp_required


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Сериализатор профиля персонажа MIND OS.
    """

    user = UserSerializer(read_only=True)
    xp_progress_percent = serializers.SerializerMethodField()
    inventory = serializers.SerializerMethodField()
    equipped = serializers.SerializerMethodField()
    equip_stats = serializers.ReadOnlyField()
    class_stats = serializers.ReadOnlyField()
    unlocked_skills = serializers.SerializerMethodField()
    recruited_allies = serializers.SerializerMethodField()
    max_hp = serializers.SerializerMethodField()
    hp_max = serializers.SerializerMethodField()
    unlocked_achievements = serializers.SerializerMethodField()
    prestige_xp_required = serializers.SerializerMethodField()
    rank_info = serializers.SerializerMethodField()
    streak_title = serializers.ReadOnlyField()

    class Meta:
        model = UserProfile
        fields = (
            "id",
            "user",
            "hp",
            "hp_max",
            "mana",
            "mana_max",
            "gold",
            "level",
            "xp",
            "xp_to_next_level",
            "xp_progress_percent",
            "character_class",
            "avatar",
            "gf",
            "gc",
            "ps",
            "vm",
            "gf_ceiling",
            "gc_ceiling",
            "ps_ceiling",
            "vm_ceiling",
            "boss_difficulty",
            "prestige_count",
            "prestige_xp_required",
            "inventory",
            "equipped",
            "equip_stats",
            "class_stats",
            "base_pwr",
            "base_foc",
            "base_spd",
            "base_lck",
            "base_def",
            "base_mem",
            "unspent_stat_points",
            "skill_points",
            "total_stats",
            "created_at",
            "updated_at",
            "rank_xp",
            "streak",
            "unlocked_skills",
            "recruited_allies",
            "max_hp",
            "active_mutators",
            "unlocked_achievements",
            "rival_data",
            "seen_guides",
            "rank_info",
            "streak_title",
            "analytics_enabled",
            "is_premium",
            "timezone",
            "johan_recruited",
        )
        read_only_fields = (
            "id",
            "user",
            "level",
            "xp",
            "xp_to_next_level",
            "xp_progress_percent",
            "total_stats",
            "created_at",
            "updated_at",
            "rank_xp",
            "prestige_count",
            "prestige_xp_required",
            "gf_ceiling",
            "gc_ceiling",
            "ps_ceiling",
            "vm_ceiling",
            "damage_multiplier",
            "gold_multiplier",
            "xp_multiplier",
            "seen_guides",
            "rank_info",
            "is_premium",
        )

    def get_max_hp(self, obj) -> int:
        return obj.max_hp

    def get_rank_info(self, obj):
        from api.services.profile_service import get_rank_info

        return get_rank_info(obj)

    def get_hp_max(self, obj) -> int:
        return obj.max_hp

    def get_prestige_xp_required(self, obj) -> int:
        return get_prestige_xp_required(obj.prestige_count)

    def get_xp_progress_percent(self, obj) -> int:
        if obj.xp_to_next_level == 0:
            return 100
        return int((obj.xp / obj.xp_to_next_level) * 100)

    def get_inventory(self, obj):
        return [
            {
                "id": inv.item.code,
                "name": inv.item.name,
                "description": inv.item.description,
                "slot": inv.item.slot_type,
                "icon_url": inv.item.icon_url,
                "consumable": inv.item.item_type == "consumable",
                "quantity": inv.quantity,
                "is_equipped": inv.is_equipped,
                "stat_bonuses": inv.stat_bonuses,
            }
            for inv in obj.inventory_items.select_related("item").all()
        ]

    def get_equipped(self, obj):
        return [
            {"code": inv.item.code, "name": inv.item.name}
            for inv in obj.inventory_items.all()
            if inv.is_equipped
        ]

    def get_unlocked_skills(self, obj):
        return [s.skill_code for s in obj.unlocked_skills.all()]

    def get_recruited_allies(self, obj):
        return {a.ally_code: a.level for a in obj.recruited_allies.all()}

    def get_unlocked_achievements(self, obj):
        # UserAchievement is linked to User, not UserProfile
        return [a.achievement_id for a in obj.user.achievements.all()]

    def update(self, instance, validated_data):
        # Premium class check
        if "character_class" in validated_data:
            new_class = validated_data["character_class"]
            # Only ascetic is free. If changing TO a premium class, require premium.
            # If they already have a premium class and are staying on it, that's fine.
            # But here they are updating it, so we check if new_class is a premium one.
            free_classes = [
                "ascetic",
                "wanderer",
                "architect",
            ]  # Allow wanderer just in case it's still default somewhere
            if new_class not in free_classes and not instance.is_premium:
                # If they already have this exact premium class, it's a no-op, let it pass
                if instance.character_class != new_class:
                    raise ValidationError(
                        {
                            "character_class": "This class requires a Premium subscription."
                        }
                    )

        # Handle standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Handle relational arrays sent from frontend to mimic saveRPGData
        request = self.context.get("request")
        if request and hasattr(request, "data"):
            data = request.data

            # Update Active Mutators
            if "active_mutators" in data:
                active_mutators_data = data["active_mutators"]
                if isinstance(active_mutators_data, dict):
                    active_list = active_mutators_data.get("active", [])
                    max_mutators = 3 + instance.prestige_count
                    # Must be a list of dicts, but we just check length
                    if len(active_list) > max_mutators:
                        raise ValidationError(
                            f"Maximum of {max_mutators} active mutators allowed."
                        )
                instance.active_mutators = active_mutators_data

            # Update Rival Data
            if "rival_data" in data:
                instance.rival_data = data["rival_data"]

            # Update Achievements
            if "unlocked_achievements" in data:
                from api.models import UserAchievement

                current = set(
                    a.achievement_id for a in instance.user.achievements.all()
                )
                new_achievements = set(data["unlocked_achievements"])
                for ach in new_achievements - current:
                    UserAchievement.objects.create(
                        user=instance.user, achievement_id=ach
                    )

            # Update Skills
            if "unlocked_skills" in data:
                from api.models import UnlockedSkill

                current = set(s.skill_code for s in instance.unlocked_skills.all())
                new_skills = set(data["unlocked_skills"])
                for sk in new_skills - current:
                    UnlockedSkill.objects.create(user_profile=instance, skill_code=sk)

            # Update Allies
            if "recruited_allies" in data:
                from api.models import RecruitedAlly

                allies_data = data["recruited_allies"]
                if isinstance(allies_data, dict):
                    for code, level in allies_data.items():
                        obj, created = RecruitedAlly.objects.get_or_create(
                            user_profile=instance,
                            ally_code=code,
                            defaults={"level": level},
                        )
                        if not created and obj.level != level:
                            obj.level = level
                            obj.save()

        instance.save()
        return instance
