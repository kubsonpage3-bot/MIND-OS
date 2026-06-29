// ─── RPG SYSTEM DATA & LOGIC ─────────────────────────────────────────────────

// Character sprites per class (used in ClassSelector and PixelCharacter)
export const CLASS_SPRITES = {
  architect: "/images/original/7958b621c_characters2.png",
  ascetic:   "/images/original/303411c1f_characters3.png",
  linguist:  "/images/original/eb9d93154_characters4.png",
  warlord:   "/images/original/f5c789146_characters1.png",
};

// Rank→character progression using class sprites with visual filters by rank
// F = faded/starving, D→C = awakening, B→A = sharpened, S→SS = apex, SSS = king
export const RANK_CHARACTER_FILTERS = {
  // F: starving beggar — washed out, dark, barely visible
  F:   "grayscale(90%) brightness(0.35) contrast(0.7) sepia(40%)",
  // D: awakening from poverty — still grey, slightly brighter
  D:   "grayscale(65%) brightness(0.55) contrast(0.85)",
  // C: grinding commoner — desaturated but present
  C:   "grayscale(30%) brightness(0.78) saturate(0.8)",
  // B: sharpened warrior — full color, clean
  B:   "brightness(1.0) saturate(1.05)",
  // A: elite — vivid, sharp
  A:   "brightness(1.1) saturate(1.3) contrast(1.05)",
  // S: apex — glowing, intense
  S:   "brightness(1.2) saturate(1.55) contrast(1.1)",
  // SS: sovereign — radiant gold haze
  SS:  "brightness(1.35) saturate(1.7) contrast(1.1) drop-shadow(0 0 10px rgba(255,200,50,0.7))",
  // SSS: god-king — blazing gold, legendary aura
  SSS: "brightness(1.5) saturate(2.0) contrast(1.15) drop-shadow(0 0 20px #f0c040) drop-shadow(0 0 40px #fbbf24) drop-shadow(0 0 6px #fff8)",
};

export const CLASSES = {
  architect: {
    id: "architect",
    name: "THE ARCHITECT",
    color: "#00e5ff",
    lore: "Builds systems. Thinks in structures. Never improvises.",
    stats: { pwr: 3, def: 4, foc: 12, mem: 10, spd: 5, lck: 6 },
    maxMana: 120,
    skills: [
      { id: "blueprint", name: "BLUEPRINT", mana: 40, cooldownH: 24, desc: "Next 3 tasks logged give +50% Rank XP until midnight." },
      { id: "system_overload", name: "SYSTEM OVERLOAD", mana: 70, cooldownH: 24, desc: "Deal 3× damage to current boss on next task completion." },
      { id: "infinite_loop", name: "INFINITE LOOP", mana: 100, cooldownH: 24, desc: "All sessions in next 2 hours count double for cognitive metrics." },
    ],
  },
  ascetic: {
    id: "ascetic",
    name: "THE ASCETIC",
    color: "#9944ff",
    lore: "Forges the will through suffering. Pain is the teacher.",
    stats: { pwr: 7, def: 8, foc: 7, mem: 10, spd: 7, lck: 6 },
    maxMana: 100,
    skills: [
      { id: "iron_fast", name: "IRON FAST", mana: 35, cooldownH: 24, desc: "For 24h: each task restores 5 HP. Missed dailies deal 0 HP damage." },
      { id: "contemplate", name: "CONTEMPLATE", mana: 60, cooldownH: 24, desc: "Instantly gain +3 to all Gf/Gc/Ps/Vm as if a 1h perfect session." },
      { id: "transcendence", name: "TRANSCENDENCE", mana: 90, cooldownH: 24, desc: "For 48h: streak cannot break. Rival XP frozen." },
    ],
  },
  linguist: {
    id: "linguist",
    name: "THE LINGUIST",
    color: "#00cc88",
    lore: "Languages are keys. Every key opens a different mind.",
    stats: { pwr: 5, def: 5, foc: 10, mem: 11, spd: 9, lck: 5 },
    maxMana: 110,
    skills: [
      { id: "babel_mode", name: "BABEL MODE", mana: 40, cooldownH: 24, desc: "Next language session counts across all three language subjects." },
      { id: "polyglot_surge", name: "POLYGLOT SURGE", mana: 65, cooldownH: 24, desc: "Push all language subject ranks forward by 2 virtual hours each." },
      { id: "memetic_transfer", name: "MEMETIC TRANSFER", mana: 95, cooldownH: 24, desc: "For 24h: Gc and Vm gains also mirror as Gf gains at 50% rate." },
    ],
  },
  warlord: {
    id: "warlord",
    name: "THE WARLORD",
    color: "#ff3355",
    lore: "The body is the weapon. Discipline is the ammunition.",
    stats: { pwr: 14, def: 10, foc: 5, mem: 4, spd: 10, lck: 7 },
    maxMana: 110,
    skills: [
      { id: "battle_fury", name: "BATTLE FURY", mana: 45, cooldownH: 24, desc: "For 1h: +50% physical damage, -20% mana regen." },
      { id: "war_cry", name: "WAR CRY", mana: 75, cooldownH: 24, desc: "Reduce boss HP by 10% and stun boss for 1h." },
      { id: "tactical_retreat", name: "TACTICAL RETREAT", mana: 80, cooldownH: 24, desc: "Reset boss encounter, gain 25% max mana back." },
    ],
  },
};

// ─── SKILL TREE ───────────────────────────────────────────────────────────────

