// @ts-nocheck
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import FantasyIcon from "@/components/navigation/FantasyIcon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = ["STEM", "Languages", "Humanities & Arts", "Health & Fitness", "Rest & Recovery", "Mindfulness", "Social & Communication", "Reading & Writing", "Work & Career", "Other"];
const DIFFICULTIES = [
  { id: "trivial", label: "Trivial", color: "#64748b" },
  { id: "easy", label: "Easy", color: "#22c55e" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "hard", label: "Hard", color: "#ef4444" },
];
import { useHardwareBack } from "@/utils/modalStack";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

const CLASS_MASTERY_MAP = {
  architect: "sciences",
  warlord: "body",
  linguist: "languages",
  ascetic: "spirit",
};

const CATEGORY_TO_MASTERY = {
  "STEM": "sciences",
  "Languages": "languages",
  "Humanities & Arts": "humanities",
  "Health & Fitness": "body",
  "Rest & Recovery": "recovery",
  "Mindfulness": "spirit",
  "Social & Communication": "spirit",
  "Reading & Writing": "languages",
  "Work & Career": "sciences",
  "Other": "humanities",
};

const CATEGORY_COLORS = {
  "STEM": "#3b82f6",
  "Languages": "#00cc88",
  "Humanities & Arts": "#eab308",
  "Health & Fitness": "#ef4444",
  "Rest & Recovery": "#f97316",
  "Mindfulness": "#9944ff",
  "Social & Communication": "#a855f7",
  "Reading & Writing": "#22c55e",
  "Work & Career": "#64748b",
  "Other": "#94a3b8",
};

const CATEGORY_ICONS = {
  "STEM": "🔬",
  "Languages": "🌐",
  "Humanities & Arts": "📚",
  "Health & Fitness": "💪",
  "Rest & Recovery": "☕",
  "Mindfulness": "🧘",
  "Social & Communication": "💬",
  "Reading & Writing": "✍️",
  "Work & Career": "💼",
  "Other": "📦",
};

