"""
Nutrition service — вся бизнес-логика дневника питания (NutriLog).
Views вызывают только эти функции, никакой математики в views.
"""

import json
import logging
import urllib.parse
import urllib.request
from datetime import date, timedelta
from calendar import monthrange

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum, F
from django.utils import timezone

from api.models import (
    FoodItem,
    MealEntry,
    NutriGoal,
    GlobalFoodCache,
    SavedMealCombo,
    MealComboItem,
    WaterLog,
    WeightLog,
)
from api.exceptions import GameLogicError

logger = logging.getLogger(__name__)


def normalize_food_name(name: str) -> str:
    """
    Лёгкая нормализация названия продукта: убирает пробелы по краям и,
    если строка целиком в одном регистре (ВСЕ КАПС или строчными),
    приводит к предложенческому регистру. Смешанный регистр не трогаем —
    он, как правило, уже осмысленно расставлен пользователем.
    """
    name = (name or "").strip()
    if len(name) > 1 and (name == name.upper() or name == name.lower()):
        name = name[0].upper() + name[1:].lower()
    return name


def _get_or_create_goal(user: User) -> NutriGoal:
    goal, _ = NutriGoal.objects.get_or_create(
        user=user,
        defaults={
            "calories": 2000,
            "protein": 150,
            "fat": 65,
            "carbs": 250,
            "water_ml": 2000,
        },
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
    """Создать новый продукт в справочнике пользователя."""
    name = normalize_food_name(data.get("name", ""))
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


# ─── Global Search (Open Food Facts + Cache) ──────────────────────────────────


def search_global_foods(user: User, query: str) -> dict:
    """
    Универсальный поиск:
    1. Пользовательские продукты (FoodItem)
    2. Кешированные глобальные продукты (GlobalFoodCache)
    3. Поиск через Open Food Facts API (если query >= 2 символов)
    """
    clean_q = query.strip()
    if not clean_q:
        user_items = FoodItem.objects.filter(user=user)[:20]
        cached_staples = GlobalFoodCache.objects.all().order_by('-id')[:25]
        return {
            "user_foods": [
                {
                    "id": item.id,
                    "name": item.name,
                    "calories_per_100": item.calories_per_100,
                    "protein_per_100": item.protein_per_100,
                    "fat_per_100": item.fat_per_100,
                    "carbs_per_100": item.carbs_per_100,
                    "unit": item.unit,
                    "is_favorite": item.is_favorite,
                    "is_custom": True,
                }
                for item in user_items
            ],
            "global_foods": [
                {
                    "id": item.id,
                    "name": item.name,
                    "brand": item.brand,
                    "barcode": item.barcode,
                    "calories_per_100": item.calories_per_100,
                    "protein_per_100": item.protein_per_100,
                    "fat_per_100": item.fat_per_100,
                    "carbs_per_100": item.carbs_per_100,
                    "unit": item.unit,
                    "image_url": item.image_url,
                    "source": item.source,
                    "is_custom": False,
                }
                for item in cached_staples
            ],
        }

    # 1. Поиск среди пользовательских
    user_items = FoodItem.objects.filter(user=user, name__icontains=clean_q)[:20]
    user_foods_res = [
        {
            "id": item.id,
            "name": item.name,
            "calories_per_100": item.calories_per_100,
            "protein_per_100": item.protein_per_100,
            "fat_per_100": item.fat_per_100,
            "carbs_per_100": item.carbs_per_100,
            "unit": item.unit,
            "is_favorite": item.is_favorite,
            "is_custom": True,
        }
        for item in user_items
    ]

    # 2. Поиск в локальном кеше
    cached_items = GlobalFoodCache.objects.filter(name__icontains=clean_q)[:25]
    cached_foods_res = [
        {
            "id": item.id,
            "name": item.name,
            "brand": item.brand,
            "barcode": item.barcode,
            "calories_per_100": item.calories_per_100,
            "protein_per_100": item.protein_per_100,
            "fat_per_100": item.fat_per_100,
            "carbs_per_100": item.carbs_per_100,
            "unit": item.unit,
            "image_url": item.image_url,
            "source": item.source,
            "is_custom": False,
        }
        for item in cached_items
    ]

    # 3. Если в кеше мало результатов, делаем внешний запрос к Open Food Facts
    if len(cached_foods_res) < 8 and len(clean_q) >= 2:
        try:
            params = urllib.parse.urlencode(
                {
                    "search_terms": clean_q,
                    "search_simple": "1",
                    "action": "process",
                    "json": "1",
                    "page_size": "20",
                    "fields": "code,product_name,product_name_ru,product_name_en,brands,nutriments,image_front_small_url",
                }
            )
            url = f"https://world.openfoodfacts.org/cgi/search.pl?{params}"
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "MindOS-NutritionTracker/1.0 (mindos@app.local)"
                },
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                products = data.get("products", [])

                for p in products:
                    name = normalize_food_name(
                        p.get("product_name_ru")
                        or p.get("product_name")
                        or p.get("product_name_en")
                        or ""
                    )
                    if not name:
                        continue

                    nutriments = p.get("nutriments", {})
                    # Рассчитываем ккал/100г
                    kcal = nutriments.get("energy-kcal_100g")
                    if kcal is None:
                        energy_kj = float(nutriments.get("energy_100g") or 0)
                        kcal = round(energy_kj / 4.184, 1) if energy_kj > 0 else 0.0
                    else:
                        kcal = float(kcal)

                    protein = float(nutriments.get("proteins_100g") or 0.0)
                    fat = float(nutriments.get("fat_100g") or 0.0)
                    carbs = float(nutriments.get("carbohydrates_100g") or 0.0)
                    # Микронутриенты (nullable — не у всех продуктов есть)
                    fiber_raw = nutriments.get("fiber_100g")
                    sugar_raw = nutriments.get("sugars_100g")
                    sodium_raw = nutriments.get("sodium_100g")  # в граммах → конвертируем в мг
                    sat_fat_raw = nutriments.get("saturated-fat_100g")
                    fiber = float(fiber_raw) if fiber_raw is not None else None
                    sugar = float(sugar_raw) if sugar_raw is not None else None
                    sodium = round(float(sodium_raw) * 1000, 1) if sodium_raw is not None else None  # г → мг
                    saturated_fat = float(sat_fat_raw) if sat_fat_raw is not None else None
                    barcode = str(p.get("code") or "")
                    brand = str(p.get("brands") or "").strip()
                    image_url = str(p.get("image_front_small_url") or "")

                    # Сохраняем в GlobalFoodCache (с микронутриентами)
                    cache_item, _ = GlobalFoodCache.objects.update_or_create(
                        barcode=barcode if barcode else None,
                        name=name,
                        defaults={
                            "brand": brand,
                            "calories_per_100": max(0.0, kcal),
                            "protein_per_100": max(0.0, protein),
                            "fat_per_100": max(0.0, fat),
                            "carbs_per_100": max(0.0, carbs),
                            "fiber_per_100": fiber,
                            "sugar_per_100": sugar,
                            "sodium_per_100": sodium,
                            "saturated_fat_per_100": saturated_fat,
                            "unit": "g",
                            "image_url": image_url,
                            "source": "openfoodfacts",
                        },
                    )
                    # Добавляем в выдачу если еще нет
                    if not any(
                        f["name"].lower() == name.lower() for f in cached_foods_res
                    ):
                        cached_foods_res.append(
                            {
                                "id": cache_item.id,
                                "name": cache_item.name,
                                "brand": cache_item.brand,
                                "barcode": cache_item.barcode,
                                "calories_per_100": cache_item.calories_per_100,
                                "protein_per_100": cache_item.protein_per_100,
                                "fat_per_100": cache_item.fat_per_100,
                                "carbs_per_100": cache_item.carbs_per_100,
                                "fiber_per_100": cache_item.fiber_per_100,
                                "sugar_per_100": cache_item.sugar_per_100,
                                "sodium_per_100": cache_item.sodium_per_100,
                                "saturated_fat_per_100": cache_item.saturated_fat_per_100,
                                "unit": cache_item.unit,
                                "image_url": cache_item.image_url,
                                "source": cache_item.source,
                                "is_custom": False,
                            }
                        )
        except Exception as e:
            logger.warning("OpenFoodFacts search failed: %s", e)

    return {
        "user_foods": user_foods_res,
        "global_foods": cached_foods_res[:20],
    }


