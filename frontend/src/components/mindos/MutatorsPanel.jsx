import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MUTATORS } from "@/constants/rpgData";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi, getMediaUrl } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { showRewardToast } from "@/components/mindos/RewardToast";
import GameCard from "@/components/ui/GameCard";
import { useHardwareBack } from "@/utils/modalStack";

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
  const [highlightedId, setHighlightedId] = useState(null);
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  useHardwareBack(!!selectedMutator, () => setSelectedMutator(null));

  const mutators = profile?.active_mutators || { active: [], purchased: [] };
  const gold = profile?.gold || 0;

  const active = mutators.active || [];
  const purchased = mutators.purchased || [];

  const isActive = (id) => active.some(m => (typeof m === 'object' ? m.id : m) === id);
  const isPurchased = (id) => purchased.includes(id);

  const getActiveSynergyIds = () => active.map(m => (typeof m === 'object' ? m.id : m));

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

  const openChestMutation = useMutation({
    mutationFn: () => djangoApi.mutators.openChest(),
    onSuccess: (/** @type {{ won_mutator_id: string }} */ data) => {
      const wonId = data.won_mutator_id;
      setHighlightedId(wonId);
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      refreshProfile();

      showRewardToast({
        label: `🎉 Unlocked Mutator: ${MUTATORS.find(m => m.id === wonId)?.name || wonId}!`,
      });

      // Scroll to the card
      setTimeout(() => {
        const el = document.getElementById(`mutator-card-${wonId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      setTimeout(() => {
        setHighlightedId(null);
      }, 4000);
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Failed to open chest: ${err.message}` });
    }
  });

  const activate = (mutator) => {
    if (!isPurchased(mutator.id)) return;
    if (mutator.id === "ironman" && !isActive(mutator.id)) { setConfirmIronman(true); return; }
    if (active.length >= MAX_ACTIVE && !isActive(mutator.id)) return;

    // Conflict check
    if (!isActive(mutator.id) && mutator.conflicts) {
      const hasConflict = mutator.conflicts.some(c => isActive(c));
      if (hasConflict) return;
    }

    if (isActive(mutator.id) && mutator.permanent_lock) return; // ironman cannot toggle off

    toggleMutatorMutation.mutate({ id: mutator.id, duration: mutator.durationDays });
    djangoApi.analytics.logEvent("mutator_activated");
  };

  const confirmIronmanActivate = () => {
    toggleMutatorMutation.mutate({ id: "ironman", duration: null });
    setConfirmIronman(false);
  };

  const byCategory = {};
  MUTATORS.filter(m => !m.disabled).forEach(m => { if (!byCategory[m.cat]) byCategory[m.cat] = []; byCategory[m.cat].push(m); });

  const activeMutatorsList = MUTATORS.filter(m => !m.disabled);
  const totalMutators = activeMutatorsList.length;
  const unlockedCount = purchased.filter(id => activeMutatorsList.some(m => m.id === id)).length;
  const isAllUnlocked = unlockedCount >= totalMutators;

  const activeSynergies = active.map(m => {
    const mutId = typeof m === 'object' ? m.id : m;
    return MUTATORS.find(orig => orig.id === mutId);
  }).filter(orig => orig && isSynergyActive(orig));

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 8px hsla(var(--primary), 0.15);
            border-color: hsla(var(--primary), 0.3);
          }
          50% {
            box-shadow: 0 0 20px hsla(var(--primary), 0.55);
            border-color: hsla(var(--primary), 0.8);
          }
        }
        @keyframes celebratePulse {
          0%, 100% {
            box-shadow: 0 0 10px #f0c04050;
            border-color: #f0c040;
          }
          50% {
            box-shadow: 0 0 25px #f0c040ff;
            border-color: #ffffff;
            transform: scale(1.05);
          }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">{t('sidebar.sections.mutators')}</div>
        <div className="text-[10px] font-mono font-bold" style={{ color: active.length >= MAX_ACTIVE ? "#ef4444" : "#00cc88" }}>
          {t('mutators_ui.active_count', { n: active.length, max: MAX_ACTIVE })}
        </div>
      </div>

      {/* Mutator Chest Card */}
      <div className="p-1">
        <div 
          className="relative overflow-hidden p-4 rounded-xl border-[1.5px] bg-[var(--habit-panel)] flex flex-col sm:flex-row gap-4 items-center justify-between transition-all"
          style={{
            borderColor: "hsla(var(--primary), 0.4)",
            boxShadow: "0 0 15px hsla(var(--primary), 0.15)",
            animation: "pulseGlow 3s infinite ease-in-out"
          }}
        >
          {/* Scanline pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />
          
          <div className="flex gap-4 items-center flex-1 min-w-0">
            {/* Icon */}
            <div 
              className="w-16 h-16 shrink-0 border bg-black/40 flex items-center justify-center p-1 rounded-xl relative overflow-hidden"
              style={{
                borderColor: "hsla(var(--primary), 0.3)",
                boxShadow: "0 0 10px hsla(var(--primary), 0.1)"
              }}
            >
              <img 
                src={getMediaUrl("/static/items/standard_cache.webp")} 
                alt="Mutator Chest" 
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-black text-foreground tracking-wide">
                MUTATOR CHEST
              </div>
              <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                Unlock a random Mutator!
              </div>
              <div className="text-[10px] font-mono text-primary font-bold mt-1.5 flex items-center gap-1.5">
                <span>📦 {unlockedCount} / {totalMutators} Unlocked</span>
                {isAllUnlocked && <span className="text-[#00cc88] font-black">(100% COMPLETE)</span>}
              </div>
            </div>
          </div>

          <div className="shrink-0 w-full sm:w-auto text-right flex flex-col gap-1 items-end">
            <button
              onClick={() => openChestMutation.mutate()}
              disabled={isAllUnlocked || gold < 100 || openChestMutation.isPending}
              className={`w-full sm:w-auto px-5 py-2.5 text-xs font-mono font-bold rounded-lg border transition-all z-10 ${
                isAllUnlocked ? "border-border bg-muted/20 text-muted-foreground/45 cursor-not-allowed" :
                gold < 100 ? "border-red-900/40 bg-red-950/20 text-red-400/60 cursor-not-allowed" :
                "border-primary bg-primary/10 hover:bg-primary/20 text-primary-foreground hover:shadow-[0_0_12px_hsla(var(--primary),0.3)]"
              }`}
            >
              {openChestMutation.isPending ? "DECRYPTING..." : isAllUnlocked ? "ALL UNLOCKED" : "OPEN CHEST (100G)"}
            </button>
            {!isAllUnlocked && gold < 100 && (
              <span className="text-[9px] font-mono text-red-500/80 mr-1 mt-0.5">
                Requires 100G (You have {gold}G)
              </span>
            )}
          </div>
        </div>
      </div>

      {activeSynergies.length > 0 && (
        <div className="p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 flex items-center gap-2">
          <span className="text-base">⚡</span>
          <div className="text-[10px] font-mono text-indigo-300">
            <span className="font-bold uppercase tracking-wide">Synergies Active:</span>{" "}
            {activeSynergies.map(m => t(`rpgData.mutators.${m.id}.name`)).join(", ")}
          </div>
        </div>
      )}

      <div className="p-3 rounded-xl border border-border bg-card/40 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
          <span>ACTIVE SLOTS</span>
          <span>{active.length} / {MAX_ACTIVE}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_ACTIVE }).map((_, idx) => {
            const mut = active[idx];
            const orig = mut ? MUTATORS.find(m => m.id === mut.id) : null;
            return (
              <div
                key={idx}
                onClick={() => orig && setSelectedMutator(orig)}
                className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center h-20 transition-all ${
                  orig
                    ? "border-[#f0c040] bg-[#f0c04008] cursor-pointer hover:bg-[#f0c04015]"
                    : "border-dashed border-border/60 bg-muted/10 text-muted-foreground/30"
                }`}
              >
                {orig ? (
                  <>
                    <img src={orig.icon} alt={orig.name} className="w-8 h-8 object-contain mb-1" style={{ imageRendering: "pixelated" }} />
                    <div className="font-mono text-[9px] font-bold text-[#f0c040] truncate w-full px-1">
                      {t(`rpgData.mutators.${orig.id}.name`)}
                    </div>
                  </>
                ) : (
                  <span className="font-mono text-[9px] tracking-widest uppercase">EMPTY</span>
                )}
              </div>
            );
          })}
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
                const conflicted = !isActive(mut.id) && mut.conflicts?.some(c => isActive(c));
                const isHighlighted = mut.id === highlightedId;

                return (
                  <div
                    key={mut.id}
                    onClick={() => setSelectedMutator(mut)}
                    className="cursor-pointer select-none transition-transform active:scale-[0.98] h-full"
                  >
                    <GameCard
                      id={`mutator-card-${mut.id}`}
                      isHoverable
                      isActive={active_ || isHighlighted}
                      borderColor={isHighlighted ? "#f0c040" : active_ ? "#f0c040" : purchased_ ? "hsl(var(--primary)/0.4)" : undefined}
                      glowColor={isHighlighted ? "#f0c040" : "#f0c040"}
                      className={`flex flex-col text-center p-3 relative h-full ${purchased_ && !active_ ? "bg-primary/5" : ""}`}
                      style={isHighlighted ? {
                        animation: "celebratePulse 1s infinite ease-in-out",
                        zIndex: 30
                      } : {}}
                    >
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
                        onClick={(e) => {
                          if (!purchased_) return;
                          e.stopPropagation();
                          activate(mut);
                        }}
                        disabled={!purchased_ || (!canActivate && !active_) || conflicted}
                        className={`w-full shrink-0 py-1.5 mt-auto text-[10px] font-mono font-bold rounded border transition-all relative z-10 ${
                          active_ ? "border-[#f0c040] bg-[#f0c040] text-black" :
                          purchased_ && canActivate && !conflicted ? "border-border bg-foreground/5 text-foreground hover:bg-foreground/10" :
                          "border-border/30 text-muted-foreground/30 bg-transparent cursor-not-allowed"
                        }`}
                        style={{ opacity: conflicted ? 0.4 : 1 }}
                      >
                        {active_ ? (mut.permanent_lock ? "🔒 ACTIVE" : "ACTIVE (ON)") : purchased_ ? "ACTIVATE" : conflicted ? "BLOCKED" : "🎁 Chest Only"}
                      </button>
                    </GameCard>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <AnimatePresence>
        {selectedMutator && (() => {
          const catColor = CAT_LABELS[selectedMutator.cat]?.color || "#f0c040";
          const catLabel = CAT_LABELS[selectedMutator.cat]?.label || selectedMutator.cat;
          const active_ = isActive(selectedMutator.id);
          const purchased_ = isPurchased(selectedMutator.id);
          const canActivate = active.length < MAX_ACTIVE || active_;
          const conflicted = !isActive(selectedMutator.id) && selectedMutator.conflicts?.some(c => isActive(c));

          let btnText = t('mutators_ui.btn_activate', 'ACTIVATE');
          if (active_) {
            btnText = selectedMutator.permanent_lock 
              ? t('mutators_ui.btn_active_permanent', '🔒 ACTIVE (PERMANENT)') 
              : t('mutators_ui.btn_active_on', 'ACTIVE (TAP TO UNEQUIP)');
          } else if (conflicted) {
            btnText = t('mutators_ui.btn_conflict_blocked', '⚠️ BLOCKED BY CONFLICT');
          } else if (!purchased_) {
            btnText = t('mutators_ui.btn_chest_only', '🎁 CHEST ONLY');
          } else if (!canActivate) {
            btnText = t('mutators_ui.btn_limit_reached', { max: MAX_ACTIVE });
          }

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1rem)' }}
              onClick={() => setSelectedMutator(null)}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="bg-card border rounded-2xl p-5 max-w-sm w-full space-y-4 max-h-[85svh] overflow-y-auto"
                style={{ borderColor: `${catColor}60`, boxShadow: `0 0 40px ${catColor}30` }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-2 relative text-center">
                  <div
                    className="w-24 h-24 rounded-2xl overflow-hidden border-2 relative z-10 flex items-center justify-center bg-black/40 p-2"
                    style={{
                      borderColor: catColor,
                      boxShadow: `0 0 25px ${catColor}40`,
                      imageRendering: "pixelated",
                    }}
                  >
                    <img
                      src={selectedMutator.icon}
                      alt={t(`rpgData.mutators.${selectedMutator.id}.name`)}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>

                  <div className="font-mono font-black text-base tracking-wide" style={{ color: catColor }}>
                    {t(`rpgData.mutators.${selectedMutator.id}.name`)}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase"
                      style={{ background: `${catColor}20`, color: catColor, border: `1px solid ${catColor}50` }}
                    >
                      {catLabel}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground/60 uppercase">
                      {selectedMutator.permanent_lock 
                        ? t('mutators_ui.type_permanent', 'Permanent') 
                        : selectedMutator.toggle 
                        ? t('mutators_ui.type_toggleable', 'Toggleable') 
                        : selectedMutator.durationDays 
                        ? t('mutators_ui.type_duration', { days: selectedMutator.durationDays }) 
                        : t('mutators_ui.type_passive', 'Passive')}
                    </span>
                  </div>

                  <div className="border border-border p-3 rounded-xl bg-muted/20 w-full">
                    <div className="text-[11px] font-mono text-muted-foreground/80 leading-relaxed italic text-center">
                      "{t(`rpgData.mutators.${selectedMutator.id}.desc`)}"
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {t(`rpgData.mutators.${selectedMutator.id}.bonus`, { defaultValue: "" }) && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                      <div className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="text-emerald-300 font-black">✦</span> {t('mutators_ui.positive_effect', 'Positive Effect')}
                      </div>
                      <div className="text-xs font-mono text-emerald-200/90 leading-relaxed">
                        {t(`rpgData.mutators.${selectedMutator.id}.bonus`)}
                      </div>
                    </div>
                  )}

                  {t(`rpgData.mutators.${selectedMutator.id}.penalty`, { defaultValue: "" }) && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1">
                      <div className="text-[11px] font-mono font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="text-rose-300">⚠️</span> {t('mutators_ui.penalty_cost', 'Penalty / Cost')}
                      </div>
                      <div className="text-xs font-mono text-rose-200/90 leading-relaxed">
                        {t(`rpgData.mutators.${selectedMutator.id}.penalty`)}
                      </div>
                    </div>
                  )}

                  {t(`rpgData.mutators.${selectedMutator.id}.mechanics`, { defaultValue: "" }) && (
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-1">
                      <div className="text-[11px] font-mono font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <span>⚙️</span> {t('mutators_ui.mechanics', 'Mechanics')}
                      </div>
                      <div className="text-xs font-mono text-slate-300 leading-relaxed">
                        {t(`rpgData.mutators.${selectedMutator.id}.mechanics`)}
                      </div>
                    </div>
                  )}

                  {selectedMutator.synergy && (
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-1">
                      <div className="font-mono text-[11px] font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <span>⚡</span> {t('mutators_ui.synergy', 'Synergy')}
                      </div>
                      <div className="font-mono text-xs text-slate-300">
                        {t('mutators_ui.pairs_with', 'Pairs with:')}{" "}
                        <span className="text-indigo-300 font-bold">
                          {t(`rpgData.mutators.${MUTATORS.find(m => m.id === selectedMutator.synergy)?.id || selectedMutator.synergy}.name`)}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedMutator.conflicts && selectedMutator.conflicts.length > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                      <div className="font-mono text-[11px] font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <span>🚫</span> {t('mutators_ui.conflicts_with', 'Conflicts with:')}
                      </div>
                      <div className="font-mono text-xs text-amber-200/90 leading-relaxed">
                        {selectedMutator.conflicts.map(c => t(`rpgData.mutators.${MUTATORS.find(m => m.id === c)?.id || c}.name`)).join(", ")}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (!purchased_) return;
                      activate(selectedMutator);
                      setSelectedMutator(null);
                    }}
                    disabled={!purchased_ || (!canActivate && !active_) || conflicted}
                    className={`w-full py-3 text-xs font-mono font-black rounded-xl transition-all border ${
                      active_ ? "border-[#f0c040] bg-[#f0c040] text-black shadow-lg shadow-[#f0c040]/20" :
                      purchased_ && canActivate && !conflicted ? "border-primary bg-primary/20 text-primary hover:bg-primary/30" :
                      "border-border/40 text-muted-foreground/40 bg-white/5 cursor-not-allowed"
                    }`}
                    style={{ opacity: conflicted ? 0.4 : 1 }}
                  >
                    {btnText}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedMutator(null)}
                  className="w-full text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors text-center uppercase tracking-wider"
                >
                  {t('skill_tree.btn_cancel', 'CLOSE')}
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}