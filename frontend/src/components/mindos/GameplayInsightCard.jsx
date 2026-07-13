import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight } from 'lucide-react';
import { useGameplayInsights } from '@/hooks/useGameplayInsights';
import { playSound } from '@/lib/soundEffects';

export default function GameplayInsightCard({ onNavigate }) {
  const { t } = useTranslation();
  const { activeInsight, dismissInsight } = useGameplayInsights();

  if (!activeInsight) return null;

  const handleAction = () => {
    playSound('ui_click');
    if (onNavigate && activeInsight.targetSection) {
      onNavigate(activeInsight.targetApp, activeInsight.targetSection, activeInsight.targetSub);
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    playSound('ui_click');
    dismissInsight(activeInsight.id);
  };

  return (
    <AnimatePresence>
      {activeInsight && (
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-16 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] cursor-pointer"
          onClick={handleAction}
        >
          <div className="bg-card border border-border shadow-lg rounded-xl overflow-hidden relative group">
            {/* Subtle glow edge */}
            <div className="absolute inset-y-0 left-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors" />
            
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors z-10"
              aria-label="Dismiss insight"
            >
              <X size={14} />
            </button>

            <div className="p-3 pl-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none pt-1">
                  {activeInsight.icon}
                </div>
                <div className="flex-1 pr-4">
                  <h4 className="text-sm font-bold text-foreground mb-1 leading-tight">
                    {t(activeInsight.title)}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-snug mb-2">
                    {t(activeInsight.description)}
                  </p>
                  
                  {activeInsight.cta && (
                    <div className="flex items-center text-xs font-semibold text-primary group-hover:text-primary/80 transition-colors">
                      {t(activeInsight.cta)}
                      <ChevronRight size={14} className="ml-1" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