export const SKILL_TREE = {
  mind: {
    label: "MIND", color: "#3b82f6",
    nodes: [
      { id: "sharp_focus", tier: 1, name: "Sharp Focus", desc: "Sessions with Focus 8+ give +10% bonus Rank XP", sp: 3, gold: 100 },
      { id: "deep_concentration", tier: 2, name: "Deep Concentration", desc: "Focus minimum counts as 7.0", requires: "sharp_focus", sp: 6, gold: 250 },
      { id: "flow_state", tier: 3, name: "Flow State", desc: "First session each day gives 1.5× Rank XP", requires: "deep_concentration", sp: 10, gold: 500 },
      { id: "neural_expansion", tier: 4, name: "Neural Expansion", desc: "Gf ceiling +5 permanently", requires: "flow_state", sp: 15, gold: 800 },
      { id: "cognitive_supremacy", tier: 5, name: "Cognitive Supremacy", desc: "All cognitive metric gains +20%", requires: "neural_expansion", sp: 22, gold: 1500 },
      { id: "godmind", tier: 6, name: "GODMIND", desc: "IQ score contributes 0.5× to Rank XP per session", requires: "cognitive_supremacy", sp: 35, gold: 3000 },
    ],
  },
  body: {
    label: "BODY", color: "#ff4400",
    nodes: [
      { id: "iron_conditioning", tier: 1, name: "Iron Conditioning", desc: "Exercise and Running give +15% Rank XP", sp: 3, gold: 100 },
      { id: "endurance_protocol", tier: 2, name: "Endurance Protocol", desc: "Running rank thresholds reduced by 20%", requires: "iron_conditioning", sp: 6, gold: 250 },
      { id: "combat_reflexes", tier: 3, name: "Combat Reflexes", desc: "Critical hit chance +10% globally", requires: "endurance_protocol", sp: 10, gold: 500 },
      { id: "pain_threshold", tier: 4, name: "Pain Threshold", desc: "Missed daily HP loss reduced by 25%", requires: "combat_reflexes", sp: 15, gold: 800 },
      { id: "unbreakable", tier: 5, name: "Unbreakable", desc: "HP regenerates +3 per day passively", requires: "pain_threshold", sp: 22, gold: 1500 },
      { id: "apex_predator", tier: 6, name: "APEX PREDATOR", desc: "Boss damage +30% permanently", requires: "unbreakable", sp: 35, gold: 3000 },
    ],
  },
  wealth: {
    label: "WEALTH", color: "#f0c040",
    nodes: [
      { id: "resource_awareness", tier: 1, name: "Resource Awareness", desc: "Task completions give +10% Gold", sp: 3, gold: 100 },
      { id: "compound_returns", tier: 2, name: "Compound Returns", desc: "7-day perfect streak gives bonus 200G", requires: "resource_awareness", sp: 6, gold: 250 },
      { id: "loot_magnetism", tier: 3, name: "Fortune's Pull", desc: "Item drop chance from tasks +3%", requires: "compound_returns", sp: 10, gold: 500 },
      { id: "market_knowledge", tier: 4, name: "Market Knowledge", desc: "Selling items gives 60% of buy price", requires: "loot_magnetism", sp: 15, gold: 800 },
      { id: "fortunes_favor", tier: 5, name: "Fortune's Favor", desc: "Daily login bonus Gold doubled", requires: "market_knowledge", sp: 22, gold: 1500 },
      { id: "golden_mind", tier: 6, name: "GOLDEN MIND", desc: "Sessions over 2h give a guaranteed loot drop", requires: "fortunes_favor", sp: 35, gold: 3000 },
    ],
  },
  spirit: {
    label: "SPIRIT", color: "#9944ff",
    nodes: [
      { id: "inner_stillness", tier: 1, name: "Inner Stillness", desc: "Prayer/Meditation sessions give +20% Rank XP", sp: 3, gold: 100 },
      { id: "resilience", tier: 2, name: "Resilience", desc: "Mana regeneration +25%", requires: "inner_stillness", sp: 6, gold: 250 },
      { id: "mindguard", tier: 3, name: "Mindguard", desc: "Active skill cooldowns reduced by 15%", requires: "resilience", sp: 10, gold: 500 },
      { id: "aura_of_focus", tier: 4, name: "Aura of Focus", desc: "Allies gain +10% to their stat bonuses", requires: "mindguard", sp: 15, gold: 800 },
      { id: "transcendent_will", tier: 5, name: "Transcendent Will", desc: "Rival advancement speed reduced by 10% permanently", requires: "aura_of_focus", sp: 22, gold: 1500 },
      { id: "void_clarity", tier: 6, name: "VOID CLARITY", desc: "Once per week: use any active skill at 0 mana cost", requires: "transcendent_will", sp: 35, gold: 3000 },
    ],
  },
  knowledge: {
    label: "KNOWLEDGE", color: "#00cc88",
    nodes: [
      { id: "polymath", tier: 1, name: "Polymath", desc: "Logging 3+ subjects in one day gives +20 bonus XP", sp: 3, gold: 100 },
      { id: "cross_training", tier: 2, name: "Cross-Training", desc: "Language sessions give 30% of hours to Humanities ranks", requires: "polymath", sp: 6, gold: 250 },
      { id: "encyclopedia", tier: 3, name: "Encyclopedia", desc: "Gc gains increased by 20% from all sources", requires: "cross_training", sp: 10, gold: 500 },
      { id: "master_of_arts", tier: 4, name: "Master of Arts", desc: "Humanities rank thresholds reduced by 15%", requires: "encyclopedia", sp: 15, gold: 800 },
      { id: "living_library", tier: 5, name: "Living Library", desc: "Reading/Philosophy sessions advance you faster vs rival", requires: "master_of_arts", sp: 22, gold: 1500 },
      { id: "omniscience", tier: 6, name: "OMNISCIENCE", desc: "All 5 metrics gain +0.3 flat on each achievement unlock", requires: "living_library", sp: 35, gold: 3000 },
    ],
  },
};

// ─── ALLIES ───────────────────────────────────────────────────────────────────

export const ALLY_RANKS = ["E", "D", "C", "B", "A", "S"];

