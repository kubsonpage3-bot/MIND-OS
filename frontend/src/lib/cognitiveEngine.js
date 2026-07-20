// Cognitive growth engine — based on neuroscience research coefficients

export const ACTIVITIES = {
  mathematics: {
    label: "Mathematics",
    icon: "∑",
    description: "Deep work & problem solving",
    coefficients: { gf: 1.60, ps: 0.80, gc: 0.20, vm: 0 },
    flavorText: "Prefrontal cortex engaged — analytical networks firing",
    xpPerHour: 25,
  },
  physics: {
    label: "Physics",
    icon: "⚛",
    description: "Abstract problem solving",
    coefficients: { gf: 1.40, ps: 1.00, gc: 0.20, vm: 0 },
    flavorText: "Spatial reasoning circuits reinforced",
    xpPerHour: 25,
  },
  history: {
    label: "History",
    icon: "📜",
    description: "Reading & analysis",
    coefficients: { gf: 0.20, ps: 0, gc: 1.80, vm: 0.40 },
    flavorText: "Semantic memory banks consolidated",
    xpPerHour: 25,
  },
  english: {
    label: "English",
    icon: "✍",
    description: "Language practice",
    coefficients: { gf: 0, ps: 0.40, gc: 1.40, vm: 2.00 },
    flavorText: "Lexical network expanded — phonological loop activated",
    xpPerHour: 25,
  },
  philosophy: {
    label: "Philosophy",
    icon: "φ",
    description: "Deep reading & theology",
    coefficients: { gf: 0.40, ps: 0, gc: 1.60, vm: 0.80 },
    flavorText: "Abstract conceptual frameworks restructured",
    xpPerHour: 25,
  },
  vocabulary: {
    label: "Vocabulary",
    icon: "Aa",
    description: "Drilling & memorization",
    coefficients: { gf: 0, ps: 0, gc: 1.00, vm: 2.40 },
    flavorText: "Vm +2.40 — Lexical network densified",
    xpPerHour: 25,
  },
  chess: {
    label: "Chess / Logic",
    icon: "♟",
    description: "Chess & logic puzzles",
    coefficients: { gf: 1.80, ps: 1.20, gc: 0, vm: 0 },
    flavorText: "Working memory load maximized — Gf pathways strengthened",
    xpPerHour: 25,
  },
  coding: {
    label: "Coding",
    icon: "</>",
    description: "Programming & algorithms",
    coefficients: { gf: 1.40, ps: 1.60, gc: 0.20, vm: 0 },
    flavorText: "Procedural reasoning circuits optimized",
    xpPerHour: 25,
  },
  creative_answers: {
    label: "Creative Answers",
    icon: "💡",
    description: "Questions answered & explained",
    coefficients: { gf: 0.30, gc: 0.20, vm: 0.16, ps: 0.10 },
    flavorText: "Neural pathways activated — retrieval strengthens long-term encoding",
    xpPerHour: 25,
    inputType: "questions",
    questionsMax: 20,
  },
  exercise: {
    label: "Exercise",
    icon: "⚡",
    description: "Sport & physical training",
    coefficients: { gf: 0.40, ps: 1.00, gc: 0, vm: 0 },
    flavorText: "BDNF surge detected — neuroplasticity window open",
    xpPerHour: 25,
  },
  prayer: {
    label: "Prayer / Meditation",
    icon: "🕊️",
    description: "Spiritual discipline & contemplation",
    coefficients: { gf: 0, ps: 0, gc: 1.20, vm: 1.20 },
    flavorText: "Contemplative state entered — default mode network calmed",
    xpPerHour: 25,
  },
  running: {
    label: "Running",
    icon: "🏃",
    description: "Cardio & endurance training",
    coefficients: { gf: 0.80, ps: 1.00, gc: 0, vm: 0 },
    flavorText: "Cardiovascular efficiency up — prefrontal blood flow optimized",
    xpPerHour: 25,
  },
  reading: {
    label: "Reading",
    icon: "📖",
    description: "Deep reading & comprehension",
    coefficients: { gf: 0.20, ps: 0, gc: 1.40, vm: 1.00 },
    flavorText: "Semantic networks reinforced — long-term potentiation engaged",
    xpPerHour: 25,
  },
  german: {
    label: "German",
    icon: "🇩🇪",
    description: "German language practice",
    coefficients: { gf: 0, ps: 0.60, gc: 1.20, vm: 1.40 },
    flavorText: "Broca's area activated — phonological loop expanding",
    xpPerHour: 25,
  },
  languages: {
    label: "Other Languages",
    icon: "🌐",
    description: "Foreign language learning",
    coefficients: { gf: 0, ps: 0.60, gc: 1.20, vm: 1.40 },
    flavorText: "Multilingual cortex reinforced — cross-language transfer active",
    xpPerHour: 25,
  },
};

