import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { MUTATORS } from "@/constants/rpgData";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { showRewardToast } from "@/components/mindos/RewardToast";
import GameCard from "@/components/ui/GameCard";

const CAT_LABELS = {
  amplifier: { label: "AMPLIFIERS", color: "#3b82f6" },
  economy: { label: "ECONOMY", color: "#f0c040" },
  streak: { label: "STREAK", color: "#f59e0b" },
  challenge: { label: "CHALLENGE", color: "#ef4444" },
  synergy: { label: "SYNERGY BUILDERS", color: "#aa44ff" },
  wild: { label: "WILD", color: "#00e5ff" },
};

const MAX_ACTIVE = 3;

export default function MutatorsPanel({ onSpendGold }) {
  const { t } = useTranslation();
  const [confirmIronman, setConfirmIronman] = useState(false);
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const mutators = profile?.active_mutators || { active: [], purchased: [] };
  const gold = profile?.gold || 0;

  const active = mutators.active || [];
  const purchased = mutators.purchased || [];

  const isActive = (id) => active.some(m => m.id === id);
  const isPurchased = (id) => purchased.includes(id);

  const getActiveSynergyIds = () => active.map(m => m.id);

  const isSynergyActive = (mut) => {
    if (!mut.synergy) return false;
    return isActive(mut.id) && isActive(mut.synergy);
  };

  const toggleMutatorMutation = useMutation({
    mutationFn: ({ id, duration }) => djangoApi.mutators.toggle(id, { duration }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      refreshProfile();
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Mutators update failed: ${err.message}` });
    }
  });

  const buyMutatorMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => djangoApi.mutators.buy(id),
    onSuccess: (data, mutatorId) => {
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      refreshProfile();
      
      // Auto-activate after purchase if we have space
      if (active.length < MAX_ACTIVE) {
        const mutator = MUTATORS.find(m => m.id === mutatorId);
        toggleMutatorMutation.mutate({ id: mutatorId, duration: mutator.durationDays });
        djangoApi.analytics.logEvent("mutator_activated");
      }
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Purchase failed: ${err.message}` });
    }
  });

  const activate = (mutator) => {
    if (mutator.id === "ironman" && !isActive(mutator.id)) { setConfirmIronman(true); return; }
    if (!isPurchased(mutator.id) && mutator.cost > 0 && gold < mutator.cost) return;
    if (active.length >= MAX_ACTIVE && !isActive(mutator.id)) return;

    // Conflict check
    if (!isActive(mutator.id) && mutator.conflicts) {
      const hasConflict = mutator.conflicts.some(c => isActive(c));
      if (hasConflict) return;
    }

    if (!isPurchased(mutator.id) && mutator.cost > 0) {
      buyMutatorMutation.mutate(mutator.id);
      return;
    }

    if (isActive(mutator.id) && mutator.permanent_lock) return; // ironman cannot toggle off

    toggleMutatorMutation.mutate({ id: mutator.id, duration: mutator.durationDays });
    djangoApi.analytics.logEvent("mutator_activated");
  };

  const confirmIronmanActivate = () => {
    buyMutatorMutation.mutate("ironman");
    setConfirmIronman(false);
  };

  const byCategory = {};
  MUTATORS.filter(m => !m.disabled).forEach(m => { if (!byCategory[m.cat]) byCategory[m.cat] = []; byCategory[m.cat].push(m); });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">{t('sidebar.sections.mutators')}</div>
        <div className="text-[10px] font-mono font-bold" style={{ color: active.length >= MAX_ACTIVE ? "#ef4444" : "#00cc88" }}>
          {t('mutators_ui.active_count', { n: active.length, max: MAX_ACTIVE })}
        </div>
      </div>

      {Object.entries(CAT_LABELS).map(([cat, cfg]) => {
        const muts = byCategory[cat] || [];
        if (!muts.length) return null;
        return (
          <div key={cat} className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: cfg.color }}>
              {cfg.label}
            </div>
            {muts.map(mut => {
              const active_ = isActive(mut.id);
              const purchased_ = isPurchased(mut.id);
              const synActive = isSynergyActive(mut);
              const canActivate = active.length < MAX_ACTIVE || active_;
              const canAfford = purchased_ || gold >= mut.cost;
              const conflicted = !isActive(mut.id) && mut.conflicts?.some(c => isActive(c));

              const cardBorderClass = active_ ? "border-[#f0c040]" : purchased_ ? "border-primary/40" : "border-border";
              const cardBgClass = active_ ? "bg-[#f0c04008]" : purchased_ ? "bg-primary/5" : "bg-card";
              const glowStyle = active_ ? { boxShadow: "0 0 12px #f0c04040" } : {};

              return (
                <GameCard key={mut.id} 
                  isActive={active_}
                  borderColor={active_ ? "#f0c040" : purchased_ ? "hsl(var(--primary)/0.4)" : undefined}
                  glowColor="#f0c040"
                  className={purchased_ && !active_ ? "bg-primary/5" : ""}
                  onClick={() => {}}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Pixel art icon */}
                    <div className={`shrink-0 w-9 h-9 rounded-lg border overflow-hidden flex items-center justify-center ${active_ ? "border-[#f0c04060] bg-[#f0c04010]" : "border-border bg-muted/30"}`}
                      style={{ imageRendering: "pixelated" }}>
                        <img src={mut.icon} alt={t(`rpgData.mutators.${mut.id}.name`)} className="w-full h-full object-contain"
                        style={{ imageRendering: "pixelated" }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-[11px] font-black tracking-wide ${active_ ? "text-[#f0c040]" : purchased_ ? "text-primary" : "text-foreground"}`}>
                          {t(`rpgData.mutators.${mut.id}.name`)}
                        </span>
                        {active_ && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "#f0c04025", color: "#f0c040", border: "1px solid #f0c04040" }}>{t('boss_panel.active')}</span>}
                        {purchased_ && !active_ && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary">{t('character.bought')}</span>}
                        {mut.toggle && <span className="text-[8px] font-mono text-muted-foreground/40">[toggle]</span>}
                        {mut.durationDays && <span className="text-[8px] font-mono text-muted-foreground/40">{mut.durationDays}d</span>}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 leading-relaxed">{t(`rpgData.mutators.${mut.id}.desc`)}</div>

                      {/* Synergy line */}
                      {mut.synergy && (
                        <div className={`mt-1 text-[8px] font-mono italic ${synActive ? "text-[#f0c040]" : "text-muted-foreground/60"}`}>
                          {synActive ? `⚡ Synergy: ${t(`rpgData.mutators.${MUTATORS.find(m => m.id === mut.synergy)?.id}.name`)} — ACTIVE ✦` : `Synergy: ${t(`rpgData.mutators.${MUTATORS.find(m => m.id === mut.synergy)?.id}.name`)}`}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => activate(mut)}
                      disabled={(!canAfford && !purchased_) || (!canActivate && !active_) || conflicted}
                      className={`shrink-0 px-2.5 py-1.5 text-[9px] font-mono font-bold rounded-lg border transition-all ${
                        active_ ? "border-[#f0c040] bg-[#f0c040] text-black" :
                        canAfford && canActivate && !conflicted ? "border-border bg-foreground/5 text-foreground hover:bg-foreground/10" :
                        "border-border/50 text-muted-foreground/40 bg-transparent"
                      }`}
                      style={{ opacity: conflicted ? 0.4 : 1 }}
                    >
                      {active_ ? (mut.permanent_lock ? "🔒" : "ON") : purchased_ ? "OFF" : conflicted ? "×" : `${mut.cost}G`}
                    </button>
                  </div>
                </GameCard>
              );
            })}
          </div>
        );
      })}

      {confirmIronman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="rounded-2xl border border-red-900/60 bg-card p-6 max-w-sm w-full space-y-4 text-center">
            <div className="text-2xl">💀</div>
            <div className="font-mono font-black text-red-400 tracking-widest">{t('mutators_ui.ironman_title')}</div>
            <div className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
              {t('mutators_ui.ironman_desc')}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmIronman(false)} className="flex-1 py-2 text-xs font-mono rounded-lg border border-border text-muted-foreground">{t('skill_tree.btn_cancel')}</button>
              <button onClick={confirmIronmanActivate} className="flex-1 py-2 text-xs font-mono rounded-lg bg-red-600 text-white font-bold">{t('mutators_ui.ironman_confirm_btn')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}