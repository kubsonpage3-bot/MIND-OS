from django.db import transaction
from api.models import UserProfile, Recipe, InventoryItem
from api.exceptions import GameLogicError


@transaction.atomic
def craft_item(user, recipe_code: str):
    """
    Создает предмет по рецепту, если у пользователя достаточно ингредиентов и золота.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    try:
        recipe = Recipe.objects.get(code=recipe_code)
    except Recipe.DoesNotExist:
        raise GameLogicError(f"Unknown recipe: {recipe_code}")

    if profile.gold < recipe.crafting_cost:
        raise GameLogicError("Not enough gold for crafting.")

    # Проверяем наличие всех ингредиентов
    ingredients = recipe.ingredients.select_related("item").all()
    if not ingredients:
        raise GameLogicError("This recipe has no ingredients configured.")

    items_to_deduct = {}

    for req in ingredients:
        inv_item = profile.inventory_items.filter(item=req.item).first()
        if not inv_item or inv_item.quantity < req.quantity:
            raise GameLogicError(
                f"Missing ingredient: {req.item.name} (Need: {req.quantity})"
            )
        items_to_deduct[req.id] = (inv_item, req.quantity)

    # Списываем золото
    profile.gold -= recipe.crafting_cost
    profile.save(update_fields=["gold"])

    # Списываем ингредиенты
    for inv_item, req_qty in items_to_deduct.values():
        if inv_item.quantity == req_qty:
            inv_item.delete()
        else:
            inv_item.quantity -= req_qty
            inv_item.save(update_fields=["quantity"])

    # Добавляем скрафченный предмет
    result_inv_item, created = InventoryItem.objects.get_or_create(
        user_profile=profile, item=recipe.result_item, defaults={"quantity": 1}
    )
    if not created:
        result_inv_item.quantity += 1
        result_inv_item.save(update_fields=["quantity"])

    return recipe.result_item
