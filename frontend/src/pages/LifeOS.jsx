// @ts-nocheck
/**
 * LIFE OS · Eat Journal — page shell.
 *
 * Owns the chrome only: ambient backdrop, the sticky brand header, language
 * and the switch back to Mind OS. All journal content lives in NutritionTab.
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, Brain, Sparkles, Globe } from 'lucide-react';
import NutritionTab from '@/components/mindos/NutritionTab';
import { hapticLight } from '@/hooks/useHaptic';
import { saveSettings } from '@/utils/settings';

const LANGS = [
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
];

export default function LifeOS({ onOpenSidebar, onSwitchToMindOS }) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('ru') ? 'ru' : 'en';

  function setLanguage(code) {
    hapticLight();
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
    try {
      const settings = JSON.parse(localStorage.getItem('mindos_settings') || '{}');
      saveSettings({ ...settings, language: code });
    } catch { /* settings are best-effort */ }
  }

  const mindOsButton = (size = 'md') => (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={() => { hapticLight(); onSwitchToMindOS?.(); }}
      className="flex items-center gap-1.5 rounded-xl font-black transition-colors"
      style={{
        padding: size === 'sm' ? '5px 9px' : '7px 12px',
        fontSize: size === 'sm' ? 11 : 12,
        background: 'rgba(123, 97, 255, 0.14)',
        border: '1px solid rgba(123, 97, 255, 0.34)',
        color: '#a78bfa',
        cursor: 'pointer',
      }}
      title={t('sidebar.apps.mind', 'Switch to Mind OS')}
    >
      <Brain size={size === 'sm' ? 12 : 14} />
      <span className={size === 'sm' ? 'hidden xs:inline' : ''}>
        {size === 'sm' ? 'Mind OS' : t('sidebar.apps.mind', 'Switch to Mind OS')}
      </span>
    </motion.button>
  );

  const langSwitch = (size = 'md') => (
    <div
      className="flex items-center gap-0.5 rounded-xl"
      style={{ padding: 2, background: 'var(--ej-surface-sunken, rgba(0,0,0,0.2))', border: '1px solid var(--habit-border)' }}
      role="group"
      aria-label="Language"
    >
      {LANGS.map(({ code, label, flag }) => {
        const active = currentLang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            aria-pressed={active}
            className="rounded-lg font-black transition-colors"
            style={{
              padding: size === 'sm' ? '3px 7px' : '4px 9px',
              fontSize: size === 'sm' ? 10.5 : 11.5,
              background: active ? 'var(--habit-gold, #f59e0b)' : 'transparent',
              color: active ? '#000' : 'var(--habit-dim)',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{ marginRight: 3 }}>{flag}</span>{label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="eat-journal min-h-screen relative" style={{ background: 'var(--habit-bg)' }}>
      <div className="ej-aura" aria-hidden="true" />

      {/* ── Mobile header ──────────────────────────────────────────────────── */}
      <header
        className="ej-topbar md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 px-3 py-2 backdrop-blur-xl"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={() => { hapticLight(); onOpenSidebar?.(); }}
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: 32, height: 32,
            background: 'var(--habit-panel)',
            border: '1px solid var(--habit-border)',
            color: 'var(--habit-text)',
          }}
          aria-label="Open sidebar"
        >
          <Menu size={16} />
        </motion.button>

        <div className="flex items-center gap-1.5 min-w-0 select-none">
          <span
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}
          >
            <Sparkles size={12} color="#000" />
          </span>
          <span className="flex flex-col min-w-0 leading-none">
            <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--habit-text)', letterSpacing: '0.04em' }}>
              LIFE OS
            </span>
            <span
              className="truncate"
              style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--habit-gold, #f59e0b)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}
            >
              {t('nutrition.brand_sub', 'Eat Journal')}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setLanguage(currentLang === 'ru' ? 'en' : 'ru')}
            className="flex items-center gap-1 rounded-xl font-black"
            style={{
              padding: '5px 8px', fontSize: 11,
              background: 'var(--habit-panel)',
              border: '1px solid var(--habit-border)',
              color: 'var(--habit-gold, #f59e0b)',
              cursor: 'pointer',
            }}
            title="Switch language / Сменить язык"
          >
            <Globe size={11} />
            <span>{currentLang === 'ru' ? 'RU' : 'EN'}</span>
          </button>
          {mindOsButton('sm')}
        </div>
      </header>

      {/* ── Desktop header ─────────────────────────────────────────────────── */}
      <header
        className="ej-topbar hidden md:block sticky top-0 z-40 backdrop-blur-xl"
      >
        <div className="mx-auto flex items-center justify-between gap-4 px-6 py-3" style={{ maxWidth: 1280 }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #fbbf24, #d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.32)' }}
            >
              <Sparkles size={17} color="#000" />
            </span>
            <div className="min-w-0">
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--habit-text)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                LIFE OS <span style={{ opacity: 0.35, fontWeight: 800 }}>·</span> {t('nutrition.brand_sub', 'Eat Journal')}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--habit-dim)', marginTop: 2 }}>
                {t('nutrition.brand_tagline', 'Nutrition, calories, water & body weight')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {langSwitch()}
            {mindOsButton()}
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto px-2 md:px-6 py-3 md:py-6" style={{ maxWidth: 1280 }}>
        {/* Opacity only, deliberately: animating `y` leaves a transform on this
            element, which would make it the containing block for the modals and
            the floating add button below it. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <NutritionTab />
        </motion.div>
      </div>
    </div>
  );
}
