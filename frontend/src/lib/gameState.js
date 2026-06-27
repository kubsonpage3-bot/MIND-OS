// Global game state for RPG features — persisted to localStorage

const KEY = "mindos_game_state";

export const DEFAULT_GAME_STATE = {
  gold: 0,
  hp: 100,
  maxHp: 100,
  statPoints: 0,
  stats: { pwr: 5, def: 5, foc: 5, mem: 5, spd: 5, lck: 5 },
  equipped: {}, // slot -> item
  inventory: [],
  bossIndex: 0,
  bossHP: null, // null = use boss max
  tasks: [], // habits, dailies, todos
  consumables: {}, // active consumable effects
  // ─── RPG Engine fields ───────────────────────────────────────────────────
  buffs: [],          // активные баффы [ createBuff(...) ]
  streak: 0,          // дней подряд без пропусков дейликов
  lastDailyTickMs: 0, // timestamp последнего суточного тика
};

export function loadGameState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GAME_STATE };
    return { ...DEFAULT_GAME_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GAME_STATE };
  }
}

export function saveGameState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const BOSSES = [
  {
    id: "void",
    name: "THE VOID",
    maxHP: 500,
    lore: "The absence of thought given form.",
    attack: "Mental Fog",
    attackEffect: "missed daily = −5 weekly XP",
    requiredRank: "F",
    color: "#00e5ff",
  },
  {
    id: "static",
    name: "COGNITIVE STATIC",
    maxHP: 1200,
    lore: "Distraction rendered conscious.",
    attack: "Signal Interference",
    attackEffect: "missed daily = −10 XP",
    requiredRank: "D",
    color: "#ff2222",
  },
  {
    id: "algorithm",
    name: "THE ALGORITHM",
    maxHP: 2500,
    lore: "Optimization without purpose.",
    attack: "Routine Override",
    attackEffect: "missed daily = streak −1",
    requiredRank: "C",
    color: "#00ff88",
  },
  {
    id: "parasite",
    name: "MEMETIC PARASITE",
    maxHP: 5000,
    lore: "A thought that thinks it is you.",
    attack: "Cognitive Drain",
    attackEffect: "missed daily = −0.1 Gf",
    requiredRank: "B",
    color: "#aa00ff",
  },
  {
    id: "recursive",
    name: "THE RECURSIVE",
    maxHP: 15000,
    lore: "The final test before transcendence.",
    attack: "Infinite Regress",
    attackEffect: "missed daily = −15 XP −0.2 metrics",
    requiredRank: "A",
    color: "#3b82f6",
  },
];

// Pixel art item icons mapped by item id
export const ITEM_ICONS = {};

