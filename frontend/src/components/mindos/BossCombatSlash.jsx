// @ts-nocheck
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Cinematic Vector Combat Slash
 * Renders high-intensity blade trails and impact spark bursts across the boss sprite
 */
export default function BossCombatSlash({ trigger, isCritical = false, color = "#22c55e" }) {
  if (!trigger) return null;

  const slashColor = isCritical ? "#00e5ff" : color;
  const secondaryColor = isCritical ? "#f0c040" : "#ffffff";

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible flex items-center justify-center">
      {/* Primary Slash Arc */}
      <motion.svg
        className="absolute w-[280px] h-[280px] overflow-visible"
        viewBox="0 0 200 200"
        initial={{ opacity: 0, scale: 0.7, rotate: isCritical ? -15 : -35 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.7, 1.25, 1.3],
          rotate: isCritical ? [0, 45] : [-35, 15],
        }}
        transition={{ duration: isCritical ? 0.55 : 0.4, ease: "easeOut" }}
      >
        <defs>
          <linearGradient id={`slashGrad-${trigger}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={secondaryColor} stopOpacity="0" />
            <stop offset="35%" stopColor={secondaryColor} stopOpacity="1" />
            <stop offset="70%" stopColor={slashColor} stopOpacity="1" />
            <stop offset="100%" stopColor={slashColor} stopOpacity="0" />
          </linearGradient>
          <filter id={`slashGlow-${trigger}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isCritical ? "4" : "2.5"} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer glowing trail */}
        <motion.path
          d="M 15 35 Q 100 100 185 165"
          fill="none"
          stroke={`url(#slashGrad-${trigger})`}
          strokeWidth={isCritical ? "12" : "7"}
          strokeLinecap="round"
          filter={`url(#slashGlow-${trigger})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />

        {/* Sharp core blade line */}
        <motion.path
          d="M 15 35 Q 100 100 185 165"
          fill="none"
          stroke="#ffffff"
          strokeWidth={isCritical ? "3.5" : "2"}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />

        {/* Secondary Cross-Slash for Critical Strikes (X-Cut) */}
        {isCritical && (
          <>
            <motion.path
              d="M 185 35 Q 100 100 15 165"
              fill="none"
              stroke={`url(#slashGrad-${trigger})`}
              strokeWidth="10"
              strokeLinecap="round"
              filter={`url(#slashGlow-${trigger})`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.28, delay: 0.08, ease: "easeOut" }}
            />
            <motion.path
              d="M 185 35 Q 100 100 15 165"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.22, delay: 0.08, ease: "easeOut" }}
            />
          </>
        )}
      </motion.svg>

      {/* Central Impact Burst Spark */}
      <motion.div
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: isCritical ? 2.6 : 1.8, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="absolute w-24 h-24 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, #ffffff 0%, ${slashColor} 45%, transparent 75%)`,
          boxShadow: `0 0 35px ${slashColor}`,
        }}
      />

      {/* Kinetic Slash Particles */}
      {Array.from({ length: isCritical ? 14 : 8 }).map((_, i) => {
        const angle = (i * (360 / (isCritical ? 14 : 8)) * Math.PI) / 180;
        const dist = 35 + (i % 3) * 25;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: tx, y: ty, scale: 0, opacity: 0 }}
            transition={{ duration: 0.38 + (i % 3) * 0.08, ease: "easeOut" }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: i % 2 === 0 ? 5 : 3,
              height: i % 2 === 0 ? 5 : 3,
              backgroundColor: i % 2 === 0 ? '#ffffff' : slashColor,
              boxShadow: `0 0 8px ${slashColor}`,
            }}
          />
        );
      })}
    </div>
  );
}
