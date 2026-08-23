from api.models import Item
from rest_framework import serializers


class ShopBuySerializer(serializers.Serializer):
    item_id = serializers.CharField(max_length=100, required=True)


class ShopSellSerializer(serializers.Serializer):
    item_id = serializers.CharField(max_length=100, required=True)
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)


class ItemSerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()
    icon_url = serializers.SerializerMethodField()
    cost = serializers.SerializerMethodField()
    base_cost = serializers.IntegerField(source="cost", read_only=True)

    class Meta:
        model = Item
        fields = "__all__"

    def get_stats(self, obj):
        return {effect.effect_name: effect.effect_value for effect in obj.effects.all()}

    def get_icon_url(self, obj):
        return obj.icon_url

    def get_cost(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            try:
                from api.services.profile_service import get_rank_info
                from api.constants import get_rank_price_multiplier
                from api.services.mechanics import (
                    apply_active_mutators,
                    get_passive_multipliers,
                )

                profile = request.user.profile
                rank_id = get_rank_info(profile).get("current_id", "E")
                rank_mult = get_rank_price_multiplier(rank_id)
                mutator_effects = apply_active_mutators(
                    profile, {}, trigger_side_effects=False
                )
                passive_effects = get_passive_multipliers(profile, {})
                shop_mult = mutator_effects.get(
                    "shop_cost_mult", 1.0
                ) * passive_effects.get("shop_cost_mult", 1.0)
                return int(obj.cost * rank_mult * shop_mult)
            except Exception:
                return obj.cost
        return obj.cost
