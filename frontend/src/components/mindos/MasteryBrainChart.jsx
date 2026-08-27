// @ts-nocheck
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

/**
 * MasteryBrainChart
 * Next-Level Cyber-Arcane 5-Lobe Neural Mastery Cortex.
 * 
 * Features:
 * - Luminous 5-zone anatomical lobes with vibrant tinted neon base (visible & gorgeous even at 0%)
 * - Animated synaptic neural circuit tracks connecting all 5 cognitive hubs
 * - Wave-distorted laser-plasma energy fill (<clipPath> + glowing wavefront line)
 * - Glassmorphic HUD chips with category icons, pixel typography and live percentage
 * - Interactive synaptic burst and pulse on hover
 */

const LOBE_PATHS = {
  "sciences": {
    "icon": "🔬",
    "d": "M 116.0 241.6 L 90.4 241.6 L 57.4 236.4 L 29.8 220.8 L 21.8 211.9 L 18.6 199.5 L 9.0 181.8 L 6.9 166.2 L 13.3 151.7 L 17.6 121.6 L 29.3 107.0 L 33.5 97.7 L 46.3 86.2 L 58.5 70.1 L 70.2 61.8 L 80.9 59.7 L 97.9 44.2 L 110.6 44.2 L 123.4 33.8 L 143.6 28.6 L 164.9 17.1 L 183.0 15.1 L 197.9 8.8 L 236.2 10.9 L 263.8 6.8 L 270.2 6.8 L 276.6 10.9 L 288.3 11.9 L 296.8 16.1 L 310.6 17.1 L 314.4 20.8 L 321.8 58.2 L 319.1 63.9 L 290.4 76.4 L 281.4 86.2 L 281.4 95.6 L 288.8 108.1 L 288.8 113.2 L 278.2 120.5 L 277.1 130.9 L 289.9 152.7 L 289.9 160.0 L 282.4 175.6 L 274.5 183.4 L 255.3 182.3 L 248.9 185.5 L 243.6 185.5 L 225.5 176.1 L 207.4 177.1 L 195.7 183.4 L 184.0 195.8 L 158.5 202.1 L 143.1 221.3 L 137.2 238.4 L 116.0 241.6 Z",
    "labelPos": { "x": 175.5, "y": 121.0 },
    "yMin": 6.8,
    "yMax": 241.6,
    "height": 234.8,
    "gradColors": ["#1d4ed8", "#3b82f6", "#60a5fa"],
    "glowColor": "rgba(59, 130, 246, 0.6)",
    "wrinkles": [
      "M 148.4 213.0 L 149.5 210.9 L 145.2 210.4 L 144.1 213.5 L 148.4 213.0",
      "M 152.7 205.7 L 150.5 204.7 L 150.0 206.8 L 152.7 205.7",
      "M 296.8 174.6 L 295.7 172.5 L 296.8 174.6",
      "M 264.9 174.6 L 263.8 172.5 L 264.9 174.6",
      "M 132.4 172.5 L 129.8 168.8 L 127.1 168.8 L 129.8 168.3 L 132.4 172.5",
      "M 137.2 168.8 L 135.1 168.8 L 136.2 166.2 L 137.2 168.8",
      "M 139.9 162.6 L 138.8 160.0 L 139.9 162.6",
      "M 290.4 153.2 L 288.3 148.0 L 290.4 153.2",
      "M 148.4 151.7 L 147.3 146.5 L 148.4 151.7",
      "M 259.6 142.3 L 257.4 139.2 L 256.4 139.7 L 259.6 142.3",
      "M 170.7 141.3 L 169.1 137.1 L 170.7 141.3",
      "M 288.3 133.0 L 287.2 127.8 L 288.3 133.0"
    ]
  },
  "body": {
    "icon": "💪",
    "d": "M 401.1 195.8 L 390.4 194.8 L 386.7 183.9 L 383.0 180.3 L 353.2 179.2 L 330.9 165.7 L 318.1 165.7 L 281.4 176.6 L 289.9 160.0 L 288.8 149.6 L 277.1 130.9 L 278.2 120.5 L 288.8 112.2 L 281.4 95.6 L 281.4 86.2 L 290.4 76.4 L 319.7 63.4 L 321.8 55.1 L 315.4 32.2 L 316.0 24.4 L 329.8 27.5 L 345.7 40.0 L 360.6 41.0 L 373.4 48.3 L 379.8 55.6 L 393.6 58.7 L 404.3 71.2 L 417.0 73.2 L 423.9 81.0 L 430.3 94.5 L 439.4 98.2 L 456.9 119.5 L 458.0 128.8 L 465.4 139.2 L 465.4 144.4 L 458.0 156.9 L 447.3 167.3 L 431.9 189.6 L 424.5 193.8 L 401.1 195.8 Z",
    "labelPos": { "x": 366.3, "y": 117.3 },
    "yMin": 24.4,
    "yMax": 195.8,
    "height": 171.4,
    "gradColors": ["#c2410c", "#ff4400", "#fb923c"],
    "glowColor": "rgba(255, 68, 0, 0.6)",
    "wrinkles": [
      "M 423.4 170.9 L 420.7 170.4 L 420.7 167.3 L 430.3 151.7 L 433.5 140.3 L 433.5 127.8 L 436.2 127.3 L 434.6 146.5 L 423.4 170.9",
      "M 422.3 109.6 L 420.7 109.1 L 419.7 102.9 L 414.4 97.7 L 411.2 88.3 L 405.9 83.1 L 407.4 81.6 L 413.3 86.2 L 416.5 95.6 L 420.7 99.7 L 422.3 109.6",
      "M 353.2 106.5 L 347.9 101.3 L 341.0 102.9 L 339.4 85.7 L 342.0 87.3 L 343.6 100.3 L 348.9 99.2 L 353.2 104.4 L 358.5 101.3 L 362.2 101.8 L 353.2 106.5",
      "M 401.1 169.9 L 399.0 169.3 L 398.4 167.8 L 401.1 169.9",
      "M 374.5 169.3 L 373.4 167.3 L 374.5 169.3",
      "M 390.4 166.8 L 388.3 164.7 L 390.4 166.8",
      "M 329.8 165.7 L 328.7 163.6 L 329.8 165.7",
      "M 364.9 164.7 L 362.8 162.6 L 364.9 164.7",
      "M 358.5 164.7 L 356.4 162.6 L 358.5 164.7",
      "M 400.0 163.6 L 397.9 161.6 L 400.0 163.6",
      "M 387.8 163.6 L 386.7 161.6 L 387.8 163.6",
      "M 384.6 163.6 L 382.5 161.6 L 384.6 163.6"
    ]
  },
  "languages": {
    "icon": "🌐",
    "d": "M 212.8 330.9 L 201.1 329.9 L 193.6 326.8 L 187.2 320.5 L 160.6 316.4 L 142.6 308.1 L 132.4 291.9 L 119.7 279.5 L 115.4 258.7 L 120.7 245.2 L 116.5 241.0 L 137.2 238.4 L 143.1 221.3 L 158.5 202.1 L 184.0 195.8 L 195.7 183.4 L 210.6 176.1 L 229.8 177.1 L 243.6 185.5 L 255.3 182.3 L 268.1 184.4 L 295.7 171.9 L 318.1 165.7 L 334.0 166.8 L 353.2 179.2 L 385.1 180.3 L 387.8 190.1 L 392.6 195.8 L 415.4 195.3 L 405.3 196.9 L 392.6 212.5 L 376.6 219.7 L 373.9 223.4 L 377.1 233.8 L 380.9 236.4 L 396.8 236.4 L 404.3 240.5 L 416.0 241.6 L 420.7 245.2 L 421.8 253.5 L 418.6 264.9 L 406.4 283.1 L 370.2 302.9 L 330.9 310.1 L 318.1 317.4 L 264.9 321.6 L 236.2 328.8 L 212.8 330.9 Z",
    "labelPos": { "x": 284.5, "y": 239.9 },
    "yMin": 165.7,
    "yMax": 330.9,
    "height": 165.2,
    "gradColors": ["#047857", "#00cc88", "#34d399"],
    "glowColor": "rgba(0, 204, 136, 0.6)",
    "wrinkles": [
      "M 186.2 245.7 L 186.7 237.9 L 173.4 230.1 L 172.3 227.0 L 181.9 233.2 L 194.1 235.8 L 187.8 236.9 L 187.8 244.2 L 186.2 245.7",
      "M 222.3 224.9 L 218.1 220.8 L 212.2 222.3 L 218.1 216.6 L 222.3 224.9",
      "M 186.2 205.2 L 185.1 200.0 L 186.2 205.2",
      "M 309.6 241.6 L 308.5 234.3 L 310.1 235.8 L 309.6 241.6",
      "M 303.2 236.4 L 300.5 234.8 L 301.1 233.2 L 303.2 236.4",
      "M 234.0 228.1 L 229.8 228.1 L 229.3 226.5 L 234.0 228.1",
      "M 302.1 191.7 L 304.3 186.5 L 302.1 191.7",
      "M 339.4 188.6 L 338.3 186.5 L 339.4 188.6",
      "M 222.3 325.7 L 221.3 323.6 L 222.3 325.7",
      "M 264.9 318.4 L 263.8 316.4 L 264.9 318.4",
      "M 252.1 318.4 L 251.1 316.4 L 252.1 318.4",
      "M 248.9 318.4 L 247.9 316.4 L 248.9 318.4"
    ]
  },
  "spirit": {
    "icon": "✨",
    "d": "M 440.4 306.0 L 434.0 306.0 L 412.8 297.7 L 403.2 299.7 L 400.0 296.6 L 387.8 293.0 L 411.2 278.4 L 419.7 261.8 L 421.8 247.3 L 416.0 241.6 L 404.3 240.5 L 396.8 236.4 L 379.8 236.4 L 375.0 229.6 L 373.9 222.3 L 392.6 212.5 L 401.6 203.6 L 403.2 196.9 L 425.5 194.8 L 434.0 189.6 L 467.0 143.9 L 470.7 154.8 L 470.7 167.3 L 477.1 172.5 L 484.6 210.9 L 491.0 224.4 L 488.8 242.1 L 492.0 248.3 L 492.0 263.9 L 488.8 275.3 L 479.8 289.4 L 459.6 300.8 L 440.4 306.0 Z",
    "labelPos": { "x": 436.1, "y": 237.5 },
    "yMin": 143.9,
    "yMax": 308.1,
    "height": 164.2,
    "gradColors": ["#6d28d9", "#9944ff", "#c084fc"],
    "glowColor": "rgba(153, 68, 255, 0.6)",
    "wrinkles": [
      "M 403.2 238.4 L 402.7 236.9 L 406.9 232.7 L 406.9 224.4 L 402.7 222.3 L 407.4 222.9 L 411.7 218.7 L 409.0 223.4 L 409.0 231.7 L 403.2 238.4",
      "M 468.1 249.9 L 466.5 248.3 L 469.7 246.2 L 474.5 234.3 L 476.1 235.8 L 473.9 242.1 L 468.1 249.9",
      "M 467.0 194.8 L 466.0 179.2 L 468.6 187.0 L 467.0 194.8",
      "M 458.5 195.8 L 455.9 194.3 L 452.1 183.4 L 458.5 195.8",
      "M 411.7 240.5 L 410.1 240.0 L 411.7 238.4 L 415.4 237.9 L 411.7 240.5",
      "M 478.7 234.3 L 478.7 230.1 L 480.3 232.7 L 478.7 234.3",
      "M 481.9 216.6 L 480.3 216.1 L 481.9 212.5 L 481.9 216.6",
      "M 443.6 216.6 L 443.6 212.5 L 443.6 216.6",
      "M 484.6 295.1 L 483.5 293.0 L 484.6 295.1",
      "M 472.9 294.0 L 471.8 292.0 L 472.9 294.0",
      "M 460.1 294.0 L 459.0 292.0 L 460.1 294.0",
      "M 470.7 293.0 L 469.7 290.9 L 470.7 293.0"
    ]
  },
  "humanities": {
    "icon": "📚",
    "d": "M 374.5 395.3 L 347.9 392.2 L 323.4 377.7 L 309.6 377.7 L 297.9 382.9 L 284.0 379.7 L 273.9 370.9 L 266.5 359.5 L 262.2 338.7 L 255.9 324.2 L 283.0 319.5 L 316.0 318.4 L 331.9 310.1 L 370.2 302.9 L 387.2 292.5 L 395.7 296.6 L 421.3 299.7 L 434.0 306.0 L 445.7 304.9 L 441.0 309.6 L 444.1 319.0 L 443.1 329.4 L 432.4 356.4 L 418.1 364.2 L 401.1 380.8 L 391.5 384.9 L 384.0 392.2 L 374.5 395.3 Z",
    "labelPos": { "x": 356.3, "y": 346.3 },
    "yMin": 292.5,
    "yMax": 399.0,
    "height": 106.5,
    "gradColors": ["#b45309", "#f0c040", "#fde047"],
    "glowColor": "rgba(240, 192, 64, 0.6)",
    "wrinkles": [
      "M 374.5 391.2 L 373.4 389.1 L 374.5 391.2",
      "M 347.9 388.0 L 346.8 386.0 L 347.9 388.0",
      "M 378.7 387.0 L 377.7 384.9 L 378.7 387.0",
      "M 364.9 387.0 L 363.8 384.9 L 364.9 387.0",
      "M 388.3 381.8 L 387.2 379.7 L 388.3 381.8",
      "M 397.9 377.7 L 396.8 375.6 L 397.9 377.7",
      "M 297.9 377.7 L 296.8 375.6 L 297.9 377.7",
      "M 284.0 374.5 L 283.0 372.5 L 284.0 374.5",
      "M 411.7 371.4 L 410.6 369.4 L 411.7 371.4",
      "M 273.9 366.2 L 272.9 364.2 L 273.9 366.2",
      "M 423.4 360.0 L 422.3 358.0 L 423.4 360.0",
      "M 427.7 354.8 L 426.6 352.7 L 427.7 354.8"
    ]
  }
};

