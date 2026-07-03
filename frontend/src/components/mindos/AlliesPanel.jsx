import { useState, useEffect, useRef } from "react";
import { normalizeGold } from "@/lib/utils";
import { ALLIES } from "@/constants/rpgData";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { motion, AnimatePresence } from "framer-motion";
import OptimizedImage from "./OptimizedImage";
import GameCard from "@/components/ui/GameCard";

const RANK_COLORS = { E: "#888", D: "#22c55e", C: "#3b82f6", B: "#a855f7", A: "#f0c040", S: "#ff3355" };
const RANK_GLOW = { E: "#88888840", D: "#22c55e40", C: "#3b82f640", B: "#a855f740", A: "#f0c04040", S: "#ff335540" };

function AllyCard({ ally, isRecruited, level, gold, onRecruit, onUpgrade }) {
  const [hovered, setHovered] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [justRecruited, setJustRecruited] = useState(false);
  const prevRecruited = useRef(isRecruited);

  useEffect(() => {
    if (!prevRecruited.current && isRecruited) {
      setJustRecruited(true);
      const t = setTimeout(() => setJustRecruited(false), 1000);
      return () => clearTimeout(t);
    }
    prevRecruited.current = isRecruited;
  }, [isRecruited]);

  const nextCost = isRecruited ? ally.upgradeCosts[level - 1] : null;
  const canAffordRecruit = gold >= ally.recruitCost;
  const canAffordUpgrade = nextCost != null && gold >= nextCost;
  const rankColor = RANK_COLORS[ally.rank] || "#888";
  const rankGlow = RANK_GLOW[ally.rank] || "#88888840";

  return (
    <GameCard
      isHoverable
      isActive={isRecruited}
      borderColor={isRecruited ? ally.color : undefined}
      glowColor={ally.color}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, scale: justRecruited ? [0.9, 1.05, 1] : 1 }}
      transition={{
        scale: justRecruited ? { duration: 0.5, ease: "easeOut" } : {}
      }}
      onClick={() => setShowDetail(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Animated portrait */}
        <div className="relative shrink-0">
          <motion.div
            animate={isRecruited ? {
              boxShadow: hovered
                ? [`0 0 12px ${ally.color}`, `0 0 24px ${ally.color}80`, `0 0 12px ${ally.color}`]
                : [`0 0 6px ${ally.color}60`, `0 0 14px ${ally.color}40`, `0 0 6px ${ally.color}60`],
            } : {
              boxShadow: "0 0 0 transparent",
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 rounded-xl overflow-hidden border-2"
            style={{ borderColor: isRecruited ? ally.color : "var(--habit-border)" }}
          >
            <OptimizedImage
              src={ally.image}
              alt={ally.name}
              className="w-full h-full object-contain"
              style={{
                filter: isRecruited
                  ? `brightness(1.1) saturate(1.2) drop-shadow(0 0 4px ${ally.color})`
                  : "brightness(0.4) grayscale(0.6)",
                transition: "filter 0.5s ease",
                imageRendering: "pixelated",
              }}
            />
          </motion.div>
          {/* Rank badge */}
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-mono font-black text-[9px] border"
            style={{ background: rankColor, borderColor: rankGlow, color: "#000", boxShadow: `0 0 6px ${rankColor}` }}
          >
            {ally.rank}
          </div>
          {isRecruited && (
            <motion.div
              className="absolute -top-1 -left-1 w-3 h-3 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ background: "#00ff88", boxShadow: "0 0 4px #00ff88" }}
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-black" style={{ color: isRecruited ? ally.color : "var(--habit-dim)" }}>{ally.name}</span>
            <span className="text-[8px] font-mono px-1 py-0.5 rounded font-bold" style={{ background: `${rankColor}20`, color: rankColor, border: `1px solid ${rankColor}50` }}>
              RANK {ally.rank}
            </span>
            {isRecruited && (
              <span className="text-[8px] font-mono px-1 py-0.5 rounded font-bold" style={{ background: "#00ff8820", color: "#00ff88", border: "1px solid #00ff8840" }}>ACTIVE</span>
            )}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/40 italic">{ally.title}</div>
          {isRecruited && (
            <>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    animate={i < level ? { opacity: [0.7, 1, 0.7] } : {}}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                    style={{ background: i < level ? ally.color : "var(--habit-border)", boxShadow: i < level ? `0 0 4px ${ally.color}` : "none" }}
                  />
                ))}
                <span className="text-[9px] font-mono text-muted-foreground/40 ml-1">Lv{level}</span>
              </div>
              <div className="text-[9px] font-mono mt-0.5 truncate" style={{ color: ally.color }}>▸ {ally.levels[level - 1]}</div>
            </>
          )}
        </div>

        {/* Cost */}
        <div className="shrink-0 text-right">
          {!isRecruited ? (
            <div className="text-[10px] font-mono font-bold" style={{ color: canAffordRecruit ? "var(--habit-gold)" : "var(--habit-dim)" }}>
              {ally.recruitCost}G
            </div>
          ) : level < 5 ? (
            <div className="text-[10px] font-mono" style={{ color: canAffordUpgrade ? ally.color : "#4a4060" }}>
              {nextCost}G →Lv{level + 1}
            </div>
          ) : (
            <div className="text-[9px] font-mono text-muted-foreground/30">MAX</div>
          )}
        </div>
      </div>
    </GameCard>
  );
}

