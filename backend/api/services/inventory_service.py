from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from typing import Any
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
        from api.services.mechanics import get_passive_multipliers

        passive_effects = get_passive_multipliers(profile, {})
        if passive_effects.get("vivian_blood_magic", False):
            return False, "Blood Magic disables healing from shop potions", profile

        if item.code == "elixir":
            profile.hp = profile.max_hp
            # 24 hour protective shield
            ActiveEffect.objects.update_or_create(
                user=profile.user,
                effect_id=f"{profile.user.id}_elixir_immunity",
                defaults={
                    "skill_id": "elixir",
                    "data": {"effect_type": "elixir_immunity"},
                    "expires_at": timezone.now() + timedelta(hours=24),
                },
            )
        elif item.code == "small_heal":
            heal_amount = max(25, int(profile.max_hp * 0.25))
            profile.hp = min(profile.max_hp, profile.hp + heal_amount)
        elif item.code in ("medium_heal", "health_potion"):
            heal_amount = max(50, int(profile.max_hp * 0.50))
            profile.hp = min(profile.max_hp, profile.hp + heal_amount)
        elif item.code == "large_heal":
            heal_amount = max(100, int(profile.max_hp * 0.75))
            profile.hp = min(profile.max_hp, profile.hp + heal_amount)
        else:
            profile.hp = min(profile.max_hp, profile.hp + item.hp_boost)

    # Apply Memory Patch (Instant Gc boost capped at ceiling)
    if item.code == "memory_patch":
        if profile.gc >= profile.gc_ceiling:
            return False, "Growth Coefficient (Gc) is already at maximum ceiling", profile
        profile.gc = min(profile.gc_ceiling, profile.gc + 0.2)

    # Apply Duration / Usage Effects (Buffs)
    buff_mapping: dict[str, dict[str, Any]] = {
        "daily_gold_rush": {
            "data": {"effect_type": "gold_booster", "gold_boost": 0.5},
            "duration_hours": 24,
        },
        "focus_stim": {
            "data": {"effect_type": "focus_stim", "uses_left": 1},
            "duration_hours": None,
        },
        "xp_booster": {
            "data": {"effect_type": "xp_booster", "xpBoost": 0.5},
            "duration_hours": 24,
        },
        "daily_xp_surge": {
            "data": {"effect_type": "xp_booster", "xpBoost": 1.0},
            "duration_hours": 2,
        },
        "focus_scroll": {
            "data": {
                "effect_type": "focus_scroll",
                "xpBoost": 0.25,
                "cooldown_reduction": 0.5,
            },
            "duration_hours": 2,
        },
        "streak_shield": {
            "data": {"effect_type": "streak_shield", "uses_left": 1},
            "duration_hours": None,
        },
        "boss_damage_plus": {
            "data": {
                "effect_type": "boss_damage_plus",
                "uses_left": 1,
                "bossDamageMultiplier": 0.5,
            },
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

    profile.save(update_fields=["hp", "gc", "gold"])

    # Track stat for title unlock
    from api.models import UserStats

    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.potions_consumed = max(0, stats.potions_consumed) + 1
    stats.save(update_fields=["potions_consumed"])

    return True, f"Used {item.name}", profile
