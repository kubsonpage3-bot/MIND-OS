import { getMediaUrl } from "@/api/djangoClient";

// ─── RPG SYSTEM DATA & LOGIC ─────────────────────────────────────────────────

import architectSpriteF from "/images/webp/architect_f.webp";
import architectSpriteD from "/images/webp/architect_d.webp";
import architectSpriteC from "/images/webp/architect_c.webp";
import architectSpriteB from "/images/webp/architect_b.webp";
import architectSpriteA from "/images/webp/architect_a.webp";
import architectSpriteS from "/images/webp/architect_s.webp";
import architectSpriteSS from "/images/webp/architect_ss.webp";
import architectSpriteSSS from "/images/webp/architect_sss.webp";
import asceticSpriteF from "/images/webp/ascetic_f.webp";
import asceticSpriteD from "/images/webp/ascetic_d.webp";
import asceticSpriteC from "/images/webp/ascetic_c.webp";
import asceticSpriteB from "/images/webp/ascetic_b.webp";
import asceticSpriteA from "/images/webp/ascetic_a.webp";
import asceticSpriteS from "/images/webp/ascetic_s.webp";
import asceticSpriteSS from "/images/webp/ascetic_ss.webp";
import asceticSpriteSSS from "/images/webp/ascetic_sss.webp";
import linguistSpriteF from "/images/webp/linguist_f.webp";
import linguistSpriteD from "/images/webp/linguist_d.webp";
import linguistSpriteC from "/images/webp/linguist_c.webp";
import linguistSpriteB from "/images/webp/linguist_b.webp";
import linguistSpriteA from "/images/webp/linguist_a.webp";
import linguistSpriteS from "/images/webp/linguist_s.webp";
import linguistSpriteSS from "/images/webp/linguist_ss.webp";
import linguistSpriteSSS from "/images/webp/linguist_sss.webp";
import warlordSpriteF from "/images/webp/warlord_f.webp";
import warlordSpriteD from "/images/webp/warlord_d.webp";
import warlordSpriteC from "/images/webp/warlord_c.webp";
import warlordSpriteB from "/images/webp/warlord_b.webp";
import warlordSpriteA from "/images/webp/warlord_a.webp";
import warlordSpriteS from "/images/webp/warlord_s.webp";
import warlordSpriteSS from "/images/webp/warlord_ss.webp";
import warlordSpriteSSS from "/images/webp/warlord_sss.webp";

