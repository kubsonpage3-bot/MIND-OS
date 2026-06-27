import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CLASS_SPRITES, RANK_CHARACTER_FILTERS } from "@/lib/rpgSystem";
import OptimizedImage from "./OptimizedImage";

// Rank background scenes (pixel-art anime style descriptions → we use CSS + emoji layers)
const RANK_CONFIG = {
  F: {
    label: "PAUPER",
    frameColor: "#7c6a4a",
    frameGlow: "#5a4a30",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/0fafb424e_generated_image.png",
    bgFilter: "brightness(0.75) sepia(0.4)",
    particleColors: ["#a0845c","#c4a060","#e8c080"],
    filterImg: "sepia(0.2) brightness(0.85)",
    ambient: "#7c6a4a",
  },
  D: {
    label: "AWAKENING",
    frameColor: "#8fa8c8",
    frameGlow: "#6080a0",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/e40b7b940_generated_image.png",
    bgFilter: "brightness(1.2)",
    particleColors: ["#8fa8c8","#b0c8e8","#d0e4f8"],
    filterImg: "brightness(0.95)",
    ambient: "#8fa8c8",
  },
  C: {
    label: "GRINDING",
    frameColor: "#c97c3a",
    frameGlow: "#a85f20",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/d7eeb708b_generated_image.png",
    particleColors: ["#d97706","#f59e0b","#fbbf24"],
    filterImg: "none",
    ambient: "#c97c3a",
  },
  B: {
    label: "SHARPENED",
    frameColor: "#16a34a",
    frameGlow: "#15803d",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/21c3691e5_generated_image.png",
    particleColors: ["#22c55e","#4ade80","#86efac"],
    filterImg: "none",
    ambient: "#22c55e",
  },
  A: {
    label: "ELITE",
    frameColor: "#16a34a",
    frameGlow: "#15803d",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/a1200a724_generated_image.png",
    particleColors: ["#22c55e","#4ade80","#a3e635"],
    filterImg: "none",
    ambient: "#22c55e",
  },
  S: {
    label: "APEX",
    frameColor: "#d97706",
    frameGlow: "#b45309",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/3c9b18011_generated_image.png",
    particleColors: ["#f59e0b","#fbbf24","#fcd34d"],
    filterImg: "brightness(1.05)",
    ambient: "#f59e0b",
  },
  SS: {
    label: "SOVEREIGN",
    frameColor: "#b45309",
    frameGlow: "#92400e",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/f72c50f73_generated_image.png",
    particleColors: ["#f59e0b","#fbbf24","#fde68a","#dc8a04"],
    filterImg: "brightness(1.1)",
    ambient: "#d97706",
  },
  SSS: {
    label: "GOD MODE",
    frameColor: "#f0c040",
    frameGlow: "#f59e0b",
    bgImage: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/788bddb7a_generated_image.png",
    particleColors: ["#f0c040","#fbbf24","#fde68a","#ffffff","#f97316"],
    filterImg: "brightness(1.2) saturate(1.2)",
    ambient: "#f0c040",
  },
};

