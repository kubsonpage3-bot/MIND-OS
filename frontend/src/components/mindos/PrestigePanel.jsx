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

      <div className="p-4 rounded-2xl border space-y-3"
        style={{
          borderColor: canPrestige ? "#f0c04060" : "var(--habit-border)",
          background: "var(--habit-panel)",
          boxShadow: canPrestige ? "0 0 16px #f0c04030" : "none"
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs font-bold" style={{ color: canPrestige ? "#f0c040" : "var(--habit-dim)" }}>
            {t('prestige.prestige')}
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
            Reach {xpRequired} {t('prestige.xpToUnlock')} {rankXP.toFixed(0)} / {xpRequired} XP
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
            {t('prestige.initiate')}
          </button>
        )}
      </div>
      {/* Active bonuses display for prestige veterans */}
      {count > 0 && (
        <div className="rounded-xl border px-3 py-2 space-y-1"
          style={{ borderColor: "#f0c04030", background: "#f0c04008" }}
        >
          <div className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: "#f0c04080" }}>
            Active Prestige Bonuses
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <div className="text-[9px] font-mono flex justify-between">
              <span style={{ color: "var(--habit-dim)" }}>XP Mult</span>
              <span style={{ color: "#86efac" }}>×{xpMult.toFixed(2)}</span>
            </div>
            <div className="text-[9px] font-mono flex justify-between">
              <span style={{ color: "var(--habit-dim)" }}>Gold Mult</span>
              <span style={{ color: "#f0c040" }}>×{goldMult.toFixed(2)}</span>
            </div>
            <div className="text-[9px] font-mono flex justify-between">
              <span style={{ color: "var(--habit-dim)" }}>DMG Mult</span>
              <span style={{ color: "#f87171" }}>×{dmgMult.toFixed(2)}</span>
            </div>
            <div className="text-[9px] font-mono flex justify-between">
              <span style={{ color: "var(--habit-dim)" }}>Max HP</span>
              <span style={{ color: "#60a5fa" }}>{maxHp}</span>
            </div>
          </div>
        </div>
      )}


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