export const ALLIES = [
  {
    id: "kira",
    name: "KIRA",
    title: "The Analyst",
    color: "#00e5ff",
    rank: "B",
    image: "/images/original/bbc84a335_allyes1.jpg",
    recruitCost: 1200,
    lore: "She sees patterns where others see noise.",
    upgradeCosts: [800, 1500, 2500, 5000],
    levels: [
      "Science sessions give +5% Rank XP",
      "Science bonus → +10%",
      "+0.002 bonus Gf per Science session",
      "Critical hits from Science tasks always trigger",
      "Science subject rank thresholds -10%",
    ],
  },
  {
    id: "neko",
    name: "NEKO",
    title: "The Dreamer",
    color: "#ff88cc",
    rank: "C",
    image: "/images/original/b6ca653d8_allyes2.jpg",
    recruitCost: 800,
    lore: "She turns every moment into something beautiful.",
    upgradeCosts: [500, 900, 1600, 3200],
    levels: [
      "Daily task completions give +5% extra Gold",
      "Streak bonus XP +8%",
      "Mana restored +3 when completing a daily",
      "Habit streaks never break on first miss",
      "All Gold gains +15% permanently",
    ],
  },
  {
    id: "void",
    name: "VOID",
    title: "The Abyss Walker",
    color: "#7c3aff",
    rank: "A",
    image: "/images/original/4d3be463a_allyes3.jpg",
    recruitCost: 2500,
    lore: "From darkness comes the sharpest clarity.",
    upgradeCosts: [1500, 3000, 5000, 10000],
    levels: [
      "Boss damage +10% globally",
      "Critical hit damage ×1.2",
      "Defeating a boss restores +15 MP",
      "Boss HP bars reduced by 5%",
      "All boss damage ×1.5 permanently",
    ],
  },
  {
    id: "luna",
    name: "LUNA",
    title: "The Cat Spirit",
    color: "#4488ff",
    rank: "C",
    image: "/images/original/4794d3fbb_allyes4.jpg",
    recruitCost: 900,
    lore: "She purrs in binary, dreams in starlight.",
    upgradeCosts: [600, 1100, 1800, 3600],
    levels: [
      "Exercise sessions give +8% Rank XP",
      "Missed daily HP loss -10%",
      "HP regenerates +1 per completed daily",
      "Auto-heal 5 HP after defeating a boss",
      "Max HP increased by +20 permanently",
    ],
  },
  {
    id: "sakura",
    name: "SAKURA",
    title: "The Pink Phantom",
    color: "#ff6699",
    rank: "B",
    image: "/images/original/a0f17735e_allyes5.jpg",
    recruitCost: 1500,
    lore: "Her smile hides a thousand calculations.",
    upgradeCosts: [900, 1700, 2800, 5500],
    levels: [
      "Language sessions give +10% Rank XP",
      "Gc and Vm gains +10% from all sources",
      "Mana regenerates +5 per language session",
      "All Rank XP from tasks +8%",
      "Language subject ranks advance 20% faster",
    ],
  },
  {
    id: "hex",
    name: "HEX",
    title: "The Cursed One",
    color: "#cc44ff",
    rank: "A",
    image: "/images/original/940147528_allyes6.jpg",
    recruitCost: 3000,
    lore: "She whispers forbidden knowledge with a smirk.",
    upgradeCosts: [2000, 4000, 7000, 14000],
    levels: [
      "Skill cooldowns reduced by 15%",
      "Active skills cost -10 MP",
      "Using a skill gives +20 boss damage",
      "Skill cooldowns reduced by additional 20%",
      "Once per day: use any skill at 0 MP cost",
    ],
  },
  {
    id: "yuki",
    name: "YUKI",
    title: "The Witch Bride",
    color: "#d4a0ff",
    rank: "S",
    image: "/images/original/03af8fc43_allyes7.jpg",
    recruitCost: 6000,
    lore: "She guards the threshold between effort and destiny.",
    upgradeCosts: [4000, 8000, 15000, 30000],
    levels: [
      "All Rank XP gains +8% globally",
      "Mana max +20 permanently",
      "Prestige bonus increased by +5%",
      "Skill tree node costs -25%",
      "After prestige: start at Rank C instead of F",
    ],
  },
  {
    id: "nene",
    name: "NENE",
    title: "The Silent Scholar",
    color: "#00ffbb",
    rank: "B",
    image: "/images/original/a05ba9764_allyes8.jpg",
    recruitCost: 1800,
    lore: "A smile that carries the weight of a thousand books.",
    upgradeCosts: [1200, 2200, 3500, 7000],
    levels: [
      "Prayer/Meditation sessions give +15% Rank XP",
      "Logging 3+ subjects/day gives +30G bonus",
      "HP restored +2 per day passively",
      "All cognitive metric gains +10%",
      "Once per week: full mana restoration for free",
    ],
  },
];

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  // Consistency
  { id: "first_step", name: "First Step", cat: "consistency", color: "#f59e0b", icon: "👣", desc: "Log your first session", reward: "+50G", check: (s) => s.totalSessions >= 1 },
  { id: "seven_suns", name: "Seven Suns", cat: "consistency", color: "#f59e0b", icon: "☀️", desc: "Reach a 7-day streak", reward: "+150G", check: (s) => s.maxStreak >= 7 },
  { id: "iron_will", name: "Iron Will", cat: "consistency", color: "#f59e0b", icon: "🔩", desc: "Reach a 30-day streak", reward: "+500G + Title", check: (s) => s.maxStreak >= 30 },
  { id: "unbroken", name: "Unbroken", cat: "consistency", color: "#f59e0b", icon: "⛓️", desc: "Reach a 100-day streak", reward: "+2000G + Title", check: (s) => s.maxStreak >= 100 },
  { id: "eternal", name: "Eternal", cat: "consistency", color: "#f59e0b", icon: "♾️", desc: "Reach a 365-day streak", reward: "+10000G + Title", check: (s) => s.maxStreak >= 365 },
  // Combat
  { id: "first_blood", name: "First Blood", cat: "combat", color: "#ef4444", icon: "🩸", desc: "Deal 100 total boss damage", reward: "+30G", check: (s) => s.totalBossDamage >= 100 },
  { id: "boss_slayer", name: "Boss Slayer", cat: "combat", color: "#ef4444", icon: "⚔️", desc: "Defeat your first boss", reward: "+200G + Title", check: (s) => s.bossesDefeated >= 1 },
  { id: "dragon_hunter", name: "Dragon Hunter", cat: "combat", color: "#ef4444", icon: "🐉", desc: "Defeat the Crimson Sovereign", reward: "+1000G + Title", check: (s) => s.bossesDefeated >= 4 },
  { id: "emperors_bane", name: "Emperor's Bane", cat: "combat", color: "#ef4444", icon: "👑", desc: "Defeat the Void Emperor", reward: "+5000G + Title", check: (s) => s.bossesDefeated >= 5 },
  { id: "void_walker", name: "Void Walker", cat: "combat", color: "#ef4444", icon: "🌌", desc: "Complete all 5 bosses", reward: "+10000G + Title", check: (s) => s.bossesDefeated >= 5 },
  // Knowledge
  { id: "first_session", name: "First Session", cat: "knowledge", color: "#3b82f6", icon: "📚", desc: "Log your first TRAIN session", reward: "+30G", check: (s) => s.totalSessions >= 1 },
  { id: "scholar", name: "Scholar", cat: "knowledge", color: "#3b82f6", icon: "🎓", desc: "Log 50 total sessions", reward: "+300G", check: (s) => s.totalSessions >= 50 },
  { id: "polymath_ach", name: "Polymath", cat: "knowledge", color: "#3b82f6", icon: "🧩", desc: "Log in 10 different subjects", reward: "+500G", check: (s) => s.uniqueSubjects >= 10 },
  { id: "master", name: "Master", cat: "knowledge", color: "#3b82f6", icon: "🏅", desc: "Reach B rank in any subject", reward: "+1000G", check: (s) => s.highestSubjectRank >= 4 },
  { id: "grandmaster", name: "Grandmaster", cat: "knowledge", color: "#3b82f6", icon: "🌟", desc: "Reach SSS rank in any subject", reward: "+5000G + Title", check: (s) => s.highestSubjectRank >= 8 },
  // Wealth
  { id: "first_coin", name: "First Coin", cat: "wealth", color: "#f0c040", icon: "🪙", desc: "Earn your first Gold", reward: "+10G", check: (s) => s.totalGoldEarned >= 1 },
  { id: "merchant", name: "Merchant", cat: "wealth", color: "#f0c040", icon: "💰", desc: "Accumulate 1000G total earned", reward: "+100G", check: (s) => s.totalGoldEarned >= 1000 },
  { id: "wealthy", name: "Wealthy", cat: "wealth", color: "#f0c040", icon: "💎", desc: "Accumulate 10000G total earned", reward: "+500G", check: (s) => s.totalGoldEarned >= 10000 },
  { id: "tycoon", name: "Tycoon", cat: "wealth", color: "#f0c040", icon: "🏦", desc: "Accumulate 100000G total earned", reward: "+2000G + Title", check: (s) => s.totalGoldEarned >= 100000 },
  // Spirit
  { id: "first_prayer", name: "First Prayer", cat: "spirit", color: "#9944ff", icon: "🕊️", desc: "Log your first Prayer session", reward: "+50G", check: (s) => s.prayerSessions >= 1 },
  { id: "devotion", name: "Devotion", cat: "spirit", color: "#9944ff", icon: "📿", desc: "Log 20 Prayer sessions", reward: "+300G", check: (s) => s.prayerSessions >= 20 },
  { id: "sanctified", name: "Sanctified", cat: "spirit", color: "#9944ff", icon: "✨", desc: "Reach S rank in Prayer", reward: "+1000G + Title", check: (s) => s.prayerRank >= 7 },
  // Combat Skill
  { id: "first_crit", name: "First Crit", cat: "skill", color: "#00e5ff", icon: "💥", desc: "Land your first critical hit", reward: "+20G", check: (s) => s.totalCrits >= 1 },
  { id: "precision", name: "Precision", cat: "skill", color: "#00e5ff", icon: "🎯", desc: "Land 50 critical hits", reward: "+300G", check: (s) => s.totalCrits >= 50 },
  { id: "sharpshooter", name: "Sharpshooter", cat: "skill", color: "#00e5ff", icon: "🏹", desc: "Land 500 critical hits", reward: "+2000G + Title", check: (s) => s.totalCrits >= 500 },
  // Allies
  { id: "first_ally", name: "First Ally", cat: "allies", color: "#00cc88", icon: "🤝", desc: "Recruit your first ally", reward: "+100G", check: (s) => s.alliesRecruited >= 1 },
  { id: "commander", name: "Commander", cat: "allies", color: "#00cc88", icon: "🎖️", desc: "Recruit 3 allies", reward: "+500G", check: (s) => s.alliesRecruited >= 3 },
  { id: "warlords_court", name: "Warlord's Court", cat: "allies", color: "#00cc88", icon: "⚜️", desc: "Recruit all 5 allies", reward: "+2000G + Title", check: (s) => s.alliesRecruited >= 5 },
  { id: "loyal_bonds", name: "Loyal Bonds", cat: "allies", color: "#00cc88", icon: "💜", desc: "Upgrade any ally to Lv5", reward: "+1000G", check: (s) => s.allyMaxLevel >= 5 },
  // Prestige
  { id: "reborn", name: "Reborn", cat: "prestige", color: "#ffd700", icon: "🔄", desc: "Complete your first prestige", reward: "Title: Reborn", check: (s) => s.prestigeCount >= 1 },
  { id: "phoenix", name: "Phoenix", cat: "prestige", color: "#ffd700", icon: "🦅", desc: "Complete 3 prestiges", reward: "Title: Phoenix", check: (s) => s.prestigeCount >= 3 },
];

