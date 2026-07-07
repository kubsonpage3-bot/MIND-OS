import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { QUOTES } from '../../constants/quotes';

export default function DailyQuoteWidget() {
  const quote = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    return QUOTES[dayOfYear % QUOTES.length];
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mb-4 rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm relative"
    >
      <div className="p-5 md:p-6 flex flex-row items-center gap-4">
        {/* Icon */}
        <div className="shrink-0 flex items-center justify-center">
          <BookOpen size={36} style={{ color: "var(--xp-color)" }} className="opacity-80" />
        </div>
        
        {/* Quote & Reference */}
        <div className="flex flex-col relative z-10">
          <span 
            className="italic text-base mb-1 relative leading-snug" 
            style={{ color: "var(--habit-text)", fontFamily: "'Nunito', sans-serif" }}
          >
            "{quote.text}"
          </span>
          <span 
            className="text-xs font-semibold uppercase tracking-wider mt-1" 
            style={{ color: "var(--habit-text)", opacity: 0.5 }}
          >
            — {quote.ref}
          </span>
        </div>
        
        {/* Decorative huge quotation mark */}
        <div 
          className="absolute right-4 top-0 text-7xl select-none"
          style={{ color: "var(--xp-color)", opacity: 0.1, fontFamily: "serif" }}
        >
          ❝
        </div>
      </div>
    </motion.div>
  );
}
