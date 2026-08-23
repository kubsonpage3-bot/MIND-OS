"""
Nutrition service — вся бизнес-логика дневника питания.
Views вызывают только эти функции, никакой математики в views.
"""

import logging
from datetime import date

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum

from api.models import FoodItem, MealEntry, NutriGoal
from api.exceptions import GameLogicError

logger = logging.getLogger(__name__)


def _get_or_create_goal(user: User) -> NutriGoal:
    goal, _ = NutriGoal.objects.get_or_create(
        user=user,
        defaults={"calories": 2000, "protein": 150, "fat": 65, "carbs": 250},
    )
    return goal


# ─── Food Items ───────────────────────────────────────────────────────────────


def list_food_items(user: User, search: str = "", favorites_only: bool = False):
    """Список продуктов пользователя с опциональным поиском."""
    qs = FoodItem.objects.filter(user=user)
    if favorites_only:
        qs = qs.filter(is_favorite=True)
    if search:
        qs = qs.filter(name__icontains=search)
    return qs


@transaction.atomic
def create_food_item(user: User, data: dict) -> FoodItem:
    """Создать новый продукт в справочнике."""
    name = data.get("name", "").strip()
    if not name:
        raise GameLogicError("Название продукта не может быть пустым.")

    calories = float(data.get("calories_per_100", 0))
    if calories < 0:
        raise GameLogicError("Калории не могут быть отрицательными.")

    item = FoodItem.objects.create(
        user=user,
        name=name,
        calories_per_100=calories,
        protein_per_100=max(0.0, float(data.get("protein_per_100", 0))),
        fat_per_100=max(0.0, float(data.get("fat_per_100", 0))),
        carbs_per_100=max(0.0, float(data.get("carbs_per_100", 0))),
        unit=data.get("unit", "g"),
        is_favorite=bool(data.get("is_favorite", False)),
    )
    logger.info("FoodItem created: %s for user %s", item.name, user.username)
    return item


@transaction.atomic
def update_food_item(user: User, item_id: int, data: dict) -> FoodItem:
    """Обновить продукт (только свой)."""
    try:
        item = FoodItem.objects.get(id=item_id, user=user)
    except FoodItem.DoesNotExist:
        raise GameLogicError("Продукт не найден.")

    for field in (
        "name",
        "calories_per_100",
        "protein_per_100",
        "fat_per_100",
        "carbs_per_100",
        "unit",
        "is_favorite",
    ):
        if field in data:
            setattr(item, field, data[field])
    item.save()
    return item


@transaction.atomic
def delete_food_item(user: User, item_id: int) -> None:
    """Удалить продукт и все связанные записи питания."""
    try:
        item = FoodItem.objects.get(id=item_id, user=user)
    except FoodItem.DoesNotExist:
        raise GameLogicError("Продукт не найден.")
    item.delete()


# ─── Meal Entries ─────────────────────────────────────────────────────────────


def get_day_entries(user: User, day: date) -> dict:
    """Вернуть все записи питания за день + дневной итог + цели."""
    entries = MealEntry.objects.filter(user=user, date=day).select_related("food_item")

    meals_by_type: dict[str, list] = {
        "breakfast": [],
        "lunch": [],
        "dinner": [],
        "snack": [],
    }
    totals = {"calories": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}

    for e in entries:
        meal_data = {
            "id": e.id,
            "food_item_id": e.food_item_id,
            "food_name": e.food_item.name,
            "amount": e.amount,
            "unit": e.food_item.unit,
            "calories": e.calories,
            "protein": e.protein,
            "fat": e.fat,
            "carbs": e.carbs,
            "note": e.note,
            "created_at": e.created_at.isoformat(),
        }
        meals_by_type[e.meal_type].append(meal_data)
        totals["calories"] += e.calories
        totals["protein"] += e.protein
        totals["fat"] += e.fat
        totals["carbs"] += e.carbs

    goal = _get_or_create_goal(user)

    return {
        "date": str(day),
        "meals": meals_by_type,
        "totals": {k: round(v, 1) for k, v in totals.items()},
        "goal": {
            "calories": goal.calories,
            "protein": goal.protein,
            "fat": goal.fat,
            "carbs": goal.carbs,
        },
    }


@transaction.atomic
def add_meal_entry(user: User, data: dict) -> MealEntry:
    """Добавить запись приёма пищи."""
    try:
        food_item = FoodItem.objects.get(id=data["food_item_id"], user=user)
    except FoodItem.DoesNotExist:
        raise GameLogicError("Продукт не найден.")

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise GameLogicError("Количество должно быть больше 0.")

    entry_date = data.get("date", date.today())
    if isinstance(entry_date, str):
        from datetime import date as dt

        entry_date = dt.fromisoformat(entry_date)

    entry = MealEntry(
        user=user,
        food_item=food_item,
        date=entry_date,
        meal_type=data.get("meal_type", "snack"),
        amount=amount,
        note=data.get("note", ""),
    )
    entry.save()  # save() авто-считает КБЖУ
    logger.info(
        "MealEntry added: %s %.0fg for user %s", food_item.name, amount, user.username
    )
    return entry


@transaction.atomic
def delete_meal_entry(user: User, entry_id: int) -> None:
    """Удалить запись приёма пищи."""
    try:
        entry = MealEntry.objects.get(id=entry_id, user=user)
    except MealEntry.DoesNotExist:
        raise GameLogicError("Запись не найдена.")
    entry.delete()


# ─── Calendar Summary ─────────────────────────────────────────────────────────


def get_calendar_summary(user: User, year: int, month: int) -> list[dict]:
    """
    Вернуть агрегированные данные по дням месяца для мини-календаря.
    Возвращает список {date, calories, protein, fat, carbs}.
    """
    from calendar import monthrange

    _, days_in_month = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days_in_month)

    rows = (
        MealEntry.objects.filter(user=user, date__range=(start, end))
        .values("date")
        .annotate(
            calories=Sum("calories"),
            protein=Sum("protein"),
            fat=Sum("fat"),
            carbs=Sum("carbs"),
        )
        .order_by("date")
    )

    return [
        {
            "date": str(r["date"]),
            "calories": round(r["calories"] or 0, 1),
            "protein": round(r["protein"] or 0, 1),
            "fat": round(r["fat"] or 0, 1),
            "carbs": round(r["carbs"] or 0, 1),
        }
        for r in rows
    ]


# ─── Goals ────────────────────────────────────────────────────────────────────


@transaction.atomic
def update_nutri_goal(user: User, data: dict) -> NutriGoal:
    """Обновить цели питания."""
    goal = _get_or_create_goal(user)
    for field in ("calories", "protein", "fat", "carbs"):
        if field in data:
            val = float(data[field])
            if val < 0:
                raise GameLogicError(f"Цель '{field}' не может быть отрицательной.")
            setattr(goal, field, val)
    goal.save()
    return goal


def get_nutri_goal(user: User) -> NutriGoal:
    return _get_or_create_goal(user)