// Inline SVG pixel art icons as data URLs — each 16x16 pixel grid
const PIXEL = {
  // Gold pouch / coin bag
  gold_bag: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='6' width='8' height='8' fill='%23c8860a'/><rect x='5' y='5' width='6' height='2' fill='%23e8a020'/><rect x='6' y='3' width='4' height='3' fill='%23e8a020'/><rect x='7' y='2' width='2' height='2' fill='%23c8860a'/><rect x='5' y='7' width='6' height='5' fill='%23e8c040'/><rect x='6' y='8' width='4' height='3' fill='%23f0d060'/><rect x='7' y='9' width='2' height='1' fill='%23ffffff80'/></svg>`,
  // Blue potion
  blue_potion: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='6' y='2' width='4' height='2' fill='%238888aa'/><rect x='7' y='1' width='2' height='2' fill='%23aaaacc'/><rect x='5' y='4' width='6' height='1' fill='%23aaaacc'/><rect x='4' y='5' width='8' height='8' fill='%231a3a8a'/><rect x='5' y='6' width='6' height='6' fill='%232255cc'/><rect x='6' y='7' width='4' height='4' fill='%233366ff'/><rect x='6' y='7' width='2' height='2' fill='%23aaccff'/><rect x='4' y='13' width='8' height='1' fill='%231a3a8a'/></svg>`,
  // Spell book
  spell_book: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='2' width='10' height='12' fill='%23442200'/><rect x='4' y='3' width='8' height='10' fill='%23663300'/><rect x='5' y='4' width='6' height='1' fill='%23f0c040'/><rect x='5' y='6' width='6' height='1' fill='%23ffdd77'/><rect x='5' y='8' width='4' height='1' fill='%23ffdd77'/><rect x='5' y='10' width='5' height='1' fill='%23ffdd77'/><rect x='3' y='2' width='1' height='12' fill='%23221100'/><rect x='6' y='3' width='2' height='2' fill='%23ff4400'/></svg>`,
  // Red potion
  red_potion: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='6' y='2' width='4' height='2' fill='%238888aa'/><rect x='7' y='1' width='2' height='2' fill='%23aaaacc'/><rect x='5' y='4' width='6' height='1' fill='%23aaaacc'/><rect x='4' y='5' width='8' height='8' fill='%238a1a1a'/><rect x='5' y='6' width='6' height='6' fill='%23cc2222'/><rect x='6' y='7' width='4' height='4' fill='%23ff3333'/><rect x='6' y='7' width='2' height='2' fill='%23ffaaaa'/><rect x='4' y='13' width='8' height='1' fill='%238a1a1a'/></svg>`,
  // Headphones (focus gear)
  headphones: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='5' width='10' height='2' fill='%23334466' rx='2'/><rect x='2' y='7' width='3' height='5' fill='%23334466'/><rect x='11' y='7' width='3' height='5' fill='%23334466'/><rect x='2' y='8' width='3' height='3' fill='%23aa44ff'/><rect x='11' y='8' width='3' height='3' fill='%23aa44ff'/><rect x='3' y='4' width='10' height='3' fill='%23445577'/></svg>`,
  // Green gem necklace
  gem_necklace: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='2' width='6' height='1' fill='%23c8a060'/><rect x='4' y='3' width='1' height='3' fill='%23c8a060'/><rect x='11' y='3' width='1' height='3' fill='%23c8a060'/><rect x='6' y='8' width='4' height='4' fill='%2300cc44'/><rect x='5' y='9' width='6' height='2' fill='%2322ff66'/><rect x='7' y='7' width='2' height='6' fill='%2300aa33'/><rect x='6' y='9' width='2' height='2' fill='%2366ffaa'/></svg>`,
  // Fire orb (boss damage)
  fire_orb: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='6' y='8' width='4' height='5' fill='%23ff4400'/><rect x='5' y='7' width='6' height='5' fill='%23ff6600'/><rect x='6' y='6' width='4' height='4' fill='%23ff8800'/><rect x='7' y='4' width='2' height='4' fill='%23ffaa00'/><rect x='8' y='3' width='1' height='3' fill='%23ffdd00'/><rect x='5' y='9' width='2' height='2' fill='%23ffaa00'/><rect x='9' y='8' width='2' height='3' fill='%23ff6600'/></svg>`,
  // Crystal shard (memory)
  crystal: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='2' width='2' height='3' fill='%2300ddff'/><rect x='6' y='5' width='4' height='2' fill='%2300bbdd'/><rect x='5' y='7' width='6' height='4' fill='%2300aacc'/><rect x='6' y='11' width='4' height='2' fill='%230088aa'/><rect x='7' y='13' width='2' height='1' fill='%23006688'/><rect x='7' y='5' width='1' height='6' fill='%2366eeff80'/></svg>`,
  // Sword
  sword: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='2' width='2' height='9' fill='%23cccccc'/><rect x='6' y='3' width='1' height='7' fill='%23eeeeee'/><rect x='5' y='10' width='6' height='1' fill='%23c8a060'/><rect x='7' y='11' width='2' height='3' fill='%23886622'/></svg>`,
  // Golden sword
  golden_sword: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='2' width='2' height='9' fill='%23f0c040'/><rect x='6' y='3' width='1' height='7' fill='%23f8e070'/><rect x='8' y='3' width='1' height='7' fill='%23c8a020'/><rect x='5' y='10' width='6' height='2' fill='%23c8a020'/><rect x='7' y='12' width='2' height='2' fill='%23886600'/><rect x='5' y='4' width='1' height='1' fill='%23ffffff'/></svg>`,
  // Shield
  shield: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='3' width='8' height='9' fill='%23445577'/><rect x='5' y='4' width='6' height='7' fill='%23556688'/><rect x='6' y='12' width='4' height='1' fill='%23445577'/><rect x='7' y='13' width='2' height='1' fill='%23334466'/><rect x='7' y='5' width='2' height='5' fill='%23c8a060'/><rect x='5' y='7' width='6' height='2' fill='%23c8a060'/></svg>`,
  // Speed boots
  boots: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='4' width='4' height='7' fill='%23553322'/><rect x='8' y='8' width='4' height='3' fill='%23553322'/><rect x='3' y='11' width='10' height='2' fill='%23442211'/><rect x='3' y='13' width='10' height='1' fill='%23221100'/><rect x='4' y='5' width='2' height='5' fill='%23775544'/><rect x='8' y='9' width='3' height='2' fill='%23775544'/></svg>`,
  // Luck ring
  ring: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='4' width='6' height='1' fill='%23c8a060'/><rect x='4' y='5' width='1' height='6' fill='%23c8a060'/><rect x='11' y='5' width='1' height='6' fill='%23c8a060'/><rect x='5' y='11' width='6' height='1' fill='%23c8a060'/><rect x='6' y='5' width='4' height='1' fill='%23e8c080'/><rect x='5' y='6' width='1' height='4' fill='%23e8c080'/><rect x='10' y='6' width='1' height='4' fill='%23e8c080'/><rect x='6' y='10' width='4' height='1' fill='%23e8c080'/><rect x='6' y='3' width='4' height='2' fill='%2300aaff'/><rect x='7' y='2' width='2' height='2' fill='%2333ccff'/></svg>`,
  // Echo ring (memory ring)
  echo_ring: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='4' width='6' height='1' fill='%23aa44ff'/><rect x='4' y='5' width='1' height='6' fill='%23aa44ff'/><rect x='11' y='5' width='1' height='6' fill='%23aa44ff'/><rect x='5' y='11' width='6' height='1' fill='%23aa44ff'/><rect x='6' y='5' width='4' height='1' fill='%23cc66ff'/><rect x='5' y='6' width='1' height='4' fill='%23cc66ff'/><rect x='10' y='6' width='1' height='4' fill='%23cc66ff'/><rect x='6' y='10' width='4' height='1' fill='%23cc66ff'/><rect x='7' y='6' width='2' height='4' fill='%23330066'/></svg>`,
  // Focus stim (syringe)
  syringe: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='12' width='3' height='1' fill='%23aaaaaa'/><rect x='4' y='10' width='2' height='3' fill='%23cccccc'/><rect x='4' y='7' width='7' height='4' fill='%23cccccc'/><rect x='5' y='8' width='5' height='2' fill='%2300aaff'/><rect x='11' y='8' width='2' height='2' fill='%23cccccc'/><rect x='13' y='8' width='1' height='2' fill='%23aaaaaa'/><rect x='6' y='5' width='3' height='3' fill='%23cccccc'/><rect x='7' y='4' width='1' height='2' fill='%23aaaaaa'/></svg>`,
  // XP star
  xp_star: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='2' width='2' height='3' fill='%23ffdd00'/><rect x='7' y='11' width='2' height='3' fill='%23ffdd00'/><rect x='2' y='7' width='3' height='2' fill='%23ffdd00'/><rect x='11' y='7' width='3' height='2' fill='%23ffdd00'/><rect x='4' y='4' width='2' height='2' fill='%23ffdd00'/><rect x='10' y='4' width='2' height='2' fill='%23ffdd00'/><rect x='4' y='10' width='2' height='2' fill='%23ffdd00'/><rect x='10' y='10' width='2' height='2' fill='%23ffdd00'/><rect x='5' y='5' width='6' height='6' fill='%23ffaa00'/><rect x='6' y='6' width='4' height='4' fill='%23ffdd44'/></svg>`,
  // Neural link chip
  chip: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='4' width='8' height='8' fill='%23223344'/><rect x='5' y='5' width='6' height='6' fill='%23334455'/><rect x='6' y='6' width='4' height='4' fill='%2300aaff'/><rect x='7' y='7' width='2' height='2' fill='%2333ccff'/><rect x='3' y='6' width='2' height='1' fill='%2300aaff'/><rect x='3' y='9' width='2' height='1' fill='%2300aaff'/><rect x='11' y='6' width='2' height='1' fill='%2300aaff'/><rect x='11' y='9' width='2' height='1' fill='%2300aaff'/><rect x='6' y='3' width='1' height='2' fill='%2300aaff'/><rect x='9' y='3' width='1' height='2' fill='%2300aaff'/><rect x='6' y='11' width='1' height='2' fill='%2300aaff'/><rect x='9' y='11' width='1' height='2' fill='%2300aaff'/></svg>`,
  // Mana orb
  mana_orb: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='5' y='3' width='6' height='1' fill='%236633aa'/><rect x='4' y='4' width='1' height='6' fill='%236633aa'/><rect x='11' y='4' width='1' height='6' fill='%236633aa'/><rect x='5' y='10' width='6' height='1' fill='%236633aa'/><rect x='5' y='4' width='6' height='7' fill='%239944ff'/><rect x='6' y='5' width='4' height='5' fill='%23bb66ff'/><rect x='7' y='6' width='2' height='3' fill='%23ddaaff'/><rect x='6' y='6' width='2' height='2' fill='%23ffffff60'/></svg>`,
  // Dragon helmet
  dragon_helm: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='6' width='10' height='7' fill='%23223344'/><rect x='4' y='5' width='8' height='7' fill='%23334455'/><rect x='5' y='4' width='6' height='6' fill='%23445566'/><rect x='3' y='4' width='2' height='2' fill='%23ff4400'/><rect x='11' y='4' width='2' height='2' fill='%23ff4400'/><rect x='5' y='9' width='2' height='2' fill='%23001122'/><rect x='9' y='9' width='2' height='2' fill='%23001122'/><rect x='4' y='3' width='2' height='2' fill='%23223344'/><rect x='10' y='3' width='2' height='2' fill='%23223344'/></svg>`,
  // Streak shield
  streak_shield: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='3' width='10' height='10' fill='%23334466'/><rect x='4' y='4' width='8' height='8' fill='%23445577'/><rect x='5' y='13' width='6' height='1' fill='%23334466'/><rect x='6' y='14' width='4' height='1' fill='%23334466'/><rect x='7' y='15' width='2' height='1' fill='%23223355'/><rect x='6' y='6' width='4' height='1' fill='%23ffaa00'/><rect x='7' y='5' width='2' height='5' fill='%23ffaa00'/><rect x='5' y='8' width='6' height='1' fill='%23ffaa00'/></svg>`,
};

