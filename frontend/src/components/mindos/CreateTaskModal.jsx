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
const PRIORITIES = ["low", "medium", "high", "critical"];
const PRIORITY_COLORS = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444", critical: "#a855f7" };

export default function CreateTaskModal({ isOpen, onClose, formType, setFormType, form, setForm, onCreate, editMode = false }) {
  const { t } = useTranslation();
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

          {/* Modal centered on screen - positioned below top character bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100000] flex items-start justify-center pointer-events-none"
            style={{ paddingTop: "100px" }}
          >
            <div 
              className="w-full max-w-2xl mx-4 mb-4 pointer-events-auto rounded-2xl border overflow-hidden text-slate-200"
              style={{
                background: "linear-gradient(135deg, rgba(22,20,18,0.98) 0%, rgba(15,13,11,0.99) 100%)",
                border: "1px solid rgba(240,192,64,0.3)",
                boxShadow: "0 20px 80px rgba(0,0,0,0.8), 0 0 40px rgba(240,192,64,0.1)",
                maxHeight: "calc(100vh - 120px)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                <span className="font-mono text-base font-bold tracking-wider" style={{ color: "#f0c040" }}>{editMode ? "EDIT TASK" : "CREATE NEW TASK"}</span>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                  <FantasyIcon size={22}><X /></FantasyIcon>
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto overscroll-contain p-6 pt-8" style={{ maxHeight: "calc(100vh - 220px)" }}>
                <div className="space-y-5">
                  {/* Task Name */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Task Name</label>
                    <Input
                      placeholder="Enter task name..."
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                      autoFocus
                    />
                  </div>

                  {/* Type selector */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Task Type</label>
                    <div className="flex gap-2">
                      {["habit", "daily", "todo"].map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setFormType(t);
                            setForm({ ...form, type: t });
                          }}
                          className="flex-1 px-3 py-2.5 text-sm font-mono pixel-btn border-2 transition-all uppercase"
                          style={{
                            borderColor: formType === t ? "rgba(240,192,64,0.6)" : "rgba(148,163,184,0.3)",
                            color: formType === t ? "#f0c040" : "#64748b",
                            background: formType === t ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.02)",
                            boxShadow: "0 2px 0 rgba(0,0,0,0.3)"
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category selector */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Category</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CATEGORIES.map(c => (
                        <button
                          key={c}
                          onClick={() => setForm({ ...form, category: c })}
                          className="aspect-square p-0 flex flex-col items-center justify-center text-center text-[9px] leading-[1.1] font-mono pixel-btn border-2 transition-all"
                          style={{
                            borderColor: form.category === c ? "rgba(240,192,64,0.5)" : "rgba(148,163,184,0.25)",
                            color: form.category === c ? "#f0c040" : "#64748b",
                            background: form.category === c ? "rgba(240,192,64,0.1)" : "rgba(255,255,255,0.02)",
                            boxShadow: "0 1px 0 rgba(0,0,0,0.3)"
                          }}
                        >
                          <span className="line-clamp-2 w-full px-0.5">{t("categories." + c, c)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty selector */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Difficulty</label>
                    <div className="flex gap-2">
                      {DIFFICULTIES.map(d => (
                        <button
                          key={d.id}
                          onClick={() => setForm({ ...form, difficulty: d.id })}
                          className="flex-1 px-3 py-2.5 text-xs font-mono rounded border-2 transition-all"
                          style={{
                            borderColor: form.difficulty === d.id ? d.color : "#1e293b",
                            color: form.difficulty === d.id ? d.color : "#64748b",
                            background: form.difficulty === d.id ? `${d.color}15` : "transparent",
                            boxShadow: "0 2px 0 rgba(0,0,0,0.3)"
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Todo-specific: Priority */}
                  {form.type === "todo" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Priority</label>
                      <div className="flex gap-2">
                        {PRIORITIES.map(p => (
                          <button
                            key={p}
                            onClick={() => setForm({ ...form, priority: p })}
                            className="flex-1 py-2 text-xs font-mono rounded border-2 transition-all uppercase"
                            style={{
                              borderColor: form.priority === p ? PRIORITY_COLORS[p] : "#1e293b",
                              color: form.priority === p ? PRIORITY_COLORS[p] : "#64748b",
                              background: form.priority === p ? `${PRIORITY_COLORS[p]}15` : "transparent",
                              boxShadow: "0 2px 0 rgba(0,0,0,0.3)"
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Todo-specific: Due Date */}
                  {form.type === "todo" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Due Date</label>
                      <Input
                        type="date"
                        value={form.dueDate}
                        onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                      />
                    </div>
                  )}

                  {/* Daily-specific: Scheduled Time */}
                  {form.type === "daily" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Scheduled Time</label>
                      <Input
                        type="time"
                        value={form.scheduledTime}
                        onChange={e => setForm({ ...form, scheduledTime: e.target.value })}
                        className="font-mono text-sm h-11 text-slate-200 bg-black/20 border-white/10"
                      />
                    </div>
                  )}

                  {/* Daily-specific: Show in Calendar toggle */}
                  {form.type === "daily" && (
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Show in Calendar</label>
                      <button
                        onClick={() => setForm({ ...form, showInCalendar: !form.showInCalendar })}
                        className="w-full px-3 py-2.5 text-sm font-mono pixel-btn border-2 transition-all flex items-center justify-between"
                        style={{
                          borderColor: form.showInCalendar ? "rgba(240,192,64,0.6)" : "rgba(148,163,184,0.3)",
                          color: form.showInCalendar ? "#f0c040" : "#64748b",
                          background: form.showInCalendar ? "rgba(240,192,64,0.12)" : "rgba(255,255,255,0.02)",
                          boxShadow: "0 2px 0 rgba(0,0,0,0.3)"
                        }}
                      >
                        <span>{form.showInCalendar ? "VISIBLE IN CALENDAR" : "HIDDEN FROM CALENDAR"}</span>
                        <span className="text-lg">{form.showInCalendar ? "✓" : "○"}</span>
                      </button>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground mb-2 block uppercase tracking-wider">Notes (Optional)</label>
                    <Textarea
                      placeholder="Add notes..."
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="h-24 text-xs font-mono text-slate-200 bg-black/20 border-white/10"
                    />
                  </div>

                  {/* Create button */}
                  <button
                    onClick={handleCreate}
                    disabled={!form.name.trim()}
                    className="w-full pixel-btn border-2 font-mono font-bold py-4 text-base tracking-wider"
                    style={{ 
                      borderColor: "#f0c040",
                      background: !form.name.trim() ? "rgba(240,192,64,0.15)" : "rgba(240,192,64,0.25)",
                      color: "#f0c040",
                      boxShadow: "0 2px 0 rgba(0,0,0,0.4)",
                      opacity: !form.name.trim() ? 0.5 : 1
                    }}
                  >
                    {editMode ? "SAVE CHANGES" : "CREATE TASK"}
                  </button>
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