// ─── MUTATORS ─────────────────────────────────────────────────────────────────
// Pixel art SVG icons for mutators
const M_ICONS = {
  // Fire/red
  fire: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='6' y='8' width='4' height='5' fill='%23ff2200'/><rect x='5' y='6' width='6' height='6' fill='%23ff4400'/><rect x='6' y='4' width='4' height='5' fill='%23ff8800'/><rect x='7' y='2' width='2' height='4' fill='%23ffaa00'/><rect x='4' y='9' width='2' height='2' fill='%23ff4400'/><rect x='10' y='8' width='2' height='3' fill='%23ff2200'/><rect x='7' y='11' width='2' height='1' fill='%23ff0000'/></svg>`,
  // Lightning bolt
  lightning: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='8' y='1' width='3' height='6' fill='%23ffdd00'/><rect x='7' y='2' width='3' height='5' fill='%23ffee44'/><rect x='5' y='7' width='6' height='2' fill='%23ffdd00'/><rect x='4' y='7' width='7' height='1' fill='%23ffee44'/><rect x='5' y='9' width='4' height='6' fill='%23ffdd00'/><rect x='5' y='10' width='3' height='4' fill='%23ffee44'/><rect x='6' y='7' width='1' height='1' fill='%23ffffff'/></svg>`,
  // Purple orb / spirit
  spirit: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='3' width='6' height='1' fill='%23660099'/><rect x='4' y='4' width='8' height='8' fill='%239944ff'/><rect x='5' y='5' width='6' height='6' fill='%23bb66ff'/><rect x='6' y='6' width='4' height='4' fill='%23ddaaff'/><rect x='7' y='7' width='2' height='2' fill='%23ffffff'/><rect x='4' y='12' width='8' height='1' fill='%23660099'/><rect x='5' y='13' width='6' height='1' fill='%234400aa'/></svg>`,
  // Blue wave / water
  wave: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='8' width='3' height='2' fill='%230066ff'/><rect x='3' y='7' width='3' height='2' fill='%2333aaff'/><rect x='5' y='6' width='2' height='3' fill='%230099ff'/><rect x='7' y='5' width='2' height='4' fill='%2300ccff'/><rect x='9' y='6' width='2' height='3' fill='%230099ff'/><rect x='11' y='7' width='3' height='2' fill='%2333aaff'/><rect x='12' y='8' width='2' height='2' fill='%230066ff'/><rect x='4' y='9' width='8' height='2' fill='%230055dd'/><rect x='3' y='10' width='10' height='1' fill='%230044bb'/></svg>`,
  // Moon / night
  moon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='8' y='2' width='3' height='1' fill='%23aaaaff'/><rect x='10' y='3' width='2' height='2' fill='%23aaaaff'/><rect x='11' y='5' width='2' height='4' fill='%23aaaaff'/><rect x='10' y='9' width='2' height='2' fill='%23aaaaff'/><rect x='8' y='11' width='3' height='1' fill='%23aaaaff'/><rect x='6' y='10' width='3' height='2' fill='%23ccccff'/><rect x='5' y='8' width='2' height='3' fill='%23ccccff'/><rect x='4' y='6' width='2' height='3' fill='%23ccccff'/><rect x='5' y='4' width='2' height='2' fill='%23ccccff'/><rect x='6' y='3' width='3' height='2' fill='%23ccccff'/><rect x='7' y='5' width='4' height='6' fill='%23eeeeff'/></svg>`,
  // Sun / early
  sun: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='1' width='2' height='2' fill='%23ffdd00'/><rect x='7' y='13' width='2' height='2' fill='%23ffdd00'/><rect x='1' y='7' width='2' height='2' fill='%23ffdd00'/><rect x='13' y='7' width='2' height='2' fill='%23ffdd00'/><rect x='3' y='3' width='2' height='2' fill='%23ffdd00'/><rect x='11' y='3' width='2' height='2' fill='%23ffdd00'/><rect x='3' y='11' width='2' height='2' fill='%23ffdd00'/><rect x='11' y='11' width='2' height='2' fill='%23ffdd00'/><rect x='5' y='4' width='6' height='8' fill='%23ffaa00'/><rect x='6' y='5' width='4' height='6' fill='%23ffdd00'/><rect x='7' y='6' width='2' height='4' fill='%23ffff88'/></svg>`,
  // Eye / tunnel
  eye: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='6' width='12' height='4' fill='%23334466'/><rect x='3' y='5' width='10' height='6' fill='%23445577'/><rect x='5' y='4' width='6' height='8' fill='%23336699'/><rect x='6' y='6' width='4' height='4' fill='%2300aaff'/><rect x='7' y='7' width='2' height='2' fill='%23001133'/><rect x='7' y='7' width='1' height='1' fill='%23ffffff'/></svg>`,
  // Gold coin
  coin: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='3' width='8' height='1' fill='%23c8a020'/><rect x='3' y='4' width='10' height='8' fill='%23f0c040'/><rect x='4' y='5' width='8' height='6' fill='%23f8d860'/><rect x='5' y='6' width='6' height='4' fill='%23ffe880'/><rect x='3' y='12' width='10' height='1' fill='%23c8a020'/><rect x='7' y='7' width='2' height='2' fill='%23c8a020'/><rect x='6' y='8' width='4' height='1' fill='%23c8a020'/></svg>`,
  // Bank / compound
  bank: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='12' width='12' height='2' fill='%23334466'/><rect x='3' y='4' width='10' height='2' fill='%23445577'/><rect x='2' y='3' width='12' height='2' fill='%23556699'/><rect x='4' y='6' width='2' height='6' fill='%23667788'/><rect x='7' y='6' width='2' height='6' fill='%23667788'/><rect x='10' y='6' width='2' height='6' fill='%23667788'/><rect x='7' y='3' width='2' height='1' fill='%23f0c040'/></svg>`,
  // Lock / miser
  lock: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='7' width='6' height='7' fill='%23f59e0b'/><rect x='6' y='8' width='4' height='5' fill='%23fbbf24'/><rect x='7' y='10' width='2' height='2' fill='%23a16207'/><rect x='5' y='4' width='1' height='4' fill='%23d97706'/><rect x='10' y='4' width='1' height='4' fill='%23d97706'/><rect x='5' y='3' width='6' height='2' fill='%23d97706'/><rect x='6' y='4' width='4' height='1' fill='%23fbbf24'/></svg>`,
  // Shield + lightning (tithe)
  shield_bolt: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='3' width='10' height='9' fill='%23334466'/><rect x='4' y='4' width='8' height='7' fill='%23445577'/><rect x='5' y='12' width='6' height='1' fill='%23334466'/><rect x='6' y='13' width='4' height='1' fill='%23223355'/><rect x='7' y='13' width='2' height='1' fill='%23112244'/><rect x='8' y='4' width='2' height='4' fill='%23ffdd00'/><rect x='7' y='6' width='4' height='2' fill='%23ffdd00'/><rect x='7' y='8' width='2' height='3' fill='%23ffdd00'/></svg>`,
  // Infinity loop
  loop: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='6' width='3' height='4' fill='%239944ff'/><rect x='3' y='5' width='2' height='1' fill='%239944ff'/><rect x='3' y='10' width='2' height='1' fill='%239944ff'/><rect x='5' y='4' width='2' height='1' fill='%239944ff'/><rect x='5' y='11' width='2' height='1' fill='%239944ff'/><rect x='11' y='6' width='3' height='4' fill='%239944ff'/><rect x='11' y='5' width='2' height='1' fill='%239944ff'/><rect x='11' y='10' width='2' height='1' fill='%239944ff'/><rect x='9' y='4' width='2' height='1' fill='%239944ff'/><rect x='9' y='11' width='2' height='1' fill='%239944ff'/><rect x='7' y='5' width='2' height='6' fill='%23bb66ff'/></svg>`,
  // Double arrows (momentum)
  momentum: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='7' width='8' height='2' fill='%2300cc88'/><rect x='8' y='5' width='2' height='6' fill='%2300cc88'/><rect x='10' y='6' width='2' height='4' fill='%2300cc88'/><rect x='12' y='7' width='2' height='2' fill='%2300cc88'/><rect x='2' y='4' width='6' height='2' fill='%2300ff99'/><rect x='6' y='3' width='2' height='2' fill='%2300ff99'/></svg>`,
  // Dice (gambler)
  dice: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='2' width='12' height='12' fill='%23ffffff'/><rect x='3' y='3' width='10' height='10' fill='%23f0f0f0'/><rect x='4' y='4' width='2' height='2' fill='%23111111'/><rect x='10' y='4' width='2' height='2' fill='%23111111'/><rect x='7' y='7' width='2' height='2' fill='%23111111'/><rect x='4' y='10' width='2' height='2' fill='%23111111'/><rect x='10' y='10' width='2' height='2' fill='%23111111'/></svg>`,
  // Clock
  clock: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='2' width='8' height='1' fill='%23888'/><rect x='3' y='3' width='10' height='10' fill='%23333'/><rect x='4' y='4' width='8' height='8' fill='%23555'/><rect x='5' y='5' width='6' height='6' fill='%23222'/><rect x='3' y='13' width='10' height='1' fill='%23888'/><rect x='7' y='6' width='1' height='3' fill='%23ef4444'/><rect x='8' y='8' width='3' height='1' fill='%23ef4444'/><rect x='7' y='5' width='2' height='1' fill='%23ffffff'/></svg>`,
  // Skull (ironman)
  skull: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='3' width='8' height='7' fill='%23dddddd'/><rect x='3' y='5' width='10' height='5' fill='%23eeeeee'/><rect x='5' y='4' width='6' height='6' fill='%23ffffff'/><rect x='4' y='9' width='4' height='4' fill='%23dddddd'/><rect x='8' y='9' width='4' height='4' fill='%23dddddd'/><rect x='5' y='6' width='2' height='2' fill='%23222222'/><rect x='9' y='6' width='2' height='2' fill='%23222222'/><rect x='5' y='10' width='2' height='2' fill='%23aaaaaa'/><rect x='9' y='10' width='2' height='2' fill='%23aaaaaa'/><rect x='7' y='11' width='2' height='2' fill='%23888888'/></svg>`,
  // Sword up (volatile)
  sword_up: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='1' width='2' height='10' fill='%23cccccc'/><rect x='6' y='2' width='1' height='8' fill='%23eeeeee'/><rect x='5' y='10' width='6' height='1' fill='%23c8a060'/><rect x='7' y='11' width='2' height='3' fill='%23886622'/><rect x='3' y='7' width='2' height='2' fill='%23ffdd00'/><rect x='11' y='7' width='2' height='2' fill='%23ffdd00'/><rect x='5' y='5' width='2' height='2' fill='%23ffdd00'/><rect x='9' y='5' width='2' height='2' fill='%23ffdd00'/></svg>`,
  // History book
  history: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='2' width='10' height='12' fill='%23553300'/><rect x='4' y='3' width='8' height='10' fill='%23775533'/><rect x='5' y='4' width='6' height='1' fill='%23f0c040'/><rect x='5' y='6' width='6' height='1' fill='%23ddddaa'/><rect x='5' y='8' width='4' height='1' fill='%23ddddaa'/><rect x='5' y='10' width='5' height='1' fill='%23ddddaa'/><rect x='3' y='2' width='1' height='12' fill='%23331100'/></svg>`,
  // Mirror
  mirror: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='2' width='8' height='10' fill='%23334466'/><rect x='5' y='3' width='6' height='8' fill='%2300ccff'/><rect x='6' y='4' width='4' height='6' fill='%2333ddff'/><rect x='6' y='4' width='2' height='3' fill='%23aaeeff'/><rect x='5' y='12' width='6' height='2' fill='%23556688'/><rect x='7' y='14' width='2' height='1' fill='%23334466'/></svg>`,
  // Musical note (echo)
  echo: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='8' y='2' width='2' height='8' fill='%2300cc88'/><rect x='10' y='2' width='2' height='6' fill='%2300cc88'/><rect x='6' y='9' width='4' height='3' fill='%2300cc88'/><rect x='8' y='10' width='3' height='3' fill='%2300ff99'/><rect x='3' y='5' width='2' height='1' fill='%2300cc88'/><rect x='3' y='7' width='3' height='1' fill='%2300cc88'/><rect x='3' y='9' width='2' height='1' fill='%2300cc88'/></svg>`,
  // Resonance rings
  resonance: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='7' width='2' height='2' fill='%23f0c040'/><rect x='5' y='5' width='6' height='1' fill='%23f0c040'/><rect x='5' y='10' width='6' height='1' fill='%23f0c040'/><rect x='4' y='6' width='1' height='4' fill='%23f0c040'/><rect x='11' y='6' width='1' height='4' fill='%23f0c040'/><rect x='3' y='4' width='10' height='1' fill='%23c8a020'/><rect x='3' y='11' width='10' height='1' fill='%23c8a020'/><rect x='2' y='5' width='1' height='6' fill='%23c8a020'/><rect x='13' y='5' width='1' height='6' fill='%23c8a020'/></svg>`,
  // Book (lexicon)
  book: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='2' width='10' height='12' fill='%230066cc'/><rect x='4' y='3' width='8' height='10' fill='%230088ff'/><rect x='5' y='4' width='6' height='1' fill='%23ffffff'/><rect x='5' y='6' width='6' height='1' fill='%23aaccff'/><rect x='5' y='8' width='4' height='1' fill='%23aaccff'/><rect x='5' y='10' width='5' height='1' fill='%23aaccff'/><rect x='3' y='2' width='1' height='12' fill='%23004499'/></svg>`,
  // Ghost (phantom)
  ghost: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='5' width='8' height='8' fill='%23aaaacc'/><rect x='5' y='4' width='6' height='8' fill='%23ccccee'/><rect x='3' y='7' width='10' height='6' fill='%23ccccee'/><rect x='3' y='13' width='2' height='2' fill='%23ccccee'/><rect x='7' y='13' width='2' height='2' fill='%23ccccee'/><rect x='11' y='13' width='2' height='2' fill='%23ccccee'/><rect x='5' y='8' width='2' height='2' fill='%23333366'/><rect x='9' y='8' width='2' height='2' fill='%23333366'/></svg>`,
  // Zero / empty (zero hour)
  zero: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='3' width='6' height='1' fill='%23ef4444'/><rect x='4' y='4' width='1' height='8' fill='%23ef4444'/><rect x='11' y='4' width='1' height='8' fill='%23ef4444'/><rect x='5' y='12' width='6' height='1' fill='%23ef4444'/><rect x='5' y='4' width='6' height='8' fill='%23ef444420'/><rect x='6' y='5' width='1' height='6' fill='%23ef444440'/></svg>`,
  // Catalyst atom
  atom: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='7' width='2' height='2' fill='%23ff4444'/><rect x='3' y='6' width='10' height='1' fill='%23ff8888'/><rect x='5' y='3' width='1' height='10' fill='%23ff8888'/><rect x='10' y='3' width='1' height='10' fill='%23ff8888'/><rect x='3' y='9' width='10' height='1' fill='%23ff8888'/><rect x='5' y='4' width='6' height='1' fill='%23ffaaaa'/><rect x='5' y='11' width='6' height='1' fill='%23ffaaaa'/></svg>`,
  // Dejavu swirl
  swirl: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='6' y='3' width='4' height='1' fill='%2300e5ff'/><rect x='4' y='4' width='2' height='2' fill='%2300e5ff'/><rect x='10' y='4' width='2' height='2' fill='%2300e5ff'/><rect x='3' y='6' width='1' height='4' fill='%2300e5ff'/><rect x='12' y='6' width='1' height='4' fill='%2300e5ff'/><rect x='4' y='10' width='2' height='2' fill='%2300e5ff'/><rect x='10' y='10' width='2' height='2' fill='%2300e5ff'/><rect x='6' y='12' width='4' height='1' fill='%2300e5ff'/><rect x='6' y='6' width='4' height='4' fill='%2300e5ff40'/><rect x='7' y='7' width='2' height='2' fill='%2300e5ff'/></svg>`,
  // Double coin (double or nothing)
  double: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='5' width='6' height='6' fill='%23f0c040'/><rect x='3' y='6' width='4' height='4' fill='%23f8d860'/><rect x='8' y='5' width='6' height='6' fill='%23f0c040'/><rect x='9' y='6' width='4' height='4' fill='%23f8d860'/><rect x='4' y='7' width='2' height='2' fill='%23c8a020'/><rect x='10' y='7' width='2' height='2' fill='%23c8a020'/></svg>`,
  // Muscle (iron routine)
  muscle: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='1' y='7' width='3' height='2' fill='%23888'/><rect x='12' y='7' width='3' height='2' fill='%23888'/><rect x='3' y='6' width='3' height='4' fill='%23aaa'/><rect x='10' y='6' width='3' height='4' fill='%23aaa'/><rect x='5' y='5' width='6' height='6' fill='%23ef4444'/><rect x='6' y='4' width='4' height='8' fill='%23ff6666'/><rect x='7' y='3' width='2' height='10' fill='%23ff4444'/></svg>`,
};