// ─── UNIQUE BOSS DROP ICONS (pixel-art anime style SVGs) ─────────────────────
const BOSS_DROPS = {
  // wanderers_hood — hooded cloak with glowing eye
  wanderers_hood: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='2' width='10' height='12' fill='%232a1a0a'/><rect x='4' y='3' width='8' height='10' fill='%23442210'/><rect x='5' y='2' width='6' height='4' fill='%23553318'/><rect x='6' y='3' width='4' height='3' fill='%23221108'/><rect x='6' y='7' width='4' height='1' fill='%2300aaff'/><rect x='7' y='7' width='2' height='1' fill='%2366ddff'/><rect x='6' y='6' width='4' height='1' fill='%23004488'/><rect x='3' y='11' width='10' height='2' fill='%23331a08'/></svg>`,
  // bone_bracelet — skull-carved bone ring
  bone_bracelet: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='4' width='8' height='1' fill='%23ccbbaa'/><rect x='3' y='5' width='1' height='6' fill='%23ccbbaa'/><rect x='12' y='5' width='1' height='6' fill='%23ccbbaa'/><rect x='4' y='11' width='8' height='1' fill='%23ccbbaa'/><rect x='5' y='5' width='6' height='1' fill='%23eeddcc'/><rect x='4' y='6' width='1' height='4' fill='%23eeddcc'/><rect x='11' y='6' width='1' height='4' fill='%23eeddcc'/><rect x='5' y='10' width='6' height='1' fill='%23eeddcc'/><rect x='6' y='6' width='2' height='2' fill='%23221100'/><rect x='8' y='6' width='2' height='2' fill='%23221100'/><rect x='7' y='8' width='2' height='1' fill='%23442200'/></svg>`,
  // heralds_fang — curved fang/tusk on chain
  heralds_fang: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='2' width='2' height='2' fill='%23c8a060'/><rect x='6' y='3' width='4' height='1' fill='%23c8a060'/><rect x='7' y='4' width='2' height='1' fill='%23e8c080'/><rect x='6' y='5' width='1' height='5' fill='%23f0f0f0'/><rect x='7' y='5' width='2' height='7' fill='%23ffffff'/><rect x='8' y='5' width='1' height='6' fill='%23dddddd'/><rect x='6' y='10' width='3' height='2' fill='%23eeeecc'/><rect x='7' y='12' width='1' height='2' fill='%23cccc99'/><rect x='5' y='8' width='1' height='1' fill='%2322c55e'/><rect x='9' y='7' width='1' height='1' fill='%2322c55e'/></svg>`,
  // wardens_quill — ink quill with purple gem
  wardens_quill: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='12' width='4' height='1' fill='%23334466'/><rect x='5' y='11' width='2' height='2' fill='%23445577'/><rect x='6' y='5' width='4' height='8' fill='%23ccddff'/><rect x='7' y='4' width='2' height='9' fill='%23eef2ff'/><rect x='6' y='5' width='1' height='6' fill='%23aabbee'/><rect x='10' y='3' width='3' height='5' fill='%23aa44ff'/><rect x='11' y='4' width='1' height='3' fill='%23cc88ff'/><rect x='10' y='4' width='1' height='1' fill='%23ffffff'/><rect x='7' y='2' width='2' height='3' fill='%23ffeecc'/></svg>`,
  // echo_bell — ornate hanging bell with runes
  echo_bell: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='1' width='2' height='2' fill='%23c8a060'/><rect x='6' y='3' width='4' height='1' fill='%23c8a060'/><rect x='5' y='4' width='6' height='7' fill='%23d4aa44'/><rect x='4' y='5' width='8' height='5' fill='%23e8c050'/><rect x='5' y='9' width='6' height='3' fill='%23d4aa44'/><rect x='6' y='11' width='4' height='2' fill='%23c89030'/><rect x='7' y='13' width='2' height='1' fill='%23c89030'/><rect x='6' y='6' width='2' height='1' fill='%23886600'/><rect x='9' y='7' width='1' height='2' fill='%23886600'/><rect x='6' y='5' width='1' height='1' fill='%23fff8cc'/></svg>`,
  // frostbite_blade — ice-blue serrated blade
  frostbite_blade: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='1' width='2' height='10' fill='%2300aadd'/><rect x='6' y='2' width='1' height='8' fill='%2366ddff'/><rect x='8' y='2' width='1' height='8' fill='%23006699'/><rect x='5' y='4' width='2' height='1' fill='%2300ccff'/><rect x='5' y='7' width='2' height='1' fill='%2300ccff'/><rect x='9' y='5' width='2' height='1' fill='%2300ccff'/><rect x='9' y='8' width='2' height='1' fill='%2300ccff'/><rect x='5' y='11' width='6' height='1' fill='%23446688'/><rect x='6' y='12' width='4' height='2' fill='%23334455'/><rect x='7' y='3' width='1' height='1' fill='%23ccffff'/></svg>`,
  // silk_mantle — flowing dark silk with silver trim
  silk_mantle: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='3' width='10' height='11' fill='%23220033'/><rect x='4' y='4' width='8' height='9' fill='%23330044'/><rect x='3' y='3' width='1' height='11' fill='%23ccaaff'/><rect x='12' y='3' width='1' height='11' fill='%23ccaaff'/><rect x='4' y='3' width='8' height='1' fill='%23ccaaff'/><rect x='4' y='13' width='8' height='1' fill='%23ccaaff'/><rect x='6' y='6' width='4' height='1' fill='%23aa66ee'/><rect x='5' y='8' width='6' height='1' fill='%23aa66ee'/><rect x='6' y='10' width='4' height='1' fill='%23aa66ee'/></svg>`,
  // ember_gauntlet — flame-scorched iron gauntlet
  ember_gauntlet: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='6' width='8' height='8' fill='%23552200'/><rect x='5' y='7' width='6' height='6' fill='%23773300'/><rect x='4' y='5' width='8' height='2' fill='%23884400'/><rect x='5' y='3' width='2' height='3' fill='%23664422'/><rect x='7' y='3' width='2' height='3' fill='%23664422'/><rect x='9' y='3' width='2' height='3' fill='%23664422'/><rect x='5' y='7' width='6' height='1' fill='%23ff6600'/><rect x='6' y='8' width='4' height='1' fill='%23ff4400'/><rect x='7' y='9' width='2' height='1' fill='%23ff8800'/><rect x='6' y='6' width='1' height='1' fill='%23ffaa00'/><rect x='9' y='6' width='1' height='1' fill='%23ffaa00'/></svg>`,
  // glass_tear — crystal tear-shaped gem on silver
  glass_tear: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='1' width='2' height='2' fill='%23aaaacc'/><rect x='6' y='2' width='4' height='1' fill='%23aaaacc'/><rect x='5' y='4' width='6' height='6' fill='%23aaddff'/><rect x='4' y='5' width='8' height='4' fill='%23cceeFF'/><rect x='5' y='9' width='6' height='2' fill='%23aaddff'/><rect x='6' y='11' width='4' height='2' fill='%2388bbdd'/><rect x='7' y='13' width='2' height='1' fill='%2366aacc'/><rect x='6' y='5' width='2' height='2' fill='%23ffffff'/><rect x='5' y='6' width='1' height='2' fill='%23ddeeff'/></svg>`,
  // leviathan_scale — dark iridescent dragon scale
  leviathan_scale: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='3' width='8' height='10' fill='%23003344'/><rect x='5' y='4' width='6' height='8' fill='%23004455'/><rect x='6' y='5' width='4' height='6' fill='%23005566'/><rect x='4' y='3' width='8' height='1' fill='%2300aacc'/><rect x='4' y='5' width='8' height='1' fill='%2300aacc'/><rect x='4' y='7' width='8' height='1' fill='%2300aacc'/><rect x='4' y='9' width='8' height='1' fill='%2300aacc'/><rect x='4' y='11' width='8' height='1' fill='%2300aacc'/><rect x='7' y='4' width='1' height='8' fill='%2300ccff'/><rect x='6' y='6' width='1' height='1' fill='%2366eeff'/></svg>`,
  // crown_of_ash — broken obsidian crown with embers
  crown_of_ash: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='9' width='12' height='4' fill='%23221111'/><rect x='3' y='8' width='10' height='4' fill='%23332222'/><rect x='2' y='5' width='3' height='5' fill='%23221111'/><rect x='6' y='3' width='4' height='7' fill='%23332222'/><rect x='11' y='5' width='3' height='5' fill='%23221111'/><rect x='3' y='6' width='2' height='1' fill='%23ff4400'/><rect x='7' y='4' width='2' height='1' fill='%23ff6600'/><rect x='12' y='6' width='1' height='1' fill='%23ff4400'/><rect x='4' y='8' width='8' height='1' fill='%23554433'/><rect x='6' y='5' width='1' height='2' fill='%23ffaa00'/><rect x='10' y='6' width='1' height='1' fill='%23ffaa00'/></svg>`,
  // golems_grip — stone fist with gold veins
  golems_grip: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='5' width='10' height='9' fill='%23556655'/><rect x='4' y='6' width='8' height='7' fill='%23667766'/><rect x='4' y='4' width='2' height='3' fill='%23556655'/><rect x='6' y='3' width='2' height='4' fill='%23556655'/><rect x='8' y='4' width='2' height='3' fill='%23556655'/><rect x='10' y='5' width='2' height='2' fill='%23556655'/><rect x='5' y='7' width='6' height='1' fill='%23f0c040'/><rect x='4' y='9' width='8' height='1' fill='%23f0c040'/><rect x='5' y='11' width='6' height='1' fill='%23f0c040'/><rect x='7' y='6' width='1' height='6' fill='%23c8a020'/></svg>`,
  // scar_shard — cracked blood-red crystal shard
  scar_shard: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='2' width='2' height='3' fill='%23cc2222'/><rect x='6' y='5' width='4' height='2' fill='%23aa1111'/><rect x='5' y='7' width='6' height='4' fill='%23cc2222'/><rect x='4' y='8' width='8' height='2' fill='%23dd3333'/><rect x='5' y='10' width='6' height='2' fill='%23cc2222'/><rect x='6' y='12' width='4' height='1' fill='%23aa1111'/><rect x='7' y='13' width='2' height='1' fill='%23881111'/><rect x='7' y='6' width='1' height='4' fill='%23ff6666'/><rect x='6' y='8' width='2' height='1' fill='%23ffaaaa'/><rect x='9' y='5' width='1' height='1' fill='%23ffaaaa'/></svg>`,
  // forgotten_score — ancient parchment scroll with music runes
  forgotten_score: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='3' width='10' height='10' fill='%23c8a060'/><rect x='4' y='4' width='8' height='8' fill='%23ddb870'/><rect x='3' y='3' width='2' height='10' fill='%23aa8840'/><rect x='11' y='3' width='2' height='10' fill='%23aa8840'/><rect x='5' y='5' width='6' height='1' fill='%23663300'/><rect x='5' y='7' width='5' height='1' fill='%23663300'/><rect x='5' y='9' width='6' height='1' fill='%23663300'/><rect x='9' y='6' width='1' height='2' fill='%23663300'/><rect x='7' y='6' width='1' height='2' fill='%23663300'/><rect x='6' y='6' width='1' height='1' fill='%23aa5500'/></svg>`,
  // abyssal_purse — void-black coin bag with gold glow
  abyssal_purse: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='4' y='6' width='8' height='8' fill='%23110022'/><rect x='5' y='5' width='6' height='2' fill='%23220033'/><rect x='6' y='3' width='4' height='3' fill='%23220033'/><rect x='7' y='2' width='2' height='2' fill='%23110022'/><rect x='5' y='7' width='6' height='5' fill='%23221133'/><rect x='6' y='8' width='4' height='3' fill='%23331144'/><rect x='7' y='9' width='2' height='1' fill='%23f0c040'/><rect x='5' y='7' width='6' height='1' fill='%23f0c040'/><rect x='4' y='13' width='8' height='1' fill='%23f0c04088'/></svg>`,
  // winter_plate — ice-white armor plate with frost runes
  winter_plate: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='4' width='10' height='9' fill='%23cce8ff'/><rect x='4' y='5' width='8' height='7' fill='%23ddf0ff'/><rect x='5' y='6' width='6' height='5' fill='%23eef8ff'/><rect x='3' y='4' width='10' height='1' fill='%2388bbdd'/><rect x='3' y='12' width='10' height='1' fill='%2388bbdd'/><rect x='3' y='4' width='1' height='9' fill='%2388bbdd'/><rect x='12' y='4' width='1' height='9' fill='%2388bbdd'/><rect x='7' y='6' width='2' height='5' fill='%2300aadd'/><rect x='5' y='8' width='6' height='1' fill='%2300aadd'/><rect x='6' y='7' width='1' height='1' fill='%2300ddff'/><rect x='9' y='7' width='1' height='1' fill='%2300ddff'/></svg>`,
  // throne_seal — blood-red wax seal with crown imprint
  throne_seal: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='4' width='10' height='8' fill='%23880000'/><rect x='4' y='5' width='8' height='6' fill='%23aa1111'/><rect x='5' y='6' width='6' height='4' fill='%23cc2222'/><rect x='3' y='4' width='10' height='1' fill='%23550000'/><rect x='3' y='11' width='10' height='1' fill='%23550000'/><rect x='6' y='6' width='1' height='2' fill='%23ffcc00'/><rect x='8' y='6' width='1' height='2' fill='%23ffcc00'/><rect x='7' y='5' width='2' height='1' fill='%23ffcc00'/><rect x='5' y='8' width='6' height='1' fill='%23ffcc00'/><rect x='7' y='7' width='2' height='2' fill='%23ff4400'/></svg>`,
  // eclipse_eye — dark iris eye gem pulsing purple
  eclipse_eye: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='2' y='6' width='12' height='4' fill='%23220033'/><rect x='3' y='5' width='10' height='6' fill='%23330044'/><rect x='4' y='4' width='8' height='8' fill='%23440055'/><rect x='5' y='5' width='6' height='6' fill='%23550066'/><rect x='5' y='6' width='6' height='4' fill='%23880099'/><rect x='6' y='6' width='4' height='4' fill='%23aa00cc'/><rect x='7' y='7' width='2' height='2' fill='%230000aa'/><rect x='7' y='7' width='1' height='1' fill='%23ffffff'/><rect x='6' y='7' width='1' height='1' fill='%23ff00ff'/><rect x='9' y='8' width='1' height='1' fill='%23ff00ff'/></svg>`,
  // mask_nameless — featureless god mask split black/white
  mask_nameless: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='3' y='2' width='5' height='12' fill='%23111111'/><rect x='8' y='2' width='5' height='12' fill='%23eeeeee'/><rect x='5' y='4' width='2' height='2' fill='%23ffffff'/><rect x='9' y='4' width='2' height='2' fill='%23000000'/><rect x='5' y='8' width='3' height='1' fill='%23dddddd'/><rect x='9' y='8' width='3' height='1' fill='%23222222'/><rect x='3' y='2' width='10' height='1' fill='%23ff00ff'/><rect x='3' y='13' width='10' height='1' fill='%23ff00ff'/></svg>`,
  // blade_final_dusk — massive black-gold greatsword with dusk glow
  blade_final_dusk: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='7' y='1' width='2' height='11' fill='%23111111'/><rect x='6' y='1' width='1' height='9' fill='%23ff6600'/><rect x='9' y='1' width='1' height='9' fill='%23cc4400'/><rect x='5' y='3' width='1' height='1' fill='%23ff8800'/><rect x='10' y='3' width='1' height='1' fill='%23ff8800'/><rect x='5' y='6' width='1' height='1' fill='%23ff8800'/><rect x='10' y='6' width='1' height='1' fill='%23ff8800'/><rect x='4' y='11' width='8' height='1' fill='%23f0c040'/><rect x='6' y='12' width='4' height='2' fill='%23c8a020'/><rect x='7' y='14' width='2' height='1' fill='%23886600'/><rect x='7' y='2' width='2' height='1' fill='%23ff4400'/></svg>`,
};

