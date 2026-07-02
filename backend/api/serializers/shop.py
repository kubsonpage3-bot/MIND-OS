from api.models import Item
from rest_framework import serializers


class ShopBuySerializer(serializers.Serializer):
    item_id = serializers.CharField(max_length=100, required=True)


class ItemSerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()
    icon_url = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = "__all__"

    def get_stats(self, obj):
        return {effect.effect_name: effect.effect_value for effect in obj.effects.all()}

    def get_icon_url(self, obj):
        return obj.icon_url
