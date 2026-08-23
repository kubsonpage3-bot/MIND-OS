"""Сериализаторы для дневника питания (NutriLog)."""

from rest_framework import serializers
from api.models import FoodItem, MealEntry, NutriGoal


class FoodItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodItem
        fields = [
            "id",
            "name",
            "calories_per_100",
            "protein_per_100",
            "fat_per_100",
            "carbs_per_100",
            "unit",
            "is_favorite",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class MealEntrySerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food_item.name", read_only=True)
    unit = serializers.CharField(source="food_item.unit", read_only=True)

    class Meta:
        model = MealEntry
        fields = [
            "id",
            "food_item_id",
            "food_name",
            "date",
            "meal_type",
            "amount",
            "unit",
            "calories",
            "protein",
            "fat",
            "carbs",
            "note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "food_name",
            "unit",
            "calories",
            "protein",
            "fat",
            "carbs",
            "created_at",
        ]


class NutriGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutriGoal
        fields = ["calories", "protein", "fat", "carbs", "updated_at"]
        read_only_fields = ["updated_at"]
