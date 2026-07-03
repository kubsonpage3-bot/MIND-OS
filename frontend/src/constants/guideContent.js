// guideContent.js
// Condensed copy for TabGuideModal, one entry per guideId.
// Matches the modal format shown in the app: icon + title + short body + "GOT IT".
// Tasks body uses \n bullet points — render with white-space: pre-line or split on \n in the modal.
 
export const GUIDE_CONTENT = {
  dashboard: {
    icon: "🧠",
    title: "Cognitive Metrics",
    body: "These four bars — Gf, Gc, Ps, Vm — are real cognitive abilities that grow from what you actually do. Different activities train different ones (Math builds Gf, Reading builds Gc). Your IQ score is a blend of all four. Growth slows as you approach each ceiling, so early sessions matter most.",
  },
 
  training: {
    icon: "⏱️",
    title: "Training",
    body: "Log a session for any subject to earn XP, Gold, and Cognitive Metric gains. The tip banner suggests what to train based on what's currently weak or low-effort — worth following on low-energy days instead of skipping entirely.",
  },
 
  tasks: {
    icon: "📋",
    title: "Tasks",
    body: "• Habits — repeat anytime, no deadline, just + / − tracking.\n• Dailies — scheduled, missing one costs you HP.\n• To-Dos — one-time, check it off and it's gone.\nAll three feed XP and Gold into your character.",
  },
 
  character: {
    icon: "👤",
    title: "Character",
    body: "Your class comes with 3 Active Skills (spend Mana to trigger a burst effect) and gear slots that add flat stat bonuses. The stats table always shows exactly where each point comes from — Class + Equipment + Base.",
  },
 
  skill_tree: {
    icon: "🌳",
    title: "Skill Tree",
    body: "Permanent passive bonuses across 5 branches: Mind, Body, Wealth, Spirit, Knowledge. Unlocked with Skill Points, earned mainly by defeating Bosses — this is what turns your daily progress into lasting character growth.",
  },
 
  allies: {
    icon: "🤝",
    title: "Allies",
    body: "Recruit companions with Gold to passively boost specific activities — one might boost Science XP, another might boost Daily gold. Higher Ally levels unlock stronger, more specific bonuses.",
  },
 
  mutators: {
    icon: "🃏",
    title: "Mutators",
    body: "Optional modifiers that reshape how you play. Each one gives a real bonus AND takes something in return — nothing here is free. You can equip up to 3 at once, so every choice is a tradeoff: focus everything on one subject, or spread your bonuses out. Some pairs are marked as Synergy — equip both for a stronger combined effect.",
  },
 
  shop: {
    icon: "🛒",
    title: "Shop",
    body: "Spend Gold on Gear (flat stat bonuses), Consumables, and Scrolls. Boss-drop uniques can't be bought here — you'll only get those from defeating specific bosses.",
  },
 
  rival: {
    icon: "⚔️",
    title: "Rival",
    body: "Johan is an AI opponent tracking a parallel version of your stats. The weekly comparison shows exactly where you're ahead or behind — light competitive pressure, even solo.",
  },
 
  party: {
    icon: "👥",
    title: "Party",
    body: "Team up with real friends via an invite code. See each other's rank, level, streak, class, and HP — no shared boss, no chat, just visibility so your progress isn't invisible.",
  },
};
