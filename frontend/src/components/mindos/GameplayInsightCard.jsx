// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight } from 'lucide-react';
import { useGameplayInsights } from '@/hooks/useGameplayInsights';
import { playSound } from '@/lib/soundEffects';

const AUTO_DISMISS_DURATION_MS = 9000; // 9 seconds auto-dismiss

export default function GameplayInsightCard({ onNavigate }) {
  const { t } = useTranslation();
  const { activeInsight, dismissInsight } = useGameplayInsights();
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(AUTO_DISMISS_DURATION_MS);

  // Reset timer whenever a new insight appears
  useEffect(() => {
    if (!activeInsight) return;

    setProgress(100);
    setIsPaused(false);
    remainingTimeRef.current = AUTO_DISMISS_DURATION_MS;
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      if (isPaused) {
        startTimeRef.current = Date.now();
        return;
      }

      const elapsedSinceResume = Date.now() - startTimeRef.current;
      const currentRemaining = Math.max(0, remainingTimeRef.current - elapsedSinceResume);
      const pct = (currentRemaining / AUTO_DISMISS_DURATION_MS) * 100;

      setProgress(pct);

      if (currentRemaining <= 0) {
        clearInterval(interval);
        dismissInsight(activeInsight.id);
      }
    }, 60);

    return () => clearInterval(interval);
  }, [activeInsight?.id, isPaused, dismissInsight]);

  const handleMouseEnter = () => {
    // Save remaining time and pause
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  if (!activeInsight) return null;

  const handleAction = (e) => {
    e.stopPropagation();
    playSound('ui_click');
    if (onNavigate && activeInsight.targetSection) {
      onNavigate(activeInsight.targetSection, activeInsight.targetSub, {
        app: activeInsight.targetApp,
        shopTab: activeInsight.targetShopTab
      });
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    playSound('ui_click');
    dismissInsight(activeInsight.id);
  };

  const accentColor = activeInsight.color || "var(--habit-purple)";

  return (
    <AnimatePresence>
      {activeInsight && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.92 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed bottom-6 right-4 sm:right-6 z-40 w-80 max-w-[calc(100vw-2rem)] select-none"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          {/* 16-Bit Oracle Pixel Frame */}
          <div 
            className="relative rounded-xl border-2 bg-card/95 backdrop-blur-md overflow-hidden pixel-corner-brackets"
            style={{
              borderColor: `${accentColor}70`,
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px ${accentColor}25, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
            }}
          >
            {/* Ambient category glow */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                background: `radial-gradient(ellipse at 10% 20%, ${accentColor} 0%, transparent 70%)`
              }}
            />

            {/* Top Bar with Category & Close */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1 relative z-10">
              <span 
                className="font-game text-[7.5px] font-black uppercase px-1.5 py-0.2 rounded border tracking-wider"
                style={{
                  color: accentColor,
                  borderColor: `${accentColor}50`,
                  background: `${accentColor}15`
                }}
              >
                {activeInsight.badge || '✦ ADVISOR'}
              </span>

              <button
                onClick={handleDismiss}
                className="text-[var(--habit-dim)] hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss insight"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>

            {/* Main Content */}
            <div className="px-3.5 pb-3 pt-1 flex items-start gap-3 relative z-10">
              {/* Icon Sprite / Altar */}
              <div 
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border bg-black/40 text-lg select-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                style={{ borderColor: `${accentColor}40` }}
              >
                {activeInsight.icon}
              </div>

              {/* Text Area */}
              <div className="flex-1 min-w-0 pr-1">
                <h4 className="font-game text-[10px] font-bold text-foreground leading-tight tracking-wide mb-1">
                  {t(activeInsight.title)}
                </h4>
                <p className="font-game text-[8px] text-[var(--habit-dim)] leading-relaxed mb-2.5 line-clamp-2">
                  {t(activeInsight.description)}
                </p>
                
                {/* Action Button */}
                {activeInsight.cta && (
                  <button
                    onClick={handleAction}
                    className="inline-flex items-center gap-1 font-game text-[8px] font-bold px-2.5 py-1 rounded border transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      color: "#fff",
                      background: `${accentColor}30`,
                      borderColor: `${accentColor}80`,
                      boxShadow: `0 0 10px ${accentColor}25`
                    }}
                  >
                    <span>{t(activeInsight.cta)}</span>
                    <ChevronRight size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Auto-dismiss countdown bar */}
            <div className="h-1 bg-black/60 relative overflow-hidden">
              <motion.div
                className="h-full"
                style={{
                  width: `${progress}%`,
                  background: accentColor,
                  boxShadow: `0 0 6px ${accentColor}`
                }}
                transition={{ ease: "linear", duration: 0.06 }}
              />
              <div className="absolute inset-0 pixel-meter-pattern opacity-40 pointer-events-none" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
