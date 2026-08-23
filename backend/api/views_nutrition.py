"""
Nutrition views — только HTTP-слой.
Вся логика в api.services.nutrition_service.
"""

import logging
from datetime import date

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from api.exceptions import GameLogicError
from api.serializers.nutrition import (
    FoodItemSerializer,
    MealEntrySerializer,
    NutriGoalSerializer,
)
from api.services import nutrition_service

logger = logging.getLogger(__name__)


class FoodItemListView(APIView):
    """
    GET  /api/nutrition/foods/          — список продуктов (с поиском ?q=)
    POST /api/nutrition/foods/          — создать новый продукт
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.query_params.get("q", "")
        favorites_only = request.query_params.get("favorites", "") == "1"
        items = nutrition_service.list_food_items(
            request.user, search=search, favorites_only=favorites_only
        )
        return Response(FoodItemSerializer(items, many=True).data)

    def post(self, request):
        try:
            item = nutrition_service.create_food_item(request.user, request.data)
            return Response(
                FoodItemSerializer(item).data, status=status.HTTP_201_CREATED
            )
        except GameLogicError as e:
            logger.warning("create_food_item failed: %s", e)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class FoodItemDetailView(APIView):
    """
    PATCH  /api/nutrition/foods/<id>/   — обновить продукт
    DELETE /api/nutrition/foods/<id>/   — удалить продукт
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            item = nutrition_service.update_food_item(request.user, pk, request.data)
            return Response(FoodItemSerializer(item).data)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            nutrition_service.delete_food_item(request.user, pk)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class MealEntryListView(APIView):
    """
    GET  /api/nutrition/meals/?date=YYYY-MM-DD  — дневной журнал питания
    POST /api/nutrition/meals/                  — добавить запись
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        try:
            day = date.fromisoformat(date_str) if date_str else date.today()
        except ValueError:
            return Response(
                {"error": "Неверный формат даты. Используй YYYY-MM-DD."}, status=400
            )

        data = nutrition_service.get_day_entries(request.user, day)
        return Response(data)

    def post(self, request):
        try:
            entry = nutrition_service.add_meal_entry(request.user, request.data)
            return Response(
                MealEntrySerializer(entry).data, status=status.HTTP_201_CREATED
            )
        except (GameLogicError, KeyError) as e:
            logger.warning("add_meal_entry failed: %s", e)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MealEntryDeleteView(APIView):
    """
    DELETE /api/nutrition/meals/<id>/   — удалить запись
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            nutrition_service.delete_meal_entry(request.user, pk)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class NutritionCalendarView(APIView):
    """
    GET /api/nutrition/calendar/?month=2026-08  — суммы по дням месяца
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        month_str = request.query_params.get("month", "")
        try:
            if month_str:
                year, month = map(int, month_str.split("-"))
            else:
                today = date.today()
                year, month = today.year, today.month
        except (ValueError, AttributeError):
            return Response({"error": "Формат: ?month=YYYY-MM"}, status=400)

        data = nutrition_service.get_calendar_summary(request.user, year, month)
        return Response(data)


class NutriGoalView(APIView):
    """
    GET   /api/nutrition/goal/  — текущие цели
    PATCH /api/nutrition/goal/  — обновить цели
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        goal = nutrition_service.get_nutri_goal(request.user)
        return Response(NutriGoalSerializer(goal).data)

    def patch(self, request):
        try:
            goal = nutrition_service.update_nutri_goal(request.user, request.data)
            return Response(NutriGoalSerializer(goal).data)
        except GameLogicError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
