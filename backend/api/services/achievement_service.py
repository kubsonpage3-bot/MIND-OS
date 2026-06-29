from api.models import UserStats, UserAchievement, UserProfile
from django.db import transaction

# Single Source of Truth for Achievement Requirements and Rewards
# The `check` function receives a `UserStats` instance (and profile implicitly via stats.user.profile)
ACHIEVEMENTS_SSOT = {
    # Consistency
    "first_step": {"gold": 50, "sp": 0, "check": lambda s: s.total_tasks_completed >= 1},
    "seven_suns": {"gold": 150, "sp": 0, "check": lambda s: s.max_streak >= 7},
    "iron_will": {"gold": 500, "sp": 0, "check": lambda s: s.max_streak >= 30},
    "unbroken": {"gold": 2000, "sp": 0, "check": lambda s: s.max_streak >= 100},
    "eternal": {"gold": 10000, "sp": 0, "check": lambda s: s.max_streak >= 365},
    
    # Combat
    "first_blood": {"gold": 30, "sp": 0, "check": lambda s: s.total_boss_damage >= 100},
    "boss_slayer": {"gold": 200, "sp": 0, "check": lambda s: s.bosses_defeated >= 1},
    "dragon_hunter": {"gold": 1000, "sp": 0, "check": lambda s: s.bosses_defeated >= 4},
    "emperors_bane": {"gold": 5000, "sp": 0, "check": lambda s: s.bosses_defeated >= 5},
    "void_walker": {"gold": 10000, "sp": 0, "check": lambda s: s.bosses_defeated >= 5},
    
    # Knowledge
    "first_session": {"gold": 30, "sp": 0, "check": lambda s: s.total_tasks_completed >= 1},
    "scholar": {"gold": 300, "sp": 0, "check": lambda s: s.total_tasks_completed >= 50},
    "polymath_ach": {"gold": 500, "sp": 0, "check": lambda s: len(s.unique_subjects) >= 10 if isinstance(s.unique_subjects, list) else False},
    "master": {"gold": 1000, "sp": 0, "check": lambda s: s.highest_subject_rank >= 4},
    "grandmaster": {"gold": 5000, "sp": 0, "check": lambda s: s.highest_subject_rank >= 8},
    
    # Wealth
    "first_coin": {"gold": 10, "sp": 0, "check": lambda s: s.total_gold_earned >= 1},
    "merchant": {"gold": 100, "sp": 0, "check": lambda s: s.total_gold_earned >= 1000},
    "wealthy": {"gold": 500, "sp": 0, "check": lambda s: s.total_gold_earned >= 10000},
    "tycoon": {"gold": 2000, "sp": 0, "check": lambda s: s.total_gold_earned >= 100000},
    
    # Spirit
    "first_prayer": {"gold": 50, "sp": 0, "check": lambda s: s.prayer_sessions >= 1},
    "devotion": {"gold": 300, "sp": 0, "check": lambda s: s.prayer_sessions >= 20},
    "sanctified": {"gold": 1000, "sp": 0, "check": lambda s: s.prayer_rank >= 7},
    
    # Combat Skill
    "first_crit": {"gold": 20, "sp": 0, "check": lambda s: s.total_crits >= 1},
    "precision": {"gold": 300, "sp": 0, "check": lambda s: s.total_crits >= 50},
    "sharpshooter": {"gold": 2000, "sp": 0, "check": lambda s: s.total_crits >= 500},
    
    # Allies
    "first_ally": {"gold": 100, "sp": 0, "check": lambda s: s.allies_recruited >= 1},
    "commander": {"gold": 500, "sp": 0, "check": lambda s: s.allies_recruited >= 3},
    "warlords_court": {"gold": 2000, "sp": 0, "check": lambda s: s.allies_recruited >= 5},
    "loyal_bonds": {"gold": 1000, "sp": 0, "check": lambda s: s.ally_max_level >= 5},
    
    # Prestige
    "reborn": {"gold": 0, "sp": 0, "check": lambda s: getattr(s.user, 'profile', None) and s.user.profile.prestige_count >= 1},
    "phoenix": {"gold": 0, "sp": 0, "check": lambda s: getattr(s.user, 'profile', None) and s.user.profile.prestige_count >= 3},
}

@transaction.atomic
def check_and_grant_achievements(user):
    """
    Evaluates all achievements for a user based on their stats.
    Returns a list of newly unlocked achievement IDs.
    """
    try:
        stats = user.stats
    except UserStats.DoesNotExist:
        stats = UserStats.objects.create(user=user)

    already_unlocked = set(UserAchievement.objects.filter(user=user).values_list("achievement_id", flat=True))
    
    new_achievements = []
    total_gold_reward = 0
    total_sp_reward = 0
    
    for ach_id, data in ACHIEVEMENTS_SSOT.items():
        if ach_id in already_unlocked:
            continue
            
        try:
            passed = data["check"](stats)
        except Exception:
            passed = False
            
        if passed:
            UserAchievement.objects.create(user=user, achievement_id=ach_id)
            new_achievements.append(ach_id)
            total_gold_reward += data.get("gold", 0)
            total_sp_reward += data.get("sp", 0)
            
    if new_achievements and hasattr(user, "profile"):
        # We need to use F expressions or direct additions securely
        user.profile.gold += total_gold_reward
        user.profile.skill_points += total_sp_reward
        user.profile.save(update_fields=["gold", "skill_points"])
        
    return new_achievements
