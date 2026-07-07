import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
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
      className="mb-4 rounded-none border-x-0 border-y border-l-4 md:border md:border-l-4 md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] shadow-sm relative"
      style={{
        borderTopColor: "var(--habit-border)",
        borderRightColor: "var(--habit-border)",
        borderBottomColor: "var(--habit-border)",
        borderLeftColor: "var(--habit-purple)"
      }}
    >
      {/* Background radial gradient emanating from the left */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 10% 50%, var(--habit-purple) 0%, transparent 60%)",
          opacity: 0.08
        }}
      />
      
      <div className="p-6 md:p-8 flex flex-row items-center gap-5 md:gap-6 relative z-10">
        {/* Icon */}
        <div className="shrink-0 flex items-center justify-center">
          <ScrollText 
            size={38} 
            style={{ 
              color: "var(--habit-purple)", 
              filter: "drop-shadow(0 0 6px rgba(var(--habit-purple-rgb, 123, 97, 255), 0.4))" 
            }} 
            className="opacity-90" 
          />
        </div>
        
        {/* Quote & Reference */}
        <div className="flex flex-col relative z-10">
          <span 
            className="italic text-base md:text-lg mb-2 relative leading-relaxed" 
            style={{ color: "var(--habit-text)", fontFamily: "'Nunito', sans-serif" }}
          >
            "{quote.text}"
          </span>
          <span 
            className="text-xs font-bold uppercase tracking-[0.15em] mt-1 flex items-center gap-1.5" 
            style={{ color: "var(--habit-text)", opacity: 0.8 }}
          >
            <span style={{ color: "var(--habit-purple)", opacity: 0.8 }}>—</span> {quote.ref}
          </span>
        </div>
        
        {/* Decorative huge quotation mark */}
        <div 
          className="absolute -right-2 -top-4 select-none pointer-events-none"
          style={{ 
            color: "var(--habit-purple)", 
            opacity: 0.15, 
            fontFamily: "serif",
            fontSize: "120px",
            lineHeight: 1
          }}
        >
          ❝
        </div>
      </div>
    </motion.div>
  );
}
