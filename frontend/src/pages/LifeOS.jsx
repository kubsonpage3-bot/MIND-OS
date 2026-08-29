// @ts-nocheck
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, Brain, Sparkles, ChevronLeft } from 'lucide-react';
import NutritionTab from '@/components/mindos/NutritionTab';
import { hapticLight } from '@/hooks/useHaptic';

export default function LifeOS({ onOpenSidebar, onSwitchToMindOS }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen" style={{ background: 'var(--habit-bg)' }}>
      {/* ── Mobile Branded Top Header Bar (Only on mobile / md:hidden) ────────── */}
      <div
        className="md:hidden sticky top-0 z-40 flex items-center justify-between px-3.5 py-2.5 backdrop-blur-xl border-b"
        style={{
          background: 'rgba(15, 12, 28, 0.78)',
          borderColor: 'var(--habit-border, rgba(255,255,255,0.08))',
          paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        }}
      >
        {/* Left: Hamburger menu toggle to open Sidebar */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            hapticLight();
            onOpenSidebar?.();
          }}
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
          style={{
            background: 'var(--habit-panel, rgba(30, 25, 55, 0.8))',
            border: '1px solid var(--habit-border, rgba(255,255,255,0.12))',
            color: 'var(--habit-text)',
          }}
          aria-label="Open Sidebar"
        >
          <Menu size={18} />
        </motion.button>

        {/* Center: Life OS Brand Badge */}
        <div className="flex items-center gap-1.5 select-none">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Sparkles size={13} color="#000" />
          </div>
          <div className="flex flex-col">
            <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--habit-text)', letterSpacing: '0.04em', lineHeight: 1.1 }}>
              LIFE OS
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--habit-gold, #f59e0b)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Eat Journal
            </span>
          </div>
        </div>

        {/* Right: Quick Switcher Button back to Mind OS */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            hapticLight();
            onSwitchToMindOS?.();
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all"
          style={{
            background: 'rgba(123, 97, 255, 0.15)',
            border: '1px solid rgba(123, 97, 255, 0.35)',
            color: '#a78bfa',
            cursor: 'pointer',
          }}
          title="Switch to Mind OS"
        >
          <Brain size={13} />
          <span>Mind OS</span>
        </motion.button>
      </div>

      {/* ── Main Responsive Content Container (Expanded for Desktop 6XL) ────── */}
      <div className="max-w-6xl mx-auto px-2 md:px-6 py-3 md:py-6">
        <NutritionTab />
      </div>
    </div>
  );
}