export default function CreateTaskModal({ isOpen, onClose, formType, setFormType, form, setForm, onCreate, editMode = false }) {
  useHardwareBack(isOpen, onClose);
  
  const { t } = useTranslation();
  const auth = useDjangoAuth();
  const currentProfile = auth?.profile;
  const userClass = currentProfile?.character_class ? currentProfile.character_class.toLowerCase().trim() : "";
  const heroTargetMastery = CLASS_MASTERY_MAP[userClass] || null;
  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setFormType(formType);
      setForm(prev => ({ ...prev, type: formType }));
    }
  }, [isOpen, formType]);

  const handleCreate = () => {
    if (!form.name.trim()) return;
    onCreate();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-screen backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99998] bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal centered on screen */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 pointer-events-none pt-12 sm:pt-16"
          >
            <div 
              className="w-full max-w-2xl max-h-[88vh] pointer-events-auto rounded-2xl border overflow-hidden text-slate-200 flex flex-col shadow-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(22,20,18,0.98) 0%, rgba(15,13,11,0.99) 100%)",
                border: "1px solid rgba(240,192,64,0.35)",
                boxShadow: "0 25px 80px rgba(0,0,0,0.85), 0 0 40px rgba(240,192,64,0.12)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                <span className="font-mono text-base font-bold tracking-wider" style={{ color: "#f0c040" }}>
                  {editMode ? t('task_modal.edit_title', 'EDIT TASK') : t('task_modal.create_title', 'CREATE NEW TASK')}
                </span>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <FantasyIcon size={22}><X /></FantasyIcon>
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto overscroll-contain p-6 pt-8" style={{ maxHeight: "calc(100vh - 220px)" }}>
                <div className="space-y-5">
                  {/* Task Name */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">
                      {t('task_modal.task_name', 'Task Name')}
                    </label>
                    <Input
                      placeholder={t('task_modal.task_name_placeholder', 'Enter task name...')}
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                      autoFocus
                    />
                  </div>

                  {/* Type selector */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider font-bold">
                      {t('task_modal.task_type', 'Task Type')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'habit', label: t('task_modal.habit', 'Habit'), iconImg: '/images/tasks/task_habit_lightning.png', color: '#f43f5e' },
                        { id: 'daily', label: t('task_modal.daily', 'Daily Routine'), iconImg: '/images/tasks/task_daily_shield.png', color: '#a855f7' },
                        { id: 'todo', label: t('task_modal.todo', 'To-Do / Quest'), iconImg: '/images/tasks/task_todo_scroll.png', color: '#f59e0b' }
                      ].map(item => {
                        const isSelected = formType === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setFormType(item.id);
                              setForm({ ...form, type: item.id });
                            }}
                            className="px-3 py-2.5 rounded-xl border text-center transition-all uppercase cursor-pointer flex flex-col items-center gap-1.5 relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                              borderColor: isSelected ? item.color : "rgba(255,255,255,0.1)",
                              color: isSelected ? "#ffffff" : "rgba(148, 163, 184, 0.7)",
                              background: isSelected ? `${item.color}20` : "rgba(255,255,255,0.02)",
                              boxShadow: isSelected ? `0 0 16px ${item.color}30` : "none"
                            }}
                          >
                            <div className="w-8 h-8 flex items-center justify-center">
                              <img 
                                src={item.iconImg} 
                                alt={item.label} 
                                className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110"
                                style={{
                                  filter: isSelected ? `drop-shadow(0 0 8px ${item.color}88)` : 'none'
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs font-bold tracking-wider">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category selector */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider font-bold">
                      {t('task_modal.category', 'Category')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {CATEGORIES.map(c => {
                        const mastery = CATEGORY_TO_MASTERY[c];
                        const isMatch = Boolean(heroTargetMastery && mastery === heroTargetMastery);
                        const isSelected = form.category === c;
                        const catColor = CATEGORY_COLORS[c] || '#94a3b8';
                        const catIcon = CATEGORY_ICONS[c] || '⭐';
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm({ ...form, category: c })}
                            className="p-2 sm:p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer relative overflow-hidden group"
                            style={{
                              borderColor: isSelected
                                ? catColor
                                : isMatch
                                  ? `${catColor}80`
                                  : "rgba(255, 255, 255, 0.08)",
                              background: isSelected
                                ? `${catColor}25`
                                : isMatch
                                  ? `${catColor}10`
                                  : "rgba(255, 255, 255, 0.02)",
                              boxShadow: isSelected
                                ? `0 0 16px ${catColor}35, inset 0 0 12px ${catColor}15`
                                : isMatch
                                  ? `0 0 10px ${catColor}20`
                                  : "none",
                            }}
                          >
                            {isMatch && (
                              <span 
                                className="absolute -top-1 -right-1 px-1 py-0.2 rounded text-[7px] font-bold bg-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.6)] animate-pulse z-10 font-mono"
                              >
                                +20%
                              </span>
                            )}
                            <span 
                              className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-sm transition-transform group-hover:scale-110"
                              style={{
                                background: isSelected ? `${catColor}35` : "rgba(255, 255, 255, 0.05)",
                                border: `1px solid ${isSelected ? catColor : "rgba(255, 255, 255, 0.1)"}`
                              }}
                            >
                              {catIcon}
                            </span>
                            <span 
                              className="text-[10px] sm:text-[11px] font-mono font-bold leading-tight truncate flex-1"
                              style={{
                                color: isSelected ? "#ffffff" : isMatch ? catColor : "rgba(226, 232, 240, 0.75)",
                              }}
                            >
                              {t("categories." + c, c)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Difficulty selector */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider font-bold">
                      {t('task_modal.difficulty', 'Difficulty')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {DIFFICULTIES.map(d => {
                        const isSelected = form.difficulty === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setForm({ ...form, difficulty: d.id })}
                            className="px-2.5 py-2.5 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer text-center"
                            style={{
                              borderColor: isSelected ? d.color : "rgba(255,255,255,0.08)",
                              color: isSelected ? d.color : "rgba(148, 163, 184, 0.6)",
                              background: isSelected ? `${d.color}18` : "rgba(255,255,255,0.02)",
                              boxShadow: isSelected ? `0 0 12px ${d.color}25` : "none"
                            }}
                          >
                            {t(`difficulties.${d.id}`, d.label)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Todo-specific: Due Date */}
                  {form.type === "todo" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">
                        {t('task_modal.due_date', 'Due Date')}
                      </label>
                      <Input
                        type="date"
                        value={form.dueDate}
                        onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                      />
                    </div>
                  )}

                  {/* Daily-specific: Time Window */}
                  {form.type === "daily" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider font-bold">
                          {t('task_modal.start_time', 'Start Time')}
                        </label>
                        <Input
                          type="time"
                          value={form.scheduledTime || ""}
                          onChange={e => setForm({ ...form, scheduledTime: e.target.value })}
                          className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider font-bold">
                          {t('task_modal.end_time', 'End Time')}
                        </label>
                        <Input
                          type="time"
                          value={form.scheduledEndTime || ""}
                          onChange={e => setForm({ ...form, scheduledEndTime: e.target.value })}
                          className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                        />
                      </div>
                    </div>
                  )}

                  {/* Inline Time Error */}
                  {form.type === "daily" && form.scheduledTime && form.scheduledEndTime && form.scheduledEndTime <= form.scheduledTime && (
                    <p className="text-red-400 text-[10px] font-mono uppercase tracking-wider">
                      ⚠️ {t('calendar_ui.end_time_after_start', 'End time must be after start time')}
                    </p>
                  )}

                  {/* Daily-specific: Repeat Schedule (weekdays) */}
                  {form.type === "daily" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider font-bold">
                        {t('task_modal.repeat_schedule', 'Repeat Schedule')}
                      </label>
                      <div className="flex gap-1.5 justify-between">
                        {[
                          { label: t('calendar_ui.days_short.0', 'M')[0], flag: 1 },
                          { label: t('calendar_ui.days_short.1', 'T')[0], flag: 2 },
                          { label: t('calendar_ui.days_short.2', 'W')[0], flag: 4 },
                          { label: t('calendar_ui.days_short.3', 'T')[0], flag: 8 },
                          { label: t('calendar_ui.days_short.4', 'F')[0], flag: 16 },
                          { label: t('calendar_ui.days_short.5', 'S')[0], flag: 32 },
                          { label: t('calendar_ui.days_short.6', 'S')[0], flag: 64 },
                        ].map((day, idx) => {
                          const currentBitmask = form.repeatWeekdays !== undefined ? form.repeatWeekdays : 127;
                          const isSelected = (currentBitmask & day.flag) > 0;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                let newBitmask = isSelected ? currentBitmask - day.flag : currentBitmask + day.flag;
                                if (newBitmask === 0) return;
                                setForm({ ...form, repeatWeekdays: newBitmask });
                              }}
                              className="w-10 h-10 rounded-full font-mono text-xs font-bold border-2 transition-all flex items-center justify-center cursor-pointer"
                              style={{
                                borderColor: isSelected ? "rgba(240,192,64,0.6)" : "rgba(148,163,184,0.25)",
                                color: isSelected ? "#f0c040" : "#64748b",
                                background: isSelected ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.02)",
                                boxShadow: "0 1px 0 rgba(0,0,0,0.3)"
                              }}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Daily-specific: Show in Calendar toggle */}
                  {form.type === "daily" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">
                        {t('task_modal.visible_in_calendar', 'Show in Calendar')}
                      </label>
                      <button
                        onClick={() => setForm({ ...form, showInCalendar: !form.showInCalendar })}
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition-all flex items-center justify-between cursor-pointer"
                        style={{
                          borderColor: form.showInCalendar ? "rgba(240,192,64,0.6)" : "rgba(148,163,184,0.2)",
                          color: form.showInCalendar ? "#f0c040" : "#94a3b8",
                          background: form.showInCalendar ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.02)",
                          boxShadow: form.showInCalendar ? "0 0 12px rgba(240,192,64,0.15)" : "none"
                        }}
                      >
                        <span className="font-bold">{form.showInCalendar ? t('task_modal.visible_in_calendar', 'VISIBLE IN CALENDAR') : t('calendar_ui.hidden_calendar', 'HIDDEN FROM CALENDAR')}</span>
                        <span className="text-base font-bold">{form.showInCalendar ? "✓" : "○"}</span>
                      </button>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">
                      {t('task_modal.notes', 'Notes (Optional)')}
                    </label>
                    <Textarea
                      placeholder={t('task_modal.notes_placeholder', 'Add notes...')}
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="h-24 text-xs font-mono text-slate-200 bg-black/20 border-white/10"
                    />
                  </div>

                  {/* Create button */}
                  {(() => {
                    const isTimeInvalid = form.type === "daily" && form.scheduledTime && form.scheduledEndTime && form.scheduledEndTime <= form.scheduledTime;
                    const isSubmitDisabled = !form.name.trim() || isTimeInvalid;
                    return (
                      <button
                        onClick={handleCreate}
                        disabled={isSubmitDisabled}
                        className="w-full rounded-xl border font-mono font-bold py-3.5 text-sm tracking-wider uppercase cursor-pointer transition-all flex items-center justify-center gap-2"
                        style={{ 
                          borderColor: !isSubmitDisabled ? "#f0c040" : "rgba(240,192,64,0.2)",
                          background: !isSubmitDisabled 
                            ? "linear-gradient(135deg, rgba(240,192,64,0.3) 0%, rgba(245,158,11,0.2) 100%)" 
                            : "rgba(255,255,255,0.02)",
                          color: !isSubmitDisabled ? "#f0c040" : "rgba(148,163,184,0.4)",
                          boxShadow: !isSubmitDisabled ? "0 4px 20px rgba(240,192,64,0.25)" : "none",
                          cursor: !isSubmitDisabled ? "pointer" : "not-allowed"
                        }}
                      >
                        <span>{editMode ? "💾" : "⚔️"}</span>
                        <span>{editMode ? t('task_modal.save_changes', 'SAVE CHANGES') : t('task_modal.create_task', 'CREATE TASK')}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}