import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * MasteryBrainChart
 * Replaces the pentagon radar chart with an interactive 5-lobe SVG Brain visualization.
 * 
 * Category <-> Brain Lobe mapping:
 * - sciences   : Frontal Lobe (Top-Left / Front)
 * - body       : Parietal Lobe (Top-Right / Crown)
 * - languages  : Temporal Lobe (Center / Middle)
 * - spirit     : Occipital Lobe (Back-Right / Posterior)
 * - humanities : Cerebellum (Bottom / Lower)
 */

// Define SVG path shapes for the 5 brain lobes (viewBox 0 0 500 360)
const LOBE_PATHS = {
  sciences: {
    // Frontal lobe (Top-Left / Front)
    d: "M 130 185 C 100 170 75 140 85 105 C 95 65 140 45 195 45 C 235 45 255 60 260 95 C 265 125 240 155 200 175 C 175 185 150 190 130 185 Z",
    labelPos: { x: 165, y: 110 },
    wrinkles: [
      "M 110 115 C 130 100 160 120 185 95",
      "M 135 75 C 160 65 195 80 220 65",
      "M 160 145 C 185 130 215 145 235 120",
    ]
  },
  body: {
    // Parietal lobe (Top-Right / Crown)
    d: "M 260 95 C 255 60 280 45 320 48 C 365 52 400 75 405 115 C 410 145 390 175 350 180 C 310 185 270 160 260 125 Z",
    labelPos: { x: 335, y: 110 },
    wrinkles: [
      "M 285 75 C 310 65 345 85 375 70",
      "M 280 120 C 310 105 350 130 380 115",
      "M 300 155 C 330 145 365 160 385 150",
    ]
  },
  languages: {
    // Temporal lobe (Center / Middle)
    d: "M 130 185 C 150 190 175 185 200 175 C 240 155 265 125 260 95 C 270 160 310 185 350 180 C 335 210 295 235 245 235 C 190 235 150 215 130 185 Z",
    labelPos: { x: 235, y: 195 },
    wrinkles: [
      "M 155 195 C 185 210 225 200 265 215",
      "M 185 180 C 215 170 255 185 290 175",
      "M 225 225 C 255 220 285 225 315 210",
    ]
  },
  spirit: {
    // Occipital lobe (Back-Right / Posterior)
    d: "M 350 180 C 390 175 410 145 405 115 C 425 135 435 170 425 200 C 415 230 380 245 340 240 C 335 210 350 180 350 180 Z",
    labelPos: { x: 385, y: 185 },
    wrinkles: [
      "M 365 150 C 385 160 410 155 420 175",
      "M 360 190 C 380 195 405 190 415 210",
    ]
  },
  humanities: {
    // Cerebellum (Bottom / Lower)
    d: "M 245 235 C 295 235 335 210 340 240 C 345 270 325 300 280 305 C 235 310 210 285 220 255 C 228 242 236 237 245 235 Z",
    labelPos: { x: 280, y: 275 },
    wrinkles: [
      "M 240 260 C 265 255 295 260 320 255",
      "M 235 280 C 260 275 290 280 310 275",
      "M 250 295 C 270 292 290 295 300 290",
    ]
  }
};

