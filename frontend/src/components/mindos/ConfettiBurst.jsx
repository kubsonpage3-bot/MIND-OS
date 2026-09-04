// @ts-nocheck
﻿import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/**
 * ConfettiBurst — 50 colored particles exploding from center.
 * Props:
 *   active: boolean — triggers animation when true
 *   color: string — primary particle color (hex)
 *   onDone: fn — called when animation ends
 *   count: number — particle count (default 50)
 */
export default function ConfettiBurst({ active, color = "#9444ff", onDone, count = 50, isPixel = false }) {
  const [particles, setParticles] = useState([]);
  const triggered = useRef(false);

  useEffect(() => {
    if (!active || triggered.current) return;
    triggered.current = true;

    const COLORS = isPixel 
      ? [color, "#ffffff", "#fde047", "#4ade80", "#60a5fa", "#e879f9", "#fb923c"]
      : [color, "#ffffff", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"];

    const p = Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: rand(0, 360),
      dist: rand(80, isPixel ? 320 : 260),
      size: isPixel ? [4, 6, 8, 10][Math.floor(Math.random() * 4)] : rand(5, 12),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: rand(0, 0.15),
      rotation: isPixel ? Math.floor(rand(0, 4)) * 90 : rand(-360, 360),
      shape: isPixel ? "pixel" : (Math.random() > 0.5 ? "rect" : "circle"),
    }));

    setParticles(p);

    const timer = setTimeout(() => {
      setParticles([]);
      triggered.current = false;
      onDone?.();
    }, isPixel ? 2400 : 1800);

    return () => clearTimeout(timer);
  }, [active, count, color, isPixel, onDone]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] flex items-center justify-center">
      <AnimatePresence>
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.dist;
          const ty = Math.sin(rad) * p.dist + p.dist * 0.35; // gravity pull down

          return (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
              animate={{
                x: tx,
                y: ty,
                opacity: [1, 1, 0.9, 0],
                scale: isPixel ? [1, 1.2, 1, 0.2] : [1, 1.2, 0.9, 0.4],
                rotate: p.rotation,
              }}
              transition={{
                duration: rand(isPixel ? 1.1 : 0.9, isPixel ? 1.8 : 1.5),
                delay: p.delay,
                ease: isPixel ? "easeOut" : [0.23, 1.05, 0.32, 1],
              }}
              className="absolute pixel-art-crisp"
              style={{
                width: p.shape === "rect" ? p.size * 1.6 : p.size,
                height: p.size,
                borderRadius: p.shape === "circle" ? "50%" : 0,
                background: p.color,
                boxShadow: isPixel 
                  ? `0 0 0 1px rgba(0,0,0,0.6), 0 0 ${p.size * 1.5}px ${p.color}` 
                  : `0 0 ${p.size}px ${p.color}88`,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
