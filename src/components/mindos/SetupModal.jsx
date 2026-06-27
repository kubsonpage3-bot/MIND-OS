import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const DEFAULTS = {
  gf: 103, gc: 118, ps: 100, vm: 120,
  gf_ceiling: 120, gc_ceiling: 135, ps_ceiling: 112, vm_ceiling: 138,
};

const FIELDS = [
  { key: "gf", label: "Fluid Intelligence (Gf)", color: "text-gf", desc: "Pattern recognition, abstract reasoning" },
  { key: "gc", label: "Crystallized Intelligence (Gc)", color: "text-gc", desc: "Knowledge, language, experience" },
  { key: "ps", label: "Processing Speed (Ps)", color: "text-ps", desc: "Cognitive efficiency" },
  { key: "vm", label: "Verbal Memory (Vm)", color: "text-vm", desc: "Language acquisition, retention" },
];

export default function SetupModal({ onSave }) {
  const [values, setValues] = useState(DEFAULTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const set = (key, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) setValues(v => ({ ...v, [key]: num }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Update Django profile statistics
      await djangoApi.profile.update({
        character_class: "Путник",
        hp: 100,
        hp_max: 100,
        mana: 50,
        mana_max: 50,
        gold: 0,
      });

      // 2. Save cognitive baseline metrics to localStorage
      const currentGs = JSON.parse(localStorage.getItem("mindos_game_state") || "{}");
      const updatedGs = {
        ...currentGs,
        initialized: true,
        gf: values.gf,
        gc: values.gc,
        ps: values.ps,
        vm: values.vm,
        gf_ceiling: values.gf_ceiling,
        gc_ceiling: values.gc_ceiling,
        ps_ceiling: values.ps_ceiling,
        vm_ceiling: values.vm_ceiling,
        hp: 100,
        maxHp: 100,
        gold: 0,
      };
      localStorage.setItem("mindos_game_state", JSON.stringify(updatedGs));

      // 3. Invalidate React Query cache and refresh DjangoAuth profile state
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      await refreshProfile();

      // 4. Trigger onSave callback to sync parent state
      if (typeof onSave === "function") {
        onSave(updatedGs);
      }

      // 5. Redirect to Dashboard root
      navigate("/");
    } catch (err) {
      console.error("System initialization failed:", err);
      setError(err.message || "Failed to initialize system. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg mx-4 p-6 rounded-2xl border border-border bg-card shadow-2xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="text-center mb-6">
            <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Cognitive Baseline
            </div>
            <h1 className="text-2xl font-bold text-foreground">Initialize MIND OS</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enter your current scores and genetic ceiling estimates.
              These set your starting point — you can update them later.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-destructive text-center font-mono">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {FIELDS.map(({ key, label, color, desc }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-semibold ${color}`}>{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground/60 font-mono uppercase">Current</label>
                    <input
                      type="number"
                      value={values[key]}
                      onChange={e => set(key, e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm font-mono focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                      step="0.1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground/60 font-mono uppercase">Ceiling</label>
                    <input
                      type="number"
                      value={values[`${key}_ceiling`]}
                      onChange={e => set(`${key}_ceiling`, e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-muted text-foreground text-sm font-mono focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                      step="0.1"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <span>Initialize System →</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}