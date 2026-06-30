from rest_framework import serializers
from api.models import ActiveEffect, SkillCooldown


class ActiveEffectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActiveEffect
        fields = ["id", "effect_id", "skill_id", "data", "expires_at", "created_at"]
        read_only_fields = fields


class SkillCooldownSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillCooldown
        fields = ["skill_id", "cooldown_until"]
        read_only_fields = fields


class SkillActivateSerializer(serializers.Serializer):
    skill_id = serializers.CharField(max_length=50, required=True)