def search_by_barcode(user: User, barcode: str) -> dict | None:
    """
    Точный поиск продукта по штрихкоду (для сканера камерой):
    1. Сначала — локальный кеш GlobalFoodCache.
    2. Если не нашли — прямой запрос к Open Food Facts по коду продукта
       (эндпоинт .../product/<barcode>.json — быстрее и точнее полнотекстового поиска).
    Возвращает None, если продукт не найден нигде.

    NB: парсинг nutriments здесь намеренно продублирован из search_global_foods,
    а не вынесен в общий хелпер — чтобы не трогать уже рабочую ветку текстового
    поиска в рамках этой правки.
    """
    barcode = (barcode or "").strip()
    if not barcode:
        return None

    cached = GlobalFoodCache.objects.filter(barcode=barcode).first()
    if cached:
        return {
            "id": cached.id,
            "name": cached.name,
            "brand": cached.brand,
            "barcode": cached.barcode,
            "calories_per_100": cached.calories_per_100,
            "protein_per_100": cached.protein_per_100,
            "fat_per_100": cached.fat_per_100,
            "carbs_per_100": cached.carbs_per_100,
            "fiber_per_100": cached.fiber_per_100,
            "sugar_per_100": cached.sugar_per_100,
            "sodium_per_100": cached.sodium_per_100,
            "saturated_fat_per_100": cached.saturated_fat_per_100,
            "unit": cached.unit,
            "image_url": cached.image_url,
            "source": cached.source,
            "is_custom": False,
        }

    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{urllib.parse.quote(barcode)}.json"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "MindOS-NutritionTracker/1.0 (mindos@app.local)"},
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning("OpenFoodFacts barcode lookup failed for %s: %s", barcode, e)
        return None

    if payload.get("status") != 1:
        return None
    p = payload.get("product", {})

    name = normalize_food_name(
        p.get("product_name_ru")
        or p.get("product_name")
        or p.get("product_name_en")
        or ""
    )
    if not name:
        return None

    nutriments = p.get("nutriments", {})
    kcal = nutriments.get("energy-kcal_100g")
    if kcal is None:
        energy_kj = float(nutriments.get("energy_100g") or 0)
        kcal = round(energy_kj / 4.184, 1) if energy_kj > 0 else 0.0
    else:
        kcal = float(kcal)

    protein = float(nutriments.get("proteins_100g") or 0.0)
    fat = float(nutriments.get("fat_100g") or 0.0)
    carbs = float(nutriments.get("carbohydrates_100g") or 0.0)
    fiber_raw = nutriments.get("fiber_100g")
    sugar_raw = nutriments.get("sugars_100g")
    sodium_raw = nutriments.get("sodium_100g")
    sat_fat_raw = nutriments.get("saturated-fat_100g")
    fiber = float(fiber_raw) if fiber_raw is not None else None
    sugar = float(sugar_raw) if sugar_raw is not None else None
    sodium = round(float(sodium_raw) * 1000, 1) if sodium_raw is not None else None
    saturated_fat = float(sat_fat_raw) if sat_fat_raw is not None else None
    brand = str(p.get("brands") or "").strip()
    image_url = str(p.get("image_front_small_url") or "")

    cache_item, _ = GlobalFoodCache.objects.update_or_create(
        barcode=barcode,
        name=name,
        defaults={
            "brand": brand,
            "calories_per_100": max(0.0, kcal),
            "protein_per_100": max(0.0, protein),
            "fat_per_100": max(0.0, fat),
            "carbs_per_100": max(0.0, carbs),
            "fiber_per_100": fiber,
            "sugar_per_100": sugar,
            "sodium_per_100": sodium,
            "saturated_fat_per_100": saturated_fat,
            "unit": "g",
            "image_url": image_url,
            "source": "openfoodfacts",
        },
    )
    return {
        "id": cache_item.id,
        "name": cache_item.name,
        "brand": cache_item.brand,
        "barcode": cache_item.barcode,
        "calories_per_100": cache_item.calories_per_100,
        "protein_per_100": cache_item.protein_per_100,
        "fat_per_100": cache_item.fat_per_100,
        "carbs_per_100": cache_item.carbs_per_100,
        "fiber_per_100": cache_item.fiber_per_100,
        "sugar_per_100": cache_item.sugar_per_100,
        "sodium_per_100": cache_item.sodium_per_100,
        "saturated_fat_per_100": cache_item.saturated_fat_per_100,
        "unit": cache_item.unit,
        "image_url": cache_item.image_url,
        "source": cache_item.source,
        "is_custom": False,
    }