// Character sprites per class (used in ClassSelector and PixelCharacter)
export const CLASS_SPRITES = {
  architect: {
    F: architectSpriteF,
    D: architectSpriteD,
    C: architectSpriteC,
    B: architectSpriteB,
    A: architectSpriteA,
    S: architectSpriteS,
    SS: architectSpriteSS,
    SSS: architectSpriteSSS,
  },
  ascetic: {
    F: asceticSpriteF,
    D: asceticSpriteD,
    C: asceticSpriteC,
    B: asceticSpriteB,
    A: asceticSpriteA,
    S: asceticSpriteS,
    SS: asceticSpriteSS,
    SSS: asceticSpriteSSS,
  },
  linguist: {
    F: linguistSpriteF,
    D: linguistSpriteD,
    C: linguistSpriteC,
    B: linguistSpriteB,
    A: linguistSpriteA,
    S: linguistSpriteS,
    SS: linguistSpriteSS,
    SSS: linguistSpriteSSS,
  },
  warlord: {
    F: warlordSpriteF,
    D: warlordSpriteD,
    C: warlordSpriteC,
    B: warlordSpriteB,
    A: warlordSpriteA,
    S: warlordSpriteS,
    SS: warlordSpriteSS,
    SSS: warlordSpriteSSS,
  },
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
    name: "rpgData.classes.architect.name",
    color: "#00e5ff",
    lore: "rpgData.classes.architect.lore",
    stats: { pwr: 3, def: 4, foc: 12, mem: 10, spd: 5, lck: 6 },
    maxMana: 120,
    skills: [
      { id: "blueprint", name: "rpgData.skills.blueprint.name", mana: 40, cooldownH: 24, desc: "rpgData.skills.blueprint.desc" },
      { id: "system_overload", name: "rpgData.skills.system_overload.name", mana: 70, cooldownH: 24, desc: "rpgData.skills.system_overload.desc" },
      { id: "infinite_loop", name: "rpgData.skills.infinite_loop.name", mana: 100, cooldownH: 24, desc: "rpgData.skills.infinite_loop.desc" },
    ],
  },
  ascetic: {
    id: "ascetic",
    name: "rpgData.classes.ascetic.name",
    color: "#9944ff",
    lore: "rpgData.classes.ascetic.lore",
    stats: { pwr: 7, def: 8, foc: 7, mem: 10, spd: 7, lck: 6 },
    maxMana: 100,
    skills: [
      { id: "iron_fast", name: "rpgData.skills.iron_fast.name", mana: 35, cooldownH: 24, desc: "rpgData.skills.iron_fast.desc" },
      { id: "contemplate", name: "rpgData.skills.contemplate.name", mana: 60, cooldownH: 24, desc: "rpgData.skills.contemplate.desc" },
      { id: "transcendence", name: "rpgData.skills.transcendence.name", mana: 90, cooldownH: 24, desc: "rpgData.skills.transcendence.desc" },
    ],
  },
  linguist: {
    id: "linguist",
    name: "rpgData.classes.linguist.name",
    color: "#00cc88",
    lore: "rpgData.classes.linguist.lore",
    stats: { pwr: 5, def: 5, foc: 10, mem: 11, spd: 9, lck: 5 },
    maxMana: 110,
    skills: [
      { id: "babel_mode", name: "rpgData.skills.babel_mode.name", mana: 40, cooldownH: 24, desc: "rpgData.skills.babel_mode.desc" },
      { id: "polyglot_surge", name: "rpgData.skills.polyglot_surge.name", mana: 65, cooldownH: 24, desc: "rpgData.skills.polyglot_surge.desc" },
      { id: "memetic_transfer", name: "rpgData.skills.memetic_transfer.name", mana: 95, cooldownH: 24, desc: "rpgData.skills.memetic_transfer.desc" },
    ],
  },
  warlord: {
    id: "warlord",
    name: "rpgData.classes.warlord.name",
    color: "#ff3355",
    lore: "rpgData.classes.warlord.lore",
    stats: { pwr: 14, def: 10, foc: 5, mem: 4, spd: 10, lck: 7 },
    maxMana: 110,
    skills: [
      { id: "battle_fury", name: "rpgData.skills.battle_fury.name", mana: 45, cooldownH: 24, desc: "rpgData.skills.battle_fury.desc" },
      { id: "war_cry", name: "rpgData.skills.war_cry.name", mana: 75, cooldownH: 24, desc: "rpgData.skills.war_cry.desc" },
      { id: "tactical_retreat", name: "rpgData.skills.tactical_retreat.name", mana: 80, cooldownH: 24, desc: "rpgData.skills.tactical_retreat.desc" },
    ],
  },
};

// ─── SKILL TREE ───────────────────────────────────────────────────────────────

