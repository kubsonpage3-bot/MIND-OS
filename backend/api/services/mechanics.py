import random
from api.models import UserProfile, Item

def calculate_task_outcome(user, task_type, base_xp=0, base_gold=0, base_hp_lost=0, is_positive=True):
    """
    Calculates the final outcome of a task based on the user's total RPG stats.
    """
    profile = UserProfile.objects.get(user=user)
    stats = profile.total_stats
    
    pwr = stats.get("pwr", 0)
    foc = stats.get("foc", 0)
    spd = stats.get("spd", 0)
    lck = stats.get("lck", 0)
    def_stat = stats.get("def", 0)
    mem = stats.get("mem", 0)
    
    result = {
        "xp_earned": 0,
        "gold_earned": 0,
        "hp_lost": 0,
        "is_crit": False,
        "item_dropped": None,
        "mana_cost_multiplier": 100.0 / (100.0 + mem) # MEM: Reduces Mana/Fatigue cost by (100 / (100 + MEM))
    }
    
    if is_positive:
        # Power (PWR): Adds a flat bonus to the base XP earned. Formula: Base_XP + (PWR * 0.5)
        pwr_bonus = pwr * 0.5
        final_xp = base_xp + pwr_bonus
        
        # Speed (SPD): Grants a flat bonus to Gold. Formula: Base_Gold + (SPD * 0.5)
        spd_bonus = spd * 0.5
        final_gold = base_gold + spd_bonus
        
        # Focus (FOC): Grants a "Critical Focus" chance. Formula: FOC * 0.5% chance. If triggered, multiply final XP and Gold by 2.
        crit_chance = foc * 0.005
        if random.random() < crit_chance:
            result["is_crit"] = True
            final_xp *= 2
            final_gold *= 2
            
        # Luck (LCK): Acts as a multiplier for Gold. Formula: Final_Gold * (1 + (LCK / 100))
        final_gold = final_gold * (1 + (lck / 100.0))
        
        # Drop chance: LCK * 0.2% to find a random item.
        drop_chance = lck * 0.002
        if random.random() < drop_chance:
            items = list(Item.objects.all())
            if items:
                dropped_item = random.choice(items)
                result["item_dropped"] = dropped_item.code
                
        result["xp_earned"] = int(final_xp)
        result["gold_earned"] = int(final_gold)
    else:
        # For negative habits/missed dailies: DEF reduces HP damage taken by (100 / (100 + DEF))
        def_multiplier = 100.0 / (100.0 + def_stat)
        final_hp_lost = base_hp_lost * def_multiplier
        result["hp_lost"] = int(final_hp_lost)
        
    return result