# ─── Meal Entries ─────────────────────────────────────────────────────────────


def get_day_entries(user: User, day: date) -> dict:
    """Вернуть все записи питания за день + дневной итог + цели + воду."""
    entries = MealEntry.objects.filter(user=user, date=day).select_related("food_item")

    meals_by_type: dict[str, list] = {
        "breakfast": [],
        "lunch": [],
        "dinner": [],
        "snack": [],
    }
    totals = {
        "calories": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0,
        "fiber": 0.0, "sugar": 0.0, "sodium": 0.0, "saturated_fat": 0.0,
    }

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
            "fiber": e.fiber,
            "sugar": e.sugar,
            "sodium": e.sodium,
            "saturated_fat": e.saturated_fat,
            "note": e.note,
            "photo_url": e.photo_url,
            "created_at": e.created_at.isoformat(),
        }
        meals_by_type[e.meal_type].append(meal_data)
        totals["calories"] += e.calories
        totals["protein"] += e.protein
        totals["fat"] += e.fat
        totals["carbs"] += e.carbs
        totals["fiber"] += e.fiber or 0.0
        totals["sugar"] += e.sugar or 0.0
        totals["sodium"] += e.sodium or 0.0
        totals["saturated_fat"] += e.saturated_fat or 0.0

    goal = _get_or_create_goal(user)
    water_entry = WaterLog.objects.filter(user=user, date=day).first()
    water_amount = water_entry.amount_ml if water_entry else 0

    return {
        "date": str(day),
        "meals": meals_by_type,
        "totals": {k: round(v, 1) for k, v in totals.items()},
        "water": {
            "amount_ml": water_amount,
            "goal_ml": goal.water_ml,
        },
        "goal": {
            "calories": goal.calories,
            "protein": goal.protein,
            "fat": goal.fat,
            "carbs": goal.carbs,
            "water_ml": goal.water_ml,
        },
    }