export const METRIC_CONFIG = {
  gf: { label: "Fluid Intelligence", abbr: "Gf", color: "gf", glowClass: "glow-blue", colorHex: "#3b82f6", weight: 0.30 },
  gc: { label: "Crystallized Intelligence", abbr: "Gc", color: "gc", glowClass: "glow-green", colorHex: "#22c55e", weight: 0.30 },
  ps: { label: "Processing Speed", abbr: "Ps", color: "ps", glowClass: "glow-yellow", colorHex: "#f59e0b", weight: 0.20 },
  vm: { label: "Verbal Memory", abbr: "Vm", color: "vm", glowClass: "glow-purple", colorHex: "#a855f7", weight: 0.20 },
};

export const LEVEL_TITLES = [
  { min: 0, max: 105, title: "Awakening", color: "#94a3b8" },
  { min: 106, max: 110, title: "Grinder", color: "#f59e0b" },
  { min: 111, max: 115, title: "Sharpened", color: "#3b82f6" },
  { min: 116, max: 120, title: "Elite", color: "#a855f7" },
  { min: 121, max: 999, title: "Ceiling Breaker", color: "#22c55e" },
];

export function getLevelTitle(iq) {
  return LEVEL_TITLES.find(l => iq >= l.min && iq <= l.max) || LEVEL_TITLES[0];
}

// Logarithmic growth multiplier: slows as metric approaches ceiling
export function getGrowthMultiplier(current, ceiling) {
  const ratio = current / ceiling;
  return Math.max(0, 1 - Math.pow(ratio, 2));
}

// Calculate IQ from metrics
export function calculateIQ(gf, gc, ps, vm) {
  const raw = gf * 0.30 + gc * 0.30 + ps * 0.20 + vm * 0.20;
  return Math.round(raw * 10) / 10;
}

// ─── EFFICIENCY COEFFICIENTS ────────────────────────────────────────────────

export function getFocusMultiplier(focus) {
  if (focus <= 3) return 0.4;
  if (focus <= 6) return 0.8;
  if (focus <= 8) return 1.0;
  return 1.3;
}

export function getStreakMultiplier(streakDays) {
  if (streakDays <= 7) return 1.0;
  if (streakDays <= 14) return 1.1;
  if (streakDays <= 21) return 1.2;
  if (streakDays <= 30) return 1.35;
  return 1.5;
}

export function getFatigueMultiplier(hoursLoggedToday) {
  if (hoursLoggedToday <= 2) return 1.0;
  if (hoursLoggedToday <= 4) return 0.9;
  if (hoursLoggedToday <= 6) return 0.75;
  return 0.5;
}

export function getSubjectDiminishingMultiplier(subjectHoursToday) {
  if (subjectHoursToday < 1) return 1.0;
  if (subjectHoursToday < 2) return 0.9;
  if (subjectHoursToday < 3) return 0.8;
  if (subjectHoursToday < 6) return 0.75;
  return 0.5;
}



export function resolveMasteryCategory(activityKey, customTaskCategory) {
  if (customTaskCategory) {
    const cat = customTaskCategory.toLowerCase().trim();
    if (["body", "sciences", "languages", "spirit", "humanities"].includes(cat)) {
      return cat;
    }
    if (cat === "health & fitness") return "body";
    if (cat === "rest & recovery") return "body";
    if (cat === "stem") return "sciences";
    if (cat === "reading & writing") return "humanities";
    if (cat === "social & communication") return "languages";
    if (cat === "work & career") return "sciences";
  }

  if (!activityKey) return "";
  const key = activityKey.toLowerCase().trim();
  
  if (["exercise", "running", "cold_shower", "nutrition", "sleep"].includes(key)) {
    return "body";
  }
  if (["mathematics", "physics", "chemistry", "biology", "computer_science", "coding", "chess", "creative_answers"].includes(key)) {
    return "sciences";
  }
  if (["english", "german", "other_languages", "languages", "vocabulary"].includes(key)) {
    return "languages";
  }
  if (["prayer_meditation", "prayer", "meditation", "mindfulness", "reading_philosophy"].includes(key)) {
    return "spirit";
  }
  if (["reading", "philosophy", "history", "humanities", "writing"].includes(key)) {
    return "humanities";
  }
  return "";
}

