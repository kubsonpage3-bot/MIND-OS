// @ts-nocheck
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Scroll, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTES } from '../../constants/quotes';

export default function DailyQuoteWidget() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language?.startsWith('ru');

  const quote = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    return QUOTES[dayOfYear % QUOTES.length];
  }, []);

  const quoteText = isRu && quote?.ruText ? quote.ruText : quote?.text;
  const quoteRef = isRu && quote?.ruRef ? quote.ruRef : quote?.ref;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-4 rounded-xl border relative overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] pixel-corner-brackets pixel-corner-gold"
      style={{
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Ambient background with warm parchment / arcane glow */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(circle at 10% 30%, rgba(255, 190, 93, 0.12) 0%, rgba(123, 97, 255, 0.06) 50%, transparent 80%)",
        }}
      />

      {/* Subtle pixel grid texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--habit-text) 1px, transparent 0)",
          backgroundSize: "12px 12px"
        }}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--habit-border)] bg-black/10 relative z-10">
        <div className="flex items-center gap-2">
          <Scroll className="w-3.5 h-3.5 text-[#ffbe5d] animate-pulse" />
          <span className="font-game text-[9px] text-[#ffbe5d] tracking-widest uppercase font-bold">
            {t('daily_quote.title', '✦ SCRIPTURE OF THE DAY ✦')}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-60">
          <Sparkles className="w-3 h-3 text-[#ffbe5d]" />
          <span className="font-game text-[8px] text-[var(--habit-dim)] uppercase">
            {t('daily_quote.badge', 'WISDOM SCROLL')}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 md:p-5 flex flex-row items-center gap-4 relative z-10">
        {/* Animated Pixel-like Icon Altar */}
        <div className="shrink-0 hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-lg border border-[#ffbe5d]/30 bg-[#ffbe5d]/10 relative">
          <span className="text-xl select-none filter drop-shadow-[0_0_8px_rgba(255,190,93,0.5)]">📜</span>
          <div className="absolute -bottom-1 w-6 h-0.5 bg-[#ffbe5d]/60 rounded-full" />
        </div>
        
        {/* Quote & Reference */}
        <div className="flex-1 flex flex-col justify-center">
          <p 
            className="italic text-sm md:text-[15px] leading-relaxed text-[var(--habit-text)] relative font-medium"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
          >
            "{quoteText}"
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-[#ffbe5d]" />
            <span 
              className="font-game text-[9px] text-[#ffbe5d] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-[#ffbe5d]/30 bg-[#ffbe5d]/10"
              style={{ textShadow: "0 0 8px rgba(255, 190, 93, 0.4)" }}
            >
              {quoteRef}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