@transaction.atomic
def add_meal_entry(user: User, data: dict) -> MealEntry:
    """Добавить запись приёма пищи (поддерживает как FoodItem id, так и GlobalFoodCache id)."""
    food_item = None

    if "food_item_id" in data and data["food_item_id"]:
        try:
            food_item = FoodItem.objects.get(id=data["food_item_id"], user=user)
        except FoodItem.DoesNotExist:
            raise GameLogicError("Продукт не найден.")
    elif "global_food_id" in data and data["global_food_id"]:
        # Создаем копию глобального продукта в списке пользователя
        try:
            global_item = GlobalFoodCache.objects.get(id=data["global_food_id"])
            food_item, _ = FoodItem.objects.get_or_create(
                user=user,
                name=global_item.name,
                defaults={
                    "calories_per_100": global_item.calories_per_100,
                    "protein_per_100": global_item.protein_per_100,
                    "fat_per_100": global_item.fat_per_100,
                    "carbs_per_100": global_item.carbs_per_100,
                    "fiber_per_100": global_item.fiber_per_100,
                    "sugar_per_100": global_item.sugar_per_100,
                    "sodium_per_100": global_item.sodium_per_100,
                    "saturated_fat_per_100": global_item.saturated_fat_per_100,
                    "unit": global_item.unit,
                },
            )
        except GlobalFoodCache.DoesNotExist:
            raise GameLogicError("Глобальный продукт не найден.")

    if not food_item:
        raise GameLogicError("Не указан продукт для добавления.")

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
        photo_url=data.get("photo_url", ""),
    )
    entry.save()
    # Обновляем статистику использования продукта (для Quick-Add / Recent)
    FoodItem.objects.filter(pk=food_item.pk).update(
        last_used_at=timezone.now(),
        use_count=F('use_count') + 1,
    )
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