export default function AlliesPanel({ onSpendGold }) {
  const [selected, setSelected] = useState(null);
  const [revealState, setRevealState] = useState("idle"); // idle, shaking, flipping_front, revealed
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const recruited = profile?.recruited_allies ? Object.keys(profile.recruited_allies) : [];
  const levels = profile?.recruited_allies || {};
  const gold = profile?.gold || 0;

  const recruitMutation = useMutation({
    mutationFn: (allyId) => djangoApi.allies.recruit(allyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });
      refreshProfile();
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Recruit failed: ${err.message}` });
    }
  });

  const recruit = async (ally) => {
    if (gold < ally.recruitCost) return;
    
    setRevealState("shaking");
    try {
      await recruitMutation.mutateAsync(ally.id);
      djangoApi.analytics.logEvent("ally_recruited");
      onSpendGold(ally.recruitCost);
      
      setTimeout(() => {
        setRevealState("flipping_front");
        setTimeout(() => {
          setRevealState("revealed");
        }, 300);
      }, 1200);
    } catch (e) {
      setRevealState("idle");
    }
  };

  const upgrade = async (ally) => {
    const currentLevel = levels[ally.id] || 1;
    if (currentLevel >= 5) return;
    const cost = ally.upgradeCosts[currentLevel - 1];
    if (gold < cost) return;
    
    try {
      await recruitMutation.mutateAsync(ally.id);
      djangoApi.analytics.logEvent("ally_recruited");
      onSpendGold(cost);
    } catch (e) {
      // ignore
    }
  };

  const closeDetail = () => {
    if (revealState === "shaking" || revealState === "flipping_front") return;
    setSelected(null);
    setRevealState("idle");
  };

  const activeAllies = ALLIES.filter(a => recruited.includes(a.id));
  const teamBonuses = activeAllies.map(a => ({ ally: a, bonus: a.levels[(levels[a.id] || 1) - 1] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
          Allies — {recruited.length}/{ALLIES.length} Recruited
        </div>
        <div className="text-[10px] font-mono font-bold" style={{ color: "#f0c040" }}>🪙 {normalizeGold(gold).toLocaleString()}G</div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {ALLIES.map(ally => {
          const isRecruited = recruited.includes(ally.id);
          const level = levels[ally.id] || 0;
          return (
            <div key={ally.id} onClick={() => { setSelected(ally); setRevealState("idle"); }}>
              <AllyCard
                ally={ally}
                isRecruited={isRecruited}
                level={level}
                gold={gold}
                onRecruit={recruit}
                onUpgrade={upgrade}
              />
            </div>
          );
        })}
      </div>

      {/* Team bonuses */}
      {teamBonuses.length > 0 && (
        <div className="p-3 rounded-xl border border-border bg-card/40 space-y-1.5">
          <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">Active Team Bonuses</div>
          {teamBonuses.map(({ ally, bonus }) => (
            <div key={ally.id} className="flex items-center gap-2 text-[10px] font-mono">
              <span className="font-bold" style={{ color: ally.color }}>{ally.name}:</span>
              <span className="text-foreground/60">{bonus}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (() => {
          const isRecruitedStatus = recruited.includes(selected.id);
          const displayAsRecruited = isRecruitedStatus && revealState !== "shaking" && revealState !== "flipping_front";

          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", damping: 18 }}
              className="bg-card border rounded-2xl p-5 max-w-xs w-full space-y-4"
              style={{ borderColor: `${selected.color}60`, boxShadow: `0 0 40px ${selected.color}30` }}
              onClick={e => e.stopPropagation()}
            >
              {/* Big portrait */}
              <div className="flex flex-col items-center gap-2 relative">
                {revealState === "revealed" && (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 1 }} 
                    animate={{ scale: 2, opacity: 0 }} 
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 rounded-full" 
                    style={{ background: `radial-gradient(circle, ${selected.color} 0%, transparent 70%)` }}
                  />
                )}
                <motion.div
                  animate={
                    revealState === "shaking" 
                      ? { x: [-5, 5, -5, 5, -3, 3, 0], y: [-2, 2, -2, 2, 0], boxShadow: `0 0 15px ${selected.color}` }
                      : revealState === "flipping_front"
                      ? { rotateY: 90, scale: 1.1, boxShadow: `0 0 25px ${selected.color}` }
                      : revealState === "revealed"
                      ? { rotateY: 0, scale: 1, boxShadow: [`0 0 50px ${selected.color}`, `0 0 20px ${selected.color}60`] }
                      : { boxShadow: [`0 0 20px ${selected.color}60`, `0 0 40px ${selected.color}40`, `0 0 20px ${selected.color}60`] }
                  }
                  transition={
                    revealState === "shaking" ? { duration: 0.3, repeat: Infinity }
                    : revealState === "flipping_front" ? { duration: 0.3, ease: "easeIn" }
                    : revealState === "revealed" ? { duration: 0.5, type: "spring", bounce: 0.4 }
                    : { duration: 2.5, repeat: Infinity }
                  }
                  className="w-28 h-28 rounded-2xl overflow-hidden border-2 relative z-10"
                  style={{ borderColor: selected.color }}
                >
                  <OptimizedImage
                    src={selected.image}
                    alt={selected.name}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: "pixelated", filter: displayAsRecruited ? "brightness(1.1) saturate(1.3)" : "brightness(0.5) grayscale(0.5)" }}
                  />
                </motion.div>
                <div className="font-mono font-black text-sm relative z-10" style={{ color: selected.color }}>{selected.name}</div>
                <div className="flex items-center gap-2 relative z-10">
                  <span className="text-[9px] font-mono text-muted-foreground/50">{selected.title}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                    style={{ background: `${RANK_COLORS[selected.rank]}20`, color: RANK_COLORS[selected.rank], border: `1px solid ${RANK_COLORS[selected.rank]}50` }}>
                    RANK {selected.rank}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/50 italic text-center">"{selected.lore}"</div>
              </div>

              {/* Levels */}
              <div className="space-y-1.5">
                <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">Abilities by Level</div>
                {selected.levels.map((bonus, i) => {
                  const currentLevel = levels[selected.id] || 0;
                  const isUnlocked = displayAsRecruited && currentLevel > i;
                  return (
                    <div key={i} className="flex items-start gap-2 text-[10px] font-mono"
                      style={{ opacity: isUnlocked ? 1 : 0.35 }}>
                      <span className="shrink-0" style={{ color: isUnlocked ? selected.color : "#4a4060" }}>Lv{i + 1}</span>
                      <span className="text-foreground/70">{bonus}</span>
                    </div>
                  );
                })}
              </div>

              {/* Action button */}
              {!displayAsRecruited ? (
                <button
                  onClick={() => recruit(selected)}
                  disabled={gold < selected.recruitCost || revealState !== "idle"}
                  className="w-full py-2.5 font-mono font-bold text-xs rounded-xl border transition-all"
                  style={{
                    borderColor: gold >= selected.recruitCost ? "#f0c040" : "#1e1a38",
                    color: gold >= selected.recruitCost ? "#f0c040" : "#4a4060",
                    background: gold >= selected.recruitCost ? "#f0c04015" : "transparent",
                  }}
                >
                  {revealState !== "idle" ? "SUMMONING..." : `RECRUIT — ${selected.recruitCost}G`}
                </button>
              ) : (levels[selected.id] || 1) < 5 ? (
                <button
                  onClick={() => upgrade(selected)}
                  disabled={gold < (selected.upgradeCosts[(levels[selected.id] || 1) - 1] || 0)}
                  className="w-full py-2.5 font-mono font-bold text-xs rounded-xl border transition-all"
                  style={{
                    borderColor: gold >= (selected.upgradeCosts[(levels[selected.id] || 1) - 1] || 0) ? selected.color : "#1e1a38",
                    color: gold >= (selected.upgradeCosts[(levels[selected.id] || 1) - 1] || 0) ? selected.color : "#4a4060",
                    background: gold >= (selected.upgradeCosts[(levels[selected.id] || 1) - 1] || 0) ? `${selected.color}15` : "transparent",
                  }}
                >
                  UPGRADE → Lv{(levels[selected.id] || 1) + 1} — {selected.upgradeCosts[(levels[selected.id] || 1) - 1]}G
                </button>
              ) : (
                <div className="w-full py-2 text-[10px] font-mono text-center text-muted-foreground/30 border border-border rounded-xl">MAX LEVEL</div>
              )}

              <button onClick={closeDetail} className="w-full text-[10px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                CLOSE
              </button>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}