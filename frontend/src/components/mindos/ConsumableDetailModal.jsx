import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Zap, Clock, ShieldAlert, Sparkles, Coins, CheckCircle, Flame, Heart, Activity } from 'lucide-react';
import { useHardwareBack } from '@/utils/modalStack';
import { getTierColor } from '@/lib/gameState';
import { getMediaUrl } from '@/api/djangoClient';
import { getConsumableMeta, CONSUMABLE_CATEGORIES } from '@/lib/consumableMetadata';

export default function ConsumableDetailModal({
  item,
  isOpen,
  onClose,
  count = 1,
  isActive = false,
  activeData = null,
  onConsume,
  onSell,
  isConsuming = false,
  isSelling = false,
}) {
  useHardwareBack(isOpen, onClose);
  const { t } = useTranslation();

  if (typeof document === 'undefined') return null;

  const itemCode = item?.code || item?.id || '';
  const meta = getConsumableMeta(itemCode);
  const tier = item?.tier || meta.tier || 'D';
  const tierColor = getTierColor(tier) || '#8b5cf6';
  const category = CONSUMABLE_CATEGORIES[meta.category] || CONSUMABLE_CATEGORIES.utility;
  const iconUrl = item?.icon_url ? getMediaUrl(item.icon_url) : '/static/items/default.webp';
  const title = item ? t(`items.${itemCode}.name`, item.label || item.name || meta.shortDesc || 'Consumable') : '';
  
  // Dynamic duration calculation if currently active
  const timeLeftStr = activeData?.expiresAt 
    ? `${Math.max(1, Math.ceil((activeData.expiresAt - Date.now()) / 3600000))}h left`
    : (isActive ? t('consumables.active_now', 'Active Now') : null);

  const getCategoryIcon = (catKey) => {
    switch (catKey) {
      case 'healing': return <Heart className="w-3 h-3" />;
      case 'buff': return <Flame className="w-3 h-3" />;
      case 'utility': return <ShieldAlert className="w-3 h-3" />;
      case 'wealth': return <Coins className="w-3 h-3" />;
      case 'cognition': return <Activity className="w-3 h-3" />;
      default: return <Sparkles className="w-3 h-3" />;
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && item && (
        <motion.div
          key="consumable-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 16px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
          }}
          onClick={onClose}
        >
            <motion.div
              initial={{ scale: 0.88, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col relative border"
              style={{
                background: 'var(--habit-panel, #121218)',
                borderColor: `${tierColor}55`,
                boxShadow: `0 0 45px ${tierColor}30, 0 10px 30px rgba(0,0,0,0.8)`,
              }}
            >
              {/* Top ambient glow bar */}
              <div 
                className="h-1 w-full" 
                style={{ background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)` }} 
              />

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--habit-border,#222)] bg-black/20">
                <div className="flex items-center gap-1.5">
                  {/* Category Pill */}
                  <span
                    className="flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full border"
                    style={{
                      color: category.color,
                      background: category.bg,
                      borderColor: `${category.color}40`,
                    }}
                  >
                    {getCategoryIcon(meta.category)}
                    {t(`consumables.categories.${meta.category}`, category.label)}
                  </span>

                  {/* Tier badge */}
                  <span
                    className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md border"
                    style={{
                      color: tierColor,
                      borderColor: `${tierColor}50`,
                      background: `${tierColor}15`,
                    }}
                  >
                    RANK {tier}
                  </span>
                </div>

                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col items-center text-center space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Visual Avatar with pulsing glow */}
                <div className="relative my-1">
                  <motion.div
                    animate={{
                      boxShadow: [
                        `0 0 16px ${tierColor}40`,
                        `0 0 28px ${tierColor}70`,
                        `0 0 16px ${tierColor}40`,
                      ],
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-20 h-20 rounded-2xl flex items-center justify-center p-2 relative overflow-hidden border-2"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${tierColor}25 0%, var(--habit-panel) 85%)`,
                      borderColor: tierColor,
                    }}
                  >
                    <img
                      src={iconUrl}
                      alt={title}
                      className="w-full h-full object-contain"
                      style={{
                        imageRendering: 'pixelated',
                        filter: `drop-shadow(0 0 6px ${tierColor}80)`,
                      }}
                    />
                  </motion.div>

                  {/* Quantity badge */}
                  {count > 1 && (
                    <div
                      className="absolute -bottom-1 -right-2 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black shadow-md border"
                      style={{
                        background: tierColor,
                        color: '#000',
                        borderColor: '#00000040',
                      }}
                    >
                      x{count}
                    </div>
                  )}
                </div>

                {/* Title & Short Description */}
                <div>
                  <h2
                    className="text-lg font-mono font-black tracking-wide"
                    style={{ color: tierColor }}
                  >
                    {title}
                  </h2>
                  <p className="text-xs font-mono text-[var(--habit-dim,#888)] mt-1 max-w-xs">
                    {t(`items.${itemCode}.desc`, meta.shortDesc)}
                  </p>
                </div>

                {/* Key Mechanics Grid */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  {/* Effect Value Highlight */}
                  <div 
                    className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      borderColor: `${tierColor}35`,
                    }}
                  >
                    <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-[var(--habit-dim)] tracking-wider mb-0.5">
                      <Zap className="w-3 h-3" style={{ color: tierColor }} />
                      {t('consumables.effect', 'Effect')}
                    </div>
                    <div className="font-mono text-xs font-black" style={{ color: tierColor }}>
                      {meta.effectValue}
                    </div>
                  </div>

                  {/* Duration Highlight */}
                  <div 
                    className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      borderColor: 'var(--habit-border, #333)',
                    }}
                  >
                    <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-[var(--habit-dim)] tracking-wider mb-0.5">
                      <Clock className="w-3 h-3 text-sky-400" />
                      {t('consumables.duration', 'Duration')}
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-200">
                      {t(`consumables.durations.${itemCode}`, meta.duration)}
                    </div>
                  </div>
                </div>

                {/* Detailed "How it works" box */}
                <div 
                  className="w-full p-3 rounded-xl border text-left space-y-1"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderColor: 'var(--habit-border, #2a2a35)',
                  }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--habit-text,#fff)] uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {t('consumables.how_it_works', 'How It Works')}
                  </div>
                  <p className="text-[11px] font-mono text-[var(--habit-dim,#999)] leading-relaxed">
                    {t(`consumables.mechanics.${itemCode}`, meta.howItWorks)}
                  </p>
                </div>

                {/* Active Indicator Banner */}
                {isActive && (
                  <div
                    className="w-full py-2 px-3 rounded-xl flex items-center justify-between border"
                    style={{
                      background: `${tierColor}15`,
                      borderColor: `${tierColor}40`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.span
                        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-2 h-2 rounded-full"
                        style={{ background: tierColor }}
                      />
                      <span className="text-[10px] font-mono font-bold" style={{ color: tierColor }}>
                        {t('consumables.currently_active', 'BUFF ACTIVE')}
                      </span>
                    </div>
                    {timeLeftStr && (
                      <span className="text-[10px] font-mono text-[var(--habit-dim)]">
                        {timeLeftStr}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-[var(--habit-border,#222)] bg-black/30 flex flex-col gap-2">
                {/* Consume Button */}
                {onConsume && (
                  <motion.button
                    whileTap={!isActive && !isConsuming ? { scale: 0.96 } : {}}
                    onClick={() => {
                      if (!isActive && !isConsuming) {
                        onConsume(item);
                        onClose();
                      }
                    }}
                    disabled={isActive || isConsuming}
                    className="w-full py-3 px-4 rounded-xl text-xs font-mono font-black transition-all relative overflow-hidden flex items-center justify-center gap-2 border shadow-lg cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      background: isActive 
                        ? 'rgba(255,255,255,0.05)' 
                        : `linear-gradient(135deg, ${tierColor}30, ${tierColor}15)`,
                      borderColor: isActive ? 'var(--habit-border)' : tierColor,
                      color: isActive ? 'var(--habit-dim)' : tierColor,
                      opacity: isActive ? 0.6 : 1,
                    }}
                  >
                    {!isActive && !isConsuming && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        animate={{ x: ['-100%', '130%'] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'linear', repeatDelay: 1.5 }}
                        style={{
                          background: `linear-gradient(90deg, transparent, ${tierColor}40, transparent)`,
                          width: '60%',
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-1.5">
                      {isActive ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t('consumables.already_active', 'ALREADY ACTIVE')}
                        </>
                      ) : isConsuming ? (
                        t('consumables.using', 'USING...')
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          {t('consumables.use_item', 'USE ITEM')}
                        </>
                      )}
                    </span>
                  </motion.button>
                )}

                {/* Sell Button */}
                {onSell && !isActive && (
                  <motion.button
                    whileTap={!isSelling ? { scale: 0.96 } : {}}
                    onClick={() => {
                      if (!isSelling) {
                        onSell(item);
                        onClose();
                      }
                    }}
                    disabled={isSelling}
                    className="w-full py-2 px-3 rounded-lg text-[11px] font-mono font-bold transition-all border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    {isSelling ? t('consumables.selling', 'SELLING...') : t('consumables.sell_for_gold', 'SELL FOR GOLD')}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
}