def get_recent_foods(user: User, limit: int = 12) -> list:
    """
    Возвращает продукты пользователя отсортированные по последнему использованию.
    Избранные всегда идут первыми внутри своей группы.
    Использовать для Quick-Add секции в AddMealModal.
    """
    items = (
        FoodItem.objects.filter(user=user)
        .exclude(last_used_at=None)  # только реально использованные
        .order_by('-is_favorite', '-last_used_at')[:limit]
    )
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "name": item.name,
            "calories_per_100": item.calories_per_100,
            "protein_per_100": item.protein_per_100,
            "fat_per_100": item.fat_per_100,
            "carbs_per_100": item.carbs_per_100,
            "fiber_per_100": item.fiber_per_100,
            "sugar_per_100": item.sugar_per_100,
            "sodium_per_100": item.sodium_per_100,
            "saturated_fat_per_100": item.saturated_fat_per_100,
            "unit": item.unit,
            "is_favorite": item.is_favorite,
            "is_custom": True,
            "use_count": item.use_count,
        })
    return result


# ─── Water Tracking ───────────────────────────────────────────────────────────


def get_water_log(user: User, day: date) -> dict:
    """Получить данные о воде за день."""
    goal = _get_or_create_goal(user)
    water_entry = WaterLog.objects.filter(user=user, date=day).first()
    return {
        "date": str(day),
        "amount_ml": water_entry.amount_ml if water_entry else 0,
        "goal_ml": goal.water_ml,
    }


@transaction.atomic
def update_water_log(
    user: User, day: date, delta_ml: int | None = None, amount_ml: int | None = None
) -> dict:
    """Обновить количество выпитой воды (через дельту или точное значение)."""
    goal = _get_or_create_goal(user)
    water_entry, _ = WaterLog.objects.get_or_create(
        user=user, date=day, defaults={"amount_ml": 0}
    )

    if amount_ml is not None:
        water_entry.amount_ml = max(0, int(amount_ml))
    elif delta_ml is not None:
        water_entry.amount_ml = max(0, water_entry.amount_ml + int(delta_ml))

    water_entry.save()
    return {
        "date": str(day),
        "amount_ml": water_entry.amount_ml,
        "goal_ml": goal.water_ml,
    }


# ─── Saved Combos ─────────────────────────────────────────────────────────────


def list_combos(user: User) -> list[dict]:
    """Список сохраненных комбо-блюд пользователя."""
    combos = SavedMealCombo.objects.filter(user=user).prefetch_related(
        "items", "items__food_item"
    )
    res = []
    for c in combos:
        items_data = []
        total_cal = 0.0
        total_p = 0.0
        total_f = 0.0
        total_c = 0.0

        for ci in c.items.all():
            ratio = ci.amount / 100.0
            cal = ci.food_item.calories_per_100 * ratio
            p = ci.food_item.protein_per_100 * ratio
            f = ci.food_item.fat_per_100 * ratio
            carb = ci.food_item.carbs_per_100 * ratio

            total_cal += cal
            total_p += p
            total_f += f
            total_c += carb

            items_data.append(
                {
                    "id": ci.id,
                    "food_item_id": ci.food_item_id,
                    "food_name": ci.food_item.name,
                    "amount": ci.amount,
                    "unit": ci.food_item.unit,
                    "calories": round(cal, 1),
                    "protein": round(p, 1),
                    "fat": round(f, 1),
                    "carbs": round(carb, 1),
                }
            )

        res.append(
            {
                "id": c.id,
                "name": c.name,
                "default_meal_type": c.default_meal_type,
                "items": items_data,
                "totals": {
                    "calories": round(total_cal, 1),
                    "protein": round(total_p, 1),
                    "fat": round(total_f, 1),
                    "carbs": round(total_c, 1),
                },
                "created_at": c.created_at.isoformat(),
            }
        )
    return res


@transaction.atomic
def create_combo(user: User, data: dict) -> dict:
    """Создать сохраненное комбо-блюдо."""
    name = data.get("name", "").strip()
    if not name:
        raise GameLogicError("Название комбо не может быть пустым.")

    items = data.get("items", [])
    if not items:
        raise GameLogicError("В комбо должно быть хотя бы одно блюдо.")

    combo = SavedMealCombo.objects.create(
        user=user,
        name=name,
        default_meal_type=data.get("default_meal_type", "breakfast"),
    )

    for it in items:
        food_id = it.get("food_item_id")
        amount = float(it.get("amount", 100))
        try:
            food_item = FoodItem.objects.get(id=food_id, user=user)
        except FoodItem.DoesNotExist:
            continue
        MealComboItem.objects.create(combo=combo, food_item=food_item, amount=amount)

    return list_combos(user)[0]


