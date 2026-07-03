// guideContent.js
// Condensed copy for TabGuideModal, one entry per guideId.
// Matches the modal format shown in the app: icon + title + body + "GOT IT".
// Tasks/dashboard bodies use \n bullet points — render with white-space: pre-line or split on \n in the modal.
// Bodies are slightly longer now (still popup-length) for real explanatory depth, not just labels.
 
export const GUIDE_CONTENT = {
  dashboard: {
    icon: "🧠",
    title: "Cognitive Metrics",
    body: "Intelligence research has long treated 'IQ' as a single number, but the modern view (Cattell-Horn-Carroll theory, the current mainstream model) breaks it into distinct abilities that grow somewhat independently. This app tracks four of them:\n• Gf (Fluid Intelligence) — reasoning through new problems you haven't seen before.\n• Gc (Crystallized Intelligence) — accumulated knowledge you can recall and apply.\n• Ps (Processing Speed) — how fast you execute routine mental work.\n• Vm (Verbal Memory) — holding and retrieving language-based information.\nEach one responds to different activities (Math trains Gf, Reading trains Gc), and each has a ceiling with diminishing returns as you approach it — real skill growth slows the better you get, so consistency beats intensity.",
  },
 
  training: {
    icon: "⏱️",
    title: "Training",
    body: "Log a session for any subject to earn XP, Gold, and gains in the specific Cognitive Metrics that activity targets — the coefficients aren't arbitrary, they reflect which mental skill each subject actually exercises. The suggestion banner points you toward whatever's currently weak or low-effort, which matters most on days you're tempted to skip training entirely — a short session in a low-energy-friendly subject still moves the needle.",
  },
 
  tasks: {
    icon: "📋",
    title: "Tasks",
    body: "• Habits — repeatable, no deadline. Just + or − whenever you do (or don't do) the thing.\n• Dailies — scheduled and consequential: miss one and it costs real HP, which is what keeps them from feeling optional.\n• To-Dos — one-time. Complete it, get rewarded, it's gone.\nAll three route XP and Gold into your character, and where relevant, into your Cognitive Metrics.",
  },
 
  character: {
    icon: "👤",
    title: "Character",
    body: "Your class defines your identity and comes with 3 Active Skills — deliberate, Mana-costed tools you trigger for a burst effect at the right moment, not passive background bonuses. Gear you equip adds flat stat bonuses (PWR, DEF, FOC, MEM, SPD, LCK), each tied to a concrete gameplay effect shown right under its name. The stats table breaks down exactly where every point comes from — Class + Equipment + Base — so nothing about your character is hidden math.",
  },
 
  skill_tree: {
    icon: "🌳",
    title: "Skill Tree",
    body: "A grid of permanent, passive bonuses across 5 branches — Mind, Body, Wealth, Spirit, Knowledge — unlocked with Skill Points rather than Gold alone. You earn SP mainly by defeating Bosses, which is the real link in this system: your daily task completions chip away at a Boss's HP, and beating it converts that effort into lasting character growth instead of a one-time reward.",
  },
 
  allies: {
    icon: "🤝",
    title: "Allies",
    body: "Companions you recruit with Gold, each passively boosting a specific kind of activity rather than a broad stat — one might strengthen Science sessions, another might boost Gold from Dailies. Leveling an Ally up unlocks stronger, more specific versions of their bonus, so your roster ends up shaped around whatever you actually train most.",
  },
 
  mutators: {
    icon: "🃏",
    title: "Mutators",
    body: "Optional modifiers that reshape how you play. Each one gives a real bonus AND takes something back — nothing here is free, by design. You can have up to 3 active at once, so every choice is a genuine tradeoff: concentrate everything into one subject with a strong bonus/penalty pair, or spread smaller bonuses across the board for less risk. Some Mutators are marked as Synergy pairs — equip both together and their combined effect is stronger than either alone.",
  },
 
  shop: {
    icon: "🛒",
    title: "Shop",
    body: "Spend Gold on Gear (permanent stat bonuses), Consumables (one-time effects), and Scrolls (special limited-time boosts). Boss-drop unique items never appear here — those only come from actually defeating the specific boss they're tied to, so a full Inventory says something real about what you've beaten, not just what you could afford.",
  },
 
  rival: {
    icon: "⚔️",
    title: "Rival",
    body: "Johan is an AI-driven rival tracking a parallel version of your stats and commenting on your activity as you go. The weekly comparison table shows precisely where you're ahead or behind on hours, focus, subjects, and Rank XP — a source of light competitive pressure that works even if you're training completely alone.",
  },
 
  party: {
    icon: "👥",
    title: "Party",
    body: "Team up with real friends using a shared invite code. Everyone in your Party can see each other's rank, level, streak, class, and HP — no shared boss, no chat, just visibility. The idea is simple: progress you can't show anyone is easier to quietly abandon than progress your friends can actually see.",
  },
};
