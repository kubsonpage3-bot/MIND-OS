import random
from typing import Tuple

from django.db import transaction

from api.models import InventoryItem, Item, LootChest, UserProfile
from api.exceptions import GameLogicError


def _roll_and_grant_item(profile, drop_rates: dict) -> dict | None:
    """
    Shared roll+grant core for open_chest (paid) and grant_free_chest
    (reward flows): weighted-rolls a gear_class from drop_rates, picks a
    random equipment Item of that class (falling back to E-class), adds it
    to the player's inventory, bumps the chests_opened stat, and returns the
    full item dict both AnimatedChestModal reveal UIs expect. Returns None
    if no eligible item exists at all.
    """
    classes = list(drop_rates.keys())
    weights = [float(drop_rates[c]) for c in classes]
    rolled_class = random.choices(classes, weights=weights, k=1)[0]

    eligible_items = list(
        Item.objects.filter(gear_class=rolled_class, item_type=Item.ItemType.EQUIPMENT)
    )
    if not eligible_items:
        eligible_items = list(
            Item.objects.filter(gear_class="E", item_type=Item.ItemType.EQUIPMENT)
        )
        rolled_class = "E"
    if not eligible_items:
        return None

    won_item = random.choice(eligible_items)
    inv_item, created = InventoryItem.objects.get_or_create(
        user_profile=profile, item=won_item, defaults={"quantity": 1, "is_equipped": False}
    )
    if not created:
        inv_item.quantity += 1
        inv_item.save(update_fields=["quantity"])

    from api.models import UserStats

    stats, _ = UserStats.objects.get_or_create(user=profile.user)
    stats.chests_opened = max(0, stats.chests_opened) + 1
    stats.save(update_fields=["chests_opened"])

    return {
        "code": won_item.code,
        "name": won_item.name,
        "gear_class": rolled_class,
        "slot_type": won_item.slot_type,
        "icon_url": won_item.icon_url,
        "description": won_item.description,
        "stats": {
            effect.effect_name: effect.effect_value
            for effect in won_item.effects.all()
        },
        "is_new": created,
    }


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

    item = _roll_and_grant_item(profile, chest.drop_rates)
    if item is None:
        raise GameLogicError("No eligible items exist for this chest.")

    return (
        True,
        f"You obtained [{item['gear_class']}] {item['name']}!",
        {
            "item": item,
            "rolled_class": item["gear_class"],
            "chest_type": chest_type,
            "gold_spent": 0 if is_refunded else actual_cost,
            "gold_remaining": profile.gold,
            "is_new": item["is_new"],
            "is_refunded": is_refunded,
        },
    )


def grant_free_chest(profile, chest_type: str) -> dict | None:
    """
    Opens a loot chest for free (no gold cost, no gold-related mutator/
    passive checks) -- used for reward flows like the Rival weekly bonus,
    NOT the paid shop path (see open_chest above). Shares the drop-roll
    logic but skips payment entirely. Returns None if the chest type or an
    eligible item doesn't exist, rather than raising, since this is meant to
    be called from a background reward grant, not a user-facing purchase.
    """
    try:
        chest = LootChest.objects.get(chest_type=chest_type)
    except LootChest.DoesNotExist:
        return None

    item = _roll_and_grant_item(profile, chest.drop_rates)
    if item is None:
        return None

    return {**item, "chest_type": chest_type, "chest_name": chest.name}


def grant_free_mutator(profile) -> dict | None:
    """
    Grants one random unowned mutator for free (no gold cost) -- used for
    reward flows like the Rival weekly bonus. Mirrors OpenMutatorChestView's
    (api/views.py) pool-selection logic minus the payment step. Returns None
    if the player already owns every non-disabled mutator.
    """
    from api.constants.mutators import MUTATORS_CONFIG

    raw_mutators = profile.active_mutators
    if isinstance(raw_mutators, dict):
        active_mutators = {
            "active": list(raw_mutators.get("active", [])),
            "purchased": list(raw_mutators.get("purchased", [])),
        }
    elif isinstance(raw_mutators, list):
        active_mutators = {
            "active": [m for m in raw_mutators if isinstance(m, dict)],
            "purchased": [m if isinstance(m, str) else m.get("id") for m in raw_mutators if m],
        }
    else:
        active_mutators = {"active": [], "purchased": []}

    purchased = active_mutators["purchased"]
    pool = [
        m_id
        for m_id, cfg in MUTATORS_CONFIG.items()
        if not cfg.get("disabled", False) and m_id not in purchased
    ]
    if not pool:
        return None

    won_mutator_id = random.choice(pool)
    purchased.append(won_mutator_id)
    active_mutators["purchased"] = purchased
    profile.active_mutators = active_mutators
    profile.save(update_fields=["active_mutators"])

    return {"mutator_id": won_mutator_id}