export const SKILL_TREE = {
  mind: {
    label: "MIND", color: "#3b82f6",
    nodes: [
      { id: "sharp_focus", tier: 1, name: "rpgData.skillTree.sharp_focus.name", desc: "rpgData.skillTree.sharp_focus.desc", sp: 3, gold: 100 },
      { id: "deep_concentration", tier: 2, name: "rpgData.skillTree.deep_concentration.name", desc: "rpgData.skillTree.deep_concentration.desc", requires: "sharp_focus", sp: 6, gold: 250 },
      { id: "flow_state", tier: 3, name: "rpgData.skillTree.flow_state.name", desc: "rpgData.skillTree.flow_state.desc", requires: "deep_concentration", sp: 10, gold: 500 },
      { id: "neural_expansion", tier: 4, name: "rpgData.skillTree.neural_expansion.name", desc: "rpgData.skillTree.neural_expansion.desc", requires: "flow_state", sp: 15, gold: 800 },
      { id: "cognitive_supremacy", tier: 5, name: "rpgData.skillTree.cognitive_supremacy.name", desc: "rpgData.skillTree.cognitive_supremacy.desc", requires: "neural_expansion", sp: 22, gold: 1500 },
      { id: "godmind", tier: 6, name: "rpgData.skillTree.godmind.name", desc: "rpgData.skillTree.godmind.desc", requires: "cognitive_supremacy", sp: 35, gold: 3000 },
    ],
  },
  body: {
    label: "BODY", color: "#ff4400",
    nodes: [
      { id: "iron_conditioning", tier: 1, name: "rpgData.skillTree.iron_conditioning.name", desc: "rpgData.skillTree.iron_conditioning.desc", sp: 3, gold: 100 },
      { id: "endurance_protocol", tier: 2, name: "rpgData.skillTree.endurance_protocol.name", desc: "rpgData.skillTree.endurance_protocol.desc", requires: "iron_conditioning", sp: 6, gold: 250 },
      { id: "combat_reflexes", tier: 3, name: "rpgData.skillTree.combat_reflexes.name", desc: "rpgData.skillTree.combat_reflexes.desc", requires: "endurance_protocol", sp: 10, gold: 500 },
      { id: "pain_threshold", tier: 4, name: "rpgData.skillTree.pain_threshold.name", desc: "rpgData.skillTree.pain_threshold.desc", requires: "combat_reflexes", sp: 15, gold: 800 },
      { id: "unbreakable", tier: 5, name: "rpgData.skillTree.unbreakable.name", desc: "rpgData.skillTree.unbreakable.desc", requires: "pain_threshold", sp: 22, gold: 1500 },
      { id: "apex_predator", tier: 6, name: "rpgData.skillTree.apex_predator.name", desc: "rpgData.skillTree.apex_predator.desc", requires: "unbreakable", sp: 35, gold: 3000 },
    ],
  },
  wealth: {
    label: "WEALTH", color: "#f0c040",
    nodes: [
      { id: "resource_awareness", tier: 1, name: "rpgData.skillTree.resource_awareness.name", desc: "rpgData.skillTree.resource_awareness.desc", sp: 3, gold: 100 },
      { id: "compound_returns", tier: 2, name: "rpgData.skillTree.compound_returns.name", desc: "rpgData.skillTree.compound_returns.desc", requires: "resource_awareness", sp: 6, gold: 250 },
      { id: "loot_magnetism", tier: 3, name: "rpgData.skillTree.loot_magnetism.name", desc: "rpgData.skillTree.loot_magnetism.desc", requires: "compound_returns", sp: 10, gold: 500 },
      { id: "market_knowledge", tier: 4, name: "rpgData.skillTree.market_knowledge.name", desc: "rpgData.skillTree.market_knowledge.desc", requires: "loot_magnetism", sp: 15, gold: 800 },
      { id: "fortunes_favor", tier: 5, name: "rpgData.skillTree.fortunes_favor.name", desc: "rpgData.skillTree.fortunes_favor.desc", requires: "market_knowledge", sp: 22, gold: 1500 },
      { id: "golden_mind", tier: 6, name: "rpgData.skillTree.golden_mind.name", desc: "rpgData.skillTree.golden_mind.desc", requires: "fortunes_favor", sp: 35, gold: 3000 },
    ],
  },
  spirit: {
    label: "SPIRIT", color: "#9944ff",
    nodes: [
      { id: "inner_stillness", tier: 1, name: "rpgData.skillTree.inner_stillness.name", desc: "rpgData.skillTree.inner_stillness.desc", sp: 3, gold: 100 },
      { id: "resilience", tier: 2, name: "rpgData.skillTree.resilience.name", desc: "rpgData.skillTree.resilience.desc", requires: "inner_stillness", sp: 6, gold: 250 },
      { id: "mindguard", tier: 3, name: "rpgData.skillTree.mindguard.name", desc: "rpgData.skillTree.mindguard.desc", requires: "resilience", sp: 10, gold: 500 },
      { id: "aura_of_focus", tier: 4, name: "rpgData.skillTree.aura_of_focus.name", desc: "rpgData.skillTree.aura_of_focus.desc", requires: "mindguard", sp: 15, gold: 800 },
      { id: "transcendent_will", tier: 5, name: "rpgData.skillTree.transcendent_will.name", desc: "rpgData.skillTree.transcendent_will.desc", requires: "aura_of_focus", sp: 22, gold: 1500 },
      { id: "void_clarity", tier: 6, name: "rpgData.skillTree.void_clarity.name", desc: "rpgData.skillTree.void_clarity.desc", requires: "transcendent_will", sp: 35, gold: 3000 },
    ],
  },
  knowledge: {
    label: "KNOWLEDGE", color: "#00cc88",
    nodes: [
      { id: "polymath", tier: 1, name: "rpgData.skillTree.polymath.name", desc: "rpgData.skillTree.polymath.desc", sp: 3, gold: 100 },
      { id: "cross_training", tier: 2, name: "rpgData.skillTree.cross_training.name", desc: "rpgData.skillTree.cross_training.desc", requires: "polymath", sp: 6, gold: 250 },
      { id: "encyclopedia", tier: 3, name: "rpgData.skillTree.encyclopedia.name", desc: "rpgData.skillTree.encyclopedia.desc", requires: "cross_training", sp: 10, gold: 500 },
      { id: "master_of_arts", tier: 4, name: "rpgData.skillTree.master_of_arts.name", desc: "rpgData.skillTree.master_of_arts.desc", requires: "encyclopedia", sp: 15, gold: 800 },
      { id: "living_library", tier: 5, name: "rpgData.skillTree.living_library.name", desc: "rpgData.skillTree.living_library.desc", requires: "master_of_arts", sp: 22, gold: 1500 },
      { id: "omniscience", tier: 6, name: "rpgData.skillTree.omniscience.name", desc: "rpgData.skillTree.omniscience.desc", requires: "living_library", sp: 35, gold: 3000 },
    ],
  },
};

