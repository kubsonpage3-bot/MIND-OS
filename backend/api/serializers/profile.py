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
            "base_pwr",
            "base_foc",
            "base_spd",
            "base_lck",
            "base_def",
            "base_mem",
            "unspent_stat_points",
            "total_stats",
            "created_at",
            "updated_at",
            "rank_xp",
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
        )

    def get_xp_progress_percent(self, obj) -> int:
        if obj.xp_to_next_level == 0:
            return 100
        return int((obj.xp / obj.xp_to_next_level) * 100)

    def get_inventory(self, obj):
        return [
            {"id": inv.item.code, "quantity": inv.quantity, "is_equipped": inv.is_equipped}
            for inv in obj.inventory_items.all()
        ]

    def get_equipped(self, obj):
        return [
            {"code": inv.item.code, "name": inv.item.name}
            for inv in obj.inventory_items.all()
            if inv.is_equipped
        ]
