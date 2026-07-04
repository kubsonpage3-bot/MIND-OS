import { useState } from "react";
import { gainXP, gainGold, loseHP, getDifficulty, getHabitColor, maybeDropItem } from "@/lib/lifeOS";
import { Plus, Minus, Trash2, PlusCircle } from "lucide-react";
import TaskForm from "./TaskForm";
import { useTranslation } from "react-i18next";

export default function HabitsColumn({ gs, update }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const clickPositive = (habit) => {
    const diff = getDifficulty(habit.difficulty);
    update(s => {
      let ns = gainXP(s, diff.xp);
      ns = gainGold(ns, diff.gold);
      ns = maybeDropItem(ns);
      ns = {
        ...ns,
        habits: ns.habits.map(h => h.id === habit.id
          ? { ...h, posStreak: h.posStreak + 1 }
          : h),
        logs: [{ type: "habit+", msg: `✅ ${habit.label} (+${diff.xp} XP)`, ts: Date.now() }, ...ns.logs].slice(0, 50),
      };
      return ns;
    });
  };

  const clickNegative = (habit) => {
    const diff = getDifficulty(habit.difficulty);
    update(s => {
      let ns = loseHP(s, diff.xp * 0.5);
      ns = {
        ...ns,
        habits: ns.habits.map(h => h.id === habit.id
          ? { ...h, negStreak: h.negStreak + 1 }
          : h),
        logs: [{ type: "habit-", msg: `❌ ${habit.label} (-HP)`, ts: Date.now() }, ...ns.logs].slice(0, 50),
      };
      return ns;
    });
  };

  const deleteHabit = (id) => {
    update(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) }));
  };

  const addHabit = (data) => {
    const habit = {
      id: Date.now().toString(),
      posStreak: 0,
      negStreak: 0,
      type: "both",
      ...data,
    };
    update(s => ({ ...s, habits: [...s.habits, habit] }));
    setAdding(false);
  };

  return (
    <div className="rounded-xl border border-purple-800/40 bg-purple-950/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-800/40">
        <h2 className="text-purple-200 font-bold text-sm uppercase tracking-wider">{t("lifeos_columns.habits", "⚡ Habits")}</h2>
        <button onClick={() => setAdding(v => !v)} className="text-purple-400 hover:text-purple-200">
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {adding && (
          <TaskForm
            type="habit"
            onSave={addHabit}
            onCancel={() => setAdding(false)}
          />
        )}

        {gs.habits.length === 0 && !adding && (
          <div className="text-purple-600 text-xs text-center py-6">{t("lifeos_columns.no_habits", "No habits yet. Add one!")}</div>
        )}

        {gs.habits.map(habit => {
          const color = getHabitColor(habit.posStreak, habit.negStreak);
          const showPos = habit.type === "positive" || habit.type === "both";
          const showNeg = habit.type === "negative" || habit.type === "both";
          return (
            <div key={habit.id} className="p-3 rounded-lg border bg-black hover:bg-black/80 transition-all group"
              style={{ borderColor: `${color}40` }}>
              <div className="flex items-center gap-2">
                {showNeg && (
                  <button onClick={() => clickNegative(habit)}
                    className="w-7 h-7 rounded flex items-center justify-center border border-red-700/60 bg-red-900/30 hover:bg-red-700/40 text-red-400 shrink-0">
                    <Minus className="w-3 h-3" />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-purple-100 font-medium truncate">{habit.label}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] capitalize" style={{ color }}>{getDifficulty(habit.difficulty).label}</span>
                    {habit.posStreak > 0 && <span className="text-[10px] text-green-500">+{habit.posStreak}</span>}
                    {habit.negStreak > 0 && <span className="text-[10px] text-red-500">-{habit.negStreak}</span>}
                  </div>
                </div>
                {showPos && (
                  <button onClick={() => clickPositive(habit)}
                    className="w-7 h-7 rounded flex items-center justify-center border border-green-700/60 bg-green-900/30 hover:bg-green-700/40 text-green-400 shrink-0">
                    <Plus className="w-3 h-3" />
                  </button>
                )}
                <button onClick={() => deleteHabit(habit.id)}
                  className="opacity-0 group-hover:opacity-100 text-purple-700 hover:text-red-400 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}