export function computeEfficiency({ focus, streakDays, hoursToday, subjectHoursToday, categoryHoursToday = 0, categoryStreakDays = 0, statFoc = 5, statMem = 5 }) {
  // FOC stat boosts focus multiplier: each point above 5 = +1% bonus
  const focStatBonus = 1 + (statFoc - 5) * 0.01;
  // MEM stat reduces fatigue penalty: each point above 5 = 1.5% less fatigue penalty
  const memFatigueBonus = 1 + (statMem - 5) * 0.015;

  const focusMult = getFocusMultiplier(focus) * focStatBonus;
  const streakMult = getStreakMultiplier(streakDays);
  const rawFatigue = getFatigueMultiplier(hoursToday);
  // MEM boosts fatigue — moves it closer to 1.0
  const fatigueMult = Math.min(1.0, rawFatigue * memFatigueBonus);
  const diminMult = getSubjectDiminishingMultiplier(subjectHoursToday);

  // Category-based diminishing returns (starts after 2.0 hours)
  let categoryDiminMult = 1.0;
  if (categoryHoursToday >= 8) {
    categoryDiminMult = 0.5;
  } else if (categoryHoursToday >= 4) {
    categoryDiminMult = 0.75;
  } else if (categoryHoursToday >= 3) {
    categoryDiminMult = 0.8;
  } else if (categoryHoursToday >= 2) {
    categoryDiminMult = 0.9;
  }

  const finalDiminMult = Math.min(diminMult, categoryDiminMult);

  // Category streak bonus: +5% if category streak is active (days >= 2)
  const categoryStreakMult = categoryStreakDays >= 2 ? 1.05 : 1.0;

  const total = focusMult * streakMult * fatigueMult * finalDiminMult * categoryStreakMult;
  return {
    focus: Math.round(focusMult * 1000) / 1000,
    streak: streakMult,
    fatigue: Math.round(fatigueMult * 1000) / 1000,
    diminishing: finalDiminMult,
    total: Math.round(total * 1000) / 1000,
  };
}

export const CATEGORY_ICONS = {
  STEM: "🔬",
  Languages: "🌐",
  "Humanities & Arts": "🎨",
  "Health & Fitness": "💪",
  "Rest & Recovery": "💤",
  Mindfulness: "🧘",
  "Social & Communication": "🤝",
  "Reading & Writing": "📖",
  "Work & Career": "💼",
  Other: "🔘",
};

export const CATEGORY_COEFFICIENTS = {
  STEM: { gf: 0.06, ps: 0.05, gc: 0.02, vm: 0.01 },
  Languages: { gf: 0, ps: 0.03, gc: 0.06, vm: 0.07 },
  "Humanities & Arts": { gf: 0.02, ps: 0.02, gc: 0.06, vm: 0.03 },
  "Health & Fitness": { gf: 0.03, ps: 0.05, gc: 0, vm: 0 },
  "Rest & Recovery": { gf: 0.01, ps: 0.015, gc: 0.015, vm: 0.01 },
  Mindfulness: { gf: 0, ps: 0, gc: 0.06, vm: 0.06 },
  "Social & Communication": { gf: 0.01, ps: 0.03, gc: 0.03, vm: 0.05 },
  "Reading & Writing": { gf: 0.01, ps: 0.01, gc: 0.07, vm: 0.075 },
  "Work & Career": { gf: 0.04, ps: 0.04, gc: 0.02, vm: 0.02 },
  Other: { gf: 0.02, ps: 0.02, gc: 0.02, vm: 0.02 },
};

