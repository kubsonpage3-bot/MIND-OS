import uuid
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from api.models import UserProfile, Item, InventoryItem, ActiveEffect


def _apply_consumable(profile, item):
    """
    Применяет эффект от расходника.
    """
    # Instant gold grant
    if item.code == "daily_gold_rush":
        profile.gold += 200
        return

    # Memory IQ boost
    if item.code == "memory_patch":
        profile.gc += 0.2
        return

    # HP heal (small_heal, medium_heal, large_heal, health_potion, elixir)
    if item.hp_boost > 0:
        profile.hp = min(profile.max_hp, profile.hp + item.hp_boost)
        return

    # Timed buffs → ActiveEffect
    buff_mapping = {
        "focus_stim": {"data": {"multiplier": 1.3, "stat": "foc"}, "duration_hours": 2},
        "xp_booster": {"data": {"xpBoost": 0.5}, "duration_hours": 24},
        "daily_xp_surge": {"data": {"xpBoost": 1.0}, "duration_hours": 2},
        "streak_shield": {"data": {"protectStreak": True}, "duration_hours": 24},
        "boss_damage_plus": {
            "data": {"bossDamageMultiplier": 2.0},
            "duration_hours": 2,
        },
    }

    if item.code in buff_mapping:
        buff = buff_mapping[item.code]
        ActiveEffect.objects.create(
            user=profile.user,
            effect_id=f"{item.code}_{uuid.uuid4().hex[:8]}",
            skill_id=item.code,
            data=buff["data"],
            expires_at=timezone.now() + timedelta(hours=buff["duration_hours"]),
        )


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

    if item.item_type == "consumable":
        _apply_consumable(profile, item)
    else:
        # Если предмет не расходник, добавляем в инвентарь
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
