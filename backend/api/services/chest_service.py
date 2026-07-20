import random
from typing import Tuple

from django.db import transaction

from api.models import InventoryItem, Item, LootChest, UserProfile
from api.exceptions import GameLogicError


@transaction.atomic
def open_chest(user, chest_type: str) -> Tuple[bool, str, dict]:
    """
    Opens a loot chest for the user.
    1. Validates chest exists and user has enough gold (select_for_update).
    2. Deducts gold atomically.
    3. Rolls a gear_class using weighted random from drop_rates.
    4. Selects a random Item of that gear_class (equipment only).
    5. Adds item to inventory.
    Returns (success, message, result_data).
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    try:
        chest = LootChest.objects.get(chest_type=chest_type)
    except LootChest.DoesNotExist:
        raise GameLogicError(f"Chest type '{chest_type}' does not exist.")

    from api.services.mechanics import apply_active_mutators, get_passive_multipliers

    mutator_effects = apply_active_mutators(profile, {}, trigger_side_effects=False)
    passive_effects = get_passive_multipliers(profile, {})
    shop_mult = mutator_effects.get("shop_cost_mult", 1.0) * passive_effects.get(
        "shop_cost_mult", 1.0
    )
    actual_cost = int(chest.cost_gold * shop_mult)

    if profile.gold < actual_cost:
        raise GameLogicError(
            f"Not enough gold. Need {actual_cost}G, have {profile.gold}G."
        )

    # Deduct gold
    profile.gold = max(0, profile.gold - actual_cost)

    # Bran L5 chest refund
    is_refunded = False
    if passive_effects.get("bran_jackpot", False) and random.random() < 0.12:
        profile.gold += actual_cost
        is_refunded = True

    profile.save(update_fields=["gold"])

    # Roll gear_class using weighted random
    drop_rates: dict = chest.drop_rates
    classes = list(drop_rates.keys())  # ['E', 'D', 'C', 'B', 'A', 'S']
    weights = [float(drop_rates[c]) for c in classes]
    rolled_class = random.choices(classes, weights=weights, k=1)[0]

    # Pick a random item of that gear_class (equipment, not consumable)
    eligible_items = list(
        Item.objects.filter(
            gear_class=rolled_class,
            item_type=Item.ItemType.EQUIPMENT,
        )
    )
    if not eligible_items:
        # Fallback: pick any E-class item if no items for rolled class
        eligible_items = list(
            Item.objects.filter(
                gear_class="E",
                item_type=Item.ItemType.EQUIPMENT,
            )
        )
        rolled_class = "E"

    won_item = random.choice(eligible_items)

    # Add to inventory (or increment quantity)
    inv_item, created = InventoryItem.objects.get_or_create(
        user_profile=profile,
        item=won_item,
        defaults={"quantity": 1, "is_equipped": False},
    )
    if not created:
        inv_item.quantity += 1
        inv_item.save(update_fields=["quantity"])

    # Track stat for title unlock
    from api.models import UserStats

    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.chests_opened = max(0, stats.chests_opened) + 1
    stats.save(update_fields=["chests_opened"])

    return (
        True,
        f"You obtained [{rolled_class}] {won_item.name}!",
        {
            "item": {
                "code": won_item.code,
                "name": won_item.name,
                "gear_class": won_item.gear_class,
                "slot_type": won_item.slot_type,
                "icon_url": won_item.icon_url,
                "description": won_item.description,
                "stats": {
                    effect.effect_name: effect.effect_value
                    for effect in won_item.effects.all()
                },
            },
            "rolled_class": rolled_class,
            "chest_type": chest_type,
            "gold_spent": 0 if is_refunded else actual_cost,
            "gold_remaining": profile.gold,
            "is_new": created,
            "is_refunded": is_refunded,
        },
    )
