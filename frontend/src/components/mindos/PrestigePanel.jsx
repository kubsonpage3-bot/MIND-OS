import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { showRewardToast } from "@/components/mindos/RewardToast";

export default function PrestigePanel({ prestige, rankXP, onPrestige }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [animating, setAnimating] = useState(false);
  
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const count = profile?.prestige_count || prestige?.count || 0;
  const xpRequired = profile?.prestige_xp_required || 8000;
  const canPrestige = rankXP >= xpRequired;

  // Active multiplier bonuses from previous prestiges
  const xpMult = profile?.total_stats?.xp_multiplier || profile?.xp_multiplier || 1.0;
  const goldMult = profile?.total_stats?.gold_multiplier || profile?.gold_multiplier || 1.0;
  const dmgMult = profile?.total_stats?.damage_multiplier || profile?.damage_multiplier || 1.0;
  const maxHp = profile?.hp_max || profile?.max_hp || 100;

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
              {t('prestige.reborn')}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Premium Prestige Progress Card ── */}
      <div className="rounded-2xl border overflow-hidden relative"
        style={{
          borderColor: canPrestige ? "#f0c04055" : "var(--habit-border)",
          background: "var(--habit-panel)",
          boxShadow: canPrestige
            ? "0 0 24px #f0c04022, 0 2px 12px rgba(0,0,0,0.18)"
            : "0 2px 8px rgba(0,0,0,0.10)",
        }}
      >
        {/* Top glow strip when can prestige */}
        {canPrestige && (
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent, #f0c040, transparent)" }}
          />
        )}

        <div className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black tracking-widest uppercase"
                style={{ color: canPrestige ? "#f0c040" : "var(--habit-dim)" }}>
                ✦ {t('prestige.prestige')}
              </span>
              {count > 0 && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-black"
                  style={{ background: "#f0c04025", color: "#f0c040", border: "1px solid #f0c04050" }}>
                  ×{count}
                </span>
              )}
            </div>
            {/* Next prestige label */}
            <span className="text-[8px] font-mono" style={{ color: "var(--habit-dim)" }}>
              {canPrestige
                ? `→ ASCENDANT ${['','I','II','III','IV','V','VI','VII','VIII','IX','X'][count + 1] ?? count + 1}`
                : `→ ASCENDANT ${['','I','II','III','IV','V','VI','VII','VIII','IX','X'][count + 1] ?? count + 1}`
              }
            </span>
          </div>

          {/* XP Progress bar */}
          <div className="space-y-1.5">
            <div className="relative h-3 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (rankXP / xpRequired) * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: canPrestige
                    ? "linear-gradient(90deg, #ca8a04, #f0c040, #fde68a)"
                    : "linear-gradient(90deg, #92400e, #ca8a04)",
                  boxShadow: canPrestige ? "0 0 10px #f0c04066" : "none",
                }}
              >
                {/* Shimmer */}
                <div className="absolute inset-0 opacity-30"
                  style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 6px)" }}
                />
              </motion.div>
              {/* Percent label inside bar */}
              {rankXP > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[7px] font-mono font-black"
                    style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                    {Math.min(100, Math.round((rankXP / xpRequired) * 100))}%
                  </span>
                </div>
              )}
            </div>

            {/* XP numbers row */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono" style={{ color: "var(--habit-dim)" }}>
                <span style={{ color: canPrestige ? "#f0c040" : "var(--habit-text)", fontWeight: 700 }}>
                  {Math.round(rankXP).toLocaleString()}
                </span>
                {" / "}{xpRequired.toLocaleString()} XP
              </span>
              {!canPrestige && (
                <span className="text-[8px] font-mono" style={{ color: "var(--habit-dim)" }}>
                  {(xpRequired - rankXP).toLocaleString()} XP to go
                </span>
              )}
            </div>
          </div>

          {/* Active bonuses (compact row) — only if has prestige */}
          {count > 0 && (
            <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {[
                { label: "XP", value: `×${xpMult.toFixed(2)}`, color: "#86efac" },
                { label: "Gold", value: `×${goldMult.toFixed(2)}`, color: "#f0c040" },
                { label: "DMG", value: `×${dmgMult.toFixed(2)}`, color: "#f87171" },
                { label: "HP", value: String(maxHp), color: "#60a5fa" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
                  <span className="text-[7px] font-mono" style={{ color: "var(--habit-dim)" }}>{label}</span>
                  <span className="text-[9px] font-mono font-black" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Initiate button */}
          {canPrestige && (
            <motion.button
              onClick={() => setOpen(true)}
              animate={{ boxShadow: ["0 0 8px #f0c04040", "0 0 20px #f0c04080", "0 0 8px #f0c04040"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="w-full py-2.5 text-xs font-mono font-black rounded-xl relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #92400e, #ca8a04)", color: "#fde68a", border: "1px solid #f0c04060" }}
            >
              <span className="relative z-10 tracking-widest uppercase">⚡ {t('prestige.initiate')}</span>
              {/* Shine */}
              <div className="absolute inset-0 opacity-20"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />
            </motion.button>
          )}
        </div>
      </div>


      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 overflow-y-auto"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="rounded-2xl border border-yellow-500/40 bg-card p-6 max-w-md w-full space-y-4 my-4 max-h-[85svh] overflow-y-auto">
            <div className="text-center">
              <div className="text-2xl mb-2">🦅</div>
              <div className="font-mono font-black text-xl" style={{ color: "#f0c040" }}>PRESTIGE — REBIRTH</div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/30 space-y-1">
                <div className="text-red-400 font-bold mb-1">{t('prestige.you_will_lose')}</div>
                {(t('prestige.lose_items', { returnObjects: true }) || []).map((item, i) => (
                  <div key={i} className="text-muted-foreground/60">✗ {item}</div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-green-900/10 border border-green-900/30 space-y-1">
                <div className="text-green-400 font-bold mb-1">{t('prestige.you_will_keep')}</div>
                {(t('prestige.keep_items', { returnObjects: true }) || []).map((item, i) => (
                  <div key={i} className="text-muted-foreground/60">✓ {item}</div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-yellow-900/10 border border-yellow-900/30 space-y-1">
                <div className="text-yellow-400 font-bold mb-1">{t('prestige.you_will_gain')}</div>
                {[
                  t('prestige.gain_items.0', { pct: (count + 1) * 10 }),
                  t('prestige.gain_items.1', { iq: 15 + count * 5 }),
                  t('prestige.gain_items.2'),
                  t('prestige.gain_items.3', { count: count + 1 }),
                  t('prestige.gain_items.4'),
                  t('prestige.gain_items.5'),
                ].map((item, i) => (
                  <div key={i} className="text-yellow-400/70">✦ {item}</div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground/50 text-center">{t('prestige.type_rebirth')}</div>
              <input
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                placeholder="REBIRTH"
                className="w-full bg-muted/20 border border-border rounded-lg px-3 py-2 text-sm font-mono text-center text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-yellow-500/60"
              />
              <div className="flex gap-2">
                <button onClick={() => { setOpen(false); setInput(""); }} className="flex-1 py-2 text-xs font-mono rounded-lg border border-border text-muted-foreground">{t('prestige.cancel')}</button>
                <button
                  onClick={confirm}
                  disabled={input !== "REBIRTH"}
                  className="flex-1 py-2 text-xs font-mono rounded-lg font-black transition-all"
                  style={{ background: input === "REBIRTH" ? "#dc2626" : "var(--habit-purple-light, rgba(0,0,0,0.05))", color: input === "REBIRTH" ? "#fff" : "var(--habit-dim)" }}
                >{t('prestige.confirmRebirth')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}