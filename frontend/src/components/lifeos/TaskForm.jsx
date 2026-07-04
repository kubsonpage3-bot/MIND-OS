import { useState } from "react";
import { DIFFICULTIES, DAYS } from "@/lib/lifeOS";
import { useTranslation } from "react-i18next";

export default function TaskForm({ type, onSave, onCancel }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [habitType, setHabitType] = useState("both");
  const [activeDays, setActiveDays] = useState([]);
  const [dueDate, setDueDate] = useState("");

  const toggleDay = (day) => {
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSave = () => {
    if (!label.trim()) return;
    const data = { label: label.trim(), difficulty };
    if (type === "habit") data.type = habitType;
    if (type === "daily") data.activeDays = activeDays;
    if (type === "todo") data.dueDate = dueDate;
    onSave(data);
  };

  return (
    <div className="p-3 rounded-lg border border-purple-600/50 bg-purple-900/40 space-y-3">
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        placeholder={t("task_form.placeholder_name", "Task name...")}
        className="w-full bg-purple-900/40 border border-purple-700/40 rounded px-3 py-2 text-sm text-white placeholder-purple-600 focus:outline-none focus:border-purple-500"
      />

      {/* Difficulty */}
      <div className="flex gap-1 flex-wrap">
        {DIFFICULTIES.map(d => (
          <button key={d.id} onClick={() => setDifficulty(d.id)}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
              difficulty === d.id ? "bg-purple-600 text-white" : "bg-purple-900/40 text-purple-500 hover:bg-purple-800/50"
            }`}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Habit type */}
      {type === "habit" && (
        <div className="flex gap-1">
          {["positive", "negative", "both"].map(t => (
            <button key={t} onClick={() => setHabitType(t)}
              className={`flex-1 py-1 rounded text-[10px] font-bold capitalize transition-all ${
                habitType === t ? "bg-purple-600 text-white" : "bg-purple-900/40 text-purple-500"
              }`}>
              {t === "both" ? "+ / −" : t === "positive" ? t("task_form.habit_good", "✅ Good") : t("task_form.habit_bad", "❌ Bad")}
            </button>
          ))}
        </div>
      )}

      {/* Active days for dailies */}
      {type === "daily" && (
        <div>
          <div className="text-[10px] text-purple-500 mb-1">{t("task_form.active_days", "Active days (empty = every day)")}</div>
          <div className="flex gap-1 flex-wrap">
            {DAYS.map(day => (
              <button key={day} onClick={() => toggleDay(day)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  activeDays.includes(day) ? "bg-purple-600 text-white" : "bg-purple-900/40 text-purple-500"
                }`}>
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Due date for todos */}
      {type === "todo" && (
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="w-full bg-purple-900/40 border border-purple-700/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
        />
      )}

      <div className="flex gap-2">
        <button onClick={handleSave}
          className="flex-1 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all">
          {t("task_form.add", "Add")}
        </button>
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded border border-purple-700/40 text-purple-500 text-xs hover:text-purple-300 transition-all">
          {t("task_form.cancel", "Cancel")}
        </button>
      </div>
    </div>
  );
}