// @ts-nocheck
import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { playSound } from '@/lib/soundEffects';
import { useHardwareBack } from '@/utils/modalStack';
import { hapticHeavy, hapticSuccess } from '@/hooks/useHaptic';
import { SCROLLS, SCROLL_BOSS_IMAGES, RANK_COLORS } from './ScrollsPanel';
import ConfettiBurst from './ConfettiBurst';
import OptimizedImage from './OptimizedImage';
import { Swords, Skull, Coins, Zap, Sparkles, Gem, Trophy } from 'lucide-react';

export default function BossDefeatModal({ isOpen, onClose, combatResult, rewards }) {
  useHardwareBack(isOpen, onClose);
  const { t } = useTranslation();

  const bossName = combatResult?.boss_name || "The Boss";
  const bossId = combatResult?.boss_id_name;
  const finalDamage = combatResult?.final_damage || combatResult?.damage_dealt || 0;
  const isCrit = combatResult?.is_critical || false;

  // Match boss definition from scrolls database
  const bossTemplate = useMemo(() => {
    return SCROLLS.find(s => 
      (bossId && s.id === bossId) ||
      (s.boss && s.boss.toLowerCase() === bossName.toLowerCase()) ||
      (s.name && s.name.toLowerCase() === bossName.toLowerCase())
    );
  }, [bossId, bossName]);

  const bossImage = useMemo(() => {
    if (bossId && SCROLL_BOSS_IMAGES[bossId]) return SCROLL_BOSS_IMAGES[bossId];
    if (bossTemplate && SCROLL_BOSS_IMAGES[bossTemplate.id]) return SCROLL_BOSS_IMAGES[bossTemplate.id];
    return "/images/boss_victory_banner.jpg";
  }, [bossId, bossTemplate]);

  const bossRank = bossTemplate?.rank || "D";
  const rankColor = RANK_COLORS[bossRank] || "#f59e0b";
  const bossHP = bossTemplate?.bossHP || 0;
  const bossQuote = bossTemplate?.quote || "";
  const uniqueItem = bossTemplate?.uniqueItem;

  const bossGold = rewards?.boss_gold ?? bossTemplate?.reward?.gold ?? 0;
  const bossXp = rewards?.boss_xp ?? bossTemplate?.reward?.xp ?? 0;
  const bossSp = rewards?.boss_sp ?? bossTemplate?.reward?.sp ?? 0;

  useEffect(() => {
    if (isOpen) {
      playSound('level_up');
      const timer = setTimeout(() => {
        playSound('gold_earned');
      }, 350);
      try {
        hapticHeavy?.();
      } catch {
        // Safe fallback if unsupported
      }
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClaim = () => {
    playSound('gold_earned');
    try {
      hapticSuccess?.();
    } catch {
      // Safe fallback
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 16px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
            touchAction: 'none'
          }}
          onClick={handleClaim}
        >
          {/* Pixel-art celebration confetti */}
          <ConfettiBurst active={isOpen} count={65} isPixel={true} color="#f59e0b" />

          {/* Golden radial background flare */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.18)_0%,_transparent_65%)] pointer-events-none animate-pulse" />

          <motion.div
            initial={{ scale: 0.8, y: 35, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 35, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className="relative w-full max-w-md rounded-2xl border-2 border-amber-500/60 text-center shadow-2xl overflow-hidden max-h-[90svh] flex flex-col"
            style={{
              background: "linear-gradient(180deg, #1d160e 0%, #0c0906 100%)",
              boxShadow: "0 0 50px rgba(245, 158, 11, 0.35), inset 0 0 20px rgba(0,0,0,0.8)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Corner retro pixel brackets */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-400/80 pointer-events-none z-20" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-400/80 pointer-events-none z-20" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-400/80 pointer-events-none z-20" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-400/80 pointer-events-none z-20" />

            {/* Top Pixel Art Victory Banner Image Header */}
            <div className="relative h-28 sm:h-32 w-full overflow-hidden shrink-0 border-b border-amber-500/30">
              <img
                src="/images/boss_victory_banner.jpg"
                alt="Victory Banner"
                className="w-full h-full object-cover object-center opacity-85 brightness-110"
                style={{ imageRendering: 'pixelated' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1d160e] via-[#1d160e]/50 to-black/30" />
              
              {/* Victory Header Title */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/60 border border-amber-400/40 backdrop-blur-sm mb-1 shadow-md">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="font-mono text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                    {t('boss_defeat.boss_slain', 'BOSS VANQUISHED')}
                  </span>
                </div>
                <h2 
                  className="font-game text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-yellow-600 drop-shadow-[0_2px_12px_rgba(245,158,11,0.8)] tracking-wider"
                >
                  {t('boss_defeat.victory', 'VICTORY!')}
                </h2>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-left flex-1">
              
              {/* Vanquished Boss Spotlight Card */}
              <div className="relative rounded-xl border border-amber-500/30 bg-black/50 p-3.5 flex items-center gap-3.5 shadow-inner overflow-hidden">
                {/* Boss Sprite Thumbnail */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg border border-amber-500/40 overflow-hidden bg-black/70 flex items-center justify-center">
                  <OptimizedImage
                    src={bossImage}
                    alt={bossName}
                    className="w-full h-full object-contain filter contrast-125 brightness-90"
                    fallbackText="💀"
                  />
                  {/* Vanquished Slanted Ribbon */}
                  <div className="absolute inset-x-0 bottom-1 py-0.5 bg-rose-600/95 border-y border-rose-300 text-center font-game text-[8px] sm:text-[9px] font-black text-white tracking-widest uppercase shadow-md -rotate-3">
                    {t('boss_defeat.vanquished', 'VANQUISHED')}
                  </div>
                </div>

                {/* Boss Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      className="px-2 py-0.5 rounded font-mono text-[10px] font-black uppercase tracking-wider"
                      style={{ 
                        color: rankColor, 
                        background: `${rankColor}15`, 
                        border: `1px solid ${rankColor}40` 
                      }}
                    >
                      {t('boss_defeat.boss_rank', 'RANK')} {bossRank}
                    </span>
                    {bossHP > 0 && (
                      <span className="font-mono text-[10px] text-gray-400">
                        {bossHP.toLocaleString()} HP
                      </span>
                    )}
                  </div>

                  <h3 className="font-game text-base sm:text-lg font-bold text-amber-200 mt-1 truncate">
                    {bossName}
                  </h3>

                  {bossQuote ? (
                    <p className="font-mono text-[11px] text-amber-200/60 italic mt-0.5 line-clamp-2">
                      {bossQuote}
                    </p>
                  ) : (
                    <p className="font-mono text-[11px] text-gray-400 mt-0.5">
                      {t('boss_defeat.slain_desc', { bossName })}
                    </p>
                  )}
                </div>
              </div>

              {/* Combat Recap: Final Blow & Critical Strike */}
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-2.5 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-gray-400 text-[11px]">
                    {t('boss_defeat.final_blow', 'FINAL BLOW')}:
                  </span>
                  <span className="font-bold text-amber-300">
                    +{finalDamage.toLocaleString()} DMG
                  </span>
                </div>
                {isCrit && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-black tracking-wider animate-pulse flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    {t('boss_defeat.critical_hit', 'CRIT')}
                  </span>
                )}
              </div>

              {/* Loot Rewards Grid */}
              <div>
                <div className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{t('boss_defeat.rewards_title', 'SPOILS OF BATTLE')}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Gold */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/30 flex flex-col items-center text-center">
                    <Coins className="w-4 h-4 text-amber-400 mb-1" />
                    <span className="font-mono text-[9px] text-gray-400 uppercase">
                      {t('boss_defeat.gold_reward', 'GOLD')}
                    </span>
                    <span className="font-mono font-black text-xs text-amber-400 mt-0.5">
                      +{bossGold.toLocaleString()} G
                    </span>
                  </div>

                  {/* XP */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-purple-500/30 flex flex-col items-center text-center">
                    <Zap className="w-4 h-4 text-purple-400 mb-1" />
                    <span className="font-mono text-[9px] text-gray-400 uppercase">
                      {t('boss_defeat.xp_reward', 'XP')}
                    </span>
                    <span className="font-mono font-black text-xs text-purple-400 mt-0.5">
                      +{bossXp.toLocaleString()}
                    </span>
                  </div>

                  {/* SP */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/30 flex flex-col items-center text-center">
                    <Gem className="w-4 h-4 text-cyan-400 mb-1" />
                    <span className="font-mono text-[9px] text-gray-400 uppercase">
                      {t('boss_defeat.sp_reward', 'SKILL PTS')}
                    </span>
                    <span className="font-mono font-black text-xs text-cyan-400 mt-0.5">
                      +{bossSp} SP
                    </span>
                  </div>
                </div>

                {/* Unique Item Drop (if available) */}
                {uniqueItem && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/40 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-black/50 border border-amber-400/50 flex items-center justify-center shrink-0 text-amber-300">
                      🎁
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                          {t('boss_defeat.unique_drop', 'UNIQUE DROP')}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 text-[8px] font-mono">
                          {uniqueItem.tier || 'Unique'}
                        </span>
                      </div>
                      <div className="font-mono text-xs font-bold text-white truncate">
                        {uniqueItem.label}
                      </div>
                      <div className="font-mono text-[10px] text-gray-300 truncate">
                        {uniqueItem.effect}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Claim Button */}
            <div className="p-4 sm:p-5 pt-0 shrink-0">
              <button
                onClick={handleClaim}
                className="w-full py-3.5 rounded-xl font-game text-sm sm:text-base font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer tracking-wider flex items-center justify-center gap-2 shadow-lg"
                style={{ 
                  background: "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)",
                  boxShadow: "0 0 25px rgba(245, 158, 11, 0.45)"
                }}
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span>{t('boss_defeat.claim_rewards', 'CLAIM LOOT')}</span>
                <Sparkles className="w-4 h-4 text-black" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