@transaction.atomic
def log_combo(
    user: User, combo_id: int, day: date, meal_type: str | None = None
) -> list:
    """Залогировать все продукты из комбо за один клик."""
    try:
        combo = SavedMealCombo.objects.get(id=combo_id, user=user)
    except SavedMealCombo.DoesNotExist:
        raise GameLogicError("Комбо не найдено.")

    target_meal_type = meal_type or combo.default_meal_type
    created_entries = []

    for ci in combo.items.all():
        entry = MealEntry.objects.create(
            user=user,
            food_item=ci.food_item,
            date=day,
            meal_type=target_meal_type,
            amount=ci.amount,
            note=f"Комбо: {combo.name}",
        )
        created_entries.append(entry)

    logger.info(
        "Logged combo '%s' (%d items) for user %s",
        combo.name,
        len(created_entries),
        user.username,
    )
    return created_entries


@transaction.atomic
def delete_combo(user: User, combo_id: int) -> None:
    """Удалить сохраненное комбо."""
    try:
        combo = SavedMealCombo.objects.get(id=combo_id, user=user)
    except SavedMealCombo.DoesNotExist:
        raise GameLogicError("Комбо не найдено.")
    combo.delete()


# ─── Calendar & Trends ────────────────────────────────────────────────────────


def get_calendar_summary(user: User, year: int, month: int) -> list[dict]:
    """
    Агрегированные данные по дням месяца для календаря (включая воду).
    """
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

    # Добавляем воду
    water_logs = {
        wl.date: wl.amount_ml
        for wl in WaterLog.objects.filter(user=user, date__range=(start, end))
    }

    result = []
    goal = _get_or_create_goal(user)

    for r in rows:
        d = r["date"]
        cal = round(r["calories"] or 0, 1)
        result.append(
            {
                "date": str(d),
                "calories": cal,
                "protein": round(r["protein"] or 0, 1),
                "fat": round(r["fat"] or 0, 1),
                "carbs": round(r["carbs"] or 0, 1),
                "water_ml": water_logs.get(d, 0),
                "goal_met": bool(abs(cal - goal.calories) <= (goal.calories * 0.1)),
            }
        )

    return result


