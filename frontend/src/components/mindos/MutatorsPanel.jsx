import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { MUTATORS } from "@/constants/rpgData";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { showRewardToast } from "@/components/mindos/RewardToast";
import GameCard from "@/components/ui/GameCard";
import ItemDetailModal from "./ItemDetailModal";

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
  const [selectedMutator, setSelectedMutator] = useState(null);
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
    mutationFn: (/** @type {{ id: string, duration?: number }} */ { id, duration }) => djangoApi.mutators.toggle(id, { duration }),
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
              {muts.map(mut => {
                const active_ = isActive(mut.id);
                const purchased_ = isPurchased(mut.id);
                const synActive = isSynergyActive(mut);
                const canActivate = active.length < MAX_ACTIVE || active_;
                const canAfford = purchased_ || gold >= mut.cost;
                const conflicted = !isActive(mut.id) && mut.conflicts?.some(c => isActive(c));

                return (
                  <GameCard key={mut.id} 
                    isActive={active_}
                    borderColor={active_ ? "#f0c040" : purchased_ ? "hsl(var(--primary)/0.4)" : undefined}
                    glowColor="#f0c040"
                    className={`flex flex-col text-center p-3 relative cursor-pointer ${purchased_ && !active_ ? "bg-primary/5" : ""}`}
                    onClick={() => setSelectedMutator(mut)}
                  >
                    {/* Badges container (Synergy / Conflict) top-right */}
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                      {mut.synergy && (
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${synActive ? "bg-[#f0c040] text-black" : "bg-[#f0c04020] text-[#f0c040]"}`}>
                          ⚡
                        </div>
                      )}
                      {conflicted && (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-red-500/20 text-red-500">
                          ⚠️
                        </div>
                      )}
                    </div>

                    {/* Pixel art icon */}
                    <div className={`shrink-0 w-12 h-12 mx-auto rounded-lg border overflow-hidden flex items-center justify-center mb-2 z-10 relative ${active_ ? "border-[#f0c04060] bg-[#f0c04010]" : "border-border bg-muted/30"}`}
                      style={{ imageRendering: "pixelated" }}>
                        <img src={mut.icon} alt={t(`rpgData.mutators.${mut.id}.name`)} className="w-full h-full object-contain"
                        style={{ imageRendering: "pixelated" }} />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-start">
                      <div className={`font-mono text-[11px] font-black tracking-wide truncate px-1 ${active_ ? "text-[#f0c040]" : purchased_ ? "text-primary" : "text-foreground"}`}>
                        {t(`rpgData.mutators.${mut.id}.name`)}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5 line-clamp-2 px-1 mb-2">
                        {t(`rpgData.mutators.${mut.id}.desc`)}
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); activate(mut); }}
                      disabled={(!canAfford && !purchased_) || (!canActivate && !active_) || conflicted}
                      className={`w-full shrink-0 py-1.5 mt-auto text-[10px] font-mono font-bold rounded border transition-all relative z-10 ${
                        active_ ? "border-[#f0c040] bg-[#f0c040] text-black" :
                        canAfford && canActivate && !conflicted ? "border-border bg-foreground/5 text-foreground hover:bg-foreground/10" :
                        "border-border/50 text-muted-foreground/40 bg-transparent"
                      }`}
                      style={{ opacity: conflicted ? 0.4 : 1 }}
                    >
                      {active_ ? (mut.permanent_lock ? "🔒 ACTIVE" : "ACTIVE (ON)") : purchased_ ? "ACTIVATE" : conflicted ? "BLOCKED" : `${mut.cost}G - BUY`}
                    </button>
                  </GameCard>
                );
              })}
            </div>
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

      {/* Item Detail Modal for Mutators */}
      <ItemDetailModal 
        item={selectedMutator}
        isOpen={!!selectedMutator}
        onClose={() => setSelectedMutator(null)}
        title={selectedMutator ? t(`rpgData.mutators.${selectedMutator.id}.name`) : ""}
        subtitle={selectedMutator ? (CAT_LABELS[selectedMutator.cat]?.label || "") : ""}
        tierColor={selectedMutator ? CAT_LABELS[selectedMutator.cat]?.color : undefined}
        iconUrl={selectedMutator ? selectedMutator.icon : undefined}
        description={
          selectedMutator && (
            <div className="space-y-4 text-left">
              <div className="text-sm font-mono text-slate-300 leading-relaxed">
                {t(`rpgData.mutators.${selectedMutator.id}.desc`)}
              </div>
              
              {(selectedMutator.durationDays || selectedMutator.toggle) && (
                <div className="text-xs font-mono text-slate-400 border-t border-slate-700/50 pt-2 flex items-center gap-2">
                  <span className="opacity-60">Type:</span> 
                  {selectedMutator.permanent_lock ? "Permanent" : selectedMutator.toggle ? "Toggleable" : `${selectedMutator.durationDays} Days`}
                </div>
              )}

              {selectedMutator.synergy && (
                <div className="rounded border border-indigo-900/50 bg-indigo-900/20 p-3 space-y-1 mt-2">
                  <div className="font-mono text-xs font-bold text-indigo-400 flex items-center gap-1">
                    ⚡ Synergy
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">
                    Pairs with: <span className="text-indigo-300">{t(`rpgData.mutators.${MUTATORS.find(m => m.id === selectedMutator.synergy)?.id}.name`)}</span>
                  </div>
                </div>
              )}

              {selectedMutator.conflicts && (
                <div className="rounded border border-red-900/50 bg-red-900/20 p-3 space-y-1 mt-2">
                  <div className="font-mono text-xs font-bold text-red-400 flex items-center gap-1">
                    ⚠️ Conflicts With
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {selectedMutator.conflicts.map(c => t(`rpgData.mutators.${MUTATORS.find(m => m.id === c)?.id}.name`)).join(", ")}
                  </div>
                </div>
              )}
            </div>
          )
        }
        actionButton={
          selectedMutator && (() => {
            const active_ = isActive(selectedMutator.id);
            const purchased_ = isPurchased(selectedMutator.id);
            const canActivate = active.length < MAX_ACTIVE || active_;
            const canAfford = purchased_ || gold >= selectedMutator.cost;
            const conflicted = !isActive(selectedMutator.id) && selectedMutator.conflicts?.some(c => isActive(c));

            return (
              <button
                onClick={() => { activate(selectedMutator); setSelectedMutator(null); }}
                disabled={(!canAfford && !purchased_) || (!canActivate && !active_) || conflicted}
                className={`w-full py-3 text-xs font-mono font-black rounded transition-all ${
                  active_ ? "border-[#f0c040] bg-[#f0c040] text-black" :
                  canAfford && canActivate && !conflicted ? "border-border bg-foreground/5 text-foreground hover:bg-foreground/10 border" :
                  "border-border/50 text-muted-foreground/40 bg-transparent border"
                }`}
                style={{ opacity: conflicted ? 0.4 : 1 }}
              >
                {active_ ? (selectedMutator.permanent_lock ? "🔒 ACTIVE" : "ACTIVE (ON)") : purchased_ ? "ACTIVATE" : conflicted ? "BLOCKED BY CONFLICT" : `${selectedMutator.cost}G - BUY`}
              </button>
            );
          })()
        }
      />
    </div>
  );
}