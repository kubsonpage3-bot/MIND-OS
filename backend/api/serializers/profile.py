from rest_framework import serializers
from api.models import UserProfile
from .auth import UserSerializer


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
            "unlocked_skills",
            "recruited_allies",
            "max_hp",
            "active_mutators",
            "unlocked_achievements",
            "rival_data",
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
            "gf_ceiling",
            "gc_ceiling",
            "ps_ceiling",
            "vm_ceiling",
            "damage_multiplier",
            "gold_multiplier",
            "xp_multiplier",
        )

    def get_max_hp(self, obj) -> int:
        return obj.max_hp

    def get_hp_max(self, obj) -> int:
        return obj.max_hp

    def get_xp_progress_percent(self, obj) -> int:
        if obj.xp_to_next_level == 0:
            return 100
        return int((obj.xp / obj.xp_to_next_level) * 100)

    def get_inventory(self, obj):
        return [
            {
                "id": inv.item.code,
                "quantity": inv.quantity,
                "is_equipped": inv.is_equipped,
            }
            for inv in obj.inventory_items.all()
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
        # Handle standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Handle relational arrays sent from frontend to mimic saveRPGData
        request = self.context.get("request")
        if request and hasattr(request, "data"):
            data = request.data

            # Update Active Mutators (since it's a JSON field, it might already be in validated_data, but just in case)
            if "active_mutators" in data:
                instance.active_mutators = data["active_mutators"]

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
