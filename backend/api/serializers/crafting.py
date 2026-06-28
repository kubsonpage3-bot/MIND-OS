from rest_framework import serializers
from api.models import Recipe, RecipeIngredient

class CraftSerializer(serializers.Serializer):
    recipe_code = serializers.CharField(max_length=100, required=True)

class RecipeIngredientSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.code', read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ["item_code", "item_name", "quantity"]
        read_only_fields = fields

class RecipeListSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    result_item_name = serializers.CharField(source='result_item.name', read_only=True)
    result_item_code = serializers.CharField(source='result_item.code', read_only=True)

    class Meta:
        model = Recipe
        fields = ["code", "name", "crafting_cost", "result_item_code", "result_item_name", "ingredients"]
        read_only_fields = fields
