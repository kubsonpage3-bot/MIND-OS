// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import ClassSelector from "@/components/mindos/ClassSelector";
import { Brain, Shield, Zap, Sparkles, ArrowRight, ArrowLeft, UserCheck } from "lucide-react";

const DEFAULT_METRICS = {
  gf: 100, gc: 100, ps: 100, vm: 100,
  gf_ceiling: 105, gc_ceiling: 105, ps_ceiling: 105, vm_ceiling: 105,
};

const METRIC_FIELDS = [
  { key: "gf", label: "Fluid Intelligence (Gf)", color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10", desc: "Pattern recognition, problem solving, abstract logic" },
  { key: "gc", label: "Crystallized Intelligence (Gc)", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", desc: "Acquired knowledge, vocabulary, comprehension" },
  { key: "ps", label: "Processing Speed (Ps)", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10", desc: "Mental efficiency, quick decision making" },
  { key: "vm", label: "Verbal Memory (Vm)", color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10", desc: "Memory retention, language recall, focus capacity" },
];

export default function SelectClass() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { refreshProfile } = useDjangoAuth();
  const isChanging = location.state?.changingClass;

  const { data: profile } = useQuery({
    queryKey: ["userprofile"],
    queryFn: () => djangoApi.profile.get(),
  });

  const [step, setStep] = useState(isChanging ? 3 : 1);
  const [characterName, setCharacterName] = useState("");
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (profile) {
      if (profile.character_name) setCharacterName(profile.character_name);
      else if (profile.user?.username) setCharacterName(profile.user.username);

      setMetrics({
        gf: profile.gf ?? 100,
        gc: profile.gc ?? 100,
        ps: profile.ps ?? 100,
        vm: profile.vm ?? 100,
        gf_ceiling: profile.gf_ceiling ?? 105,
        gc_ceiling: profile.gc_ceiling ?? 105,
        ps_ceiling: profile.ps_ceiling ?? 105,
        vm_ceiling: profile.vm_ceiling ?? 105,
      });
    }
  }, [profile]);

  const updateMetric = (key, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setMetrics((prev) => ({ ...prev, [key]: num }));
    }
  };

  const completeOnboardingMutation = useMutation({
    mutationFn: async (selectedClassId) => {
      if (isChanging) {
        // If changing class from settings, only update class
        return djangoApi.profile.update({ character_class: selectedClassId });
      }

      // Full atomic onboarding update
      return djangoApi.profile.update({
        character_name: characterName.trim() || profile?.user?.username || "Hero",
        character_class: selectedClassId,
        gf: metrics.gf,
        gc: metrics.gc,
        ps: metrics.ps,
        vm: metrics.vm,
        gf_ceiling: metrics.gf_ceiling,
        gc_ceiling: metrics.gc_ceiling,
        ps_ceiling: metrics.ps_ceiling,
        vm_ceiling: metrics.vm_ceiling,
        hp: 100,
        hp_max: 100,
        mana: 50,
        mana_max: 50,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      if (typeof refreshProfile === "function") {
        await refreshProfile();
      }
      navigate("/");
    },
    onError: (err) => {
      setErrorMsg(err?.message || "Initialization failed. Please try again.");
    },
  });

  const handleClassSelection = async (classId) => {
    setErrorMsg(null);
    await completeOnboardingMutation.mutateAsync(classId);
  };

  return (
    <div className="min-h-dvh w-full bg-[#05040a] text-foreground p-4 md:p-8 flex flex-col items-center justify-start relative overflow-y-auto overflow-x-hidden selection:bg-purple-500/30">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 my-auto py-6">
        {/* Header & Step Indicator */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            {isChanging ? "RECALIBRATION MODE" : `STEP ${step} OF 3 — NEURAL SETUP`}
          </div>

          <h1 className="text-3xl md:text-4xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-purple-300">
            {isChanging
              ? "CLASS RECALIBRATION"
              : step === 1
              ? "CHARACTER INITIALIZATION"
              : step === 2
              ? "COGNITIVE BASELINE"
              : "CHOOSE ARCHITECTURE"}
          </h1>

          {/* Progress Bar */}
          {!isChanging && (
            <div className="w-48 h-1 bg-slate-800 rounded-full mx-auto overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono text-center shadow-lg">
            {errorMsg}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: IDENTITY & OVERVIEW */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-purple-500/20 backdrop-blur-md space-y-5">
                <div>
                  <label className="block text-xs font-mono text-purple-400 uppercase tracking-wider mb-2">
                    Character Call-Sign / Username
                  </label>
                  <input
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="Enter your hero name..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    MIND OS Architecture Benefits:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <Brain className="w-5 h-5 text-sky-400 mb-1" />
                      <div className="text-xs font-bold font-mono text-slate-200">IQ Metrics</div>
                      <div className="text-[11px] text-slate-400">Track Gf, Gc, Ps, Vm cognitive growth.</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <Shield className="w-5 h-5 text-emerald-400 mb-1" />
                      <div className="text-xs font-bold font-mono text-slate-200">RPG Mechanics</div>
                      <div className="text-[11px] text-slate-400">Defeat bosses, gain XP & unlock skills.</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <Zap className="w-5 h-5 text-amber-400 mb-1" />
                      <div className="text-xs font-bold font-mono text-slate-200">+20% XP Passives</div>
                      <div className="text-[11px] text-slate-400">Specialized class boost per category.</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
              >
                <span>CONTINUE TO BASELINE ASSESSMENT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 2: COGNITIVE BASELINE */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-purple-500/20 backdrop-blur-md space-y-4">
                <div className="text-xs font-mono text-slate-400">
                  Set your current baseline cognitive ratings. Default values (100) are standard benchmark metrics.
                </div>

                <div className="space-y-4">
                  {METRIC_FIELDS.map(({ key, label, color, border, bg, desc }) => (
                    <div key={key} className={`p-4 rounded-xl ${bg} border ${border} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-mono font-bold ${color}`}>{label}</div>
                          <div className="text-[11px] text-slate-400">{desc}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-mono text-slate-400 uppercase">Current</label>
                          <input
                            type="number"
                            value={metrics[key]}
                            onChange={(e) => updateMetric(key, e.target.value)}
                            step="0.5"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-slate-400 uppercase">Ceiling Limit</label>
                          <input
                            type="number"
                            value={metrics[`${key}_ceiling`]}
                            onChange={(e) => updateMetric(`${key}_ceiling`, e.target.value)}
                            step="0.5"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-sm flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK</span>
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
                >
                  <span>PROCEED TO CLASS SELECTION</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CLASS SELECTION */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <ClassSelector
                isPremium={profile?.is_premium}
                onChoose={handleClassSelection}
              />

              {!isChanging && (
                <div className="flex justify-start">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono text-xs flex items-center gap-2 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>BACK TO METRICS</span>
                  </button>
                </div>
              )}

              {completeOnboardingMutation.isPending && (
                <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center font-mono text-xs text-purple-300 animate-pulse flex items-center justify-center gap-2">
                  <UserCheck className="w-4 h-4 animate-bounce" />
                  INITIALIZING NEURAL LINK & CREATING HERO PROFILE...
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
