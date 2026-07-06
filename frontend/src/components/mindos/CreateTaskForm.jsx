import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { djangoApi } from "@/api/djangoClient";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

const CATEGORIES = ["Math", "Physics", "Chemistry", "Biology", "English", "Philosophy", "Coding", "Sleep", "Nutrition", "Reading", "Social", "Mindfulness", "Exercise", "Running", "Music", "Art", "History", "Languages", "Other"];

const TASK_TYPES = [
  { id: "habit", label: "Habit", desc: "Repeatable ± action" },
  { id: "daily", label: "Daily", desc: "Reset every day" },
  { id: "todo", label: "To-Do", desc: "One-time task" },
  { id: "button", label: "Button", desc: "Manual session log" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#22c55e" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "high", label: "High", color: "#ef4444" },
  { id: "critical", label: "Critical", color: "#a855f7" },
];

export default function CreateTaskForm({ onCreated, hideTypeSelector = false }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    type: hideTypeSelector ? "button" : "daily",
    category: "Math",
    priority: "medium",
    notes: "",
    dueDate: "",
    xpReward: 10,
    goldReward: 8,
    bossDamage: 15,
    hpDamageOnMiss: 20,
    defaultHours: 1,
    defaultFocus: 7,
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const create = async () => {
    if (!form.name.trim()) return;

    try {
      const taskData = {
        title: form.name.trim(),
        task_type: form.type,
        category: form.category || "Other",
        notes: form.notes || "",
        difficulty: "medium", // default difficulty tier
        due_date: form.dueDate || null,
        
        // Custom rewards and session defaults (with safety fallback values)
        xp_reward: Math.max(1, parseInt(form.xpReward, 10) || 10),
        gold_reward: Math.max(1, parseInt(form.goldReward, 10) || 8),
        boss_damage: Math.max(1, parseInt(form.bossDamage, 10) || 15),
        default_hours: Math.max(0.5, parseFloat(form.defaultHours) || 1.0),
        default_focus: Math.max(1, Math.min(10, parseInt(form.defaultFocus, 10) || 7)),
      };

      await djangoApi.tasks.create(taskData);
      
      djangoApi.analytics.logEvent("task_created");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onCreated?.();
      setForm({ name: "", type: hideTypeSelector ? "button" : "daily", category: "Math", priority: "medium", notes: "", dueDate: "", xpReward: 10, goldReward: 8, bossDamage: 15, hpDamageOnMiss: 20, defaultHours: 1, defaultFocus: 7 });
    } catch (e) {
      console.error("Failed to create custom task on backend:", e);
    }
  };

  const NumStepper = ({ label, value, onChange, min = 0, max = 9999, step = 1, color = "#3b82f6" }) => (
    <div className="space-y-1">
      <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - step))}
          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-accent text-muted-foreground">
          <Minus className="w-3 h-3" />
        </button>
        <div className="flex-1 text-center font-mono font-bold text-sm" style={{ color }}>{value}</div>
        <button onClick={() => onChange(Math.min(max, value + step))}
          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-accent text-muted-foreground">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {hideTypeSelector ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--habit-purple-light)', border: '1px solid var(--habit-purple)' }}>
          <span className="text-sm">🔘</span>
          <div>
            <div className="text-[11px] font-mono font-bold" style={{ color: 'var(--habit-purple)' }}>Training Activity Button</div>
            <div className="text-[9px] font-mono" style={{ color: 'var(--habit-dim)' }}>Appears in the Activities grid — tap to log a session instantly</div>
          </div>
        </div>
      ) : (
        <div className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wider">{t("task_form.create_custom_task", "Create Custom Task")}</div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.task_name", "Task Name")}</div>
        <Input
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder={t("task_form.placeholder_name", "Enter task name...")}
          className="font-mono text-sm bg-muted/20 border-border/60"
        />
      </div>

      {/* Type — hidden when hideTypeSelector */}
      {!hideTypeSelector && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.type", "Type")}</div>
          <div className="grid grid-cols-2 gap-2">
            {TASK_TYPES.map(tType => (
              <button key={tType.id} onClick={() => set("type", tType.id)}
                className="p-2.5 rounded-lg border text-center transition-all"
                style={{
                  borderColor: form.type === tType.id ? "var(--habit-purple)" : "var(--habit-border)",
                  background: form.type === tType.id ? "var(--habit-purple-light)" : "transparent",
                }}>
                <div className="text-xs font-mono font-bold" style={{ color: form.type === tType.id ? "var(--habit-purple)" : "var(--habit-dim)" }}>{t(`task_form.types.${tType.id}`, tType.label)}</div>
                <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">{t(`task_form.types.${tType.id}_desc`, tType.desc)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.category", "Category")}</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => set("category", c)}
              className="px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all"
              style={{
                borderColor: form.category === c ? "var(--habit-purple)" : "var(--habit-border)",
                color: form.category === c ? "var(--habit-purple)" : "var(--habit-dim)",
                background: form.category === c ? "var(--habit-purple-light)" : "transparent",
              }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.priority", "Priority")}</div>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map(p => (
            <button key={p.id} onClick={() => set("priority", p.id)}
              className="py-1.5 text-[10px] font-mono font-bold rounded-lg border transition-all"
              style={{
                borderColor: form.priority === p.id ? p.color : "var(--habit-border)",
                color: form.priority === p.id ? p.color : "var(--habit-dim)",
                background: form.priority === p.id ? `${p.color}20` : "transparent",
              }}>
              {t(`task_form.priorities.${p.id}`, p.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Rewards */}
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-4">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.completion_rewards", "Completion Rewards")}</div>
        <div className="grid grid-cols-3 gap-4">
          <NumStepper label={t("task_form.xp_reward", "XP Reward")} value={form.xpReward} onChange={v => set("xpReward", v)} min={1} step={5} color="#3b82f6" />
          <NumStepper label={t("task_form.gold_reward", "Gold Reward")} value={form.goldReward} onChange={v => set("goldReward", v)} min={1} step={5} color="#f0c040" />
          <NumStepper label={t("task_form.boss_dmg", "Boss DMG")} value={form.bossDamage} onChange={v => set("bossDamage", v)} min={1} step={5} color="#ef4444" />
        </div>
      </div>

      {/* Button: default hours + focus */}
      {form.type === "button" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
          <div className="text-[10px] font-mono text-primary/60 uppercase tracking-wider">{t("task_form.session_defaults", "Session Defaults")}</div>
          <div className="grid grid-cols-2 gap-4">
            <NumStepper label={t("task_form.default_hours", "Default Hours")} value={form.defaultHours} onChange={v => set("defaultHours", v)} min={0.5} max={12} step={0.5} color="#3b82f6" />
            <NumStepper label={t("task_form.default_focus", "Default Focus (1-10)")} value={form.defaultFocus} onChange={v => set("defaultFocus", v)} min={1} max={10} step={1} color="#a855f7" />
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/40">{t("task_form.button_desc", "When you press this button it logs the session with these defaults. You can adjust before confirming.")}</div>
        </div>
      )}

      {/* HP damage on miss (habits/dailies) — hidden when button-only */}
      {!hideTypeSelector && form.type !== "todo" && form.type !== "button" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <div className="text-[10px] font-mono text-red-400/60 uppercase tracking-wider">{t("task_form.penalty", "Penalty on Miss / Negative")}</div>
          <NumStepper label={t("task_form.hp_damage", "HP Damage")} value={form.hpDamageOnMiss} onChange={v => set("hpDamageOnMiss", v)} min={0} step={5} color="#ef4444" />
        </div>
      )}

      {/* Due date for todos — hidden when button-only */}
      {!hideTypeSelector && form.type === "todo" && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.due_date", "Due Date (optional)")}</div>
          <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} className="font-mono text-sm bg-muted/20 border-border/60" />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.notes", "Notes (optional)")}</div>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          placeholder={t("task_form.notes_placeholder", "Any notes or context...")} className="h-16 text-xs font-mono bg-muted/20 border-border/60" />
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border/40 bg-muted/10 p-3 font-mono text-[10px] space-y-1">
        <div className="text-muted-foreground/40 uppercase tracking-wider mb-2">{t("task_form.preview", "Preview")}</div>
        <div className="flex gap-3 flex-wrap">
          <span className="text-blue-400">+{form.xpReward} XP</span>
          <span className="text-yellow-400">+{form.goldReward}G</span>
          <span className="text-red-400">⚔ {form.bossDamage} DMG</span>
          {form.type !== "todo" && <span className="text-red-600">💔 -{form.hpDamageOnMiss} HP {t("task_form.on_miss", "on miss")}</span>}
        </div>
      </div>

      <button
        onClick={create}
        disabled={!form.name.trim()}
        className="w-full py-3 rounded-xl font-mono font-bold text-sm transition-all"
        style={{
          background: form.name.trim() ? "var(--habit-purple)" : "var(--habit-bg)",
          color: form.name.trim() ? "white" : "var(--habit-dim)",
          cursor: form.name.trim() ? "pointer" : "not-allowed",
        }}
      >
        {t("task_form.create_btn", "CREATE TASK")}
      </button>
    </div>
  );
}