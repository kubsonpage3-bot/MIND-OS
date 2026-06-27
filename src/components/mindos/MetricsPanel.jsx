import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateIQ } from "@/lib/cognitiveEngine";
import { Brain, Zap, BookOpen, Eye, Save, RefreshCw, Info } from "lucide-react";

const METRIC_META = {
  gf: { icon: Brain,   color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.25)", label: "Fluid Intelligence",         abbr: "Gf", hint: "Abstract reasoning, pattern recognition, problem solving" },
  gc: { icon: BookOpen,color: "#22c55e", bg: "rgba(34, 197, 94, 0.08)", border: "rgba(34, 197, 94, 0.25)", label: "Crystallized Intelligence",  abbr: "Gc", hint: "Knowledge base, vocabulary, accumulated learning" },
  ps: { icon: Zap,     color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.25)", label: "Processing Speed",           abbr: "Ps", hint: "Mental processing rate, reaction time, cognitive efficiency" },
  vm: { icon: Eye,     color: "#a855f7", bg: "rgba(168, 85, 247, 0.08)", border: "rgba(168, 85, 247, 0.25)", label: "Verbal Memory",              abbr: "Vm", hint: "Working memory, recall, verbal retention" },
};

function Slider({ value, min, max, step = 0.1, color, onChange }) {
  return (
    <div className="relative w-full h-6 flex items-center">
      <div className="w-full h-2 rounded-full bg-[var(--habit-border)]">
        <div
          className="h-2 rounded-full transition-all duration-200"
          style={{ width: `${((value - min) / (max - min)) * 100}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
        />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-6"
        style={{ WebkitAppearance: "none" }}
      />
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
        style={{
          left: `calc(${((value - min) / (max - min)) * 100}% - 8px)`,
          background: color,
          boxShadow: `0 2px 8px ${color}99`,
        }}
      />
    </div>
  );
}

export default function MetricsPanel() {
  const [gameState, setGameState] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeHint, setActiveHint] = useState(null);

  useEffect(() => {
    try {
      const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      setGameState(gs);
      setDraft({
        gf: gs.gf ?? 100.0,
        gc: gs.gc ?? 100.0,
        ps: gs.ps ?? 100.0,
        vm: gs.vm ?? 100.0,
        gf_ceiling: gs.gf_ceiling ?? 120.0,
        gc_ceiling: gs.gc_ceiling ?? 135.0,
        ps_ceiling: gs.ps_ceiling ?? 112.0,
        vm_ceiling: gs.vm_ceiling ?? 138.0,
      });
      setLoading(false);
    } catch (e) {
      console.error("Failed to load game state in MetricsPanel:", e);
    }
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const gs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      const updatedGs = {
        ...gs,
        gf: draft.gf,
        gc: draft.gc,
        ps: draft.ps,
        vm: draft.vm,
        gf_ceiling: draft.gf_ceiling,
        gc_ceiling: draft.gc_ceiling,
        ps_ceiling: draft.ps_ceiling,
        vm_ceiling: draft.vm_ceiling,
      };
      localStorage.setItem("mindos_game_state", JSON.stringify(updatedGs));
      setGameState(updatedGs);

      // Dispatch event to notify dashboard of state changes
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("mindos-state-change", { detail: updatedGs }));

      setSaved(true);
    } catch (e) {
      console.error("Failed to save game state:", e);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const draftIQ = draft ? calculateIQ(draft.gf, draft.gc, draft.ps, draft.vm) : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--habit-purple)" }} />
    </div>
  );

  if (!gameState) return (
    <div className="text-center py-12 text-sm text-[var(--habit-dim)]">
      No profile found. Complete the setup first.
    </div>
  );

  return (
    <div className="space-y-4">
      {/* IQ Preview */}
      <motion.div
        className="rounded-2xl p-4 text-center relative overflow-hidden border border-[var(--habit-border)] bg-[var(--habit-panel)]"
        style={{
          background: "linear-gradient(135deg, var(--habit-purple-light) 0%, rgba(123,97,255,0.03) 100%)"
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 50% 0%, var(--habit-purple-light) 0%, transparent 70%)"
        }} />
        <div className="relative z-10">
          <div className="text-xs font-mono mb-1 text-[var(--habit-dim)] tracking-widest">LIVE PREVIEW</div>
          <motion.div
            key={Math.round(draftIQ)}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            style={{ fontFamily: "'Press Start 2P'", fontSize: "2rem", color: "var(--habit-purple)", lineHeight: 1 }}
          >
            {draftIQ.toFixed(1)}
          </motion.div>
          <div className="text-xs mt-1 text-[var(--habit-dim)] font-bold">IQ SCORE</div>
        </div>
      </motion.div>

      {/* Metric sliders */}
      {["gf", "gc", "ps", "vm"].map(mk => {
        const meta = METRIC_META[mk];
        const Icon = meta.icon;
        const val = draft?.[mk] ?? 80;
        const ceil = draft?.[`${mk}_ceiling`] ?? 120;
        return (
          <motion.div
            key={mk}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 space-y-3 border"
            style={{ background: meta.bg, borderColor: meta.border }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: meta.color + "22" }}>
                  <Icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <div>
                  <div className="font-bold text-sm text-[var(--habit-text)]">{meta.label}</div>
                  <div className="text-[10px] text-[var(--habit-dim)] font-game">{meta.abbr}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.div
                  key={val}
                  initial={{ scale: 1.3, color: meta.color }}
                  animate={{ scale: 1 }}
                  style={{ fontFamily: "'Press Start 2P'", fontSize: 14, color: meta.color }}
                >
                  {val.toFixed(1)}
                </motion.div>
                <button onClick={() => setActiveHint(activeHint === mk ? null : mk)} className="text-[var(--habit-dim)] opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {activeHint === mk && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs rounded-lg px-3 py-2 overflow-hidden"
                  style={{ background: meta.color + "15", color: meta.color }}
                >
                  {meta.hint}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Current value slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--habit-dim)]">
                <span>Current Value</span>
                <span>80 → {ceil}</span>
              </div>
              <Slider value={val} min={80} max={ceil} step={0.1} color={meta.color}
                onChange={v => setDraft(d => ({ ...d, [mk]: Math.round(v * 10) / 10 }))} />
            </div>

            {/* Ceiling slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--habit-dim)]">
                <span>Genetic Ceiling</span>
                <span style={{ color: meta.color, fontWeight: 700 }}>{ceil}</span>
              </div>
              <Slider value={ceil} min={90} max={160} step={1} color={meta.color + "88"}
                onChange={v => setDraft(d => ({ ...d, [`${mk}_ceiling`]: Math.round(v) }))} />
            </div>

            {/* Mini progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: meta.border }}>
              <motion.div
                animate={{ width: `${Math.min(100, ((val - 80) / (ceil - 80)) * 100)}%` }}
                transition={{ duration: 0.4 }}
                className="h-full rounded-full"
                style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}88` }}
              />
            </div>
          </motion.div>
        );
      })}

      {/* Save button */}
      <motion.button
        onClick={handleSave}
        disabled={saving}
        whileTap={{ scale: 0.97 }}
        className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          background: saved ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, var(--habit-purple), #9b87ff)",
          color: "white",
          boxShadow: saved ? "0 4px 16px rgba(34,197,94,0.4)" : "0 4px 16px var(--habit-purple-glow)",
        }}
        animate={{ scale: saved ? [1, 1.02, 1] : 1 }}
        transition={{ duration: 0.3 }}
      >
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Metrics"}
      </motion.button>
    </div>
  );
}