def get_trends(user: User, days: int = 30) -> dict:
    """
    Аналитика и тренды питания за последние N дней для графиков.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    goal = _get_or_create_goal(user)

    # Агрегация по дням
    entries = (
        MealEntry.objects.filter(user=user, date__range=(start_date, end_date))
        .values("date")
        .annotate(
            calories=Sum("calories"),
            protein=Sum("protein"),
            fat=Sum("fat"),
            carbs=Sum("carbs"),
            fiber=Sum("fiber"),
            sugar=Sum("sugar"),
        )
        .order_by("date")
    )

    day_map = {r["date"]: r for r in entries}
    water_map = {
        wl.date: wl.amount_ml
        for wl in WaterLog.objects.filter(user=user, date__range=(start_date, end_date))
    }

    daily_series = []
    curr = start_date
    total_cal = 0
    total_p = 0
    total_f = 0
    total_c = 0
    total_fbr = 0
    total_sgr = 0
    active_days_count = 0

    while curr <= end_date:
        r = day_map.get(curr)
        cal = round(r["calories"], 1) if r and r["calories"] else 0.0
        p = round(r["protein"], 1) if r and r["protein"] else 0.0
        f = round(r["fat"], 1) if r and r["fat"] else 0.0
        c = round(r["carbs"], 1) if r and r["carbs"] else 0.0
        fbr = round(r["fiber"], 1) if r and r["fiber"] else 0.0
        sgr = round(r["sugar"], 1) if r and r["sugar"] else 0.0
        w = water_map.get(curr, 0)

        if cal > 0:
            active_days_count += 1
            total_cal += cal
            total_p += p
            total_f += f
            total_c += c
            total_fbr += fbr
            total_sgr += sgr

        daily_series.append(
            {
                "date": str(curr),
                "label": curr.strftime("%d.%m"),
                "calories": cal,
                "protein": p,
                "fat": f,
                "carbs": c,
                "fiber": fbr,
                "sugar": sgr,
                "water_ml": w,
                "target_calories": goal.calories,
                "target_protein": goal.protein,
                "target_fat": goal.fat,
                "target_carbs": goal.carbs,
                "target_water_ml": goal.water_ml,
            }
        )
        curr += timedelta(days=1)

    avg_cal = round(total_cal / active_days_count, 1) if active_days_count > 0 else 0
    avg_p = round(total_p / active_days_count, 1) if active_days_count > 0 else 0
    avg_f = round(total_f / active_days_count, 1) if active_days_count > 0 else 0
    avg_c = round(total_c / active_days_count, 1) if active_days_count > 0 else 0
    avg_fbr = round(total_fbr / active_days_count, 1) if active_days_count > 0 else 0
    avg_sgr = round(total_sgr / active_days_count, 1) if active_days_count > 0 else 0

    return {
        "days": days,
        "daily_series": daily_series,
        "averages": {
            "calories": avg_cal,
            "protein": avg_p,
            "fat": avg_f,
            "carbs": avg_c,
            "fiber": avg_fbr,
            "sugar": avg_sgr,
            "logged_days": active_days_count,
        },
        "goal": {
            "calories": goal.calories,
            "protein": goal.protein,
            "fat": goal.fat,
            "carbs": goal.carbs,
            "water_ml": goal.water_ml,
        },
    }


# ─── Goals ────────────────────────────────────────────────────────────────────


@transaction.atomic
def update_nutri_goal(user: User, data: dict) -> NutriGoal:
    """Обновить цели питания (включая вес и время напоминаний)."""
    goal = _get_or_create_goal(user)
    for field in ("calories", "protein", "fat", "carbs", "water_ml"):
        if field in data:
            val = float(data[field])
            if val < 0:
                raise GameLogicError(f"Цель '{field}' не может быть отрицательной.")
            setattr(goal, field, int(val) if field == "water_ml" else val)
    # Целевой вес
    if "target_weight_kg" in data:
        twk = data["target_weight_kg"]
        goal.target_weight_kg = float(twk) if twk is not None else None
    # Напоминания ("HH:MM" строки или null)
    for reminder_field in ("reminder_breakfast", "reminder_lunch", "reminder_dinner"):
        if reminder_field in data:
            goal.__dict__[reminder_field] = data[reminder_field] or None
    goal.save()
    return goal


def get_nutri_goal(user: User) -> NutriGoal:
    return _get_or_create_goal(user)


# ─── Weight Tracking ──────────────────────────────────────────────────────────


@transaction.atomic
def log_weight(user: User, day: date, weight_kg: float, note: str = "") -> WeightLog:
    """Добавить или обновить запись веса за день."""
    if weight_kg <= 0 or weight_kg > 500:
        raise GameLogicError("Некорректное значение веса.")
    entry, _ = WeightLog.objects.update_or_create(
        user=user,
        date=day,
        defaults={"weight_kg": round(weight_kg, 2), "note": note},
    )
    logger.info("WeightLog: %s %.1fkg for user %s", day, weight_kg, user.username)
    return entry


def get_weight_history(user: User, days: int = 90) -> dict:
    """История веса за последние N дней + целевой вес из NutriGoal."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    goal = _get_or_create_goal(user)

    logs = WeightLog.objects.filter(
        user=user, date__range=(start_date, end_date)
    ).order_by("date")

    series = [
        {"date": str(w.date), "weight_kg": w.weight_kg, "note": w.note}
        for w in logs
    ]

    return {
        "series": series,
        "target_weight_kg": goal.target_weight_kg,
        "days": days,
    }


@transaction.atomic
def delete_weight_entry(user: User, entry_id: int) -> None:
    """Удалить запись веса."""
    try:
        entry = WeightLog.objects.get(id=entry_id, user=user)
    except WeightLog.DoesNotExist:
        raise GameLogicError("Запись не найдена.")
    entry.delete()