export const ITEM_ICON_MAP = {
  // Heal potions
  small_heal: PIXEL.red_potion,
  medium_heal: PIXEL.red_potion,
  large_heal: PIXEL.red_potion,
  elixir: PIXEL.blue_potion,
  // Gear
  neural_cap: PIXEL.headphones,
  sync_visor: PIXEL.chip,
  cognitive_crown: PIXEL.golden_sword,
  transcendence_helm: PIXEL.dragon_helm,
  basic_cortex: PIXEL.chip,
  dual_channel: PIXEL.chip,
  quantum_sync: PIXEL.crystal,
  void_bridge: PIXEL.mana_orb,
  carbon_vest: PIXEL.shield,
  reactive_shell: PIXEL.shield,
  resonance_core: PIXEL.mana_orb,
  singularity_engine: PIXEL.fire_orb,
  training_implants: PIXEL.sword,
  force_amplifiers: PIXEL.golden_sword,
  synaptic_boosters: PIXEL.crystal,
  mobility_frame: PIXEL.boots,
  overdrive_chassis: PIXEL.boots,
  phase_legs: PIXEL.boots,
  data_ring_1: PIXEL.ring,
  echo_ring: PIXEL.echo_ring,
  null_ring: PIXEL.ring,
  focus_stim: PIXEL.syringe,
  memory_patch: PIXEL.blue_potion,
  xp_booster: PIXEL.xp_star,
  streak_shield: PIXEL.streak_shield,
  boss_damage_plus: PIXEL.fire_orb,
  // Unique boss drops — each with its own pixel-art icon
  ...BOSS_DROPS,
};

