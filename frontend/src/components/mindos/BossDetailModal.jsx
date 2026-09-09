// @ts-nocheck
import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { 
  X, 
  Swords, 
  Flame, 
  CheckCircle2,
  Lock
} from "lucide-react";
import { normalizeGold } from "@/lib/utils";
import { useHardwareBack } from "@/utils/modalStack";
import OptimizedImage from "./OptimizedImage";
import { SCROLL_BOSS_IMAGES, RANK_COLORS } from "./ScrollsPanel";

const RANK_DAILY_DMG = { E: 10, D: 9, C: 8, B: 7, A: 6, S: 6, SS: 5, SSS: 5 };

export default function BossDetailModal({
  scroll,
  isOpen,
  onClose,
  encounter = null,
  isActive = false,
  isDefeated = false,
  rankUnlocked = true,
  canAfford = true,
  userGold = 0,
  isSummoning = false,
  onSummon = null,
  onNavigateToArena = null,
}) {
  useHardwareBack(isOpen, onClose);
  const { t } = useTranslation();
  const [confirmingSummon, setConfirmingSummon] = useState(false);

  if (!scroll || !isOpen) return null;

  const color = scroll.color || RANK_COLORS[scroll.rank] || "#f87171";
  const bossId = scroll.id;

  // Localized texts
  const bossName = String(t(`scrolls.items.${bossId}.boss`, scroll.boss));
  const scrollTitle = String(t(`scrolls.items.${bossId}.scrollName`, scroll.scrollName));
  const quote = String(t(`scrolls.items.${bossId}.quote`, scroll.quote));
  const desc = t(`scrolls.items.${bossId}.desc`, {
    defaultValue: "A fearsome manifestation born from inner hesitation and mental resistance. Vanquishing this entity restores vitality and claims ancient relics."
  });
  const mechanics = t(`scrolls.items.${bossId}.mechanics`, {
    defaultValue: "Vulnerable to disciplined daily execution and deep focus. Every completed task inflicts heavy damage upon this creature."
  });

  const uniqueItemLabel = String(t(`scrolls.items.${bossId}.uniqueItem_label`, scroll.uniqueItem?.label || "Ancient Relic"));
  const uniqueItemEffect = String(t(`scrolls.items.${bossId}.uniqueItem_effect`, scroll.uniqueItem?.effect || "+Bonus Stats"));
  const uniqueItemSlot = scroll.uniqueItem?.slot || "Relic";

  // HP and Combat data
  const maxHP = scroll.bossHP;
  const currentHP = isActive && encounter ? encounter.hp_current : maxHP;
  const hpPct = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  const dailyThreatDmg = encounter?.daily_threat?.base_damage || RANK_DAILY_DMG[scroll.rank] || 8;
  const daysLimit = scroll.daysLimit || 14;

  const handleSummonClick = () => {
    if (!confirmingSummon) {
      setConfirmingSummon(true);
      return;
    }
    if (onSummon) {
      onSummon(scroll);
      setConfirmingSummon(false);
      onClose();
    }
  };

  return typeof document !== "undefined" && createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 16px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
            touchAction: 'none'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 350 }}
            className="w-full max-w-lg rounded-2xl p-5 sm:p-6 space-y-4 relative overflow-hidden my-auto max-h-[90vh] overflow-y-auto"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(30,15,40,0.98) 0%, rgba(10,6,14,0.99) 75%)',
              border: `1.5px solid ${color}50`,
              boxShadow: `0 0 50px ${color}25, inset 0 0 30px rgba(0,0,0,0.9), 0 20px 40px rgba(0,0,0,0.85)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gothic Corner Brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color }} />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color }} />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color }} />

            {/* Ambient Top Glow Line */}
            <div 
              className="absolute top-0 left-10 right-10 h-0.5"
              style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            />

            {/* Header / Badges Row */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-[10px] font-pixel">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded font-black tracking-widest uppercase border"
                  style={{ background: `${color}20`, color, borderColor: `${color}60`, boxShadow: `0 0 8px ${color}30` }}
                >
                  {t('scrolls.rank', { rank: scroll.rank })}
                </span>
                <span className="text-muted-foreground/60 hidden sm:inline">
                  {t('scrolls.boss_modal.threat_level', { rank: scroll.rank })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isActive && (
                  <span className="text-[9px] font-pixel px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/50 flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                    <Flame className="w-3 h-3 animate-pulse text-red-400" />
                    {t('scrolls.boss_modal.status_active')}
                  </span>
                )}
                {isDefeated && !isActive && (
                  <span className="text-[9px] font-pixel px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {t('scrolls.boss_modal.status_defeated')}
                  </span>
                )}
                {!isActive && !isDefeated && (
                  <span className="text-[9px] font-pixel px-2 py-0.5 rounded bg-black/60 text-muted-foreground/70 border border-white/10">
                    {rankUnlocked ? t('scrolls.boss_modal.status_available') : t('scrolls.boss_modal.status_locked', { rank: scroll.rank })}
                  </span>
                )}

                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Boss Hero Presentation */}
            <div className="flex flex-col items-center text-center relative pt-1">
              {/* Radial Aura behind portrait */}
              <div 
                className="absolute w-36 h-36 rounded-full blur-2xl pointer-events-none opacity-40 -top-2"
                style={{ background: color }}
              />

              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 relative z-10 flex items-center justify-center p-1.5 shadow-2xl"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${color}20 0%, #0c0812 90%)`,
                  borderColor: color,
                  boxShadow: `0 0 25px ${color}50, inset 0 0 15px rgba(0,0,0,0.8)`,
                }}
              >
                <OptimizedImage
                  src={SCROLL_BOSS_IMAGES[bossId]}
                  alt={bossName}
                  className="w-full h-full object-cover rounded-xl"
                  style={{
                    imageRendering: "pixelated",
                    filter: `drop-shadow(0 0 8px ${color}80) ${!rankUnlocked && !isActive && !isDefeated ? "grayscale(0.6)" : ""}`
                  }}
                />
              </motion.div>

              <h2
                className="font-pixel font-black text-xl sm:text-2xl mt-3 tracking-wide"
                style={{ color: "#f8fafc", textShadow: `0 0 14px ${color}80` }}
              >
                {bossName}
              </h2>
              <div className="font-mono text-xs text-muted-foreground/70 mt-0.5 italic">
                {scrollTitle}
              </div>

              {quote && (
                <div 
                  className="font-mono text-xs italic mt-2 px-4 py-1.5 rounded-lg border border-white/[0.06] bg-black/40 text-slate-300/80 max-w-md"
                  style={{ textShadow: `0 0 8px ${color}30` }}
                >
                  {quote}
                </div>
              )}
            </div>

            {/* Dark Lore Backstory */}
            <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-950/10 space-y-1 relative">
              <div className="text-[9px] font-pixel text-purple-300/80 uppercase tracking-widest flex items-center gap-1.5">
                <span>📜</span> <span>{t('scrolls.boss_modal.title', 'Grimoire Lore')}</span>
              </div>
              <p className="text-xs font-mono text-slate-300/90 leading-relaxed text-left">
                {desc}
              </p>
            </div>

            {/* Combat Vitals & Threat Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Health Pool */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center">
                <span className="text-base">🩸</span>
                <span className="text-xs font-pixel font-black text-red-400 mt-1">
                  {maxHP.toLocaleString()} HP
                </span>
                <span className="text-[8px] font-pixel text-muted-foreground/60 tracking-wider mt-0.5 uppercase">
                  {t('scrolls.boss_modal.health_pool')}
                </span>
              </div>

              {/* Ritual Duration */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center">
                <span className="text-base">⏳</span>
                <span className="text-xs font-pixel font-black text-amber-300 mt-1">
                  {t('scrolls.boss_modal.days_count', { days: daysLimit })}
                </span>
                <span className="text-[8px] font-pixel text-muted-foreground/60 tracking-wider mt-0.5 uppercase">
                  {t('scrolls.boss_modal.time_limit')}
                </span>
              </div>

              {/* Daily Threat */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center">
                <span className="text-base">⚔️</span>
                <span className="text-xs font-pixel font-black text-orange-400 mt-1">
                  {dailyThreatDmg} DMG/d
                </span>
                <span className="text-[8px] font-pixel text-muted-foreground/60 tracking-wider mt-0.5 uppercase">
                  {t('scrolls.boss_modal.daily_threat')}
                </span>
              </div>
            </div>

            {/* Active Combat HP bar if currently fighting this boss */}
            {isActive && (
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 space-y-1.5">
                <div className="flex justify-between text-[10px] font-pixel text-red-300">
                  <span className="flex items-center gap-1 font-bold">
                    <Flame className="w-3 h-3 text-red-400" /> Current Arena Status
                  </span>
                  <span>{currentHP.toLocaleString()} / {maxHP.toLocaleString()} HP ({Math.round(hpPct)}%)</span>
                </div>
                <div className="w-full h-2.5 bg-black/70 rounded-full overflow-hidden border border-red-500/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${hpPct}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)' }}
                  />
                </div>
              </div>
            )}

            {/* Tactics / Mechanics */}
            <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-950/10 space-y-1 text-left">
              <div className="text-[9px] font-pixel text-cyan-400/90 uppercase tracking-widest flex items-center gap-1.5">
                <span>⚙️</span> <span>{t('scrolls.boss_modal.tactics')}</span>
              </div>
              <p className="text-xs font-mono text-cyan-100/80 leading-relaxed">
                {mechanics}
              </p>
            </div>

            {/* Unique Relic / Legendary Drop */}
            <div 
              className="p-3.5 rounded-xl border relative overflow-hidden space-y-1 text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(15,10,20,0.9) 100%)',
                borderColor: 'rgba(245,158,11,0.4)',
                boxShadow: '0 0 16px rgba(245,158,11,0.15)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] font-pixel text-amber-400 uppercase tracking-widest font-bold">
                  <span>★</span> <span>{t('scrolls.boss_modal.relic_loot')}</span>
                </div>
                <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold">
                  {uniqueItemSlot}
                </span>
              </div>
              <div className="font-pixel font-bold text-sm text-amber-300">
                {uniqueItemLabel}
              </div>
              <div className="text-xs font-mono text-slate-300/90 leading-relaxed">
                {uniqueItemEffect}
              </div>
              <div className="text-[8px] font-mono text-amber-400/60 pt-0.5">
                {t('scrolls.boss_modal.relic_guaranteed')}
              </div>
            </div>

            {/* Spoils of War (Bounty) */}
            <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] space-y-2">
              <div className="text-[9px] font-pixel uppercase tracking-widest text-muted-foreground/70 text-left">
                💰 {t('scrolls.boss_modal.spoils_of_war')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                <div className="flex items-center gap-1.5 text-xs font-mono text-yellow-400 font-bold">
                  <span>🪙</span> <span>+{normalizeGold(scroll.reward?.gold || 0).toLocaleString()}G</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 font-bold">
                  <span>⚡</span> <span>+{scroll.reward?.xp || 0} XP</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-purple-300 font-bold">
                  <span>🔮</span> <span>+{scroll.reward?.sp || 0} SP</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 font-bold">
                  <span>💧</span> <span>+{scroll.reward?.mp || 0} MP</span>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="pt-2">
              {isActive ? (
                <button
                  onClick={() => {
                    if (onNavigateToArena) onNavigateToArena();
                    onClose();
                  }}
                  className="w-full py-3 rounded-xl font-pixel font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                  style={{
                    background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)',
                    color: '#ffffff',
                    boxShadow: '0 0 20px rgba(220,38,38,0.5)',
                    border: '1px solid rgba(248,113,113,0.5)',
                  }}
                >
                  <Swords className="w-4 h-4" />
                  {t('scrolls.boss_modal.btn_to_arena')}
                </button>
              ) : isDefeated ? (
                <div className="w-full py-2.5 rounded-xl font-pixel font-bold text-xs flex items-center justify-center gap-2 bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('scrolls.boss_modal.btn_vanquished')}
                </div>
              ) : !rankUnlocked ? (
                <div className="w-full py-2.5 rounded-xl font-pixel font-bold text-xs flex items-center justify-center gap-2 bg-black/60 border border-white/10 text-muted-foreground/60">
                  <Lock className="w-3.5 h-3.5" />
                  {t('scrolls.boss_modal.btn_need_rank', { rank: scroll.rank })}
                </div>
              ) : !canAfford ? (
                <div className="w-full py-2.5 rounded-xl font-pixel font-bold text-xs flex items-center justify-center gap-2 bg-red-950/30 border border-red-500/30 text-red-400">
                  <span>🪙</span>
                  {t('scrolls.boss_modal.btn_no_gold', { price: scroll.price })} (You have {normalizeGold(userGold).toLocaleString()}G)
                </div>
              ) : (
                <div className="space-y-2">
                  {confirmingSummon ? (
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-amber-300 text-center bg-amber-950/40 p-2 rounded-lg border border-amber-500/30">
                        {t('scrolls.modal_time_limit_part1')}
                        <span className="font-bold text-white">{daysLimit} days</span>
                        {t('scrolls.modal_time_limit_part3')}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmingSummon(false)}
                          className="flex-1 py-2.5 rounded-xl font-pixel text-xs border border-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                        >
                          {t('scrolls.btn_cancel')}
                        </button>
                        <button
                          onClick={handleSummonClick}
                          disabled={isSummoning}
                          className="flex-1 py-2.5 rounded-xl font-pixel font-bold text-xs transition-all cursor-pointer shadow-lg"
                          style={{
                            background: `linear-gradient(90deg, ${color} 0%, #ffffff 150%)`,
                            color: '#000000',
                            boxShadow: `0 0 20px ${color}60`,
                          }}
                        >
                          {isSummoning ? t('scrolls.boss_modal.btn_summoning') : `CONFIRM SUMMON (${scroll.price}G)`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleSummonClick}
                      disabled={isSummoning}
                      className="w-full py-3 rounded-xl font-pixel font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                      style={{
                        background: `linear-gradient(90deg, ${color} 0%, #ffffff 150%)`,
                        color: '#000000',
                        boxShadow: `0 0 20px ${color}60`,
                      }}
                    >
                      <Flame className="w-4 h-4 text-black" />
                      {t('scrolls.boss_modal.btn_summon', { price: scroll.price })}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