export function getActivityDetails(key, tasks = []) {
  if (ACTIVITIES[key]) return ACTIVITIES[key];
  if (typeof key === "string" && key.startsWith("custom_task_")) {
    const taskId = parseInt(key.replace("custom_task_", ""), 10);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const category = task.category || "Other";
      const coeff = CATEGORY_COEFFICIENTS[category] || CATEGORY_COEFFICIENTS["Other"];
      return {
        label: task.name || task.title,
        icon: task.icon || CATEGORY_ICONS[category] || "🔘",
        description: task.notes || `Custom ${category} activity`,
        coefficients: coeff,
        xpPerHour: task.xpReward || 25,
        goldReward: task.goldReward,
        bossDamage: task.bossDamage,
        defaultHours: task.defaultHours || 1,
        defaultFocus: task.defaultFocus || 7,
        isCustom: true,
        taskId: task.id,
        flavorText: `Procedural reasoning circuits optimized for ${task.name || task.title}`,
      };
    }
  }
  return null;
}

export function getEfficiencyColor(total) {
  if (total >= 1.0) return "#22c55e";
  if (total >= 0.7) return "#f59e0b";
  return "#ef4444";
}

// Smart recommendation based on current context
export function getSmartRecommendation({ hoursToday, streak, subjectHoursMap, recentFocusRatings, tasks = [] }) {
  if (hoursToday >= 5) {
    return { icon: "🧠", text: "Switch to Vocabulary — low cognitive load, high Vm gain while fatigued" };
  }
  if (streak < 4) {
    return { icon: "🔥", text: "Consistency is your weakest variable. A short session beats no session." };
  }
  const heavySubject = Object.entries(subjectHoursMap).find(([, h]) => h >= 2);
  if (heavySubject) {
    const label = getActivityDetails(heavySubject[0], tasks)?.label || heavySubject[0];
    return { icon: "🔄", text: `Diminishing returns on ${label}. Switch subjects to maximize gain.` };
  }
  const lastTwo = recentFocusRatings.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every(r => r < 5)) {
    return { icon: "⏸", text: "Focus rated <5 twice in a row. 20min break recommended — fatigue is killing your gains." };
  }
  return { icon: "✅", text: "Conditions optimal. Keep pushing — all multipliers green." };
}

// ─── APPLY ACTIVITY (with efficiency) ───────────────────────────────────────

// Apply activity to current metrics
export function applyActivity(profile, activityKey, hours, efficiencyCoeffs = null, tasks = []) {
  const activity = getActivityDetails(activityKey, tasks);
  if (!activity) return null;

  const gains = {};
  const metrics = ['gf', 'gc', 'ps', 'vm'];

  let effectiveHours = hours;
  // Sleep diminishing returns above 8h
  if (activity.sleepDiminishing && hours > 8) {
    effectiveHours = 8 + (hours - 8) * 0.3;
  }

  const effTotal = efficiencyCoeffs ? efficiencyCoeffs.total : 1.0;

  const newProfile = { ...profile };

  metrics.forEach(metric => {
    const coeff = activity.coefficients[metric] || 0;
    if (coeff === 0) { gains[metric] = 0; return; }

    const ceiling = profile[`${metric}_ceiling`];
    const current = profile[metric];
    const multiplier = getGrowthMultiplier(current, ceiling);
    const rawGain = coeff * effectiveHours * multiplier * effTotal;
    const actualGain = Math.round(rawGain * 1000) / 1000;

    gains[metric] = actualGain;
    newProfile[metric] = Math.min(ceiling, current + actualGain);
  });

  const xpEarned = Math.round(activity.xpPerHour * effectiveHours * effTotal);

  return { gains, newProfile, xpEarned, flavorText: activity.flavorText, efficiency: efficiencyCoeffs };
}

export function getFlavorText(activityKey, gains, tasks = []) {
  const activity = getActivityDetails(activityKey, tasks);
  if (!activity) return "";
  const gainStrings = Object.entries(gains)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${METRIC_CONFIG[k].abbr} +${v.toFixed(3)}`)
    .join(' · ');
  return `${gainStrings} — ${activity.flavorText}`;
}

// Hours needed to gain 1 full point in a metric
export function hoursToNextPoint(current, ceiling, activityKey, metric, tasks = []) {
  const activity = getActivityDetails(activityKey, tasks);
  if (!activity || !activity.coefficients[metric]) return null;
  const multiplier = getGrowthMultiplier(current, ceiling);
  const coeff = activity.coefficients[metric];
  if (coeff * multiplier === 0) return null;
  return Math.round(1 / (coeff * multiplier) * 10) / 10;
}