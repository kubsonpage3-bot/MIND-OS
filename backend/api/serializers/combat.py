from rest_framework import serializers
from api.models import Boss, BossEncounter


class BossSerializer(serializers.ModelSerializer):
    class Meta:
        model = Boss
        fields = (
            "id",
            "id_name",
            "name",
            "hp_max",
            "level",
            "reward_gold",
            "reward_xp",
            "drop_item_id",
        )
        read_only_fields = fields


class BossEncounterSerializer(serializers.ModelSerializer):
    boss = BossSerializer(read_only=True)
    idle_damage_applied = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = BossEncounter
        fields = (
            "id",
            "user",
            "boss",
            "hp_current",
            "reward_multiplier",
            "is_defeated",
            "started_at",
            "expires_at",
            "last_idle_tick_at",
            "idle_damage_applied",
        )
        read_only_fields = fields


class BossSummonSerializer(serializers.Serializer):
    boss_id = serializers.CharField(
        max_length=50, required=True, help_text="boss id_name (e.g. misted_wanderer)"
    )
