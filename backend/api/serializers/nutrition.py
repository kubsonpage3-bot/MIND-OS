"""Сериализаторы для дневника питания (NutriLog)."""

from rest_framework import serializers
from api.models import (
    FoodItem,
    MealEntry,
    NutriGoal,
    GlobalFoodCache,
    SavedMealCombo,
    MealComboItem,
    WaterLog,
)


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
            # Микронутриенты (nullable)
            "fiber_per_100",
            "sugar_per_100",
            "sodium_per_100",
            "saturated_fat_per_100",
            "unit",
            "is_favorite",
            "use_count",
            "last_used_at",
            "created_at",
        ]
        read_only_fields = ["id", "use_count", "last_used_at", "created_at"]


class GlobalFoodCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalFoodCache
        fields = [
            "id",
            "name",
            "brand",
            "barcode",
            "calories_per_100",
            "protein_per_100",
            "fat_per_100",
            "carbs_per_100",
            "fiber_per_100",
            "sugar_per_100",
            "sodium_per_100",
            "saturated_fat_per_100",
            "unit",
            "image_url",
            "source",
        ]


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
            # Микронутриенты денормализованные (nullable)
            "fiber",
            "sugar",
            "sodium",
            "saturated_fat",
            "note",
            "photo_url",
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
            "fiber",
            "sugar",
            "sodium",
            "saturated_fat",
            "created_at",
        ]


class NutriGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutriGoal
        fields = [
            "calories", "protein", "fat", "carbs", "water_ml",
            "target_weight_kg",
            "reminder_breakfast", "reminder_lunch", "reminder_dinner",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class MealComboItemSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food_item.name", read_only=True)
    unit = serializers.CharField(source="food_item.unit", read_only=True)

    class Meta:
        model = MealComboItem
        fields = ["id", "food_item_id", "food_name", "amount", "unit"]


class SavedMealComboSerializer(serializers.ModelSerializer):
    items = MealComboItemSerializer(many=True, read_only=True)

    class Meta:
        model = SavedMealCombo
        fields = ["id", "name", "default_meal_type", "items", "created_at"]
        read_only_fields = ["id", "created_at"]


class WaterLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterLog
        fields = ["id", "date", "amount_ml", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
