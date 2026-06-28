from api.models import Item
from rest_framework import serializers

class ShopBuySerializer(serializers.Serializer):
    item_id = serializers.CharField(max_length=100, required=True)

class ItemSerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = '__all__'
    
    def get_stats(self, obj):
        # Converts related ItemEffects to a dictionary { "foc": 2, "pwr": 3 }
        return {effect.effect_name: effect.effect_value for effect in obj.effects.all()}
