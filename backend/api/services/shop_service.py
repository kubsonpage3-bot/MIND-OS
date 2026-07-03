from django.db import transaction
from api.models import UserProfile, Item, InventoryItem


@transaction.atomic
def buy_item(user, item_id: str):
    """
    Покупка предмета в магазине.
    Использует select_for_update() для атомарного списания золота.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    try:
        item = Item.objects.get(code=item_id)
    except Item.DoesNotExist:
        return False, f"Item with code '{item_id}' not found in database", profile

    if profile.gold < item.cost:
        return False, "Not enough gold", profile

    # Списываем золото
    profile.gold -= item.cost

    # Добавляем в инвентарь
    inv_item, created = InventoryItem.objects.get_or_create(
        user_profile=profile, item=item, defaults={"quantity": 1}
    )
    if not created:
        inv_item.quantity += 1
        inv_item.save(update_fields=["quantity"])

    profile.save()

    return True, "Item purchased successfully", profile


@transaction.atomic
def sell_item(user, item_id: str, quantity: int = 1):
    """
    Sells an item from inventory.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    try:
        inv_item = InventoryItem.objects.select_for_update().get(
            user_profile=profile, item__code=item_id
        )
    except InventoryItem.DoesNotExist:
        return False, f"Item '{item_id}' not found in inventory", profile

    if inv_item.quantity < quantity:
        return False, "Not enough items to sell", profile

    from api.constants import BASE_SELL_RATE, MARKET_KNOWLEDGE_SELL_RATE
    from api.models import UnlockedSkill

    ratio = (
        MARKET_KNOWLEDGE_SELL_RATE
        if UnlockedSkill.objects.filter(
            user_profile=profile, skill_code="market_knowledge"
        ).exists()
        else BASE_SELL_RATE
    )

    # Calculate sell value
    base_value = inv_item.item.cost
    sell_value = int(base_value * ratio) * quantity

    profile.gold += sell_value
    profile.save(update_fields=["gold"])

    inv_item.quantity -= quantity
    if inv_item.quantity <= 0:
        inv_item.delete()
    else:
        inv_item.save(update_fields=["quantity"])

    return True, f"Sold {quantity}x {inv_item.item.name} for {sell_value}G", profile