export default function MasteryBrainChart({
  subjectStats = [],
  height = "250px",
  className = ""
}) {
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Map category stats into convenient object lookup
  const statsMap = React.useMemo(() => {
    const map = {};
    subjectStats.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [subjectStats]);

  // Find category with highest progress for highlight effect
  const highestCatId = React.useMemo(() => {
    if (!subjectStats.length) return null;
    let max = -1;
    let maxId = null;
    subjectStats.forEach((cat) => {
      const p = cat.pct || 0;
      if (p > max) {
        max = p;
        maxId = cat.id;
      }
    });
    return maxId;
  }, [subjectStats]);

  return (
    <div className={`relative w-full flex items-center justify-center select-none ${className}`} style={{ height }}>
      {/* Ambient background glow (Dark Fantasy theme) */}
      <div 
        className="absolute inset-0 pointer-events-none rounded-full blur-3xl opacity-20 transition-all duration-700"
        style={{
          background: hoveredCategory && statsMap[hoveredCategory]
            ? `radial-gradient(circle, ${statsMap[hoveredCategory].color} 0%, transparent 70%)`
            : "radial-gradient(circle, rgba(147, 51, 234, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 80%)"
        }}
      />

      <svg
        viewBox="50 30 400 300"
        className="w-full h-full max-h-full overflow-visible drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Dynamic glow filters for each category */}
          {Object.keys(LOBE_PATHS).map((catId) => {
            const cat = statsMap[catId];
            const color = cat?.color || "#3b82f6";
            return (
              <filter key={`glow-${catId}`} id={`brain-glow-${catId}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                  <feFuncA type="linear" slope="0.8" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>

        {/* Render 5 Brain Lobes */}
        {Object.entries(LOBE_PATHS).map(([catId, lobe]) => {
          const cat = statsMap[catId] || {
            id: catId,
            label: catId.toUpperCase(),
            color: "#6b7280",
            pct: 0
          };

          const pct = Math.max(0, cat.pct || 0);
          const isHovered = hoveredCategory === catId;
          const isHighest = highestCatId === catId && pct > 0;
          
          // Color calculations
          const baseGray = "#252632";
          const activeColor = cat.color || "#3b82f6";
          
          // Opacity & Fill setup
          // Even at 0%, keep a subtle dark outline and faint gray body so the brain shape is always visible
          const fillOpacity = pct > 0 ? Math.min(0.9, 0.25 + (pct / 100) * 0.65) : 0.15;
          const strokeOpacity = pct > 0 ? 0.9 : 0.35;
          const strokeColor = pct > 0 ? activeColor : "#4b5563";
          const fillColor = pct > 0 ? activeColor : baseGray;

          return (
            <g
              key={catId}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setHoveredCategory(catId)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() => setHoveredCategory(prev => prev === catId ? null : catId)}
            >
              {/* Lobe main path */}
              <motion.path
                d={lobe.d}
                fill={fillColor}
                fillOpacity={isHovered ? Math.min(1, fillOpacity + 0.2) : fillOpacity}
                stroke={strokeColor}
                strokeWidth={isHovered || isHighest ? 2.5 : 1.5}
                strokeOpacity={strokeOpacity}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  filter: isHovered || isHighest ? `url(#brain-glow-${catId})` : undefined,
                  transition: "fill 0.5s ease, stroke 0.5s ease, fill-opacity 0.5s ease",
                }}
                animate={{
                  scale: isHovered ? 1.03 : 1,
                }}
                transition={{ duration: 0.2 }}
              />

              {/* Decorative inner brain wrinkles/folds */}
              {lobe.wrinkles.map((wD, idx) => (
                <path
                  key={idx}
                  d={wD}
                  fill="none"
                  stroke={pct > 0 ? activeColor : "#6b7280"}
                  strokeWidth="1.2"
                  strokeOpacity={pct > 0 ? 0.35 : 0.15}
                  strokeLinecap="round"
                  className="pointer-events-none"
                />
              ))}

              {/* Category indicator label on lobe */}
              <g transform={`translate(${lobe.labelPos.x}, ${lobe.labelPos.y})`} className="pointer-events-none">
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={pct > 0 ? activeColor : "#9ca3af"}
                  fontSize="11"
                  fontFamily="'PixeloidSans', monospace"
                  fontWeight={isHovered ? "bold" : "normal"}
                  className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                >
                  {cat.label}
                </text>
                <text
                  y="13"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={pct > 0 ? "#ffffff" : "#6b7280"}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  opacity={pct > 0 || isHovered ? 1 : 0.6}
                >
                  {pct.toFixed(1)}%
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip detail on Hover / Tap */}
      <AnimatePresence>
        {hoveredCategory && statsMap[hoveredCategory] && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg border border-border/80 bg-background/95 backdrop-blur-md shadow-xl text-center pointer-events-none z-20 flex items-center gap-2 font-mono text-xs"
          >
            <span>{statsMap[hoveredCategory].icon}</span>
            <span className="font-bold" style={{ color: statsMap[hoveredCategory].color }}>
              {statsMap[hoveredCategory].label}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-foreground font-semibold">
              now {statsMap[hoveredCategory].pct?.toFixed(1)}%
            </span>
            {statsMap[hoveredCategory].pct30d != null && (
              <span className="text-muted-foreground/70 text-[10px]">
                (+30d: <span style={{ color: statsMap[hoveredCategory].color }}>{statsMap[hoveredCategory].pct30d.toFixed(1)}%</span>)
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
