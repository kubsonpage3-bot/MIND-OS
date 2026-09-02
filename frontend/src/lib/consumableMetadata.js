/**
 * Metadata and mechanics registry for all consumable items in MIND OS.
 * Provides structured details, categories, durations, and plain-English descriptions.
 */

export const CONSUMABLE_CATEGORIES = {
  healing: { key: 'healing', label: 'Healing Potion', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  buff: { key: 'buff', label: 'Combat & XP Buff', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  utility: { key: 'utility', label: 'Utility & Protection', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  wealth: { key: 'wealth', label: 'Economy & Wealth', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  cognition: { key: 'cognition', label: 'Cognitive Stimulant', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
};

export const CONSUMABLE_METADATA = {
  small_heal: {
    code: 'small_heal',
    category: 'healing',
    tier: 'E',
    effectValue: '+20 HP',
    duration: 'Instant',
    trigger: 'On Use',
    shortDesc: 'Restores 20 Health points immediately.',
    howItWorks: 'Instantly heals your character for 20 HP up to your maximum health pool. Essential for recovering from missed habits or failed tasks.',
  },
  medium_heal: {
    code: 'medium_heal',
    category: 'healing',
    tier: 'D',
    effectValue: '+50 HP',
    duration: 'Instant',
    trigger: 'On Use',
    shortDesc: 'Restores 50 Health points immediately.',
    howItWorks: 'Instantly heals your character for 50 HP. A reliable mid-tier healing flask to keep you in the fight during intense study/work weeks.',
  },
  health_potion: {
    code: 'health_potion',
    category: 'healing',
    tier: 'D',
    effectValue: '+50 HP',
    duration: 'Instant',
    trigger: 'On Use',
    shortDesc: 'Restores 50 Health points immediately.',
    howItWorks: 'Standard revitalizing potion restoring 50 HP upon consumption.',
  },
  large_heal: {
    code: 'large_heal',
    category: 'healing',
    tier: 'C',
    effectValue: '+100 HP',
    duration: 'Instant',
    trigger: 'On Use',
    shortDesc: 'Restores 100 Health points immediately.',
    howItWorks: 'A potent high-grade brew that restores 100 HP in one gulp. Ideal for surviving high-penalty legendary quest failures.',
  },
  elixir: {
    code: 'elixir',
    category: 'healing',
    tier: 'B',
    effectValue: '100% HP + Immunity',
    duration: '10 Minutes',
    trigger: 'On Use',
    shortDesc: 'Restores HP to 100% and grants 10 minutes of complete damage immunity.',
    howItWorks: 'The ultimate restorative draught. Instantly refills your Health to maximum and shields you from all incoming damage penalties for 10 minutes.',
  },
  focus_stim: {
    code: 'focus_stim',
    category: 'cognition',
    tier: 'E',
    effectValue: '+30% Focus Score',
    duration: '1 Focus Session',
    trigger: 'Next Session',
    shortDesc: 'Grants +30% Focus multiplier for your next Focus Session.',
    howItWorks: 'Enhances cognitive focus. Your next Pomodoro session calculates 30% bonus productivity points and extra focus experience.',
  },
  memory_patch: {
    code: 'memory_patch',
    category: 'cognition',
    tier: 'E',
    effectValue: '+0.2 Gc Growth',
    duration: 'Permanent',
    trigger: 'On Use',
    shortDesc: 'Permanently increases Growth Coefficient (Gc) by +0.2.',
    howItWorks: 'Directly upgrades your mental growth coefficient (Gc), permanently increasing the rate at which you earn discipline and XP from completed tasks.',
  },
  boss_damage_plus: {
    code: 'boss_damage_plus',
    category: 'buff',
    tier: 'D',
    effectValue: '+50% Boss DMG',
    duration: '1 Focus Session',
    trigger: 'Next Session',
    shortDesc: 'Deals +50% extra damage to the active Boss in your next Focus Session.',
    howItWorks: 'Imbues your strikes with explosive energy. During your next focus session, all damage dealt to the active Raid Boss is multiplied by 1.5x.',
  },
  xp_booster: {
    code: 'xp_booster',
    category: 'buff',
    tier: 'D',
    effectValue: '+50% XP Surge',
    duration: '24 Hours',
    trigger: 'All Activities',
    shortDesc: 'Grants +50% bonus XP from all sources for 24 hours.',
    howItWorks: 'Multiplies all XP earned from habits, dailies, to-dos, and Pomodoros by 1.5x for a full 24 hours. Stacks with character rank perks.',
  },
  daily_xp_surge: {
    code: 'daily_xp_surge',
    category: 'buff',
    tier: 'B',
    effectValue: '+100% Double XP',
    duration: '2 Hours',
    trigger: 'All Activities',
    shortDesc: 'Doubles all XP gains (+100%) for 2 hours.',
    howItWorks: 'Unleashes a surge of cognitive momentum. For 2 hours, all XP gained from all tasks and sessions is doubled (2x). Great for sprint sessions!',
  },
  streak_shield: {
    code: 'streak_shield',
    category: 'utility',
    tier: 'C',
    effectValue: 'Streak Shield',
    duration: '1 Use (Auto)',
    trigger: 'On Missed Habit',
    shortDesc: 'Protects your habit streak from breaking if you miss a day.',
    howItWorks: 'A protective safety talisman. If you fail to complete your daily habits before midnight, this shield automatically breaks instead of resetting your streak counter.',
  },
  daily_gold_rush: {
    code: 'daily_gold_rush',
    category: 'wealth',
    tier: 'C',
    effectValue: '+200 Gold',
    duration: 'Instant',
    trigger: 'On Use',
    shortDesc: 'Instantly grants +200 Gold coins.',
    howItWorks: 'Directly converts ancient bullion into 200 Gold in your character wallet. Useful for quickly purchasing gear or unlocking new companion slots.',
  },
  focus_scroll: {
    code: 'focus_scroll',
    category: 'buff',
    tier: 'B',
    effectValue: '-50% Cooldowns & +25% XP',
    duration: '2 Hours',
    trigger: 'All Activities',
    shortDesc: 'Reduces skill cooldowns by 50% and buffs XP by +25% for 2 hours.',
    howItWorks: 'An arcane scroll that accelerates character skill recharges by 2x while simultaneously providing a 25% experience bonus for 2 hours.',
  },
};

export function getConsumableMeta(itemOrCode) {
  const code = typeof itemOrCode === 'string'
    ? (itemOrCode || '').toLowerCase()
    : ((itemOrCode?.code || itemOrCode?.id) || '').toLowerCase();

  const base = CONSUMABLE_METADATA[code] || {
    code,
    category: 'utility',
    tier: 'D',
    effectValue: 'Special Effect',
    duration: 'Instant / Buff',
    trigger: 'On Use',
    shortDesc: 'Consumable inventory item.',
    howItWorks: 'Consuming this item applies its unique effects and buff parameters to your character profile.',
  };

  if (typeof itemOrCode === 'object' && itemOrCode) {
    let dynamicEffect = base.effectValue;
    if (itemOrCode.healAmount || itemOrCode.hp_boost) {
      dynamicEffect = `+${itemOrCode.healAmount || itemOrCode.hp_boost} HP`;
    } else if (itemOrCode.stats && Object.keys(itemOrCode.stats).length > 0) {
      dynamicEffect = Object.entries(itemOrCode.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ');
    } else if (itemOrCode.effect) {
      dynamicEffect = itemOrCode.effect;
    }

    return {
      ...base,
      tier: itemOrCode.tier || base.tier,
      effectValue: dynamicEffect,
      shortDesc: itemOrCode.desc || itemOrCode.description || base.shortDesc,
    };
  }

  return base;
}
