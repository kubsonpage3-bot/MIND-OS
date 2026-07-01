import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Pixel-art style burst particles — squares, not circles
const CHARS = ["■", "▪", "▫", "◆", "◇", "★", "✦", "▲", "▼"];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export function usePixelBurst() {
  const [bursts, setBursts] = useState([]);

  const trigger = (color = "#f0c040", count = 8) => {
    const id = Date.now();
    const particles = Array.from({ length: count }, (_, i) => ({
      id: i,
      char: CHARS[Math.floor(Math.random() * CHARS.length)],
      angle: (360 / count) * i + randomBetween(-15, 15),
      dist: randomBetween(28, 55),
      size: randomBetween(8, 14),
      delay: randomBetween(0, 0.08),
    }));
    setBursts(prev => [...prev, { id, color, particles }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 900);
  };

  return { bursts, trigger };
}

// Render all active bursts — place this in the parent container (position: relative)
export function PixelBurstLayer({ bursts }) {
  return (
    <AnimatePresence>
      {bursts.map(burst => (
        <div key={burst.id} className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
          {burst.particles.map(p => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist;
            return (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: tx, y: ty, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
                className="absolute font-mono font-black select-none"
                style={{ color: burst.color, fontSize: p.size, imageRendering: "pixelated", lineHeight: 1 }}
              >
                {p.char}
              </motion.span>
            );
          })}
        </div>
      ))}
    </AnimatePresence>
  );
}

// Pixel scanline flash overlay — flashes over any element on trigger
export function PixelFlash({ active, color = "#ffffff" }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${color}22 2px, ${color}22 4px)`,
            mixBlendMode: "screen",
          }}
        />
      )}
    </AnimatePresence>
  );
}