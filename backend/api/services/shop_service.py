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

    from api.services.mechanics import apply_active_mutators, get_passive_multipliers

    mutator_effects = apply_active_mutators(profile, {}, trigger_side_effects=False)
    passive_effects = get_passive_multipliers(profile, {})
    shop_mult = mutator_effects.get("shop_cost_mult", 1.0) * passive_effects.get(
        "shop_cost_mult", 1.0
    )
    actual_cost = int(item.cost * shop_mult)

    if profile.gold < actual_cost:
        return False, "Not enough gold", profile

    # Списываем золото
    profile.gold -= actual_cost

    # Добавляем в инвентарь
    inv_item, created = InventoryItem.objects.get_or_create(
        user_profile=profile, item=item, defaults={"quantity": 1}
    )
    if not created:
        inv_item.quantity += 1
        inv_item.save(update_fields=["quantity"])

    profile.save()

    # Track stat for title unlock
    from api.models import UserStats

    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.items_purchased = max(0, stats.items_purchased) + 1
    stats.save(update_fields=["items_purchased"])

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

    import random

    active_codes = profile.active_allies or []

    recruited_allies = {
        a.ally_code: a.level
        for a in profile.recruited_allies.filter(ally_code__in=active_codes)  # type: ignore[attr-defined]
    }
    meldor_level = recruited_allies.get("meldor", 0)
    bran_level = recruited_allies.get("bran", 0)

    is_equip = inv_item.item.item_type == Item.ItemType.EQUIPMENT

    # Bran L3: double gold for equipment sales
    if is_equip and bran_level >= 3:
        sell_value *= 2

    # Meldor L5: item sales yield 0 gold
    if meldor_level >= 5:
        sell_value = 0

    # Meldor L3: 10% chance to yield ingredient instead of gold
    yielded_ingredient_instead = False
    if meldor_level >= 3 and random.random() < 0.10:
        yielded_ingredient_instead = True
        sell_value = 0

    profile.gold += sell_value
    profile.save(update_fields=["gold"])

    inv_item.quantity -= quantity
    if inv_item.quantity <= 0:
        inv_item.delete()
    else:
        inv_item.save(update_fields=["quantity"])

    # Ingredient drops logic
    dropped_ingredient = False

    # Bran L3: 20% chance to drop ingredient for equipment
    if is_equip and bran_level >= 3 and random.random() < 0.20:
        dropped_ingredient = True

    # Meldor L3 check
    if yielded_ingredient_instead:
        dropped_ingredient = True

    if dropped_ingredient:
        # Give a random material/ingredient
        materials = Item.objects.filter(item_type="material")
        if not materials.exists():
            materials = Item.objects.filter(item_type="consumable")
        if materials.exists():
            ing = random.choice(list(materials))
            inv_ing, created = InventoryItem.objects.get_or_create(
                user_profile=profile, item=ing
            )
            if not created:
                inv_ing.quantity += 1
                inv_ing.save(update_fields=["quantity"])

    msg = f"Sold {quantity}x {inv_item.item.name} for {sell_value}G"
    if yielded_ingredient_instead:
        msg = f"Sold {quantity}x {inv_item.item.name} and received a crafting ingredient instead of gold"
    elif dropped_ingredient and is_equip and bran_level >= 3:
        msg = f"Sold {quantity}x {inv_item.item.name} for {sell_value}G and found a crafting ingredient!"

    return True, msg, profile
