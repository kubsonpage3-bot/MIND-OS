// @ts-nocheck
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, Brain, Sparkles, Globe } from 'lucide-react';
import NutritionTab from '@/components/mindos/NutritionTab';
import { hapticLight } from '@/hooks/useHaptic';
import { saveSettings } from '@/utils/settings';

export default function LifeOS({ onOpenSidebar, onSwitchToMindOS }) {
  const { t, i18n } = useTranslation();

  const currentLang = i18n.language?.startsWith('ru') ? 'ru' : 'en';

  const toggleLanguage = () => {
    hapticLight();
    const nextLang = currentLang === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('i18nextLng', nextLang);
    try {
      const settings = JSON.parse(localStorage.getItem('mindos_settings') || '{}');
      const newSettings = { ...settings, language: nextLang };
      saveSettings(newSettings);
    } catch {}
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--habit-bg)' }}>
      {/* ── Mobile Branded Top Header Bar (Only on mobile / md:hidden) ────────── */}
      <div
        className="md:hidden sticky top-0 z-40 flex items-center justify-between px-3 py-2 backdrop-blur-xl border-b gap-2"
        style={{
          background: 'rgba(15, 12, 28, 0.78)',
          borderColor: 'var(--habit-border, rgba(255,255,255,0.08))',
          paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        }}
      >
        {/* Left: Hamburger menu toggle to open Sidebar */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            hapticLight();
            onOpenSidebar?.();
          }}
          className="flex items-center justify-center w-8 h-8 rounded-xl transition-all shrink-0"
          style={{
            background: 'var(--habit-panel, rgba(30, 25, 55, 0.8))',
            border: '1px solid var(--habit-border, rgba(255,255,255,0.12))',
            color: 'var(--habit-text)',
          }}
          aria-label="Open Sidebar"
        >
          <Menu size={16} />
        </motion.button>

        {/* Center: Life OS Brand Badge */}
        <div className="flex items-center gap-1.5 select-none min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Sparkles size={12} color="#000" />
          </div>
          <div className="flex flex-col min-w-0">
            <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--habit-text)', letterSpacing: '0.04em', lineHeight: 1.1 }}>
              LIFE OS
            </span>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--habit-gold, #f59e0b)', letterSpacing: '0.06em', textTransform: 'uppercase' }} className="truncate">
              Eat Journal
            </span>
          </div>
        </div>

        {/* Right Actions: Language Switcher + Mind OS Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Language Toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-black transition-all border"
            style={{
              background: 'var(--habit-border)',
              borderColor: 'var(--habit-border)',
              color: 'var(--habit-gold, #f59e0b)',
            }}
            title="Switch Language / Сменить язык"
          >
            <Globe size={11} />
            <span>{currentLang === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}</span>
          </motion.button>

          {/* Quick Switcher Button back to Mind OS */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              hapticLight();
              onSwitchToMindOS?.();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-black transition-all"
            style={{
              background: 'rgba(123, 97, 255, 0.15)',
              border: '1px solid rgba(123, 97, 255, 0.35)',
              color: '#a78bfa',
              cursor: 'pointer',
            }}
            title="Switch to Mind OS"
          >
            <Brain size={12} />
            <span className="hidden xs:inline">Mind OS</span>
          </motion.button>
        </div>
      </div>

      {/* ── Main Responsive Content Container (Expanded for Desktop 6XL) ────── */}
      <div className="max-w-6xl mx-auto px-2 md:px-6 py-3 md:py-6">
        {/* Desktop Quick Language + Mode Switcher Bar */}
        <div className="hidden md:flex items-center justify-between pb-4 mb-2 border-b border-[var(--habit-border)]">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <Sparkles size={16} color="#000" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight" style={{ color: 'var(--habit-text)' }}>
                ✨ LIFE OS · Eat Journal
              </div>
              <div className="text-xs font-medium text-[var(--habit-dim)]">
                {t('nutrition.title', 'Nutrition, Calorie Tracker & Water Diary')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop Language Switcher */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--habit-border)] border border-[var(--habit-border)]">
              {[
                { code: 'ru', label: '🇷🇺 RU' },
                { code: 'en', label: '🇬🇧 EN' },
              ].map(({ code, label }) => {
                const isActive = currentLang === code;
                return (
                  <button
                    key={code}
                    onClick={() => {
                      hapticLight();
                      i18n.changeLanguage(code);
                      localStorage.setItem('i18nextLng', code);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      isActive
                        ? 'bg-[var(--habit-gold,#f59e0b)] text-black shadow-sm'
                        : 'text-[var(--habit-dim)] hover:text-[var(--habit-text)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Desktop Switch to Mind OS Button */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                hapticLight();
                onSwitchToMindOS?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all"
              style={{
                background: 'rgba(123, 97, 255, 0.15)',
                border: '1px solid rgba(123, 97, 255, 0.35)',
                color: '#a78bfa',
                cursor: 'pointer',
              }}
            >
              <Brain size={14} />
              <span>{t('sidebar.apps.mind', 'Switch to Mind OS')}</span>
            </motion.button>
          </div>
        </div>

        <NutritionTab />
      </div>
    </div>
  );
}