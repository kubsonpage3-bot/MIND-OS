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
        if item.code == "elixir":
            profile.hp = profile.max_hp
            # 10 min immunity
            ActiveEffect.objects.update_or_create(
                user=profile.user,
                effect_id=f"{profile.user.id}_elixir_immunity",
                defaults={
                    "skill_id": "elixir",
                    "data": {"effect_type": "elixir_immunity"},
                    "expires_at": timezone.now() + timedelta(minutes=10),
                },
            )
        else:
            profile.hp = min(profile.max_hp, profile.hp + item.hp_boost)

    # Apply Memory Patch (Instant Gc boost)
    if item.code == "memory_patch":
        profile.gc = min(profile.gc_ceiling, profile.gc + 0.2)
        # Profile fields need saving
        pass

    # Apply Duration / Usage Effects (Buffs)
    buff_mapping = {
        "focus_stim": {
            "data": {"effect_type": "focus_stim", "uses_left": 1},
            "duration_hours": None,
        },
        "xp_booster": {"data": {"effect_type": "xp_booster"}, "duration_hours": 24},
        "daily_xp_surge": {
            "data": {"effect_type": "xp_booster"},
            "duration_hours": 2,
        },  # Using same logic
        "streak_shield": {
            "data": {"effect_type": "streak_shield", "uses_left": 1},
            "duration_hours": None,
        },
        "boss_damage_plus": {
            "data": {"effect_type": "boss_damage_plus", "uses_left": 1},
            "duration_hours": None,
        },
    }

    if item.code in buff_mapping:
        buff = buff_mapping[item.code]
        expires_at = (
            timezone.now() + timedelta(hours=buff["duration_hours"])
            if buff["duration_hours"]
            else None
        )

        ActiveEffect.objects.update_or_create(
            user=profile.user,
            effect_id=f"{profile.user.id}_{item.code}_effect",
            defaults={
                "skill_id": item.code,
                "data": buff["data"],
                "expires_at": expires_at,
            },
        )

    # Decrement inventory quantity
    inv_item.quantity -= 1
    if inv_item.quantity <= 0:
        inv_item.delete()
    else:
        inv_item.save(update_fields=["quantity"])

    profile.save(update_fields=["hp", "gc"])

    return True, f"Used {item.name}", profile
