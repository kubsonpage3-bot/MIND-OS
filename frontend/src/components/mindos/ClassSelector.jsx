import { useState } from "react";
import { CLASSES, CLASS_SPRITES } from "@/constants/rpgData";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { Lock } from "lucide-react";
import PremiumUpgradeModal from "./PremiumUpgradeModal";

export default function ClassSelector({ onChoose, isPremium }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleConfirm = async () => {
    if (!selectedClass || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onChoose(selectedClass.id);
      djangoApi.analytics.logEvent("class_selected");
    } catch (error) {
      console.error("Failed to select class:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">Class Selection</div>
        <div className="font-mono text-sm text-foreground/70">Choose your path. This choice is permanent.</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Object.values(CLASSES).map(cls => {
          const isHovered = hovered === cls.id;
          const isSelected = selectedClass?.id === cls.id;
          const isActive = isHovered || isSelected;

            const FREE_CLASSES = ["wanderer", "architect", "ascetic"];
            const isLocked = !isPremium && !FREE_CLASSES.includes(cls.id);

            return (
              <motion.button
                key={cls.id}
                whileHover={{ scale: isLocked ? 1.01 : 1.03 }}
                whileTap={{ scale: isLocked ? 1 : 0.97 }}
                onClick={() => {
                  if (isLocked) {
                    setShowPremiumModal(true);
                  } else {
                    setSelectedClass(cls);
                  }
                }}
              onMouseEnter={() => setHovered(cls.id)}
              onMouseLeave={() => setHovered(null)}
              className="p-4 rounded-xl border text-left transition-all space-y-2 overflow-hidden relative"
              style={{
                borderColor: isActive ? cls.color : "#1e1a38",
                background: isActive ? `${cls.color}15` : "#0a0818",
                boxShadow: isSelected ? `0 0 24px ${cls.color}60, inset 0 0 12px ${cls.color}40` : (isHovered ? `0 0 20px ${cls.color}40` : "none"),
              }}
            >
              {/* Character sprite */}
              <div className="flex justify-center mb-1 relative h-20">
                <motion.img
                  src={typeof CLASS_SPRITES[cls.id] === 'object' ? CLASS_SPRITES[cls.id]['S'] : CLASS_SPRITES[cls.id]}
                  alt={t(`classes.${cls.id}`, cls.name)}
                  className="h-20 object-contain"
                  style={{
                    imageRendering: "pixelated",
                    filter: isActive
                      ? `drop-shadow(0 0 8px ${cls.color}) drop-shadow(0 0 16px ${cls.color}80)`
                      : `drop-shadow(0 0 2px ${cls.color}40) brightness(0.85)`,
                    transition: "filter 0.3s ease",
                  }}
                  animate={isActive ? { y: [0, -4, 0] } : { y: 0 }}
                  transition={isActive ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
                />
              </div>

              <div className="font-mono text-xs font-bold flex items-center justify-between" style={{ color: cls.color }}>
                <span>{t(`classes.${cls.id}`, cls.name)}</span>
                {isLocked && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                    <Lock className="w-3 h-3" /> PREMIUM
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/50 italic leading-relaxed line-clamp-2">"{cls.lore}"</div>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {Object.entries(cls.stats).slice(0, 4).map(([k, v]) => (
                  <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${cls.color}18`, color: cls.color }}>
                    {k.toUpperCase()} {v}
                  </span>
                ))}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/40">MANA {cls.maxMana}</div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {showPremiumModal && (
          <PremiumUpgradeModal onClose={() => setShowPremiumModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClass && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col items-center mt-6 p-4 rounded-xl border border-dashed bg-black/40"
            style={{ borderColor: selectedClass.color }}
          >
            <div className="text-xs font-mono text-center mb-4" style={{ color: selectedClass.color }}>
              You have selected <span className="font-bold">{selectedClass.name}</span>.
            </div>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full py-3 text-sm font-mono rounded-lg font-bold transition-all hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: selectedClass.color, color: "#000", boxShadow: `0 0 20px ${selectedClass.color}60` }}
            >
              {isSubmitting ? "PROCESSING..." : "CONFIRM SELECTION"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}