export const MUTATORS = [
  // ── AMPLIFIERS ──
  { id: "bloodwork", name: "BLOODWORK", icon: "/items/bloodwork.webp", cost: 600, cat: "amplifier", toggle: false, durationDays: null, desc: "Science sessions give +20% Rank XP. Other subjects give -5%.", synergy: "tunnel_vision" },
  { id: "monks_path", name: "MONK'S PATH", icon: "/items/monks_path.webp", cost: 700, cat: "amplifier", toggle: false, durationDays: null, desc: "Prayer/Meditation +40% Rank XP. Streak log gives +2 XP instead of +1.", synergy: "ascetic_loop" },
  { id: "iron_routine", name: "IRON ROUTINE", icon: "/items/iron_routine.webp", cost: 800, cat: "amplifier", toggle: false, durationDays: null, desc: "Exercise/Running +25% Rank XP. Miss a daily → lose bonus for 24h.", synergy: null },
  { id: "lexicon", name: "LEXICON", icon: "/items/lexicon.webp", cost: 600, cat: "amplifier", toggle: false, durationDays: null, desc: "Language sessions +20% Rank XP. +0.01 Gc per session.", synergy: "echo" },
  { id: "night_owl", name: "NIGHT OWL", icon: "/items/night_owl.webp", cost: 500, cat: "amplifier", toggle: false, durationDays: null, desc: "Sessions after 21:00 give +30% Rank XP. Before 09:00: -10%.", synergy: null, conflicts: ["early_riser"] },
  { id: "early_riser", name: "EARLY RISER", icon: "/items/early_riser.webp", cost: 500, cat: "amplifier", toggle: false, durationDays: null, desc: "Sessions before 09:00 give +30% Rank XP. After 21:00: -10%.", synergy: null, conflicts: ["night_owl"] },
  { id: "tunnel_vision", name: "TUNNEL VISION", icon: "/items/tunnel_vision.webp", cost: 900, cat: "amplifier", toggle: false, durationDays: null, desc: "Log ONLY one subject/day: +50% Rank XP. Log 2+: bonus lost.", synergy: "bloodwork" },
  // ── ECONOMY ──
  { id: "loan_shark", name: "LOAN SHARK", icon: "/items/loan_shark.webp", cost: 400, cat: "economy", toggle: false, durationDays: null, desc: "+40% Gold from tasks. Every midnight: lose 30G.", synergy: "compound" },
  { id: "compound", name: "COMPOUND", icon: "/items/compound.webp", cost: 1000, cat: "economy", toggle: false, durationDays: null, desc: "Every 100G you own generates +1G/day passively.", synergy: "loan_shark" },
  { id: "miser", name: "MISER", icon: "/items/miser.webp", cost: 700, cat: "economy", toggle: true, durationDays: null, desc: "Cannot spend Gold on shop items. Each 24h without spending: +5 Rank XP.", synergy: null },
  { id: "tithe", name: "TITHE", icon: "/items/tithe.webp", cost: 800, cat: "economy", toggle: false, durationDays: null, desc: "Each task: pay 3G or lose 5 HP. But +15% Rank XP from all tasks.", synergy: "compound" },
  // ── STREAK ──
    
  { id: "ascetic_loop", name: "ASCETIC LOOP", icon: "/items/ascetic_loop.webp", cost: 900, cat: "streak", toggle: false, durationDays: null, desc: "Streak gives Rank XP: streak×0.2 per day. Break streak: lose all bonus XP.", synergy: "monks_path" },
  { id: "double_nothing", name: "DOUBLE OR NOTHING", icon: "/items/double_nothing.webp", cost: 1200, cat: "streak", toggle: true, durationDays: null, desc: "Streak milestone rewards doubled. Miss 2 days in a row: streak resets to 0.", synergy: null },
  { id: "momentum", name: "MOMENTUM", icon: "/items/momentum.webp", cost: 800, cat: "streak", toggle: false, durationDays: null, desc: "Each day with 1h+ logged: +2% Rank XP, stacks to +20%. Miss: resets.", synergy: "phantom_load" },
  // ── CHALLENGE ──
  { id: "diversity_lock", name: "DIVERSITY LOCK", icon: "/items/diversity_lock.webp", cost: 500, cat: "challenge", toggle: false, durationDays: 30, desc: "Cannot log same subject two sessions in a row. Reward: +20% Rank XP for 30d.", synergy: null },
  { id: "silence", name: "SILENCE", icon: "/items/silence.webp", cost: 400, cat: "challenge", toggle: false, durationDays: 2, desc: "All skills disabled 48h. After: all cooldowns → 0.", synergy: null },
  { id: "ironman", name: "IRONMAN", icon: "/items/ironman.webp", cost: 3000, cat: "challenge", toggle: false, durationDays: null, permanent_lock: true, desc: "HP hits 0 → forced prestige. In return: all Rank XP +15% forever.", synergy: null },
  { id: "glass_cannon", name: "GLASS CANNON", icon: "/items/glass_cannon.webp", cost: 600, cat: "challenge", toggle: true, durationDays: null, desc: "Rank XP +25%. HP loss from misses +60%.", synergy: null },
  { id: "zero_hour", name: "ZERO HOUR", icon: "/items/zero_hour.webp", cost: 1000, cat: "challenge", toggle: false, durationDays: 7, desc: "No Gold earned for 7 days. After: get back 3× everything you would've earned.", synergy: null },
  // ── SYNERGY BUILDERS ──
  { id: "catalyst", name: "CATALYST", icon: "/items/catalyst.webp", cost: 1500, cat: "synergy", toggle: false, durationDays: null, desc: "Each OTHER active mutator gives +8% Rank XP. Alone: useless.", synergy: null },
  { id: "echo", name: "ECHO", icon: "/items/echo.webp", cost: 1200, cat: "synergy", toggle: false, durationDays: null, desc: "Last subject logged gives double metric gains on NEXT session (diff subject).", synergy: "lexicon" },
  { id: "mirror", name: "MIRROR", icon: "/items/mirror.webp", cost: 1100, cat: "synergy", toggle: false, durationDays: null, desc: "Same domain task as last session: +15% boss damage.", synergy: "tunnel_vision" },
  { id: "resonance", name: "RESONANCE", icon: "/items/resonance.webp", cost: 1400, cat: "synergy", toggle: false, durationDays: null, desc: "If 2+ active mutators share a category: +10% to ALL their effects.", synergy: null },
  // ── WILD ──
  { id: "gambler", name: "GAMBLER", icon: "/items/gambler.webp", cost: 800, cat: "wild", toggle: false, durationDays: null, desc: "Each task: 20% chance double rewards, 20% chance 0 rewards, 60% normal.", synergy: "catalyst" },
  { id: "phantom_load", name: "PHANTOM LOAD", icon: "/items/phantom_load.webp", cost: 700, cat: "wild", toggle: false, durationDays: null, desc: "Yesterday's hours count as +30% today for Rank XP calculation.", synergy: "momentum" },
  { id: "cursed_clock", name: "CURSED CLOCK", icon: "/items/cursed_clock.webp", cost: 900, cat: "wild", toggle: false, durationDays: null, desc: "Every idle hour (8:00–22:00): lose 2G. But +1 Rank XP per logged hour.", synergy: null },
  { id: "deja_vu", name: "DÉJÀ VU", icon: "/items/deja_vu.webp", cost: 1000, cat: "wild", toggle: false, durationDays: null, desc: "Same subject 3 days in a row: 3rd session +50% Rank XP. 4th day: normal.", synergy: null },
  { id: "volatile", name: "VOLATILE", icon: "/items/volatile.webp", cost: 1300, cat: "wild", toggle: false, durationDays: null, desc: "First task each day: +100% rewards. Last (5+ tasks): +50%. Between: -10%.", synergy: null },
  { id: "weight_of_history", name: "WEIGHT OF HISTORY", icon: "/items/weight_of_history.webp", cost: 1500, cat: "wild", toggle: false, durationDays: null, desc: "Lifetime hours / 100 = permanent bonus % Rank XP. At 500h: +5%. At 1000h: +10%.", synergy: null },
];

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────

