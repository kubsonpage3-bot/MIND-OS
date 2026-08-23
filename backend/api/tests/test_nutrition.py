import pytest
from datetime import date
from django.contrib.auth.models import User
from api.services import nutrition_service


@pytest.fixture
def nutri_user():
    return User.objects.create_user(username="nutri_test_user", password="password123")


@pytest.mark.django_db
def test_create_and_list_food_item(nutri_user):
    item = nutrition_service.create_food_item(
        nutri_user,
        {
            "name": "Oatmeal",
            "calories_per_100": 360,
            "protein_per_100": 13,
            "fat_per_100": 6.5,
            "carbs_per_100": 62,
            "unit": "g",
            "is_favorite": True,
        },
    )
    assert item.id is not None
    assert item.name == "Oatmeal"
    assert item.calories_per_100 == 360

    foods = list(nutrition_service.list_food_items(nutri_user, search="oat"))
    assert len(foods) == 1
    assert foods[0].name == "Oatmeal"


@pytest.mark.django_db
def test_add_and_get_meal_entries(nutri_user):
    item = nutrition_service.create_food_item(
        nutri_user,
        {
            "name": "Chicken Breast",
            "calories_per_100": 165,
            "protein_per_100": 31,
            "fat_per_100": 3.6,
            "carbs_per_100": 0,
        },
    )

    entry = nutrition_service.add_meal_entry(
        nutri_user,
        {
            "food_item_id": item.id,
            "date": date.today(),
            "meal_type": "lunch",
            "amount": 200,
            "note": "Grilled with salt",
        },
    )

    assert entry.calories == 330.0  # 165 * 2
    assert entry.protein == 62.0  # 31 * 2

    day_data = nutrition_service.get_day_entries(nutri_user, date.today())
    assert day_data["totals"]["calories"] == 330.0
    assert day_data["totals"]["protein"] == 62.0
    assert len(day_data["meals"]["lunch"]) == 1
    assert day_data["meals"]["lunch"][0]["food_name"] == "Chicken Breast"


@pytest.mark.django_db
def test_water_logging(nutri_user):
    today = date.today()
    w1 = nutrition_service.update_water_log(nutri_user, today, delta_ml=250)
    assert w1["amount_ml"] == 250

    w2 = nutrition_service.update_water_log(nutri_user, today, delta_ml=500)
    assert w2["amount_ml"] == 750

    w3 = nutrition_service.update_water_log(nutri_user, today, delta_ml=-250)
    assert w3["amount_ml"] == 500


@pytest.mark.django_db
def test_saved_combo_flow(nutri_user):
    food1 = nutrition_service.create_food_item(
        nutri_user, {"name": "Eggs", "calories_per_100": 140, "protein_per_100": 12}
    )
    food2 = nutrition_service.create_food_item(
        nutri_user, {"name": "Toast", "calories_per_100": 260, "carbs_per_100": 48}
    )

    combo = nutrition_service.create_combo(
        nutri_user,
        {
            "name": "Quick Breakfast",
            "default_meal_type": "breakfast",
            "items": [
                {"food_item_id": food1.id, "amount": 100},
                {"food_item_id": food2.id, "amount": 50},
            ],
        },
    )

    assert combo["name"] == "Quick Breakfast"
    assert len(combo["items"]) == 2

    # Log combo in 1 click
    today = date.today()
    entries = nutrition_service.log_combo(
        nutri_user, combo["id"], today, meal_type="breakfast"
    )
    assert len(entries) == 2

    day_data = nutrition_service.get_day_entries(nutri_user, today)
    assert len(day_data["meals"]["breakfast"]) == 2


@pytest.mark.django_db
def test_nutrition_trends_and_calendar(nutri_user):
    today = date.today()
    food = nutrition_service.create_food_item(
        nutri_user, {"name": "Apple", "calories_per_100": 52}
    )
    nutrition_service.add_meal_entry(
        nutri_user,
        {"food_item_id": food.id, "date": today, "meal_type": "snack", "amount": 200},
    )

    trends = nutrition_service.get_trends(nutri_user, days=7)
    assert trends["averages"]["calories"] > 0
    assert trends["averages"]["logged_days"] == 1

    cal = nutrition_service.get_calendar_summary(nutri_user, today.year, today.month)
    assert len(cal) >= 1
    assert any(c["calories"] == 104.0 for c in cal)
