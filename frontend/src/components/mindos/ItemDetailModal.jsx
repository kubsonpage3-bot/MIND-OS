// @ts-nocheck
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useHardwareBack } from '@/utils/modalStack';

// Shared modal for displaying expanded item details (Gear, Consumables, Mutators, etc.)
export default function ItemDetailModal({ item, isOpen, onClose, actionButton, tierColor = "#a8a29e", iconUrl = undefined, title = undefined, subtitle = undefined, stats = null, description = null }) {
  useHardwareBack(isOpen, onClose);
  const { t } = useTranslation();

  if (!item && !title) return null;

  const displayTitle = title || item?.name || item?.label || "Item";
  const displaySubtitle = subtitle || item?.tier || "";
  const displayIcon = iconUrl || item?.icon_url || item?.icon || '/static/items/default.webp';
  
  // Use stats or explicit description
  const displayDescription = description || (item?.stats ? Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : (item?.description || item?.effect || ""));

  return (
    <AnimatePresence>
      {isOpen && typeof document !== "undefined" ? createPortal(
        <motion.div
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
            transition={{ type: "spring", damping: 22, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            className="w-full max-w-sm bg-[var(--habit-panel,#121218)] border rounded-2xl overflow-hidden shadow-2xl flex flex-col relative"
            style={{
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
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--habit-dim,#888)]">
                {t('inventory.item_details', 'Item Details')}
              </span>
              <button 
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col items-center text-center space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Icon */}
              <div 
                className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center shrink-0 overflow-hidden relative"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${tierColor}25 0%, var(--habit-panel) 85%)`,
                  borderColor: tierColor,
                  boxShadow: `0 0 20px ${tierColor}40`,
                }}
              >
                <img 
                  src={displayIcon} 
                  alt={displayTitle} 
                  className="w-full h-full object-contain p-2" 
                  style={{
                    imageRendering: "pixelated",
                    filter: `drop-shadow(0 0 6px ${tierColor}80)`,
                  }} 
                />
              </div>

              {/* Title & Tier */}
              <div>
                <h2 className="text-lg font-mono font-black tracking-wide" style={{ color: tierColor }}>
                  {displayTitle}
                </h2>
                {displaySubtitle && (
                  <div 
                    className="text-[10px] font-mono font-bold tracking-widest uppercase mt-1 px-2 py-0.5 rounded-full inline-block border"
                    style={{
                      color: tierColor,
                      borderColor: `${tierColor}50`,
                      background: `${tierColor}15`,
                    }}
                  >
                    {displaySubtitle}
                  </div>
                )}
              </div>

              {/* Description */}
              <div 
                className="text-xs font-mono text-[var(--habit-dim,#aaa)] leading-relaxed w-full p-3 rounded-xl border text-left"
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderColor: 'var(--habit-border, #2a2a35)',
                }}
              >
                {displayDescription}
              </div>
            </div>

            {/* Footer / Action */}
            {actionButton && (
              <div className="p-4 border-t border-[var(--habit-border,#222)] bg-black/30">
                {actionButton}
              </div>
            )}
          </motion.div>
        </motion.div>,
        document.body
      ) : null}
    </AnimatePresence>
  );
}
