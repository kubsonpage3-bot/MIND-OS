import { useState, useEffect, useCallback } from "react";
import { loadState, saveState, checkMidnightReset, defaultState, equipItem } from "@/lib/lifeOS";
import LifeOSSetup from "@/components/lifeos/LifeOSSetup";
import CharacterPanel from "@/components/lifeos/CharacterPanel";
import HabitsColumn from "@/components/lifeos/HabitsColumn";
import DailiesColumn from "@/components/lifeos/DailiesColumn";
import TodosColumn from "@/components/lifeos/TodosColumn";
import RewardsPanel from "@/components/lifeos/RewardsPanel";
import ActivityFeed from "@/components/lifeos/ActivityFeed";
import { Sparkles, Shield, Gift, ScrollText, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";

const TABS = [
  { id: "tasks", label: "Tasks", icon: Swords },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "inventory", label: "Inventory", icon: Shield },
  { id: "feed", label: "Log", icon: ScrollText },
];

export default function LifeOS() {
  const { t } = useTranslation();
  const [gs, setGs] = useState(() => checkMidnightReset(loadState()));

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    setIsMobile(media.matches);
    const listener = (e) => setIsMobile(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  const [activeTab, setActiveTab] = useState("tasks");

  const update = useCallback((updater) => {
    setGs(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      update(s => checkMidnightReset(s));
    }, 60000);
    return () => clearInterval(interval);
  }, [update]);

  if (!gs.initialized) {
    return (
      <LifeOSSetup onComplete={(data) => {
        const next = {
          ...defaultState(),
          ...data,
          initialized: true,
          habits: [
            { id: "h1", label: "Exercise 30min", difficulty: "medium", type: "both", posStreak: 0, negStreak: 0 },
            { id: "h2", label: "Read 20 pages",  difficulty: "easy",   type: "both", posStreak: 0, negStreak: 0 },
            { id: "h3", label: "No junk food",   difficulty: "easy",   type: "negative", posStreak: 0, negStreak: 0 },
          ],
          dailies: [
            { id: "d1", label: "Morning study block", difficulty: "hard",   activeDays: ["Mon","Tue","Wed","Thu","Fri"], completedToday: false, streak: 0 },
            { id: "d2", label: "Anki review",         difficulty: "medium", activeDays: [],                              completedToday: false, streak: 0 },
            { id: "d3", label: "No phone before 10am",difficulty: "easy",   activeDays: [],                              completedToday: false, streak: 0 },
          ],
          todos: [
            { id: "t1", label: "Finish physics chapter 3", difficulty: "hard",   dueDate: "", done: false, checklist: [] },
            { id: "t2", label: "Write history essay",      difficulty: "medium", dueDate: "", done: false, checklist: [] },
            { id: "t3", label: "Plan weekly schedule",     difficulty: "easy",   dueDate: "", done: false, checklist: [] },
          ],
          lastDailyReset: new Date().toDateString(),
        };
        saveState(next);
        setGs(next);
      }} />
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0a2e] text-white font-mono">
      <header 
        className="sticky top-0 z-30 border-b border-purple-900/60 bg-[#1a0a2e]/95 backdrop-blur-md safe-top"
        style={{ paddingTop: "var(--sat)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="font-mono text-sm font-bold tracking-wider text-purple-200">{t("lifeos.life_os", "LIFE OS")}</span>
            <span className="text-xs text-purple-500/50 hidden sm:inline">{t("lifeos.rpg_habit_tracker", "RPG Habit Tracker")}</span>
          </div>
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                    activeTab === tab.id
                      ? "bg-purple-700/60 text-purple-100"
                      : "text-purple-400 hover:bg-purple-900/40"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t(`lifeos.tabs.${tab.id}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main
        className="max-w-7xl mx-auto px-4 py-5 space-y-5 md:pb-5"
        style={{
          paddingBottom: isMobile ? "calc(var(--bottom-bar-height) + 24px)" : undefined
        }}
      >
        {/* Character Panel always visible */}
        <CharacterPanel gs={gs} update={update} />

        {/* Tasks tab — 3 column layout */}
        {activeTab === "tasks" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HabitsColumn  gs={gs} update={update} />
            <DailiesColumn gs={gs} update={update} />
            <TodosColumn   gs={gs} update={update} />
          </div>
        )}

        {activeTab === "rewards" && <RewardsPanel gs={gs} update={update} />}

        {activeTab === "inventory" && <InventoryPanel gs={gs} update={update} />}

        {activeTab === "feed" && <ActivityFeed gs={gs} />}
      </main>
    </div>
  );
}

// Inline Inventory Panel
function InventoryPanel({ gs, update }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-purple-800/40 bg-purple-950/30">
        <h3 className="text-purple-300 font-bold text-sm mb-3 uppercase tracking-wider">{t("lifeos.equipped", "Equipped")}</h3>
        <div className="grid grid-cols-3 gap-3">
          {["weapon", "armor", "helmet"].map(slot => {
            const eq = gs.equipment[slot];
            return (
              <div key={slot} className="text-center p-3 rounded-lg border border-purple-800/30 bg-purple-900/20">
                <div className="text-2xl mb-1">{eq?.icon || "—"}</div>
                <div className="text-xs text-purple-300">{eq?.label || t(`lifeos.slots.${slot}`, slot)}</div>
                {eq && <div className="text-[10px] text-purple-500 mt-0.5 capitalize">{t(`lifeos.slots.${slot}`, slot)}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="p-4 rounded-xl border border-purple-800/40 bg-purple-950/30">
        <h3 className="text-purple-300 font-bold text-sm mb-3 uppercase tracking-wider">{t("lifeos.inventory", "Inventory")} ({gs.inventory.length})</h3>
        {gs.inventory.length === 0 ? (
          <div className="text-purple-500/50 text-xs text-center py-4">{t("lifeos.complete_tasks", "Complete tasks to earn item drops!")}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {gs.inventory.map(item => {
              const isEquipped = gs.equipment[item.slot]?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => update(s => equipItem(s, item))}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    isEquipped
                      ? "border-yellow-500/60 bg-yellow-900/20 text-yellow-300"
                      : "border-purple-700/40 bg-purple-900/20 hover:bg-purple-800/30 text-purple-200"
                  }`}
                >
                  <div className="text-xl mb-1">{item.icon}</div>
                  <div className="text-[10px] font-bold">{item.label}</div>
                  <div className="text-[9px] text-purple-500 mt-0.5 capitalize">{t(`lifeos.slots.${item.slot}`, item.slot)}</div>
                  {isEquipped && <div className="text-[9px] text-yellow-400 mt-0.5">{t("lifeos.equipped_badge", "EQUIPPED")}</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}