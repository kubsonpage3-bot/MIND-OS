from django.db import transaction
from django.utils import timezone
from api.models import BossEncounter, ActiveEffect

@transaction.atomic
def calculate_damage(user, encounter_id, base_damage):
    try:
        encounter = BossEncounter.objects.select_for_update().get(id=encounter_id, user=user)
    except BossEncounter.DoesNotExist:
        return 0

    if encounter.is_defeated:
        return 0
        
    final_damage = float(base_damage)
    
    # Интеграция с ActiveEffects
    effects = ActiveEffect.objects.filter(user=user)
    effect_notes = []
    
    for effect in effects:
        # System Overload: 3x damage
        if effect.skill_id == "system_overload" and effect.data.get("active"):
            mult = effect.data.get("damageMultiplier", 3)
            final_damage *= mult
            effect.data["active"] = False
            effect.save(update_fields=["data"])
            effect_notes.append(f"SYSTEM OVERLOAD: x{mult} Boss Damage!")
            
        # Battle Fury: Доп. урон
        if effect.skill_id == "battle_fury":
            boost = effect.data.get("physicalDamageBoost", 0.5)
            final_damage += (base_damage * boost)
            effect_notes.append(f"BATTLE FURY: +{int(boost*100)}% Boss Damage")

    final_damage = int(final_damage)
    encounter.hp_current = max(0, encounter.hp_current - final_damage)
    encounter.save()
    
    rewards = None
    if encounter.hp_current == 0:
        rewards = process_boss_death(user, encounter)
        
    return {
        "damage_dealt": final_damage,
        "boss_hp_remaining": encounter.hp_current,
        "boss_defeated": encounter.is_defeated,
        "rewards": rewards,
        "effect_notes": effect_notes
    }

def process_boss_death(user, encounter):
    encounter.is_defeated = True
    encounter.expires_at = timezone.now()
    encounter.save()
    
    profile = user.profile
    final_gold = int(encounter.boss.reward_gold * encounter.reward_multiplier)
    final_xp = int(encounter.boss.reward_xp * encounter.reward_multiplier)
    
    profile.gold += final_gold
    profile.gain_xp(final_xp)
    
    # Добавление уникального лута в инвентарь
    item_dropped = None
    if encounter.boss.drop_item_id:
        inventory = profile.inventory if isinstance(profile.inventory, list) else []
        item_dropped = encounter.boss.drop_item_id
        inventory.append({"id": item_dropped})
        profile.inventory = inventory
        
    profile.save()
    
    return {
        "gold": final_gold,
        "xp": final_xp,
        "item_dropped": item_dropped
    }
