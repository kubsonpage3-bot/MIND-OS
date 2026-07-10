import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Shared modal for displaying expanded item details (Gear, Consumables, Mutators, etc.)
export default function ItemDetailModal({ item, isOpen, onClose, actionButton, tierColor = "#a8a29e", iconUrl = undefined, title = undefined, subtitle = undefined, stats = null, description = null }) {
  const { t } = useTranslation();

  if (!item && !title) return null;

  const displayTitle = title || item?.name || item?.label || "Item";
  const displaySubtitle = subtitle || item?.tier || "";
  const displayIcon = iconUrl || item?.icon_url || item?.icon || '/static/items/default.webp';
  
  // Use stats or explicit description
  const displayDescription = description || (item?.stats ? Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : (item?.description || item?.effect || ""));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            className="w-full max-w-sm bg-slate-900 border rounded-xl overflow-hidden shadow-2xl flex flex-col"
            style={{ borderColor: `${tierColor}50` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/50">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                {t('inventory.item_details', 'Item Details')}
              </span>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              {/* Icon */}
              <div 
                className="w-20 h-20 rounded border flex items-center justify-center shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800/50"
                style={{ borderColor: `${tierColor}50`, imageRendering: "pixelated" }}
              >
                <img 
                  src={displayIcon} 
                  alt={displayTitle} 
                  className="w-full h-full object-contain p-2" 
                  style={{ imageRendering: "pixelated" }} 
                />
              </div>

              {/* Title & Tier */}
              <div>
                <h2 className="text-lg font-mono font-black tracking-wide" style={{ color: tierColor }}>
                  {displayTitle}
                </h2>
                {displaySubtitle && (
                  <div className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase mt-1">
                    {displaySubtitle}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="text-sm font-mono text-slate-300 leading-relaxed max-h-40 overflow-y-auto">
                {displayDescription}
              </div>
            </div>

            {/* Footer / Action */}
            {actionButton && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                {actionButton}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