// Synaptic Tracks connecting the cognitive hubs
const SYNAPTIC_CONNECTIONS = [
  { from: "sciences", to: "body", d: "M 175.5 121.0 Q 270 90 366.3 117.3" },
  { from: "sciences", to: "languages", d: "M 175.5 121.0 Q 220 190 284.5 239.9" },
  { from: "body", to: "languages", d: "M 366.3 117.3 Q 320 180 284.5 239.9" },
  { from: "body", to: "spirit", d: "M 366.3 117.3 Q 410 170 436.1 237.5" },
  { from: "languages", to: "spirit", d: "M 284.5 239.9 Q 360 230 436.1 237.5" },
  { from: "languages", to: "humanities", d: "M 284.5 239.9 Q 310 300 356.3 346.3" },
  { from: "spirit", to: "humanities", d: "M 436.1 237.5 Q 410 300 356.3 346.3" },
];

export default function MasteryBrainChart({
  subjectStats = [],
  height = "290px",
  className = ""
}) {
  const { t } = useTranslation();
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const statsMap = useMemo(() => {
    const map = {};
    subjectStats.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [subjectStats]);

  const highestCatId = useMemo(() => {
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
    <div className={`relative w-full max-w-[460px] mx-auto flex items-center justify-center select-none py-1 ${className}`} style={{ minHeight: height }}>
      {/* Background ambient radial glow matching MIND OS hero cards */}
      <div 
        className="absolute inset-0 pointer-events-none rounded-3xl blur-3xl opacity-30 transition-all duration-700"
        style={{
          background: hoveredCategory && statsMap[hoveredCategory]
            ? `radial-gradient(circle at 50% 50%, ${statsMap[hoveredCategory].color}55 0%, transparent 70%)`
            : "radial-gradient(circle at 50% 50%, rgba(147, 51, 234, 0.4) 0%, rgba(59, 130, 246, 0.25) 45%, rgba(0, 204, 136, 0.15) 75%, transparent 90%)"
        }}
      />

      <svg
        viewBox="0 0 500 415"
        className="w-full max-w-[440px] h-auto max-h-[290px] overflow-visible drop-shadow-[0_8px_32px_rgba(0,0,0,0.85)] mx-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glass specular overlay gradient */}
          <linearGradient id="brain-glass-specular" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          {/* Gradients & Filters for Each Lobe */}
          {Object.entries(LOBE_PATHS).map(([catId, lobe]) => {
            const cat = statsMap[catId];
            const pct = Math.max(0, Math.min(100, cat?.pct || 0));
            const fillHeight = (pct / 100.0) * lobe.height;
            const liquidY = lobe.yMax - fillHeight;

            return (
              <React.Fragment key={`defs-${catId}`}>
                {/* 1. Base Ambient Lobe Tint Gradient (Visible even at 0%) */}
                <radialGradient id={`base-tint-${catId}`} cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor={lobe.gradColors[1]} stopOpacity="0.32" />
                  <stop offset="70%" stopColor={lobe.gradColors[0]} stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#0a0512" stopOpacity="0.85" />
                </radialGradient>

                {/* 2. Plasma Liquid Fill Gradient */}
                <linearGradient id={`plasma-grad-${catId}`} x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor={lobe.gradColors[0]} stopOpacity="0.95" />
                  <stop offset="60%" stopColor={lobe.gradColors[1]} stopOpacity="0.92" />
                  <stop offset="100%" stopColor={lobe.gradColors[2]} stopOpacity="1.0" />
                </linearGradient>

                {/* 3. Liquid ClipPath */}
                <clipPath id={`clip-liquid-${catId}`}>
                  <motion.rect
                    x="0"
                    width="500"
                    initial={{ y: lobe.yMax, height: 0 }}
                    animate={{ y: liquidY - 2, height: fillHeight + 5 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </clipPath>

                {/* 4. Ambient Glow Filters */}
                <filter id={`brain-glow-${catId}`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feComponentTransfer in="blur" result="glow">
                    <feFuncA type="linear" slope="0.9" />
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </React.Fragment>
            );
          })}
        </defs>

        {/* ⚡ Synaptic Circuit Pathway Background Network */}
        <g className="pointer-events-none opacity-40">
          {SYNAPTIC_CONNECTIONS.map((conn, idx) => (
            <g key={`synapse-${idx}`}>
              {/* Circuit track */}
              <path
                d={conn.d}
                fill="none"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1.5"
                strokeDasharray="3 4"
              />
              {/* Traveling Synaptic Energy Sparks */}
              <motion.path
                d={conn.d}
                fill="none"
                stroke="url(#brain-glass-specular)"
                strokeWidth="2"
                strokeDasharray="10 60"
                animate={{ strokeDashoffset: [0, -70] }}
                transition={{ repeat: Infinity, duration: 3 + idx * 0.4, ease: "linear" }}
              />
            </g>
          ))}
        </g>

        {/* 🧠 Render 5 Anatomical Brain Lobes */}
        {Object.entries(LOBE_PATHS).map(([catId, lobe]) => {
          const cat = statsMap[catId] || {
            id: catId,
            label: catId.toUpperCase(),
            color: lobe.gradColors[1],
            pct: 0
          };

          const pct = Math.max(0, cat.pct || 0);
          const isHovered = hoveredCategory === catId;
          const isHighest = highestCatId === catId && pct > 0;
          const activeColor = cat.color || lobe.gradColors[1];
          const fillHeight = (pct / 100.0) * lobe.height;
          const liquidY = lobe.yMax - fillHeight;

          return (
            <g
              key={catId}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setHoveredCategory(catId)}
              onMouseLeave={() => setHoveredCategory(null)}
              onClick={() => setHoveredCategory(prev => prev === catId ? null : catId)}
            >
              {/* 1. Base Lobe Background Fill with Vibrant Neon Tint */}
              <path
                d={lobe.d}
                fill={`url(#base-tint-${catId})`}
                stroke={activeColor}
                strokeWidth={isHovered ? 2.5 : isHighest ? 2.0 : 1.6}
                strokeOpacity={isHovered ? 1.0 : pct > 0 ? 0.85 : 0.55}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  filter: isHovered ? `drop-shadow(0 0 14px ${activeColor})` : undefined,
                  transition: "stroke-width 0.3s, stroke-opacity 0.3s"
                }}
              />

              {/* 2. Precision Crisp Plasma Fill (<clipPath>) */}
              <motion.path
                d={lobe.d}
                fill={`url(#plasma-grad-${catId})`}
                fillOpacity={isHovered ? 0.95 : 0.85}
                clipPath={`url(#clip-liquid-${catId})`}
                stroke="none"
                style={{
                  filter: `url(#brain-glow-${catId})`,
                  transition: "fill 0.4s ease, fill-opacity 0.4s ease",
                }}
                animate={{
                  scale: isHovered ? 1.02 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />

              {/* 3. Plasma Wavefront / Energy Laser Line at the Liquid Surface */}
              {pct > 1 && pct < 99 && (
                <motion.line
                  x1="0"
                  y1={liquidY}
                  x2="500"
                  y2={liquidY}
                  clipPath={`url(#clip-liquid-${catId})`}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeOpacity="0.9"
                  style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
                  animate={{
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}

              {/* 4. Outer Highlight Stroke on Hover */}
              {isHovered && (
                <motion.path
                  d={lobe.d}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="3.0"
                  strokeOpacity="1.0"
                  style={{ filter: `drop-shadow(0 0 12px ${activeColor})` }}
                  animate={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              )}

              {/* 5. Luminous Sulci & Gyri (Brain Wrinkles) */}
              {lobe.wrinkles.map((wD, idx) => (
                <path
                  key={idx}
                  d={wD}
                  fill="none"
                  stroke={pct > 0 ? "#ffffff" : activeColor}
                  strokeWidth="1.6"
                  strokeOpacity={pct > 0 ? 0.65 : 0.45}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                  style={{
                    filter: pct > 0 ? `drop-shadow(0 0 3px ${activeColor})` : undefined
                  }}
                />
              ))}

              {/* 6. Neural Synaptic Hub Crystal (Node at Center) */}
              <g transform={`translate(${lobe.labelPos.x}, ${lobe.labelPos.y - 18})`} className="pointer-events-none">
                <circle
                  r="5"
                  fill={activeColor}
                  fillOpacity="0.9"
                  style={{ filter: `drop-shadow(0 0 8px ${activeColor})` }}
                />
                <circle
                  r="9"
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="1"
                  strokeOpacity="0.6"
                  className="animate-pulse"
                />
              </g>

              {/* 7. Glassmorphic HUD Label Chip */}
              <g transform={`translate(${lobe.labelPos.x}, ${lobe.labelPos.y + 4})`} className="pointer-events-none">
                {/* Backdrop Glass Capsule */}
                <rect
                  x="-46"
                  y="-12"
                  width="92"
                  height="28"
                  rx="8"
                  fill="var(--habit-brain-chip-bg, #080410)"
                  fillOpacity="0.92"
                  stroke={activeColor}
                  strokeWidth={isHovered ? "1.8" : "1.2"}
                  strokeOpacity={isHovered ? "1.0" : "0.75"}
                  style={{
                    filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.3)) ${isHovered ? `drop-shadow(0 0 8px ${activeColor}80)` : ""}`
                  }}
                />

                {/* Icon & Label */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={activeColor}
                  fontSize="9.5"
                  fontFamily="'PixeloidSans', monospace"
                  fontWeight="bold"
                  dy="-3"
                >
                  {lobe.icon} {cat.label}
                </text>

                {/* Percentage */}
                <text
                  y="8"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--habit-brain-chip-text, #ffffff)"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  opacity={pct > 0 || isHovered ? 1 : 0.85}
                >
                  {pct.toFixed(1)}%
                </text>
              </g>
            </g>
          );
        })}

        {/* Master Glass Specular Layer */}
        <g className="pointer-events-none opacity-30">
          <path
            d="M 164.9 17.1 L 183.0 15.1 L 197.9 8.8 L 236.2 10.9 L 263.8 6.8 L 270.2 6.8 L 276.6 10.9 L 288.3 11.9 L 296.8 16.1 L 310.6 17.1 L 314.4 20.8 L 321.8 58.2 L 319.1 63.9 L 290.4 76.4 L 281.4 86.2 L 281.4 95.6 Z"
            fill="url(#brain-glass-specular)"
          />
        </g>
      </svg>

      {/* Floating Detail Card on Hover / Tap */}
      <AnimatePresence>
        {hoveredCategory && statsMap[hoveredCategory] && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border bg-black/90 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.9)] text-center pointer-events-none z-20 flex items-center gap-2.5 font-mono text-xs"
            style={{
              borderColor: `${statsMap[hoveredCategory].color}80`,
              boxShadow: `0 0 16px ${statsMap[hoveredCategory].color}35`,
            }}
          >
            <span className="text-base">{LOBE_PATHS[hoveredCategory]?.icon || statsMap[hoveredCategory].icon}</span>
            <span className="font-bold font-pixel text-xs tracking-wider" style={{ color: statsMap[hoveredCategory].color }}>
              {statsMap[hoveredCategory].label}
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-white font-bold">
              {statsMap[hoveredCategory].pct?.toFixed(1)}% {t('projection.mastery', 'Mastery')}
            </span>
            {statsMap[hoveredCategory].pct30d != null && (
              <span className="text-muted-foreground/70 text-[10px]">
                (+30d: <span style={{ color: statsMap[hoveredCategory].color }} className="font-bold">+{statsMap[hoveredCategory].pct30d.toFixed(1)}%</span>)
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

