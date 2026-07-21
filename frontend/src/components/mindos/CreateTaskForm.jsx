import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { djangoApi } from "@/api/djangoClient";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import EmojiPicker, { Theme } from 'emoji-picker-react';

const CATEGORIES = ["STEM", "Languages", "Humanities & Arts", "Health & Fitness", "Rest & Recovery", "Mindfulness", "Social & Communication", "Reading & Writing", "Work & Career", "Other"];

const CATEGORY_TO_MASTERY = {
  "STEM": "sciences",
  "Languages": "languages",
  "Humanities & Arts": "humanities",
  "Health & Fitness": "body",
  "Rest & Recovery": "spirit",
  "Mindfulness": "spirit",
  "Social & Communication": "humanities",
  "Reading & Writing": "humanities",
  "Work & Career": "sciences",
  "Other": "spirit"
};

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

const PRIORITY_TO_DIFFICULTY = {
  low: "trivial",
  medium: "easy",
  high: "medium",
  critical: "hard"
};

const TRAINING_REWARDS = {
  low: { xp: 20, gold: 10, bossDamage: 20 },
  medium: { xp: 35, gold: 20, bossDamage: 45 },
  high: { xp: 50, gold: 35, bossDamage: 70 },
  critical: { xp: 70, gold: 60, bossDamage: 100 },
};

const TASK_REWARDS = {
  low: { xp: 3, gold: 1, bossDamage: 10, hpDamage: 5 },
  medium: { xp: 9, gold: 4, bossDamage: 30, hpDamage: 10 },
  high: { xp: 15, gold: 7, bossDamage: 50, hpDamage: 20 },
  critical: { xp: 30, gold: 14, bossDamage: 100, hpDamage: 40 },
};

const getInitialForm = (isButton) => {
  const defaultPriority = "medium";
  const rewardsMap = isButton ? TRAINING_REWARDS : TASK_REWARDS;
  const defaultRewards = rewardsMap[defaultPriority];
  return {
    name: "",
    icon: "⭐",
    type: isButton ? "button" : "daily",
    category: "Other",
    masteryCategory: isButton ? "spirit" : "",
    priority: defaultPriority,
    notes: "",
    dueDate: "",
    xpReward: defaultRewards.xp,
    goldReward: defaultRewards.gold,
    bossDamage: defaultRewards.bossDamage,
    hpDamageOnMiss: defaultRewards.hpDamage || 20,
    defaultHours: 1.0,
    defaultFocus: 7,
  };
};

