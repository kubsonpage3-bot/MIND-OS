import { useState } from "react";
import { gainXP, gainGold, getDifficulty, isDailyDueToday, maybeDropItem } from "@/lib/lifeOS";
import { CheckSquare, Square, Trash2, PlusCircle, Flame } from "lucide-react";
import TaskForm from "./TaskForm";
import { useTranslation } from "react-i18next";

export default function DailiesColumn({ gs, update }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const complete = (daily) => {
    if (daily.completedToday || !isDailyDueToday(daily)) return;
    const diff = getDifficulty(daily.difficulty);
    update(s => {
      let ns = gainXP(s, diff.xp);
      ns = gainGold(ns, diff.gold);
      ns = maybeDropItem(ns);
      ns = {
        ...ns,
        dailies: ns.dailies.map(d => d.id === daily.id
          ? { ...d, completedToday: true, streak: d.streak + 1 }
          : d),
        logs: [{ type: "daily", msg: `✅ ${daily.label} (+${diff.xp} XP)`, ts: Date.now() }, ...ns.logs].slice(0, 50),
      };
      return ns;
    });
  };

  const deleteDaily = (id) => {
    update(s => ({ ...s, dailies: s.dailies.filter(d => d.id !== id) }));
  };

  const addDaily = (data) => {
    const daily = {
      id: Date.now().toString(),
      completedToday: false,
      streak: 0,
      activeDays: [],
      ...data,
    };
    update(s => ({ ...s, dailies: [...s.dailies, daily] }));
    setAdding(false);
  };

  return (
    <div className="rounded-xl border border-purple-800/40 bg-purple-950/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-800/40">
        <h2 className="text-purple-200 font-bold text-sm uppercase tracking-wider">{t("lifeos_columns.dailies", "📅 Dailies")}</h2>
        <button onClick={() => setAdding(v => !v)} className="text-purple-400 hover:text-purple-200">
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {adding && (
          <TaskForm
            type="daily"
            onSave={addDaily}
            onCancel={() => setAdding(false)}
          />
        )}

        {gs.dailies.length === 0 && !adding && (
          <div className="text-purple-600 text-xs text-center py-6">{t("lifeos_columns.no_dailies", "No dailies yet. Add one!")}</div>
        )}

        {gs.dailies.map(daily => {
          const dueToday = isDailyDueToday(daily);
          const done = daily.completedToday;
          const greyOut = !dueToday;

          return (
            <div
              key={daily.id}
              onClick={() => complete(daily)}
              className={`p-3 rounded-lg border transition-all group cursor-pointer ${
                done
                  ? "border-green-700/40 bg-transparent"
                  : greyOut
                  ? "border-purple-900/30 bg-black opacity-50"
                  : "border-purple-700/40 bg-black hover:bg-black/80"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="shrink-0">
                  {done
                    ? <CheckSquare className="w-5 h-5 text-green-400" />
                    : <Square className="w-5 h-5 text-purple-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${done ? "line-through text-purple-500" : "text-purple-100"}`}>
                    {daily.label}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-purple-500">{getDifficulty(daily.difficulty).label}</span>
                    {daily.streak > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-orange-400">
                        <Flame className="w-2.5 h-2.5" />{daily.streak}
                      </span>
                    )}
                    {daily.activeDays?.length > 0 && (
                      <span className="text-[10px] text-purple-600">{daily.activeDays.join(", ")}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteDaily(daily.id); }}
                  className="opacity-0 group-hover:opacity-100 text-purple-700 hover:text-red-400 transition-all"
                >
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