export function loadRPGData() {
  const get = (key, def) => { try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; } };
  return {
    classData: get("mindos_class", { chosen: null, mana: 0, maxMana: 0, skills: [] }),
    activeEffects: get("mindos_active_effects", []),
    skillTree: get("mindos_skillTree", { unlockedNodes: [], skillPoints: 0 }),
    alliesData: get("mindos_allies", { recruited: [], levels: {} }),
    achievements: get("mindos_achievements", { unlocked: [], progress: {} }),
    titles: get("mindos_titles", { earned: [], active: "" }),
    mutators: get("mindos_mutators", { active: [], purchased: [] }),
    prestige: get("mindos_prestige", { count: 0, iqCeilingBonus: 0 }),
  };
}

export function saveRPGData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── HELPER FUNCTIONS FOR SKILL EFFECTS ───────────────────────────────────────

function getMidnightTimestamp() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return midnight.getTime();
}

export function addActiveEffect(effect) {
  let rpgData = loadRPGData();
  let newEffects = [...rpgData.activeEffects.filter(e => e.id !== effect.id), effect];
  rpgData.activeEffects = newEffects;
  saveRPGData("mindos_active_effects", newEffects);
  return rpgData;
}

export function removeExpiredEffects() {
  let rpgData = loadRPGData();
  const now = Date.now();
  const filteredEffects = rpgData.activeEffects.filter(effect => !effect.expiresAt || effect.expiresAt > now);
  if (filteredEffects.length !== rpgData.activeEffects.length) {
    saveRPGData("mindos_active_effects", filteredEffects);
    rpgData.activeEffects = filteredEffects;
  }
  return rpgData;
}