const RANK_SPRITES = {
  F:   { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/993830219_generated_image.png" },
  D:   { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/993830219_generated_image.png" },
  C:   { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/82c35d837_generated_image.png" },
  B:   { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/032923fd3_generated_image.png" },
  A:   { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/c1bdfbb0c_generated_image.png" },
  S:   { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/f6d9c9d1e_generated_image.png" },
  SS:  { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/f6d9c9d1e_generated_image.png" },
  SSS: { url: "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/c5c7fecf4_generated_image.png" },
};

// Pixel art particle that orbits/floats around character
function AmbientParticle({ color, index, total, size }) {
  const angle = (360 / total) * index;
  const radius = size * 0.55 + Math.random() * size * 0.1;
  const duration = 3 + Math.random() * 4;
  const delay = Math.random() * duration;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  const chars = ["■", "▪", "◆", "★", "✦", "▲", "●", "◉"];
  const char = chars[index % chars.length];
  const fontSize = 6 + Math.random() * 6;

  return (
    <motion.span
      className="absolute font-mono select-none pointer-events-none"
      style={{
        color,
        fontSize,
        textShadow: `0 0 6px ${color}`,
        left: "50%",
        top: "50%",
        zIndex: 20,
      }}
      animate={{
        x: [x - 4, x + 4, x - 2, x + 6, x],
        y: [y - 4, y + 4, y + 2, y - 6, y],
        opacity: [0.4, 1, 0.7, 1, 0.4],
        scale: [0.8, 1.2, 0.9, 1.1, 0.8],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {char}
    </motion.span>
  );
}

// Pixel art background using generated image
function PixelBackground({ cfg }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg">
      {/* Lighten dark backgrounds so multiply blend works on character sprite */}
      {cfg.bgLighten && (
        <div className="absolute inset-0 z-10 pointer-events-none"
          style={{ background: cfg.bgLighten, mixBlendMode: "screen" }}
        />
      )}
      <OptimizedImage
        src={cfg.bgImage}
        alt="background"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ imageRendering: "pixelated", filter: cfg.bgFilter || "none" }}
        priority={true}
      />
      {/* Bottom vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 55%)" }}
      />
    </div>
  );
}

export default function PixelCharacter({ rankId, rankColor, size = 140 }) {
  const cfg = RANK_CONFIG[rankId] || RANK_CONFIG["F"];
  const sprite = RANK_SPRITES[rankId] || RANK_SPRITES["F"];

  // Load chosen class from localStorage to pick the right character sprite
  const [chosenClass, setChosenClass] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindos_class") || "{}").chosen || null; } catch { return null; }
  });
  useEffect(() => {
    const check = () => {
      try { setChosenClass(JSON.parse(localStorage.getItem("mindos_class") || "{}").chosen || null); } catch {}
    };
    const interval = setInterval(check, 2000);
    window.addEventListener("storage", check);
    return () => { clearInterval(interval); window.removeEventListener("storage", check); };
  }, []);

  const classSprite = chosenClass ? CLASS_SPRITES[chosenClass] : null;
  const rankFilter = RANK_CHARACTER_FILTERS[rankId] || RANK_CHARACTER_FILTERS["F"];
  const isGod = rankId === "SSS";
  const isSS = rankId === "SS";
  const particleCount = rankId === "F" ? 4 : rankId === "D" ? 6 : rankId === "C" ? 8 : rankId === "B" ? 10 : rankId === "A" ? 12 : rankId === "S" ? 14 : rankId === "SS" ? 16 : 20;

  return (
    <div className="flex flex-col items-center gap-1" style={{ imageRendering: "pixelated" }}>
      <div className="relative" style={{ width: size, height: size }}>

        {/* Pixel scene background */}
        <PixelBackground cfg={cfg} />

        {/* Frame border (rank-colored, pixel style) */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none z-10"
          style={{
            border: `${Math.max(2, size * 0.03)}px solid ${cfg.frameColor}`,
            boxShadow: `0 0 ${size * 0.12}px ${cfg.frameColor}88, inset 0 0 ${size * 0.06}px ${cfg.frameGlow}44`,
          }}
        />

        {/* Corner pixel decorations */}
        {[["top-0 left-0", 0], ["top-0 right-0", 90], ["bottom-0 right-0", 180], ["bottom-0 left-0", 270]].map(([pos, rot]) => (
          <div key={rot} className={`absolute ${pos} z-20 pointer-events-none`}
            style={{ width: size * 0.14, height: size * 0.14, border: `2px solid ${cfg.frameColor}`, opacity: 0.7 }}
          />
        ))}

        {/* SSS/SS extra ring animation */}
        {(isGod || isSS) && (
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none z-10"
            animate={{ opacity: [0.15, 0.5, 0.15], scale: [1, 1.04, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ border: `2px solid ${cfg.frameColor}`, boxShadow: `0 0 24px ${cfg.ambient}` }}
          />
        )}

        {/* Character sprite backing — light circle for contrast against dark backgrounds */}
        <div
          className="absolute inset-0 flex items-center justify-center z-4"
          style={{
            background: `radial-gradient(circle at 50% 55%, ${cfg.frameColor}40 0%, transparent 70%)`,
          }}
        />

        {/* Character sprite: use class sprite with rank filter if class chosen, else fallback */}
        {classSprite ? (
          <motion.div
            key={`${classSprite}-${rankId}`}
            animate={{ y: [0, -4, 0, -2, 0], rotate: [0, 0.6, 0, -0.6, 0], scaleX: [1, 1.01, 1, 0.99, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              padding: "8%",
            }}
          >
            <OptimizedImage
              src={classSprite}
              alt={`${rankId} character`}
              className="w-full h-full object-contain"
              style={{
                imageRendering: "pixelated",
                filter: `${rankFilter} drop-shadow(0 0 4px ${cfg.frameColor}80)`,
              }}
              priority={true}
            />
          </motion.div>
        ) : (
          <OptimizedImage
            src={sprite.url}
            alt={`${rankId} character`}
            width={size}
            height={size}
            className="w-full h-full object-contain"
            style={{
              imageRendering: "pixelated",
              filter: `${cfg.filterImg} drop-shadow(0 0 3px ${cfg.frameColor}60)`,
              position: "absolute",
              inset: 0,
              zIndex: 5,
            }}
            priority={true}
          />
        )}

        {/* Pulsing glow ring behind character */}
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ zIndex: 4, background: `radial-gradient(circle at 50% 60%, ${cfg.ambient}30 0%, transparent 65%)` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Ambient floating particles */}
        {particleCount > 0 && Array.from({ length: particleCount }, (_, i) => (
          <AmbientParticle
            key={i}
            color={cfg.particleColors[i % cfg.particleColors.length]}
            index={i}
            total={particleCount}
            size={size}
          />
        ))}

        {/* God mode golden shimmer sweep */}
        {isGod && (
          <motion.div
            className="absolute inset-0 z-15 pointer-events-none rounded-lg overflow-hidden"
            style={{ zIndex: 15 }}
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
              className="absolute inset-y-0 w-1/3"
              style={{ background: "linear-gradient(90deg, transparent, #fef08a55, #f0c04088, transparent)" }}
            />
          </motion.div>
        )}
      </div>

      {/* Rank label */}
      <div
        className="font-mono text-[9px] tracking-[0.25em] uppercase font-bold px-2 py-0.5 rounded"
        style={{
          color: cfg.frameColor,
          textShadow: `0 0 8px ${cfg.frameColor}`,
          background: `${cfg.frameColor}15`,
          border: `1px solid ${cfg.frameColor}40`,
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {rankId} · {cfg.label}
      </div>
    </div>
  );
}