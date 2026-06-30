import { useState, useMemo } from "react";
import { ACTIVITIES, METRIC_CONFIG, computeEfficiency, getSmartRecommendation } from "@/lib/cognitiveEngine";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Zap, Trash2, RotateCcw } from "lucide-react";
import EfficiencyMeter from "./EfficiencyMeter";
import SubjectRankBadge from "./SubjectRankBadge";
import CreateTaskForm from "./CreateTaskForm";

function loadHiddenActivities() {
  try { return JSON.parse(localStorage.getItem("mindos_hidden_activities") || "[]"); } catch { return []; }
}
function saveHiddenActivities(list) { localStorage.setItem("mindos_hidden_activities", JSON.stringify(list)); }

export default function ActivityLogger({ onLog, profile, logs }) {
  const [trainTab, setTrainTab] = useState("log"); // "log" | "create"
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [hours, setHours] = useState(1);
  const [questions, setQuestions] = useState(5);
  const [focusRating, setFocusRating] = useState(7);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [goldFloat, setGoldFloat] = useState(null);
  const [hiddenActivities, setHiddenActivities] = useState(loadHiddenActivities);
  const [deleteMode, setDeleteMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // activity key pending confirmation

  const { hoursToday, subjectHoursMap, recentFocusRatings, subjectTotalHours } = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.log_date).toDateString() === today);
    const hoursToday = todayLogs.reduce((s, l) => s + (l.hours || 0), 0);
    const subjectHoursMap = {};
    todayLogs.forEach(l => {
      subjectHoursMap[l.activity] = (subjectHoursMap[l.activity] || 0) + (l.hours || 0);
    });
    // Total hours per subject across all logs
    const subjectTotalHours = {};
    logs.forEach(l => {
      subjectTotalHours[l.activity] = (subjectTotalHours[l.activity] || 0) + (l.hours || 0);
    });
    const recentFocusRatings = logs.slice(0, 5).map(l => l.focus_rating || 5);
    return { hoursToday, subjectHoursMap, recentFocusRatings, subjectTotalHours };
  }, [logs]);

  const subjectHoursToday = selectedActivity ? (subjectHoursMap[selectedActivity] || 0) : 0;
  const isQuestionsMode = selectedActivity && ACTIVITIES[selectedActivity]?.inputType === "questions";
  const logValue = isQuestionsMode ? questions : hours;

  const efficiency = computeEfficiency({
    focus: focusRating,
    streakDays: profile?.streak_days || 0,
    hoursToday,
    subjectHoursToday,
  });

  const recommendation = getSmartRecommendation({
    hoursToday,
    streak: profile?.streak_days || 0,
    subjectHoursMap,
    recentFocusRatings,
  });

  const confirmLog = () => {
    if (!selectedActivity) return;

    // Check active consumables (Keep local mutator visual logic for now, but remove gold writes)
    let effectiveFocus = focusRating;
    try {
      const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      const cons = gs.consumables || {};

      // Focus Stim: ×1.3 FOC for this session
      if (cons.focus_stim?.active) {
        effectiveFocus = Math.min(10, effectiveFocus * 1.3);
        gs.consumables.focus_stim = { active: false };
        localStorage.setItem("mindos_game_state", JSON.stringify(gs));
      }
    } catch (e) {
      console.error(e);
    }

    onLog(selectedActivity, logValue, effectiveFocus, efficiency, (msg) => {
      setFeedbackMsg(msg);
      setTimeout(() => setFeedbackMsg(null), 4000);
    });
    setSelectedActivity(null);
    setHours(1);
    setFocusRating(7);
  };

  const hideActivity = (key) => {
    const updated = [...hiddenActivities, key];
    setHiddenActivities(updated);
    saveHiddenActivities(updated);
    setConfirmDelete(null);
    if (selectedActivity === key) setSelectedActivity(null);
  };

  const restoreActivities = () => {
    setHiddenActivities([]);
    saveHiddenActivities([]);
    setDeleteMode(false);
  };

  const focusColors = ["", "#ef4444", "#ef4444", "#ef4444", "#f59e0b", "#f59e0b", "#f59e0b", "#22c55e", "#22c55e", "#3b82f6", "#a855f7"];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--habit-bg)" }}>
        {[{ id: "log", label: "Log Session" }, { id: "create", label: "Create Task" }].map(t => (
          <button key={t.id} onClick={() => setTrainTab(t.id)}
            className="flex-1 py-2 rounded-xl transition-all"
            style={{
              fontFamily: "'Nunito'",
              fontWeight: trainTab === t.id ? 800 : 600,
              fontSize: 12,
              background: trainTab === t.id ? "var(--habit-purple)" : "transparent",
              color: trainTab === t.id ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
              boxShadow: trainTab === t.id ? "0 2px 8px var(--habit-purple-glow)" : "none",
              letterSpacing: "0.04em",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {trainTab === "create" && <CreateTaskForm onCreated={() => setTrainTab("log")} />}

      {trainTab === "log" && <>
      {/* Smart recommendation */}
      <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: "var(--habit-bg)", border: "1px solid var(--habit-border)" }}>
        <span className="text-base shrink-0">{recommendation.icon}</span>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{recommendation.text}</p>
      </div>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl flex items-start gap-2"
            style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)", fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)" }}
          >
            <Zap className="w-3 h-3 text-ps mt-0.5 shrink-0" />
            <span>{feedbackMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity grid header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Activities</span>
        <div className="flex items-center gap-1.5">
          {hiddenActivities.length > 0 && (
            <button onClick={restoreActivities}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-muted-foreground/60 hover:text-foreground border border-border/40 rounded transition-colors">
              <RotateCcw className="w-2.5 h-2.5" /> Restore all ({hiddenActivities.length})
            </button>
          )}
          <button
            onClick={() => { setDeleteMode(d => !d); setConfirmDelete(null); }}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono border rounded transition-colors ${
              deleteMode
                ? "border-red-500/60 text-red-400 bg-red-500/10"
                : "border-border/40 text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            <Trash2 className="w-2.5 h-2.5" /> {deleteMode ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {/* Activity grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Object.entries(ACTIVITIES)
          .filter(([key]) => !hiddenActivities.includes(key))
          .map(([key, activity]) => {
            const activeMetrics = Object.entries(METRIC_CONFIG)
              .filter(([mk]) => (activity.coefficients[mk] || 0) > 0);
            const isSelected = selectedActivity === key;
            const totalHours = subjectTotalHours[key] || 0;
            const isPendingDelete = confirmDelete === key;

            return (
              <div key={key} className="relative">
                <button
                  onClick={() => !deleteMode && setSelectedActivity(isSelected ? null : key)}
                  className="w-full h-[110px] sm:h-[145px] flex flex-col group relative p-3 rounded-xl transition-all duration-200 text-left overflow-hidden"
                  style={{
                    background: deleteMode ? "rgba(247,78,82,0.05)" : isSelected ? "var(--habit-purple-light)" : "var(--habit-panel)",
                    border: deleteMode ? "1.5px solid rgba(247,78,82,0.3)" : isSelected ? "1.5px solid var(--habit-purple)" : "1.5px solid var(--habit-border)",
                    boxShadow: isSelected ? "0 2px 12px var(--habit-purple-glow)" : "0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <div className="text-xl mb-1">{activity.icon}</div>
                  <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, color: "var(--habit-text)" }} className="leading-tight">{activity.label}</div>
                  <div style={{ fontFamily: "'Nunito'", fontSize: 11, color: "var(--habit-dim)" }} className="mt-0.5 hidden sm:block line-clamp-2">{activity.description}</div>
                  <div className="flex-1" /> {/* Spacer to push metrics down if needed */}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {activeMetrics.map(([mk, mc]) => (
                      <span key={mk} className={`text-[9px] font-mono px-1 py-0.5 rounded bg-${mc.color}/10 text-${mc.color}`}>
                        +{mc.abbr}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto pt-2">
                    <SubjectRankBadge hours={totalHours} />
                  </div>
                </button>

                {/* Delete button overlay */}
                {deleteMode && (
                  <div className="absolute top-1 right-1">
                    {isPendingDelete ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => hideActivity(key)}
                          className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-red-500 text-white rounded"
                        >✓ YES</button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-1.5 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground rounded"
                        >✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(key)}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Session config panel */}
      <AnimatePresence>
        {selectedActivity && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="p-4 rounded-2xl space-y-4"
            style={{ background: "var(--habit-panel)", border: "1.5px solid var(--habit-purple-light)", boxShadow: "0 4px 20px var(--habit-purple-glow)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 15, color: "var(--habit-text)" }}>{ACTIVITIES[selectedActivity].label}</div>
                <div style={{ fontFamily: "'Nunito'", fontSize: 12, color: "var(--habit-dim)" }}>{ACTIVITIES[selectedActivity].description}</div>
              </div>
              <button onClick={() => setSelectedActivity(null)} style={{ color: "var(--habit-dim)", fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>

            {isQuestionsMode ? (
              <div className="flex items-center gap-4 justify-center">
                <button onClick={() => setQuestions(Math.max(1, questions - 1))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="text-center w-16 tabular-nums tracking-tight">
                  <div className="font-mono text-2xl font-bold text-foreground">{questions}</div>
                  <div className="text-xs text-muted-foreground">questions</div>
                </div>
                <button onClick={() => setQuestions(Math.min(20, questions + 1))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 justify-center">
                <button onClick={() => setHours(Math.max(0.5, hours - 0.5))}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="text-center w-16 tabular-nums tracking-tight">
                  <div className="font-mono text-2xl font-bold text-foreground">{hours}</div>
                  <div className="text-xs text-muted-foreground">hours</div>
                </div>
                <button onClick={() => setHours(hours + 0.5)}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-accent">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Focus rating */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Focus Quality</span>
                <span className="font-mono text-sm font-bold" style={{ color: focusColors[focusRating] }}>
                  {focusRating}/10
                  {focusRating >= 9 ? " — Flow State" : focusRating >= 7 ? " — Good" : focusRating >= 4 ? " — Average" : " — Distracted"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setFocusRating(n)}
                    className="flex-1 h-6 rounded transition-all duration-150"
                    style={{
                      backgroundColor: n <= focusRating ? focusColors[focusRating] : "rgba(255,255,255,0.06)",
                      opacity: n <= focusRating ? 1 : 0.4,
                    }}
                  />
                ))}
              </div>
            </div>

            <EfficiencyMeter
              focus={focusRating}
              streakDays={profile?.streak_days || 0}
              hoursToday={hoursToday}
              subjectHoursToday={subjectHoursToday}
            />

            {/* Expected gains */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(METRIC_CONFIG).map(([mk, mc]) => {
                const coeff = ACTIVITIES[selectedActivity].coefficients[mk] || 0;
                const ceiling = profile[`${mk}_ceiling`];
                const current = profile[mk];
                const growthMult = Math.max(0, 1 - Math.pow(current / ceiling, 2));
                const rawGain = coeff * logValue * growthMult;
                const effGain = rawGain * efficiency.total;
                return (
                  <div key={mk} className="text-center p-2 rounded-lg bg-muted/40">
                    <div className={`text-xs font-mono font-bold text-${mc.color}`}>{mc.abbr}</div>
                    <div className="text-xs font-mono text-foreground/70 mt-0.5">
                      {effGain > 0 ? `+${effGain.toFixed(3)}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gold preview */}
            {(() => {
              let mult = 1;
              try {
                const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
                const cons = gs.consumables || {};
                if (cons.xp_booster?.active && (!cons.xp_booster.expiresAt || Date.now() < cons.xp_booster.expiresAt)) mult = 1.5;
              } catch {}
              
              const stats = profile?.total_stats || {};
              const spd = stats.spd || 0;
              const lck = stats.lck || 0;
              const goldMultStats = stats.gold_multiplier || 1.0;
              
              let skillMult = 1.0;
              const skills = profile?.unlocked_skills || [];
              if (skills.some(s => (s.skill_code || s) === "resource_awareness")) skillMult += 0.10;
              
              const base_gold = (logValue * 25) * mult * skillMult;
              const spdBonus = spd * 0.5;
              const expectedGold = Math.floor((base_gold + spdBonus) * (1 + lck / 100.0));
              const total = Math.max(0, Math.floor(expectedGold * goldMultStats));

              return (
                <div className="text-xs font-mono text-center" style={{ color: "var(--habit-gold)" }}>
                  +{total}G on completion{mult > 1 && <span className="text-green-400 ml-1">(×{mult} booster!)</span>}
                </div>
              );
            })()}

            {/* Log button with gold float */}
            <div className="relative">
              <AnimatePresence>
                {goldFloat && (
                  <motion.div
                    key={goldFloat.id}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -30 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono font-bold text-sm pointer-events-none"
                    style={{ color: "var(--habit-gold)" }}
                  >
                    +{goldFloat.value}G
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={confirmLog}
                className="w-full py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--habit-purple)", color: "white", fontFamily: "'Nunito'", fontWeight: 800, fontSize: 14, boxShadow: "0 4px 16px var(--habit-purple-glow)" }}
              >
                Log {isQuestionsMode ? `${questions}q` : `${hours}h`} · ×{efficiency.total.toFixed(2)} efficiency
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>}
    </div>
  );
}