export const SHOP_ITEMS = [
  // HEADWARE
  { id: "neural_cap", slot: "headware", label: "Neural Cap", tier: "Common", cost: 80, stats: { foc: 2 } },
  { id: "sync_visor", slot: "headware", label: "Sync Visor", tier: "Uncommon", cost: 200, stats: { foc: 3, mem: 2 }, reqRank: "D" },
  { id: "cognitive_crown", slot: "headware", label: "Cognitive Crown", tier: "Rare", cost: 500, stats: { foc: 6, pwr: 3 }, reqRank: "B" },
  { id: "transcendence_helm", slot: "headware", label: "Transcendence Helm", tier: "Epic", cost: 1500, stats: { foc: 10, mem: 8 }, reqRank: "S" },
  // NEURAL LINK
  { id: "basic_cortex", slot: "neural_link", label: "Basic Cortex Link", tier: "Common", cost: 60, stats: { mem: 2 } },
  { id: "dual_channel", slot: "neural_link", label: "Dual-Channel Adapter", tier: "Uncommon", cost: 180, stats: { mem: 4, lck: 1 } },
  { id: "quantum_sync", slot: "neural_link", label: "Quantum Sync", tier: "Rare", cost: 450, stats: { mem: 7, foc: 4 }, reqRank: "C" },
  { id: "void_bridge", slot: "neural_link", label: "Void Bridge", tier: "Legendary", cost: 2000, stats: { mem: 12, foc: 8 }, reqRank: "SS" },
  // CORE
  { id: "carbon_vest", slot: "core", label: "Carbon Vest", tier: "Common", cost: 90, stats: { def: 3 } },
  { id: "reactive_shell", slot: "core", label: "Reactive Shell", tier: "Uncommon", cost: 220, stats: { def: 5, pwr: 2 } },
  { id: "resonance_core", slot: "core", label: "Resonance Core", tier: "Rare", cost: 480, stats: { def: 8, foc: 5 }, reqRank: "B" },
  { id: "singularity_engine", slot: "core", label: "Singularity Engine", tier: "Legendary", cost: 2200, stats: { def: 15, pwr: 10 }, reqRank: "SSS" },
  // ARMS
  { id: "training_implants", slot: "arms", label: "Training Implants", tier: "Common", cost: 70, stats: { pwr: 2 } },
  { id: "force_amplifiers", slot: "arms", label: "Force Amplifiers", tier: "Uncommon", cost: 190, stats: { pwr: 4, def: 1 } },
  { id: "synaptic_boosters", slot: "arms", label: "Synaptic Boosters", tier: "Rare", cost: 420, stats: { pwr: 7, spd: 5 }, reqRank: "A" },
  // LEGS
  { id: "mobility_frame", slot: "legs", label: "Mobility Frame", tier: "Common", cost: 75, stats: { spd: 2 } },
  { id: "overdrive_chassis", slot: "legs", label: "Overdrive Chassis", tier: "Uncommon", cost: 210, stats: { spd: 5, lck: 1 } },
  { id: "phase_legs", slot: "legs", label: "Phase Legs", tier: "Rare", cost: 460, stats: { spd: 8, def: 4 }, reqRank: "B" },
  // RINGS
  { id: "data_ring_1", slot: "ring1", label: "Data Ring", tier: "Common", cost: 50, stats: { lck: 1 } },
  { id: "echo_ring", slot: "ring1", label: "Echo Ring", tier: "Uncommon", cost: 140, stats: { lck: 2, mem: 2 } },
  { id: "null_ring", slot: "ring2", label: "Null Ring", tier: "Rare", cost: 380, stats: { lck: 5, foc: 3 }, reqRank: "A" },
  // CONSUMABLES
  { id: "focus_stim", slot: "consumable", label: "Focus Stim", tier: "Common", cost: 30, effect: "next session FOC ×1.3", consumable: true },
  { id: "memory_patch", slot: "consumable", label: "Memory Patch", tier: "Common", cost: 35, effect: "+0.2 Gc instantly", consumable: true },
  { id: "xp_booster", slot: "consumable", label: "XP Booster", tier: "Uncommon", cost: 80, effect: "+50% XP for 24h", consumable: true },
  { id: "streak_shield", slot: "consumable", label: "Streak Shield", tier: "Rare", cost: 200, effect: "protect streak from miss", consumable: true },
  { id: "boss_damage_plus", slot: "consumable", label: "Boss Damage+", tier: "Uncommon", cost: 60, effect: "×2 boss damage for 1 session", consumable: true },
  // Heal potions
  { id: "small_heal", slot: "consumable", label: "Small Health Potion", tier: "Common", cost: 25, effect: "Restore +20 HP instantly", consumable: true, healAmount: 20 },
  { id: "medium_heal", slot: "consumable", label: "Health Potion", tier: "Uncommon", cost: 60, effect: "Restore +50 HP instantly", consumable: true, healAmount: 50 },
  { id: "large_heal", slot: "consumable", label: "Mega Health Potion", tier: "Rare", cost: 150, effect: "Restore +100 HP (full heal)", consumable: true, healAmount: 100 },
  { id: "elixir", slot: "consumable", label: "Elixir of Life", tier: "Epic", cost: 500, effect: "Full HP restore + immunity 10min", consumable: true, healAmount: 9999 },
];

