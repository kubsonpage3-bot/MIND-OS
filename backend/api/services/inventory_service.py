from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from api.models import UserProfile, InventoryItem, ActiveEffect


@transaction.atomic
def consume_item(user, item_code: str):
    """
    Consumes an item from the user's inventory and applies its effects.
    Uses select_for_update() to ensure atomic operations on the profile and inventory.
    """
    profile = UserProfile.objects.select_for_update().get(user=user)

    try:
        inv_item = (
            InventoryItem.objects.select_for_update()
            .select_related("item")
            .get(user_profile=profile, item__code=item_code)
        )
    except InventoryItem.DoesNotExist:
        return False, f"Item '{item_code}' not found in inventory", profile

    item = inv_item.item
    if item.item_type != "consumable":
        return False, "This item cannot be consumed", profile

    # Apply Immediate Effects (Healing)
    if item.hp_boost > 0:
        profile.hp = min(profile.max_hp, profile.hp + item.hp_boost)

    # Apply Duration Effects (Buffs)
    # The effect_id is unique per user and item to prevent stacking multiple of the exact same buff
    # and instead override/refresh the duration.
    buff_mapping = {
        "focus_stim": {"data": {"gold_boost": 0.5}, "duration_hours": 1},
        "xp_booster": {"data": {"xpBoost": 0.5}, "duration_hours": 1},
        "daily_xp_surge": {"data": {"xpBoost": 1.0}, "duration_hours": 2},
        "streak_shield": {"data": {"protectStreak": True}, "duration_hours": 24},
        "boss_damage_plus": {
            "data": {"bossDamageMultiplier": 0.5},
            "duration_hours": 1,
        },
        "memory_patch": {"data": {"humanitiesXpBoost": 0.5}, "duration_hours": 1},
    }

    if item.code in buff_mapping:
        buff = buff_mapping[item.code]
        ActiveEffect.objects.update_or_create(
            user=profile.user,
            effect_id=f"{profile.user.id}_{item.code}_effect",
            defaults={
                "skill_id": item.code,
                "data": buff["data"],
                "expires_at": timezone.now() + timedelta(hours=buff["duration_hours"]),
            },
        )

    # Decrement inventory quantity
    inv_item.quantity -= 1
    if inv_item.quantity <= 0:
        inv_item.delete()
    else:
        inv_item.save(update_fields=["quantity"])

    profile.save(update_fields=["hp"])

    return True, f"Used {item.name}", profile