export default function CreateTaskForm({ onCreated, hideTypeSelector = false }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [form, setForm] = useState(() => getInitialForm(hideTypeSelector));

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const isSubmitDisabled = !form.name.trim() || (form.type === "button" && !form.masteryCategory);

  const create = async () => {
    if (isSubmitDisabled) return;

    try {
      const taskData = {
        title: form.name.trim(),
        icon: form.icon,
        task_type: form.type,
        category: form.category || "Other",
        mastery_category: form.type === "button" ? form.masteryCategory : "",
        notes: form.notes || "",
        difficulty: PRIORITY_TO_DIFFICULTY[form.priority] || "medium",
        due_date: form.dueDate || null,
        
        // Custom rewards and session defaults (with safety fallback values)
        xp_reward: Math.max(1, parseInt(String(form.xpReward), 10) || 10),
        gold_reward: Math.max(1, parseInt(String(form.goldReward), 10) || 8),
        boss_damage: Math.max(1, parseInt(String(form.bossDamage), 10) || 15),
        default_hours: Math.max(0.5, parseFloat(String(form.defaultHours)) || 1.0),
        default_focus: Math.max(1, Math.min(10, parseInt(String(form.defaultFocus), 10) || 7)),
      };

      await djangoApi.tasks.create(taskData);
      
      djangoApi.analytics.logEvent("task_created");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onCreated?.();
      setForm(getInitialForm(hideTypeSelector));
    } catch (e) {
      console.error("Failed to create custom task on backend:", e);
    }
  };

  const handleCategorySelect = (cat) => {
    setForm(prev => {
      const next = { ...prev, category: cat };
      if (prev.type === "button" && CATEGORY_TO_MASTERY[cat]) {
        next.masteryCategory = CATEGORY_TO_MASTERY[cat];
      }
      return next;
    });
  };

  const handlePrioritySelect = (priorityId) => {
    const rewardsMap = form.type === "button" ? TRAINING_REWARDS : TASK_REWARDS;
    const rewards = rewardsMap[priorityId] || rewardsMap["medium"];
    setForm(prev => ({
      ...prev,
      priority: priorityId,
      xpReward: rewards.xp,
      goldReward: rewards.gold,
      bossDamage: rewards.bossDamage,
      hpDamageOnMiss: rewards.hpDamage || 20,
    }));
  };

  const handleTypeSelect = (typeId) => {
    setForm(prev => {
      const next = { ...prev, type: typeId };
      if (typeId === "button" && prev.category && CATEGORY_TO_MASTERY[prev.category]) {
        next.masteryCategory = CATEGORY_TO_MASTERY[prev.category];
      }
      const rewardsMap = typeId === "button" ? TRAINING_REWARDS : TASK_REWARDS;
      const rewards = rewardsMap[prev.priority] || rewardsMap["medium"];
      next.xpReward = rewards.xp;
      next.goldReward = rewards.gold;
      next.bossDamage = rewards.bossDamage;
      next.hpDamageOnMiss = rewards.hpDamage || 20;
      return next;
    });
  };

  const NumStepper = ({ label, value, onChange, min = 0, max = 9999, step = 1, color = "#3b82f6" }) => (
    <div className="space-y-1">
      <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-accent text-muted-foreground transition-colors cursor-pointer shrink-0"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center font-mono font-bold text-sm sm:text-base" style={{ color }}>{value}</div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-accent text-muted-foreground transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Name and Icon */}
      <div className="space-y-1.5 relative">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.task_name", "Task Name")}</div>
        <div className="flex gap-2 relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-11 h-11 shrink-0 rounded-md border border-border/60 bg-muted/20 flex items-center justify-center text-xl hover:bg-muted/40 transition-colors cursor-pointer"
          >
            {form.icon}
          </button>
          
          <Input
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder={t("task_form.placeholder_name", "Enter task name...")}
            className="font-mono text-sm bg-muted/20 border-border/60 flex-1 h-11"
          />
        </div>
        
        {showEmojiPicker && (
          <div className="absolute top-16 left-0 z-50">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                set("icon", emojiData.emoji);
                setShowEmojiPicker(false);
              }}
              theme={Theme.DARK}
            />
          </div>
        )}
      </div>

      {/* Type Selector (if visible) */}
      {!hideTypeSelector && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.task_type", "Task Type")}</div>
          <div className="grid grid-cols-4 gap-2">
            {TASK_TYPES.map(type => (
              <button key={type.id} type="button" onClick={() => handleTypeSelect(type.id)}
                className="py-2.5 px-1 flex flex-col items-center justify-center rounded-xl border text-center transition-all cursor-pointer"
                style={{
                  borderColor: form.type === type.id ? "var(--habit-purple)" : "var(--habit-border)",
                  color: form.type === type.id ? "white" : "var(--habit-dim)",
                  background: form.type === type.id ? "var(--habit-purple-light)" : "transparent",
                }}>
                <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13 }}>{t(`task_form.types.${type.id}`, type.label)}</span>
                <span className="text-[7.5px] mt-0.5 opacity-60 leading-none">{t(`task_form.types.${type.id}_desc`, type.desc)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.category", "Category")}</div>
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORIES.map(cat => (
            <button key={cat} type="button" onClick={() => handleCategorySelect(cat)}
              className="py-2 px-1 flex items-center justify-center rounded-lg border text-center transition-all cursor-pointer"
              style={{
                borderColor: form.category === cat ? "var(--habit-purple)" : "var(--habit-border)",
                color: form.category === cat ? "white" : "var(--habit-dim)",
                background: form.category === cat ? "var(--habit-purple-light)" : "transparent",
                fontSize: 9,
                fontWeight: form.category === cat ? 700 : 500,
                fontFamily: "'Nunito'",
              }}>
              {t(`categories.${cat}`, cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Mastery category (for custom activity buttons) */}
      {form.type === "button" && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.mastery_area", "Mastery Area")} *</div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: "body", label: "Body", icon: "💪", color: "#ef4444" },
              { id: "sciences", label: "Sciences", icon: "🔬", color: "#3b82f6" },
              { id: "languages", label: "Languages", icon: "🌐", color: "#10b981" },
              { id: "spirit", label: "Spirit", icon: "✨", color: "#a855f7" },
              { id: "humanities", label: "Humanities", icon: "📚", color: "#f59e0b" },
            ].map(m => (
              <button key={m.id} type="button" onClick={() => set("masteryCategory", m.id)}
                className="p-1.5 rounded-lg border text-center flex flex-col items-center justify-center transition-all cursor-pointer"
                style={{
                  borderColor: form.masteryCategory === m.id ? m.color : "var(--habit-border)",
                  background: form.masteryCategory === m.id ? `${m.color}20` : "transparent",
                }}>
                <span className="text-sm">{m.icon}</span>
                <span className="text-[8px] font-mono font-bold mt-1" style={{ color: form.masteryCategory === m.id ? m.color : "var(--habit-dim)" }}>
                  {t(`mastery.${m.id}`, m.label)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Priority */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">{t("task_form.priority", "Priority")}</div>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map(p => (
            <button key={p.id} type="button" onClick={() => handlePrioritySelect(p.id)}
              className="py-1.5 text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer"
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

      {/* Unified Session Settings (for Buttons) */}
      {form.type === "button" && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-4">
          <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">
            {t("task_form.activity_settings", "Session Defaults")}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <NumStepper label={t("task_form.default_hours", "Default Hours")} value={form.defaultHours} onChange={v => set("defaultHours", v)} min={0.5} max={16} step={0.5} color="#3b82f6" />
            <NumStepper label={t("task_form.default_focus", "Default Focus (1-10)")} value={form.defaultFocus} onChange={v => set("defaultFocus", v)} min={1} max={10} step={1} color="#a855f7" />
          </div>
          
          <div className="text-[9px] font-mono text-slate-400/80 border-t border-purple-500/10 pt-2 leading-relaxed">
            {t("task_form.button_desc", "When you press this button it logs the session with these defaults. You can adjust before confirming.")}
          </div>
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
          {form.type !== "todo" && form.type !== "button" && (
            <span className="text-red-600">💔 -{form.hpDamageOnMiss} HP {t("task_form.on_miss", "on miss")}</span>
          )}
        </div>
      </div>

      <button
        onClick={create}
        disabled={isSubmitDisabled}
        className="w-full py-3.5 rounded-xl font-mono font-bold text-sm transition-all"
        style={{
          background: !isSubmitDisabled ? "var(--habit-purple)" : "var(--habit-bg)",
          color: !isSubmitDisabled ? "white" : "var(--habit-dim)",
          cursor: !isSubmitDisabled ? "pointer" : "not-allowed",
        }}
      >
        {form.type === "button" ? t("task_form.create_activity_btn", "CREATE ACTIVITY") : t("task_form.create_btn", "CREATE TASK")}
      </button>
    </div>
  );
}