export function getActiveEffect(id) {
  const rpgData = removeExpiredEffects(); // Clean up expired effects first
  return rpgData.activeEffects.find(effect => effect.id === id);
}

// ─── SKILL EFFECT APPLICATION ─────────────────────────────────────────────────

export function applySkillEffect(skillId, currentClassData) {
  let rpgData = loadRPGData(); // Load all RPG data
  let updatedClassData = { ...currentClassData };
  let gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");

  // Deduct mana (except for tactical_retreat which handles its own mana)
  const cls = CLASSES[currentClassData.chosen];
  if (cls) {
    const skill = cls.skills.find(s => s.id === skillId);
    if (skill && skillId !== "tactical_retreat") {
      updatedClassData.mana = Math.max(0, (updatedClassData.mana || 0) - skill.mana);
    }
  }

  switch (skillId) {
    // ARCHITECT SKILLS
    case "blueprint":
      rpgData = addActiveEffect({
        id: "blueprint_effect",
        skill: "blueprint",
        tasksRemaining: 3,
        xpBoost: 0.5, // +50%
        expiresAt: getMidnightTimestamp(),
      });
      console.log("Skill BLUEPRINT activated: Next 3 tasks give +50% Rank XP.");
      break;

    case "system_overload":
      rpgData = addActiveEffect({
        id: "system_overload_effect",
        skill: "system_overload",
        damageMultiplier: 3,
        active: true, // Will be consumed on next boss task completion
        expiresAt: Date.now() + 24 * 3600000, // Expires in 24 hours if not used
      });
      console.log("Skill SYSTEM OVERLOAD activated: Next boss task deals 3x damage.");
      break;

    case "infinite_loop":
      rpgData = addActiveEffect({
        id: "infinite_loop_effect",
        skill: "infinite_loop",
        duration: 2 * 3600000, // 2 hours
        cognitiveMetricsBoost: 2, // 2x
        expiresAt: Date.now() + 2 * 3600000,
      });
      console.log("Skill INFINITE LOOP activated: Cognitive metrics doubled for 2 hours.");
      break;

    // ASCETIC SKILLS
    case "iron_fast":
      rpgData = addActiveEffect({
        id: "iron_fast_effect",
        skill: "iron_fast",
        healingPerTask: 5,
        noDailyPenalty: true,
        expiresAt: Date.now() + 24 * 3600000, // For 24h
      });
      console.log("Skill IRON FAST activated: Tasks restore HP, no daily penalty for 24h.");
      break;

    case "contemplate":
      if (gs.gf !== undefined) gs.gf += 3;
      if (gs.gc !== undefined) gs.gc += 3;
      if (gs.ps !== undefined) gs.ps += 3;
      if (gs.vm !== undefined) gs.vm += 3;
      localStorage.setItem("mindos_game_state", JSON.stringify(gs));
      console.log("Skill CONTEMPLATE activated: Gained +3 Gf, Gc, Ps, Vm.");
      break;

    case "transcendence":
      rpgData = addActiveEffect({
        id: "transcendence_effect",
        skill: "transcendence",
        streakCannotBreak: true,
        rivalXPFrozen: true,
        expiresAt: Date.now() + 48 * 3600000, // For 48h
      });
      console.log("Skill TRANSCENDENCE activated: Streak cannot break, rival XP frozen for 48h.");
      break;

    // LINGUIST SKILLS
    case "babel_mode":
      rpgData = addActiveEffect({
        id: "babel_mode_effect",
        skill: "babel_mode",
        tripleSubjectCount: true,
        expiresAt: getMidnightTimestamp(), // Next session until midnight
      });
      console.log("Skill BABEL MODE activated: Next language session counts for all three subjects.");
      break;

    case "polyglot_surge":
      console.log("Skill POLYGLOT SURGE activated: Pushed all language subject ranks forward by 2 virtual hours each.");
      break;

    case "memetic_transfer":
      rpgData = addActiveEffect({
        id: "memetic_transfer_effect",
        skill: "memetic_transfer",
        memoryTaskProgressBoost: 2, // 2x progress
        mirrorGcVmToGf: true, // Gc and Vm gains also mirror as Gf gains at 50% rate.
        expiresAt: Date.now() + 24 * 3600000, // For 24h
      });
      console.log("Skill MEMETIC TRANSFER activated: Memory tasks give 2x progress for 24h, Gc/Vm mirror to Gf.");
      break;

    // WARLORD SKILLS
    case "battle_fury":
      rpgData = addActiveEffect({
        id: "battle_fury_effect",
        skill: "battle_fury",
        physicalDamageBoost: 0.5, // +50%
        manaRegenPenalty: 0.2, // -20% (This requires a mana regen system)
        expiresAt: Date.now() + 1 * 3600000, // For 1 hour
      });
      console.log("Skill BATTLE FURY activated: +50% physical damage, -20% mana regen for 1 hour.");
      break;

    case "war_cry":
      rpgData = addActiveEffect({
        id: "war_cry_effect",
        skill: "war_cry",
        bossHPPercentReduction: 0.10, // 10%
        stunBossFor: 1 * 3600000, // Stun for 1 hour (no boss damage)
        expiresAt: Date.now() + 1 * 3600000, // Effect lasts 1 hour
      });
      console.log("Skill WAR CRY activated: Reduced boss HP by 10% and stunned for 1 hour.");
      break;

    case "tactical_retreat":
      updatedClassData.mana = Math.min(updatedClassData.maxMana, (updatedClassData.mana || 0) + (updatedClassData.maxMana * 0.25));
      saveRPGData("mindos_class", updatedClassData); // Save mana change immediately
      console.log("Skill TACTICAL RETREAT activated: Reset boss encounter, gained 25% mana back.");
      break;

    default:
      console.warn(`Attempted to activate unknown skill: ${skillId}`);
      break;
  }

  // Save updated class data if any direct modifications were made (e.g., Tactical Retreat)
  saveRPGData("mindos_class", updatedClassData);

  return updatedClassData;
}