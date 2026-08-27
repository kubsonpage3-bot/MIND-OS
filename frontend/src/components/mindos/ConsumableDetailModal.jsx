// @ts-nocheck
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Zap, Clock, ShieldAlert, Sparkles, Coins, CheckCircle, Flame, Heart, Activity, ShoppingBag, ArrowRight, Shield, Swords, Package } from 'lucide-react';
import { useHardwareBack } from '@/utils/modalStack';
import { getTierColor } from '@/lib/gameState';
import { getMediaUrl } from '@/api/djangoClient';
import { getConsumableMeta, CONSUMABLE_CATEGORIES } from '@/lib/consumableMetadata';
import { playSound } from '@/lib/soundEffects';

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
  onBuy,
  cost = undefined,
  gold = 0,
  isBought = false,
  inInventoryCount = 0,
}) {
  useHardwareBack(isOpen, onClose);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      try {
        playSound('click');
      } catch (e) {
        // sound ignored if not loaded
      }
    }
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  const itemCode = item?.code || item?.id || '';
  const meta = getConsumableMeta(item || itemCode);
  const tier = item?.tier || meta.tier || 'D';
  const tierColor = getTierColor(tier) || '#8b5cf6';
  const category = CONSUMABLE_CATEGORIES[meta.category] || CONSUMABLE_CATEGORIES.utility;
  const iconUrl = item?.icon_url ? getMediaUrl(item.icon_url) : '/static/items/default.webp';
  const title = item ? t(`items.${itemCode}.name`, item.label || item.name || meta.shortDesc || 'Consumable') : '';
  const itemCost = cost !== undefined ? cost : (item?.cost || 0);
  const canAfford = gold >= itemCost;

  // Dynamic duration calculation if currently active
  const timeLeftStr = activeData?.expiresAt 
    ? `${Math.max(1, Math.ceil((activeData.expiresAt - Date.now()) / 3600000))}h left`
    : (isActive ? t('consumables.active_now', 'Active Now') : null);

  const getCategoryIcon = (catKey) => {
    switch (catKey) {
      case 'healing': return <Heart className="w-3.5 h-3.5" />;
      case 'buff': return <Flame className="w-3.5 h-3.5" />;
      case 'utility': return <ShieldAlert className="w-3.5 h-3.5" />;
      case 'wealth': return <Coins className="w-3.5 h-3.5" />;
      case 'cognition': return <Activity className="w-3.5 h-3.5" />;
      default: return <Sparkles className="w-3.5 h-3.5" />;
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
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col relative border"
            style={{
              background: 'var(--habit-panel, #121218)',
              borderColor: `${tierColor}60`,
              boxShadow: `0 0 50px ${tierColor}35, 0 15px 35px rgba(0,0,0,0.9)`,
            }}
          >
            {/* Top ambient glow bar */}
            <div 
              className="h-1.5 w-full shrink-0" 
              style={{ background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)` }} 
            />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--habit-border,#222)] bg-black/30 shrink-0">
              <div className="flex items-center gap-2">
                {/* Category Pill */}
                <span
                  className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full border shadow-sm"
                  style={{
                    color: category.color,
                    background: category.bg,
                    borderColor: `${category.color}45`,
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
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col items-center text-center space-y-4 max-h-[72vh] overflow-y-auto">
              {/* Visual Avatar with pulsing glow (Allies Style) */}
              <div className="relative my-1">
                <motion.div
                  animate={{
                    boxShadow: [
                      `0 0 16px ${tierColor}40`,
                      `0 0 35px ${tierColor}80`,
                      `0 0 16px ${tierColor}40`,
                    ],
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-2xl flex items-center justify-center p-3 relative overflow-hidden border-2"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${tierColor}30 0%, var(--habit-panel, #121218) 85%)`,
                    borderColor: tierColor,
                  }}
                >
                  <img
                    src={iconUrl}
                    alt={title}
                    className="w-full h-full object-contain"
                    style={{
                      imageRendering: 'pixelated',
                      filter: `drop-shadow(0 0 8px ${tierColor}90)`,
                    }}
                  />
                </motion.div>

                {/* Quantity badge if in inventory or count > 1 */}
                {count > 1 && (
                  <div
                    className="absolute -bottom-1 -right-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-black shadow-lg border"
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

              {/* Title & Lore Box (Allies Style) */}
              <div className="w-full space-y-2">
                <h2
                  className="text-lg font-mono font-black tracking-wide"
                  style={{ color: tierColor }}
                >
                  {title}
                </h2>

                {/* Description Quote Card */}
                <div className="border border-border/60 p-2.5 rounded-xl bg-muted/25 relative text-center">
                  <div className="text-[11px] font-mono text-muted-foreground/80 italic leading-snug">
                    "{t(`items.${itemCode}.desc`, meta.shortDesc)}"
                  </div>
                </div>
              </div>

              {/* Key Mechanics Grid */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                {/* Effect Value Highlight */}
                <div 
                  className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center shadow-inner"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderColor: `${tierColor}40`,
                  }}
                >
                  <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-[var(--habit-dim,#888)] tracking-wider mb-1">
                    <Zap className="w-3 h-3" style={{ color: tierColor }} />
                    {t('consumables.effect', 'Effect')}
                  </div>
                  <div className="font-mono text-xs font-black truncate max-w-full px-1" style={{ color: tierColor }}>
                    {meta.effectValue}
                  </div>
                </div>

                {/* Duration Highlight */}
                <div 
                  className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center shadow-inner"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderColor: 'var(--habit-border, #333)',
                  }}
                >
                  <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-[var(--habit-dim,#888)] tracking-wider mb-1">
                    <Clock className="w-3 h-3 text-sky-400" />
                    {t('consumables.duration', 'Duration')}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-200 truncate max-w-full px-1">
                    {t(`consumables.durations.${itemCode}`, meta.duration)}
                  </div>
                </div>
              </div>

              {/* Detailed "How it works" box (Allies lore/ability style) */}
              <div 
                className="w-full p-3.5 rounded-xl border text-left space-y-1.5"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  borderColor: 'var(--habit-border, #2a2a35)',
                }}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--habit-text,#fff)] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {t('consumables.how_it_works', 'How It Works')}
                </div>
                <p className="text-[11px] font-mono text-[var(--habit-dim,#999)] leading-relaxed">
                  {t(`consumables.mechanics.${itemCode}`, meta.howItWorks)}
                </p>
              </div>

              {/* Active Indicator Banner */}
              {isActive && (
                <div
                  className="w-full py-2.5 px-3 rounded-xl flex items-center justify-between border"
                  style={{
                    background: `${tierColor}15`,
                    borderColor: `${tierColor}45`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: tierColor }}
                    />
                    <span className="text-[10px] font-mono font-bold tracking-wide" style={{ color: tierColor }}>
                      {t('consumables.currently_active', 'BUFF ACTIVE')}
                    </span>
                  </div>
                  {timeLeftStr && (
                    <span className="text-[10px] font-mono text-[var(--habit-dim)] font-semibold">
                      {timeLeftStr}
                    </span>
                  )}
                </div>
              )}

              {/* Inventory status in shop mode */}
              {onBuy && inInventoryCount > 0 && (
                <div className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground/70 bg-white/[0.03] py-1.5 rounded-lg border border-white/5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('consumables.in_inventory', 'В инвентаре')}: <strong className="text-white">{inInventoryCount}</strong> шт.</span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--habit-border,#222)] bg-black/35 flex flex-col gap-2 shrink-0">
              {/* SHOP MODE: Buy Button */}
              {onBuy && (
                <div className="space-y-2">
                  <motion.button
                    whileTap={canAfford && !isBought ? { scale: 0.96 } : {}}
                    onClick={() => {
                      if (canAfford) {
                        onBuy(item);
                      }
                    }}
                    disabled={!canAfford || isBought}
                    className="w-full py-3.5 px-4 rounded-xl text-xs font-mono font-black transition-all relative overflow-hidden flex items-center justify-center gap-2 border shadow-xl cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      background: isBought
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.15))'
                        : canAfford 
                        ? 'linear-gradient(135deg, rgba(240,192,64,0.25), rgba(240,192,64,0.1))'
                        : 'rgba(255,255,255,0.04)',
                      borderColor: isBought 
                        ? '#22c55e' 
                        : canAfford 
                        ? '#f0c040' 
                        : 'var(--habit-border, #333)',
                      color: isBought 
                        ? '#22c55e' 
                        : canAfford 
                        ? '#f0c040' 
                        : 'var(--habit-dim, #666)',
                      boxShadow: canAfford && !isBought ? '0 0 20px rgba(240,192,64,0.2)' : 'none',
                    }}
                  >
                    {/* Shimmer sweep effect */}
                    {canAfford && !isBought && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        animate={{ x: ['-100%', '130%'] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'linear', repeatDelay: 1.5 }}
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(240,192,64,0.35), transparent)',
                          width: '60%',
                        }}
                      />
                    )}

                    <span className="relative z-10 flex items-center justify-center gap-1.5 font-bold">
                      {isBought ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span>{t('consumables.bought', 'КУПЛЕНО!')}</span>
                        </>
                      ) : canAfford ? (
                        <>
                          <Coins className="w-4 h-4 text-amber-400" />
                          <span>🪙 {itemCost}G — {t('consumables.buy_item', 'КУПИТЬ')}</span>
                        </>
                      ) : (
                        <>
                          <Coins className="w-4 h-4 text-muted-foreground/40" />
                          <span>{itemCost}G — {t('consumables.not_enough_gold', 'НЕДОСТАТОЧНО ЗОЛОТА')}</span>
                        </>
                      )}
                    </span>
                  </motion.button>

                  {!canAfford && (
                    <div className="text-[10px] font-mono text-center text-rose-400/80">
                      {t('consumables.need_more_gold', { amount: itemCost - gold, defaultValue: `Не хватает ${itemCost - gold}G` })}
                    </div>
                  )}
                </div>
              )}

              {/* INVENTORY MODE: Consume Button */}
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
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-mono font-black transition-all relative overflow-hidden flex items-center justify-center gap-2 border shadow-lg cursor-pointer disabled:cursor-not-allowed"
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

              {/* INVENTORY MODE: Sell Button */}
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