const TIER_COLORS = { Common: "#94a3b8", Uncommon: "#22c55e", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#f59e0b" };
export const getTierColor = (tier) => TIER_COLORS[tier] || "#94a3b8";

const RANK_ORDER = ["F","D","C","B","A","S","SS","SSS"];
export function rankMeetsReq(currentRankId, reqRank) {
  if (!reqRank) return true;
  return RANK_ORDER.indexOf(currentRankId) >= RANK_ORDER.indexOf(reqRank);
}

// ─── RPG Engine buff helpers (работают через loadGameState/saveGameState) ────

/**
 * Добавить бафф в gameState.buffs.
 * @param {object} buff - объект баффа из createBuff()
 */
export function addBuffToState(buff) {
  try {
    const gs = loadGameState();
    gs.buffs = [...(gs.buffs || []), buff];
    saveGameState(gs);
  } catch {}
}

/**
 * Получить активные баффы (без просроченных).
 * @returns {object[]}
 */
export function getActiveBuffs() {
  try {
    const gs = loadGameState();
    const now = Date.now();
    return (gs.buffs || []).filter(b =>
      !b.isExpired && (b.expiresAt === null || now < b.expiresAt)
    );
  } catch { return []; }
}

/**
 * Удалить все просроченные баффы из gameState.
 */
export function pruneExpiredBuffs() {
  try {
    const gs = loadGameState();
    const now = Date.now();
    gs.buffs = (gs.buffs || []).filter(b =>
      !b.isExpired && (b.expiresAt === null || now < b.expiresAt)
    );
    saveGameState(gs);
  } catch {}
}