// ─── ALLIES ───────────────────────────────────────────────────────────────────

export const ALLY_RANKS = ["E", "D", "C", "B", "A", "S"];


// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  // Consistency
  { id: "first_step", name: "rpgData.achievements.first_step.name", cat: "consistency", color: "#f59e0b", icon: "👣", desc: "rpgData.achievements.first_step.desc", reward: "rpgData.achievements.first_step.reward", check: (s) => s.totalSessions >= 1 },
  { id: "seven_suns", name: "rpgData.achievements.seven_suns.name", cat: "consistency", color: "#f59e0b", icon: "☀️", desc: "rpgData.achievements.seven_suns.desc", reward: "rpgData.achievements.seven_suns.reward", check: (s) => s.maxStreak >= 7 },
  { id: "iron_will", name: "rpgData.achievements.iron_will.name", cat: "consistency", color: "#f59e0b", icon: "🔩", desc: "rpgData.achievements.iron_will.desc", reward: "rpgData.achievements.iron_will.reward", check: (s) => s.maxStreak >= 30 },
  { id: "unbroken", name: "rpgData.achievements.unbroken.name", cat: "consistency", color: "#f59e0b", icon: "⛓️", desc: "rpgData.achievements.unbroken.desc", reward: "rpgData.achievements.unbroken.reward", check: (s) => s.maxStreak >= 100 },
  { id: "eternal", name: "rpgData.achievements.eternal.name", cat: "consistency", color: "#f59e0b", icon: "♾️", desc: "rpgData.achievements.eternal.desc", reward: "rpgData.achievements.eternal.reward", check: (s) => s.maxStreak >= 365 },
  // Combat
  { id: "first_blood", name: "rpgData.achievements.first_blood.name", cat: "combat", color: "#ef4444", icon: "🩸", desc: "rpgData.achievements.first_blood.desc", reward: "rpgData.achievements.first_blood.reward", check: (s) => s.totalBossDamage >= 100 },
  { id: "boss_slayer", name: "rpgData.achievements.boss_slayer.name", cat: "combat", color: "#ef4444", icon: "⚔️", desc: "rpgData.achievements.boss_slayer.desc", reward: "rpgData.achievements.boss_slayer.reward", check: (s) => s.bossesDefeated >= 1 },
  { id: "dragon_hunter", name: "rpgData.achievements.dragon_hunter.name", cat: "combat", color: "#ef4444", icon: "🐉", desc: "rpgData.achievements.dragon_hunter.desc", reward: "rpgData.achievements.dragon_hunter.reward", check: (s) => s.bossesDefeated >= 4 },
  { id: "emperors_bane", name: "rpgData.achievements.emperors_bane.name", cat: "combat", color: "#ef4444", icon: "👑", desc: "rpgData.achievements.emperors_bane.desc", reward: "rpgData.achievements.emperors_bane.reward", check: (s) => s.bossesDefeated >= 5 },
  { id: "void_walker", name: "rpgData.achievements.void_walker.name", cat: "combat", color: "#ef4444", icon: "🌌", desc: "rpgData.achievements.void_walker.desc", reward: "rpgData.achievements.void_walker.reward", check: (s) => s.bossesDefeated >= 5 },
  // Knowledge
  { id: "first_session", name: "rpgData.achievements.first_session.name", cat: "knowledge", color: "#3b82f6", icon: "📚", desc: "rpgData.achievements.first_session.desc", reward: "rpgData.achievements.first_session.reward", check: (s) => s.totalSessions >= 1 },
  { id: "scholar", name: "rpgData.achievements.scholar.name", cat: "knowledge", color: "#3b82f6", icon: "🎓", desc: "rpgData.achievements.scholar.desc", reward: "rpgData.achievements.scholar.reward", check: (s) => s.totalSessions >= 50 },
  { id: "polymath_ach", name: "rpgData.achievements.polymath_ach.name", cat: "knowledge", color: "#3b82f6", icon: "🧩", desc: "rpgData.achievements.polymath_ach.desc", reward: "rpgData.achievements.polymath_ach.reward", check: (s) => s.uniqueSubjects >= 10 },
  { id: "master", name: "rpgData.achievements.master.name", cat: "knowledge", color: "#3b82f6", icon: "🏅", desc: "rpgData.achievements.master.desc", reward: "rpgData.achievements.master.reward", check: (s) => s.highestSubjectRank >= 4 },
  { id: "grandmaster", name: "rpgData.achievements.grandmaster.name", cat: "knowledge", color: "#3b82f6", icon: "🌟", desc: "rpgData.achievements.grandmaster.desc", reward: "rpgData.achievements.grandmaster.reward", check: (s) => s.highestSubjectRank >= 8 },
  // Wealth
  { id: "first_coin", name: "rpgData.achievements.first_coin.name", cat: "wealth", color: "#f0c040", icon: "🪙", desc: "rpgData.achievements.first_coin.desc", reward: "rpgData.achievements.first_coin.reward", check: (s) => s.totalGoldEarned >= 1 },
  { id: "merchant", name: "rpgData.achievements.merchant.name", cat: "wealth", color: "#f0c040", icon: "💰", desc: "rpgData.achievements.merchant.desc", reward: "rpgData.achievements.merchant.reward", check: (s) => s.totalGoldEarned >= 1000 },
  { id: "wealthy", name: "rpgData.achievements.wealthy.name", cat: "wealth", color: "#f0c040", icon: "💎", desc: "rpgData.achievements.wealthy.desc", reward: "rpgData.achievements.wealthy.reward", check: (s) => s.totalGoldEarned >= 10000 },
  { id: "tycoon", name: "rpgData.achievements.tycoon.name", cat: "wealth", color: "#f0c040", icon: "🏦", desc: "rpgData.achievements.tycoon.desc", reward: "rpgData.achievements.tycoon.reward", check: (s) => s.totalGoldEarned >= 100000 },
  // Spirit
  { id: "first_prayer", name: "rpgData.achievements.first_prayer.name", cat: "spirit", color: "#9944ff", icon: "🕊️", desc: "rpgData.achievements.first_prayer.desc", reward: "rpgData.achievements.first_prayer.reward", check: (s) => s.prayerSessions >= 1 },
  { id: "devotion", name: "rpgData.achievements.devotion.name", cat: "spirit", color: "#9944ff", icon: "📿", desc: "rpgData.achievements.devotion.desc", reward: "rpgData.achievements.devotion.reward", check: (s) => s.prayerSessions >= 20 },
  { id: "sanctified", name: "rpgData.achievements.sanctified.name", cat: "spirit", color: "#9944ff", icon: "✨", desc: "rpgData.achievements.sanctified.desc", reward: "rpgData.achievements.sanctified.reward", check: (s) => s.prayerRank >= 7 },
  // Combat Skill
  { id: "first_crit", name: "rpgData.achievements.first_crit.name", cat: "skill", color: "#00e5ff", icon: "💥", desc: "rpgData.achievements.first_crit.desc", reward: "rpgData.achievements.first_crit.reward", check: (s) => s.totalCrits >= 1 },
  { id: "precision", name: "rpgData.achievements.precision.name", cat: "skill", color: "#00e5ff", icon: "🎯", desc: "rpgData.achievements.precision.desc", reward: "rpgData.achievements.precision.reward", check: (s) => s.totalCrits >= 50 },
  { id: "sharpshooter", name: "rpgData.achievements.sharpshooter.name", cat: "skill", color: "#00e5ff", icon: "🏹", desc: "rpgData.achievements.sharpshooter.desc", reward: "rpgData.achievements.sharpshooter.reward", check: (s) => s.totalCrits >= 500 },
  // Allies
  { id: "first_ally", name: "rpgData.achievements.first_ally.name", cat: "allies", color: "#00cc88", icon: "🤝", desc: "rpgData.achievements.first_ally.desc", reward: "rpgData.achievements.first_ally.reward", check: (s) => s.alliesRecruited >= 1 },
  { id: "commander", name: "rpgData.achievements.commander.name", cat: "allies", color: "#00cc88", icon: "🎖️", desc: "rpgData.achievements.commander.desc", reward: "rpgData.achievements.commander.reward", check: (s) => s.alliesRecruited >= 3 },
  { id: "warlords_court", name: "rpgData.achievements.warlords_court.name", cat: "allies", color: "#00cc88", icon: "⚜️", desc: "rpgData.achievements.warlords_court.desc", reward: "rpgData.achievements.warlords_court.reward", check: (s) => s.alliesRecruited >= 5 },
  { id: "loyal_bonds", name: "rpgData.achievements.loyal_bonds.name", cat: "allies", color: "#00cc88", icon: "💜", desc: "rpgData.achievements.loyal_bonds.desc", reward: "rpgData.achievements.loyal_bonds.reward", check: (s) => s.allyMaxLevel >= 5 },
  // Prestige
  { id: "reborn", name: "rpgData.achievements.reborn.name", cat: "prestige", color: "#ffd700", icon: "🔄", desc: "rpgData.achievements.reborn.desc", reward: "rpgData.achievements.reborn.reward", check: (s) => s.prestigeCount >= 1 },
  { id: "phoenix", name: "rpgData.achievements.phoenix.name", cat: "prestige", color: "#ffd700", icon: "🦅", desc: "rpgData.achievements.phoenix.desc", reward: "rpgData.achievements.phoenix.reward", check: (s) => s.prestigeCount >= 3 },
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
  { id: "bloodwork", name: "rpgData.mutators.bloodwork.name", icon: getMediaUrl("/static/items/bloodwork.webp"), cost: 600, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.bloodwork.desc", synergy: "tunnel_vision" },
  { id: "monks_path", name: "rpgData.mutators.monks_path.name", icon: getMediaUrl("/static/items/monks_path.webp"), cost: 700, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.monks_path.desc", synergy: "ascetic_loop" },
  { id: "iron_routine", name: "rpgData.mutators.iron_routine.name", icon: getMediaUrl("/static/items/iron_routine.webp"), cost: 800, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.iron_routine.desc", synergy: null },
  { id: "lexicon", name: "rpgData.mutators.lexicon.name", icon: getMediaUrl("/static/items/lexicon.webp"), cost: 600, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.lexicon.desc", synergy: "echo" },
  { id: "night_owl", name: "rpgData.mutators.night_owl.name", icon: getMediaUrl("/static/items/night_owl.webp"), cost: 500, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.night_owl.desc", synergy: null, conflicts: ["early_riser"] },
  { id: "early_riser", name: "rpgData.mutators.early_riser.name", icon: getMediaUrl("/static/items/early_riser.webp"), cost: 500, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.early_riser.desc", synergy: null, conflicts: ["night_owl"] },
  { id: "tunnel_vision", name: "rpgData.mutators.tunnel_vision.name", icon: getMediaUrl("/static/items/tunnel_vision.webp"), cost: 900, cat: "amplifier", toggle: false, durationDays: null, desc: "rpgData.mutators.tunnel_vision.desc", synergy: "bloodwork", disabled: true },
  // ── ECONOMY ──
  { id: "loan_shark", name: "rpgData.mutators.loan_shark.name", icon: getMediaUrl("/static/items/loan_shark.webp"), cost: 400, cat: "economy", toggle: false, durationDays: null, desc: "rpgData.mutators.loan_shark.desc", synergy: "compound" },
  { id: "compound", name: "rpgData.mutators.compound.name", icon: getMediaUrl("/static/items/compound.webp"), cost: 1000, cat: "economy", toggle: false, durationDays: null, desc: "rpgData.mutators.compound.desc", synergy: "loan_shark" },
  { id: "miser", name: "rpgData.mutators.miser.name", icon: getMediaUrl("/static/items/miser.webp"), cost: 700, cat: "economy", toggle: true, durationDays: null, desc: "rpgData.mutators.miser.desc", synergy: null, disabled: true },
  { id: "tithe", name: "rpgData.mutators.tithe.name", icon: getMediaUrl("/static/items/tithe.webp"), cost: 800, cat: "economy", toggle: false, durationDays: null, desc: "rpgData.mutators.tithe.desc", synergy: "compound" },
  // ── STREAK ──
    
  { id: "ascetic_loop", name: "rpgData.mutators.ascetic_loop.name", icon: getMediaUrl("/static/items/ascetic_loop.webp"), cost: 900, cat: "streak", toggle: false, durationDays: null, desc: "rpgData.mutators.ascetic_loop.desc", synergy: "monks_path", disabled: true },
  { id: "double_nothing", name: "rpgData.mutators.double_nothing.name", icon: getMediaUrl("/static/items/double_nothing.webp"), cost: 1200, cat: "streak", toggle: true, durationDays: null, desc: "rpgData.mutators.double_nothing.desc", synergy: null },
  { id: "momentum", name: "rpgData.mutators.momentum.name", icon: getMediaUrl("/static/items/momentum.webp"), cost: 800, cat: "streak", toggle: false, durationDays: null, desc: "rpgData.mutators.momentum.desc", synergy: "phantom_load" },
  // ── CHALLENGE ──
  { id: "diversity_lock", name: "rpgData.mutators.diversity_lock.name", icon: getMediaUrl("/static/items/diversity_lock.webp"), cost: 500, cat: "challenge", toggle: false, durationDays: 30, desc: "rpgData.mutators.diversity_lock.desc", synergy: null },
  { id: "silence", name: "rpgData.mutators.silence.name", icon: getMediaUrl("/static/items/silence.webp"), cost: 400, cat: "challenge", toggle: false, durationDays: 2, desc: "rpgData.mutators.silence.desc", synergy: null },
  { id: "ironman", name: "rpgData.mutators.ironman.name", icon: getMediaUrl("/static/items/ironman.webp"), cost: 3000, cat: "challenge", toggle: false, durationDays: null, permanent_lock: true, desc: "rpgData.mutators.ironman.desc", synergy: null, disabled: true },
  { id: "glass_cannon", name: "rpgData.mutators.glass_cannon.name", icon: getMediaUrl("/static/items/glass_cannon.webp"), cost: 600, cat: "challenge", toggle: true, durationDays: null, desc: "rpgData.mutators.glass_cannon.desc", synergy: null },
  { id: "zero_hour", name: "rpgData.mutators.zero_hour.name", icon: getMediaUrl("/static/items/zero_hour.webp"), cost: 1000, cat: "challenge", toggle: false, durationDays: 7, desc: "rpgData.mutators.zero_hour.desc", synergy: null },
  // ── SYNERGY BUILDERS ──
  { id: "catalyst", name: "rpgData.mutators.catalyst.name", icon: getMediaUrl("/static/items/catalyst.webp"), cost: 1500, cat: "synergy", toggle: false, durationDays: null, desc: "rpgData.mutators.catalyst.desc", synergy: null },
  { id: "echo", name: "rpgData.mutators.echo.name", icon: getMediaUrl("/static/items/echo.webp"), cost: 1200, cat: "synergy", toggle: false, durationDays: null, desc: "rpgData.mutators.echo.desc", synergy: "lexicon" },
  { id: "mirror", name: "rpgData.mutators.mirror.name", icon: getMediaUrl("/static/items/mirror.webp"), cost: 1100, cat: "synergy", toggle: false, durationDays: null, desc: "rpgData.mutators.mirror.desc", synergy: "tunnel_vision" },
  { id: "resonance", name: "rpgData.mutators.resonance.name", icon: getMediaUrl("/static/items/resonance.webp"), cost: 1400, cat: "synergy", toggle: false, durationDays: null, desc: "rpgData.mutators.resonance.desc", synergy: null },
  // ── WILD ──
  { id: "gambler", name: "rpgData.mutators.gambler.name", icon: getMediaUrl("/static/items/gambler.webp"), cost: 800, cat: "wild", toggle: false, durationDays: null, desc: "rpgData.mutators.gambler.desc", synergy: "catalyst" },
  { id: "phantom_load", name: "rpgData.mutators.phantom_load.name", icon: getMediaUrl("/static/items/phantom_load.webp"), cost: 700, cat: "wild", toggle: false, durationDays: null, desc: "rpgData.mutators.phantom_load.desc", synergy: "momentum" },
  { id: "cursed_clock", name: "rpgData.mutators.cursed_clock.name", icon: getMediaUrl("/static/items/cursed_clock.webp"), cost: 900, cat: "wild", toggle: false, durationDays: null, desc: "rpgData.mutators.cursed_clock.desc", synergy: null },
  { id: "deja_vu", name: "rpgData.mutators.deja_vu.name", icon: getMediaUrl("/static/items/deja_vu.webp"), cost: 1000, cat: "wild", toggle: false, durationDays: null, desc: "rpgData.mutators.deja_vu.desc", synergy: null },
  { id: "volatile", name: "rpgData.mutators.volatile.name", icon: getMediaUrl("/static/items/volatile.webp"), cost: 1300, cat: "wild", toggle: false, durationDays: null, desc: "rpgData.mutators.volatile.desc", synergy: null },
  { id: "weight_of_history", name: "rpgData.mutators.weight_of_history.name", icon: getMediaUrl("/static/items/weight_of_history.webp"), cost: 1500, cat: "wild", toggle: false, durationDays: null, desc: "rpgData.mutators.weight_of_history.desc", synergy: null },
];

