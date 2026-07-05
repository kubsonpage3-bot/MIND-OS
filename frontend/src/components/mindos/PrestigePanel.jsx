import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { showRewardToast } from "@/components/mindos/RewardToast";

export default function PrestigePanel({ prestige, rankXP, onPrestige }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [animating, setAnimating] = useState(false);
  
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const count = profile?.prestige_count || prestige?.count || 0;
  const xpRequired = profile?.prestige_xp_required || 8000;
  const canPrestige = rankXP >= xpRequired;
  
  const prestigeMutation = useMutation({
    mutationFn: () => djangoApi.profile.prestige(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['rank-progression'] });
      queryClient.invalidateQueries({ queryKey: ['character'] });
      refreshProfile();
      onPrestige({ count: count + 1 });
      setAnimating(false);
      setOpen(false);
      setInput("");
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Prestige failed: ${err.message}` });
      setAnimating(false);
    }
  });

  const confirm = () => {
    if (input !== "REBIRTH") return;
    setAnimating(true);
    setTimeout(() => {
      // Clean up any remaining local logs that aren't migrated to backend yet
      localStorage.removeItem("mindos_activity_logs");
      localStorage.removeItem("mindos_hidden_activities");
      
      prestigeMutation.mutate();
    djangoApi.analytics.logEvent("prestige_activated");
    }, 2500);
  };

  return (
    <>
      <AnimatePresence>
        {animating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: "radial-gradient(circle, #ff440066, #f0c04033, transparent)" }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 2.5 }}
              className="font-mono font-black text-4xl text-center"
              style={{ color: "#f0c040", textShadow: "0 0 40px #f0c040" }}
            >
              🦅 REBORN
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 rounded-2xl border space-y-3"
        style={{ borderColor: canPrestige ? "#f0c04060" : "#1e1a38", background: "#0a0818",
          boxShadow: canPrestige ? "0 0 16px #f0c04030" : "none" }}>
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs font-bold" style={{ color: canPrestige ? "#f0c040" : "#4a4060" }}>
            ✦ PRESTIGE
          </div>
          {count > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
              style={{ background: "#f0c04020", color: "#f0c040", border: "1px solid #f0c04040" }}>
              ×{count}
            </span>
          )}
        </div>

        {!canPrestige ? (
          <div className="text-[10px] font-mono text-muted-foreground/40 leading-relaxed">
            Reach {xpRequired} XP to unlock Prestige. Current: {rankXP.toFixed(0)} / {xpRequired} XP
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (rankXP / xpRequired) * 100)}%`, background: "#f0c040" }} />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="w-full py-2 text-xs font-mono font-black rounded-lg transition-all"
            style={{ background: "#f0c04020", color: "#f0c040", border: "2px solid #f0c040", boxShadow: "0 0 12px #f0c04040" }}
          >
            INITIATE PRESTIGE →
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 overflow-y-auto">
          <div className="rounded-2xl border border-yellow-500/40 bg-card p-6 max-w-md w-full space-y-4 my-4">
            <div className="text-center">
              <div className="text-2xl mb-2">🦅</div>
              <div className="font-mono font-black text-xl" style={{ color: "#f0c040" }}>PRESTIGE — REBIRTH</div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/30 space-y-1">
                <div className="text-red-400 font-bold mb-1">YOU WILL LOSE:</div>
                {["Rank resets to F (XP → 0)", "All active skill cooldowns reset", "Current mana → 0", "All equipped items unequipped"].map(t => (
                  <div key={t} className="text-muted-foreground/60">✗ {t}</div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-green-900/10 border border-green-900/30 space-y-1">
                <div className="text-green-400 font-bold mb-1">YOU WILL KEEP:</div>
                {["All items in inventory", "All Gold", "All recruited and upgraded Allies", "All skill tree nodes", "All achievements and titles", "All cognitive metrics and IQ"].map(t => (
                  <div key={t} className="text-muted-foreground/60">✓ {t}</div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-yellow-900/10 border border-yellow-900/30 space-y-1">
                <div className="text-yellow-400 font-bold mb-1">YOU WILL GAIN:</div>
                {[
                  `All RPG Stats permanently +${(count + 1) * 10}%`,
                  `IQ ceiling permanently +${15 + count * 5}%`,
                  "Loot rarity permanently upgraded",
                  "Enchantment pool expands",
                  `Prestige ×${count + 1} badge`,
                  "+5 Skill Points immediately",
                  "Prestige-exclusive achievement",
                ].map(t => (
                  <div key={t} className="text-yellow-400/70">✦ {t}</div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground/50 text-center">Type REBIRTH to confirm</div>
              <input
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                placeholder="REBIRTH"
                className="w-full bg-muted/20 border border-border rounded-lg px-3 py-2 text-sm font-mono text-center text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-yellow-500/60"
              />
              <div className="flex gap-2">
                <button onClick={() => { setOpen(false); setInput(""); }} className="flex-1 py-2 text-xs font-mono rounded-lg border border-border text-muted-foreground">CANCEL</button>
                <button
                  onClick={confirm}
                  disabled={input !== "REBIRTH"}
                  className="flex-1 py-2 text-xs font-mono rounded-lg font-black transition-all"
                  style={{ background: input === "REBIRTH" ? "#dc2626" : "#1e1a38", color: input === "REBIRTH" ? "#fff" : "#4a4060" }}
                >
                  CONFIRM REBIRTH
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}