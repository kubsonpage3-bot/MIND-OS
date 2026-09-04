// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import ConfettiBurst from "@/components/mindos/ConfettiBurst";
import { playSound } from "@/lib/soundEffects";
import { RANKS, getRankDisplayData } from "@/lib/rankEngine";
import { Sparkles, ArrowRight, ShieldAlert, Award } from "lucide-react";

// Mapping each rank ID to its generated dark fantasy pixel art banner template
const RANK_BANNERS = {
  E: "/ranks/banner_e.jpg",
  D: "/ranks/banner_d.jpg",
  C: "/ranks/banner_c.jpg",
  B: "/ranks/banner_b.jpg",
  A: "/ranks/banner_a.jpg",
  S: "/ranks/banner_s.jpg",
  SS: "/ranks/banner_ss.jpg",
  SSS: "/ranks/banner_sss.jpg",
  ASC: "/ranks/banner_sss.jpg",
};

export default function RankUpFlash({ newRankId, oldRankId = null, onDone }) {
  const { t } = useTranslation();

  // Normalize inputs (accepts string rank ID or { oldRank, newRank } object)
  const normalizedNewRankId = typeof newRankId === "object" && newRankId !== null 
    ? (newRankId.newRank || newRankId.newRankId || "E") 
    : (newRankId || null);

  const normalizedOldRankId = typeof newRankId === "object" && newRankId !== null
    ? (newRankId.oldRank || newRankId.oldRankId || oldRankId)
    : oldRankId;

  // Resolve rank display data from rankEngine
  const rankObj = useMemo(() => {
    if (!normalizedNewRankId) return null;
    return getRankDisplayData(normalizedNewRankId);
  }, [normalizedNewRankId]);

  const prevRankObj = useMemo(() => {
    if (normalizedOldRankId) {
      return getRankDisplayData(normalizedOldRankId);
    }
    // Auto fallback to the immediate previous rank in RANKS list
    const curIdx = RANKS.findIndex((r) => r.id === normalizedNewRankId);
    if (curIdx > 0) return RANKS[curIdx - 1];
    return null;
  }, [normalizedOldRankId, normalizedNewRankId]);

  // Animation timeline step states
  const [showConfetti, setShowConfetti] = useState(false);
  const [step, setStep] = useState(0); // 0: Flash/shake, 1: Banner up, 2: Rank reveal, 3: Quote reveal

  useEffect(() => {
    if (!normalizedNewRankId) return;

    // Reset step
    setStep(0);

    // Audio & Screen shake trigger
    const soundTimer = setTimeout(() => {
      playSound("rank_up");
    }, 120);

    const confettiTimer = setTimeout(() => {
      setShowConfetti(true);
      setStep(1);
    }, 220);

    const rankRevealTimer = setTimeout(() => {
      setStep(2);
    }, 600);

    const quoteRevealTimer = setTimeout(() => {
      setStep(3);
    }, 1100);

    // Auto close after 4.6 seconds
    const doneTimer = setTimeout(() => {
      setShowConfetti(false);
      onDone?.();
    }, 4600);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(confettiTimer);
      clearTimeout(rankRevealTimer);
      clearTimeout(quoteRevealTimer);
      clearTimeout(doneTimer);
    };
  }, [normalizedNewRankId, onDone]);

  if (!rankObj) return null;

  const bannerSrc = RANK_BANNERS[rankObj.id] || RANK_BANNERS.E;
  const themeColor = rankObj.color || "#eab308";
  const glowColor = rankObj.glow || "rgba(234, 179, 8, 0.4)";

  const handleDismiss = () => {
    setShowConfetti(false);
    onDone?.();
  };

  return (
    <>
      {/* 8-bit Pixel Confetti Explosion */}
      <ConfettiBurst 
        active={showConfetti} 
        color={themeColor} 
        count={70} 
        isPixel={true} 
      />

      <AnimatePresence>
        <div 
          onClick={handleDismiss}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 cursor-pointer select-none overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop with chromatic darkening & vignette */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Fullscreen Initial Color Flash & Shockwave */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.15, 0] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none"
            style={{ 
              background: `radial-gradient(circle at 50% 50%, ${themeColor} 0%, rgba(0,0,0,0.8) 100%)` 
            }}
          />

          {/* CRT Retro Scanline Overlay */}
          <div className="absolute inset-0 crt-scanlines-overlay pointer-events-none opacity-60 z-10" />

          {/* Camera screen shake wrapper */}
          <div className="relative z-20 w-full max-w-2xl animate-pixel-shake">

            {/* Ambient Radial Aura behind Banner */}
            <div 
              className="absolute -inset-6 rounded-3xl opacity-75 blur-2xl pointer-events-none transition-all duration-700"
              style={{
                background: `radial-gradient(ellipse at center, ${themeColor}66 0%, ${themeColor}11 60%, transparent 80%)`,
              }}
            />

            {/* MAIN PIXEL ART BANNER CONTAINER */}
            <motion.div
              initial={{ scale: 0.75, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: -20, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 340, damping: 24, delay: 0.05 }}
              className="relative w-full rounded-2xl overflow-hidden shadow-2xl border-2 pixel-art-crisp group"
              style={{
                borderColor: themeColor,
                boxShadow: `0 0 35px ${themeColor}55, inset 0 0 20px ${themeColor}33`,
              }}
            >
              {/* High-res Pixel Art Dark Fantasy Banner Background */}
              <div className="relative w-full aspect-[16/9] sm:aspect-[16/8.5] max-h-[440px] overflow-hidden bg-slate-950">
                <img
                  src={bannerSrc}
                  alt={`Rank ${rankObj.id} banner`}
                  className="w-full h-full object-cover pixel-art-crisp brightness-[0.92] contrast-[1.08]"
                  loading="eager"
                />

                {/* Subtle dark vignette overlay for maximum text contrast */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at center, rgba(8, 6, 14, 0.72) 0%, rgba(5, 3, 10, 0.88) 85%)",
                  }}
                />

                {/* Shimmer light beam sweep */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                  <div 
                    className="w-1/2 h-full animate-pixel-shimmer"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${themeColor} 50%, transparent 100%)`,
                    }}
                  />
                </div>

                {/* INNER CONTENT OVERLAY */}
                <div className="absolute inset-0 flex flex-col justify-between items-center p-4 sm:p-7 text-center z-20">
                  
                  {/* TOP: Rank Ascension Pill Header */}
                  <motion.div
                    initial={{ y: -15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="flex items-center gap-2 px-3 py-1 rounded-md border font-game text-[9px] sm:text-[11px] tracking-widest uppercase font-black"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.75)",
                      borderColor: `${themeColor}90`,
                      color: themeColor,
                      textShadow: `0 0 8px ${themeColor}`,
                      boxShadow: `0 2px 10px rgba(0,0,0,0.5)`,
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} />
                    <span>✦ {t("rankUpFlash.title", "RANK ADVANCEMENT")} ✦</span>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} />
                  </motion.div>

                  {/* CENTER: Transition [Old Rank] ➔ [New Rank] */}
                  <div className="my-auto w-full flex flex-col items-center justify-center gap-1 sm:gap-2">
                    
                    <div className="flex items-center justify-center gap-3 sm:gap-6">
                      
                      {/* Previous Rank Box (if available) */}
                      {prevRankObj && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 0.6, scale: 0.9 }}
                          transition={{ delay: 0.2 }}
                          className="flex flex-col items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border bg-black/60"
                          style={{
                            borderColor: "rgba(255,255,255,0.15)",
                            color: "#94a3b8",
                          }}
                        >
                          <span className="font-game text-[7px] sm:text-[8px] uppercase tracking-wider text-slate-400">
                            {t("rankUpFlash.previous", "PREV")}
                          </span>
                          <span className="font-game text-xl sm:text-2xl font-black line-through opacity-70">
                            {prevRankObj.id}
                          </span>
                        </motion.div>
                      )}

                      {/* Transition Arrow */}
                      {prevRankObj && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                          transition={{ delay: 0.35, duration: 0.8, repeat: Infinity }}
                          className="text-lg sm:text-2xl font-black font-game"
                          style={{ color: themeColor, textShadow: `0 0 10px ${themeColor}` }}
                        >
                          ➔
                        </motion.div>
                      )}

                      {/* NEW RANK HERO BADGE */}
                      <motion.div
                        initial={{ scale: 0.2, rotate: -10, opacity: 0 }}
                        animate={{ 
                          scale: [0.2, 1.25, 0.95, 1.05, 1], 
                          rotate: 0, 
                          opacity: 1 
                        }}
                        transition={{ delay: 0.45, duration: 0.75, ease: "easeOut" }}
                        className="relative flex flex-col items-center justify-center px-5 py-2 sm:px-8 sm:py-3.5 rounded-xl border-2 bg-black/85"
                        style={{
                          borderColor: themeColor,
                          boxShadow: `0 0 30px ${themeColor}88, inset 0 0 15px ${themeColor}44`,
                        }}
                      >
                        {/* Glow halo behind glyph */}
                        <div 
                          className="absolute inset-0 rounded-xl pointer-events-none opacity-40 animate-pulse"
                          style={{ background: themeColor }}
                        />

                        <span className="font-game text-[7px] sm:text-[9px] uppercase tracking-widest font-black text-white/90">
                          {t("rankUpFlash.attained", "ATTAINED")}
                        </span>

                        <span 
                          className="font-game font-black text-4xl sm:text-6xl leading-none my-0.5"
                          style={{
                            color: themeColor,
                            textShadow: `0 0 20px ${themeColor}, 0 0 40px ${themeColor}aa, 2px 2px 0px #000000`,
                          }}
                        >
                          {rankObj.id}
                        </span>

                        <span 
                          className="font-game text-[9px] sm:text-[11px] font-black tracking-widest uppercase mt-0.5"
                          style={{ color: themeColor }}
                        >
                          {t(`ranks.${rankObj.id}`, rankObj.label)}
                        </span>
                      </motion.div>
                    </div>

                    {/* Biblical Quote / Lore Flavor */}
                    {rankObj.desc && step >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mt-2 sm:mt-3 max-w-lg px-3 py-1.5 rounded-lg bg-black/60 border border-white/10"
                      >
                        <p className="font-mono italic text-[8.5px] sm:text-[10px] text-slate-200 leading-snug line-clamp-2">
                          "{rankObj.desc}"
                        </p>
                      </motion.div>
                    )}
                  </div>

                  {/* BOTTOM: Tap to continue prompt */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    className="font-game text-[7.5px] sm:text-[8.5px] tracking-wider text-slate-400 uppercase font-semibold"
                  >
                    [ {t("rankUpFlash.tapToContinue", "CLICK ANYWHERE TO CONTINUE")} ]
                  </motion.div>

                </div>
              </div>

              {/* Corner Pixel Brackets Decoration */}
              <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: themeColor }} />
              <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: themeColor }} />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: themeColor }} />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: themeColor }} />

            </motion.div>

          </div>
        </div>
      </AnimatePresence>
    </>
  );
}
