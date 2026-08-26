// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SKILL_TREE } from "@/constants/rpgData";
import {
  Lock,
  RotateCcw,
  Save,
  Brain,
  Dumbbell,
  Coins,
  Sparkles,
  BookOpen,
  X,
  Check,
  Zap,
  Shield,
  Flame,
  Award,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/soundEffects.js";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// ─── RESPEC COST ─────────────────────────────────────────────────────────────
function getRespecCost(unlockedCount) {
  return Math.max(50, unlockedCount * 80);
}

// ─── PRESET MANAGEMENT ───────────────────────────────────────────────────────
function loadPresets() {
  try {
    return JSON.parse(localStorage.getItem("mindos_skill_presets") || "[]");
  } catch {
    return [];
  }
}
function savePresets(presets) {
  localStorage.setItem("mindos_skill_presets", JSON.stringify(presets));
}

// ─── CATEGORY ICONS & LABELS ─────────────────────────────────────────────────
const CAT_ICONS = {
  mind: Brain,
  body: Dumbbell,
  wealth: Coins,
  spirit: Sparkles,
  knowledge: BookOpen,
};

const CAT_EMOJIS = {
  mind: "🧠",
  body: "💪",
  wealth: "💰",
  spirit: "✨",
  knowledge: "📚",
};

// ─── GRAPH LAYOUT ENGINE ─────────────────────────────────────────────────────
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 860;
const START_X = 120;
const START_Y = CANVAS_HEIGHT / 2;

const BRANCH_Y_OFFSETS = {
  mind: -280,
  body: -140,
  wealth: 0,
  spirit: 140,
  knowledge: 280,
};

const TIER_X_SPACING = 145;

function getCoords(branchKey, tier) {
  const yOffset = BRANCH_Y_OFFSETS[branchKey];
  if (yOffset === undefined) return { x: START_X, y: START_Y };

  return {
    x: START_X + tier * TIER_X_SPACING,
    y: START_Y + yOffset,
  };
}

function buildGraphData() {
  const nodes = [];
  const links = [];

  // Origin Node
  nodes.push({
    id: "center",
    isStart: true,
    color: "#f0c040",
    x: START_X,
    y: START_Y,
    categoryName: "ORIGIN",
    name: "AWAENED CORE",
    tier: 0,
  });

  Object.entries(SKILL_TREE).forEach(([branchKey, branch]) => {
    branch.nodes.forEach((node) => {
      const coords = getCoords(branchKey, node.tier);
      nodes.push({
        ...node,
        branchKey,
        color: branch.color,
        x: coords.x,
        y: coords.y,
        categoryName: branch.label,
      });

      if (node.requires) {
        const parentNode = branch.nodes.find((n) => n.id === node.requires);
        if (parentNode) {
          const parentCoords = getCoords(branchKey, parentNode.tier);
          links.push({
            id: `${node.requires}->${node.id}`,
            branchKey,
            color: branch.color,
            x1: parentCoords.x,
            y1: parentCoords.y,
            x2: coords.x,
            y2: coords.y,
            sourceId: node.requires,
            targetId: node.id,
            isOrthogonal: false,
          });
        }
      } else {
        links.push({
          id: `center->${node.id}`,
          branchKey,
          color: branch.color,
          x1: START_X,
          y1: START_Y,
          x2: coords.x,
          y2: coords.y,
          sourceId: "center",
          targetId: node.id,
          isOrthogonal: true,
        });
      }
    });
  });

  return { nodes, links };
}

const GRAPH_DATA = buildGraphData();

export default function SkillTreePanel({ skillTree, onUpdate, gold, onSpendGold }) {
  const { t } = useTranslation();
  const [showRespec, setShowRespec] = useState(false);
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState(loadPresets);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeMobileBranch, setActiveMobileBranch] = useState("mind");

  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isMobile || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      const scaleX = width / CANVAS_WIDTH;
      const scaleY = height / CANVAS_HEIGHT;
      const targetScale = Math.min(scaleX, scaleY);

      const MIN_SCALE = 0.45;
      setScale(Math.max(MIN_SCALE, targetScale));
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMobile]);

  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const unlocked = profile?.unlocked_skills || [];
  const sp = profile?.skill_points || 0;
  const currentGold = profile?.gold || gold || 0;

  const canUnlock = (node) => {
    if (!node || node.isStart) return false;
    if (unlocked.includes(node.id)) return false;
    if (node.requires && !unlocked.includes(node.requires)) return false;
    if (sp < (node.sp || 0)) return false;
    if (currentGold < (node.gold || 0)) return false;
    return true;
  };

  const buyMutation = useMutation({
    mutationFn: (skillCode) => djangoApi.skills.buy(skillCode),
    onSuccess: () => {
      playSound("purchase");
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });
      refreshProfile();
      showRewardToast({ label: "✨ Skill Mastered!" });
    },
    onError: (err) => {
      playSound("error");
      showRewardToast({ label: `❌ Failed to unlock: ${err.message || "Error"}` });
    },
  });

  const unlock = (node) => {
    if (!canUnlock(node)) return;
    buyMutation.mutate(node.id);
    djangoApi.analytics.logEvent("skill_purchased");
  };

  const respecCost = getRespecCost(unlocked.length);

  const respecMutation = useMutation({
    mutationFn: () => djangoApi.skills.respec(),
    onSuccess: () => {
      playSound("error");
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["player-stats"] });
      refreshProfile();
      setShowRespec(false);
      setSelectedNodeId(null);
      showRewardToast({ label: "🔄 Skill Points Reset!" });
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Respec failed: ${err.message || "Error"}` });
    },
  });

  const doRespec = () => {
    if (currentGold < respecCost) return;
    respecMutation.mutate();
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const newPreset = {
      name: presetName.trim(),
      nodes: [...unlocked],
      savedAt: Date.now(),
    };
    const updated = [
      ...presets.filter((p) => p.name !== presetName.trim()),
      newPreset,
    ].slice(-3);
    savePresets(updated);
    setPresets(updated);
    setPresetName("");
    setShowPresetSave(false);
    playSound("success");
    showRewardToast({ label: "💾 Preset Saved!" });
  };

  const loadPreset = (preset) => {
    const newNodes = preset.nodes.filter((id) => !unlocked.includes(id));
    const spNeeded = newNodes.reduce((acc, id) => {
      const node = GRAPH_DATA.nodes.find((n) => n.id === id);
      return acc + (node?.sp || 0);
    }, 0);
    const goldNeeded = newNodes.reduce((acc, id) => {
      const node = GRAPH_DATA.nodes.find((n) => n.id === id);
      return acc + (node?.gold || 0);
    }, 0);

    if (spNeeded > sp || goldNeeded > currentGold) {
      playSound("error");
      showRewardToast({ label: "❌ Not enough SP or Gold for this preset!" });
      return;
    }
    playSound("purchase");
    newNodes.forEach((id) => {
      buyMutation.mutate(id);
      djangoApi.analytics.logEvent("skill_purchased");
    });
  };

  const selectedNode = GRAPH_DATA.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="relative flex flex-col h-[620px] bg-[#0c0c16] rounded-2xl overflow-hidden border-2 border-[#2a243e] shadow-[0_8px_32px_rgba(0,0,0,0.8),inset_0_0_24px_rgba(0,0,0,0.9)] select-none font-mono">
      {/* ─── HEADER BAR ──────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-b from-[#0c0c16] via-[#0c0c16]/90 to-transparent flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200">
            SKILL CONSTELLATION
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Skill Points Crystal Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/40 border border-amber-500/50 rounded-lg shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <span className="text-amber-400 font-bold text-xs">◆</span>
            <span className="text-xs font-mono font-bold text-amber-300">
              {sp} SP
            </span>
          </div>

          {/* Save Preset Button */}
          <button
            onClick={() => setShowPresetSave(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold border border-[#3b3558] bg-[#161426] hover:bg-[#201d36] text-amber-300 rounded-lg transition-colors shadow-sm"
          >
            <Save className="w-3 h-3" /> SAVE
          </button>

          {/* Respec Button */}
          <button
            onClick={() => setShowRespec(true)}
            disabled={unlocked.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold border border-red-900/60 bg-[#1e1014] hover:bg-[#2e141a] text-red-300 rounded-lg transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3 h-3" /> RESPEC
          </button>
        </div>
      </div>

      {/* ─── PRESETS BAR (IF ANY) ────────────────────────────────────────── */}
      {presets.length > 0 && (
        <div className="absolute top-12 left-4 z-30 flex gap-2 pointer-events-auto">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => loadPreset(p)}
              className="px-2.5 py-0.5 text-[9px] font-mono rounded-md border border-amber-500/40 bg-[#181528]/80 text-amber-300 hover:bg-amber-950/40 transition-colors shadow-sm"
            >
              📋 {p.name}
            </button>
          ))}
        </div>
      )}

      {/* ─── MOBILE VIEW: CONSTELLATION TABS & PATH ──────────────────────── */}
      {isMobile ? (
        <div className="flex-1 flex flex-col pt-14 overflow-hidden">
          {/* Branch Selector Tabs */}
          <div className="flex overflow-x-auto gap-1 px-3 py-2 bg-[#100e1e] border-b border-[#2a243e] scrollbar-none shrink-0">
            {Object.entries(SKILL_TREE).map(([branchKey, branch]) => {
              const mastered = branch.nodes.filter((n) =>
                unlocked.includes(n.id)
              ).length;
              const isActive = activeMobileBranch === branchKey;

              return (
                <button
                  key={branchKey}
                  onClick={() => {
                    setActiveMobileBranch(branchKey);
                    playSound("click");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all border",
                    isActive
                      ? "bg-[#1f1b38] border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                      : "bg-[#141224] border-[#252038] text-slate-400 hover:text-slate-200"
                  )}
                  style={{
                    borderLeftColor: branch.color,
                    borderLeftWidth: "3px",
                  }}
                >
                  <span>{CAT_EMOJIS[branchKey]}</span>
                  <span>{branch.label}</span>
                  <span className="text-[9px] opacity-70">
                    ({mastered}/{branch.nodes.length})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Branch Constellation Track */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-28">
            {SKILL_TREE[activeMobileBranch]?.nodes.map((node, index) => {
              const isNodeUnlocked = unlocked.includes(node.id);
              const prereqMet = !node.requires || unlocked.includes(node.requires);
              const isSelected = selectedNodeId === node.id;
              const branch = SKILL_TREE[activeMobileBranch];
              const isKeystone = node.tier === 6;

              let state = "LOCKED";
              if (isNodeUnlocked) state = "MASTERED";
              else if (
                prereqMet &&
                sp >= (node.sp || 0) &&
                currentGold >= (node.gold || 0)
              )
                state = "AVAILABLE";

              const Icon = CAT_ICONS[activeMobileBranch] || Sparkles;

              return (
                <div key={node.id} className="flex flex-col items-center w-full">
                  {/* Skill Card */}
                  <motion.div
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      playSound("click");
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex items-center justify-between gap-3",
                      state === "MASTERED"
                        ? "bg-[#151228] border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                        : state === "AVAILABLE"
                        ? "bg-[#1a1533] border-purple-400/80 shadow-[0_0_14px_rgba(168,85,247,0.3)] animate-pulse"
                        : "bg-[#0f0e1c] border-[#221e36] opacity-75",
                      isSelected && "ring-2 ring-white"
                    )}
                    style={{
                      borderLeft: `4px solid ${
                        state === "MASTERED"
                          ? "#f59e0b"
                          : state === "AVAILABLE"
                          ? branch.color
                          : "#475569"
                      }`,
                    }}
                  >
                    {/* Node Icon Box */}
                    <div
                      className={cn(
                        "w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border relative",
                        state === "MASTERED"
                          ? "bg-amber-950/50 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                          : state === "AVAILABLE"
                          ? "bg-purple-950/60 border-purple-400 text-purple-200"
                          : "bg-black/60 border-slate-700 text-slate-500"
                      )}
                    >
                      {state === "LOCKED" ? (
                        <Lock className="w-5 h-5 opacity-60" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}

                      {isKeystone && (
                        <div className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-black px-1 rounded font-bold">
                          MAX
                        </div>
                      )}
                    </div>

                    {/* Skill Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-black/40 text-slate-400 border border-slate-700/50">
                          T{node.tier}
                        </span>
                        <h4
                          className={cn(
                            "text-xs font-bold font-mono truncate",
                            state === "MASTERED"
                              ? "text-amber-200"
                              : state === "AVAILABLE"
                              ? "text-white"
                              : "text-slate-300"
                          )}
                        >
                          {t(`rpgData.skillTree.${node.id}.name`, node.name)}
                        </h4>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {t(`rpgData.skillTree.${node.id}.desc`, node.desc)}
                      </p>
                    </div>

                    {/* Status / Unlock CTA */}
                    <div className="shrink-0 flex flex-col items-end">
                      {state === "MASTERED" ? (
                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> DONE
                        </span>
                      ) : (
                        <div className="text-right">
                          <span
                            className={cn(
                              "text-[10px] font-bold block",
                              sp < node.sp ? "text-red-400" : "text-amber-300"
                            )}
                          >
                            {node.sp} SP
                          </span>
                          <span
                            className={cn(
                              "text-[9px] block opacity-80",
                              currentGold < node.gold
                                ? "text-red-400"
                                : "text-slate-400"
                            )}
                          >
                            {node.gold}G
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Conduit line between mobile nodes */}
                  {index < branch.nodes.length - 1 && (
                    <div
                      className={cn(
                        "w-0.5 h-4 my-1 transition-all",
                        isNodeUnlocked
                          ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                          : "bg-[#252038]"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── DESKTOP VIEW: FULL CONSTELLATION CANVAS ───────────────────── */
        <div
          ref={containerRef}
          className="flex-1 relative bg-[#0a0a14] overflow-auto flex items-center justify-center pt-8"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onTouchStartCapture={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: CANVAS_WIDTH * scale,
              height: CANVAS_HEIGHT * scale,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              {/* Dark Fantasy Rune Grid Background */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(168, 85, 247, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.15) 1px, transparent 1px)",
                  backgroundSize: "48px 48px",
                }}
              />

              {/* Glowing SVG Conduits */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {GRAPH_DATA.links.map((link) => {
                  const isSourceUnlocked =
                    link.sourceId === "center" || unlocked.includes(link.sourceId);
                  const isTargetUnlocked = unlocked.includes(link.targetId);

                  const targetNode = GRAPH_DATA.nodes.find(
                    (n) => n.id === link.targetId
                  );
                  const targetCanAfford = targetNode
                    ? sp >= (targetNode.sp || 0) &&
                      currentGold >= (targetNode.gold || 0)
                    : false;
                  const isTargetAvailable =
                    isSourceUnlocked && !isTargetUnlocked && targetCanAfford;

                  const isMastered = isTargetUnlocked;
                  const conduitColor = isMastered
                    ? link.color
                    : isTargetAvailable
                    ? `${link.color}99`
                    : "#201d36";

                  let pathStr = "";
                  if (link.isOrthogonal) {
                    const midX = link.x1 + 65;
                    pathStr = `${link.x1},${link.y1} ${midX},${link.y1} ${midX},${link.y2} ${link.x2},${link.y2}`;
                  } else {
                    pathStr = `${link.x1},${link.y1} ${link.x2},${link.y2}`;
                  }

                  return (
                    <g key={link.id}>
                      {/* Outer shadow conduit */}
                      <polyline
                        points={pathStr}
                        fill="none"
                        stroke="#0a0a14"
                        strokeWidth={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Colored active conduit */}
                      <polyline
                        points={pathStr}
                        fill="none"
                        stroke={conduitColor}
                        strokeWidth={isMastered ? 4 : 2}
                        strokeDasharray={isMastered ? "none" : "4 4"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={isMastered ? "url(#glow)" : "none"}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* ─── DESKTOP NODES ────────────────────────────────────────── */}
              {GRAPH_DATA.nodes.map((node) => {
                const isUnlocked = node.isStart || unlocked.includes(node.id);
                const prereqMet =
                  node.isStart || !node.requires || unlocked.includes(node.requires);
                const isSelected = selectedNodeId === node.id;
                const isKeystone = node.tier === 6;

                let state = "LOCKED";
                if (isUnlocked) state = "MASTERED";
                else if (
                  prereqMet &&
                  sp >= (node.sp || 0) &&
                  currentGold >= (node.gold || 0)
                )
                  state = "AVAILABLE";

                const Icon = node.isStart
                  ? Sparkles
                  : CAT_ICONS[node.branchKey] || Sparkles;

                return (
                  <div
                    key={node.id}
                    className="absolute"
                    style={{
                      left: node.x - 30,
                      top: node.y - 30,
                      width: 60,
                      height: 60,
                      zIndex: isSelected ? 35 : isKeystone ? 25 : 15,
                    }}
                  >
                    <motion.button
                      onClick={() => {
                        setSelectedNodeId(node.id);
                        playSound("click");
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "w-full h-full rounded-xl relative flex items-center justify-center transition-all duration-300 outline-none border-2",
                        state === "MASTERED"
                          ? "bg-[#16122a] border-amber-400 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.4)]"
                          : state === "AVAILABLE"
                          ? "bg-[#1f1a3a] border-purple-400 text-purple-200 shadow-[0_0_14px_rgba(168,85,247,0.4)] animate-pulse"
                          : "bg-[#0e0d1a] border-[#252038] text-slate-600 hover:border-slate-500",
                        isSelected && "ring-2 ring-white scale-110",
                        isKeystone &&
                          state === "MASTERED" &&
                          "ring-2 ring-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.6)]"
                      )}
                      style={{
                        backgroundColor:
                          state === "MASTERED"
                            ? `${node.color}22`
                            : undefined,
                        borderColor:
                          state === "MASTERED"
                            ? node.color
                            : state === "AVAILABLE"
                            ? "#c084fc"
                            : undefined,
                      }}
                    >
                      {state === "LOCKED" ? (
                        <Lock className="w-6 h-6 opacity-40" />
                      ) : (
                        <Icon
                          className="w-6 h-6"
                          style={{
                            color:
                              state === "MASTERED" ? node.color : "#e2e8f0",
                          }}
                        />
                      )}

                      {/* Mastered Badge */}
                      {state === "MASTERED" && !node.isStart && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                          <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                        </div>
                      )}

                      {/* Keystone Gold Crown */}
                      {isKeystone && (
                        <div className="absolute -top-2.5 -right-2.5 px-1 bg-amber-500 text-black text-[8px] font-bold rounded font-mono shadow-sm">
                          APEX
                        </div>
                      )}
                    </motion.button>

                    {/* Node Title Label */}
                    {!node.isStart && (
                      <div
                        className="absolute -bottom-6 w-40 -ml-10 text-center pointer-events-none"
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color:
                            state === "MASTERED"
                              ? node.color
                              : state === "AVAILABLE"
                              ? "#f1f5f9"
                              : "#64748b",
                          textShadow: "0 1px 4px #000, 0 1px 8px #000",
                        }}
                      >
                        {t(`rpgData.skillTree.${node.id}.name`, node.name)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM INSPECTOR DRAWER (DOCK) ──────────────────────────────── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-40 border-t-2 bg-[#100e20]/95 backdrop-blur-md p-4 text-slate-200 shadow-2xl"
            style={{ borderTopColor: selectedNode.color || "#a855f7" }}
          >
            <button
              onClick={() => setSelectedNodeId(null)}
              className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3 md:gap-4 items-start w-full">
              {/* Big Rune Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2"
                style={{
                  borderColor: selectedNode.color || "#a855f7",
                  background: `${selectedNode.color || "#a855f7"}20`,
                  boxShadow: `0 0 16px ${selectedNode.color || "#a855f7"}40`,
                }}
              >
                {(() => {
                  const SIcon = CAT_ICONS[selectedNode.branchKey] || Sparkles;
                  return (
                    <SIcon
                      className="w-6 h-6"
                      style={{ color: selectedNode.color || "#a855f7" }}
                    />
                  );
                })()}
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="font-mono font-bold text-sm truncate"
                    style={{ color: selectedNode.color || "#f59e0b" }}
                  >
                    {selectedNode.isStart
                      ? "AWAKENED CORE"
                      : t(
                          `rpgData.skillTree.${selectedNode.id}.name`,
                          selectedNode.name
                        )}
                  </h3>
                  {!selectedNode.isStart && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                      TIER {selectedNode.tier}
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-slate-300 mt-1 leading-relaxed">
                  {selectedNode.isStart
                    ? "The origin of your cognitive and physical growth."
                    : t(
                        `rpgData.skillTree.${selectedNode.id}.desc`,
                        selectedNode.desc
                      )}
                </p>
              </div>

              {/* Unlock Action Button */}
              {!selectedNode.isStart && (
                <div className="shrink-0 flex flex-col items-end justify-center min-w-[100px]">
                  {unlocked.includes(selectedNode.id) ? (
                    <div
                      className="flex items-center gap-1 font-mono font-bold text-xs"
                      style={{ color: selectedNode.color || "#10b981" }}
                    >
                      <Check className="w-4 h-4" /> MASTERED
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold mb-1.5">
                        <span
                          className={
                            sp < selectedNode.sp
                              ? "text-red-400"
                              : "text-amber-300"
                          }
                        >
                          {selectedNode.sp} SP
                        </span>
                        <span
                          className={
                            currentGold < selectedNode.gold
                              ? "text-red-400"
                              : "text-amber-300"
                          }
                        >
                          {selectedNode.gold} G
                        </span>
                      </div>
                      <button
                        onClick={() => unlock(selectedNode)}
                        disabled={
                          !canUnlock(selectedNode) || buyMutation.isPending
                        }
                        className="px-4 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                        style={{
                          borderColor: selectedNode.color,
                          color: "#fff",
                          background: `${selectedNode.color}33`,
                        }}
                      >
                        {buyMutation.isPending ? "..." : "UNLOCK"}
                      </button>
                    </>
                  )}

                  {/* Prerequisite warning */}
                  {!unlocked.includes(selectedNode.id) &&
                    selectedNode.requires &&
                    !unlocked.includes(selectedNode.requires) && (
                      <div className="text-[8px] font-mono text-red-400 mt-1 uppercase">
                        Requires previous tier
                      </div>
                    )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── RESPEC MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRespec && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
            onClick={() => setShowRespec(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="rounded-2xl border-2 border-red-900/60 bg-[#140e14] p-6 max-w-xs w-full space-y-4 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-2xl">⚠️</div>
              <div className="font-mono text-sm font-bold text-red-400">
                RESET SKILL TREE
              </div>
              <div className="text-xs font-mono text-slate-300 leading-relaxed">
                Refund all {unlocked.length} unlocked skills and reclaim all SP.<br />
                Cost: <span className="text-amber-400 font-bold">{respecCost}G</span>
                {currentGold < respecCost && (
                  <span className="text-red-400 block mt-1">Not enough Gold!</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRespec(false)}
                  className="flex-1 py-2 rounded-lg border border-[#2a243e] text-xs font-mono text-slate-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={doRespec}
                  disabled={currentGold < respecCost}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono font-bold disabled:opacity-30 transition-colors border-red-500/60 text-red-300 bg-red-950/40 hover:bg-red-900/60"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SAVE PRESET MODAL ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showPresetSave && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
            onClick={() => setShowPresetSave(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="rounded-2xl border-2 border-amber-500/40 bg-[#161224] p-6 max-w-xs w-full space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-mono text-sm font-bold text-amber-300">
                SAVE SKILL PRESET
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Save your current build ({unlocked.length} skills) for quick switching.
              </div>
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Build name (e.g. Focus God)..."
                className="w-full px-3 py-2 rounded-lg border border-[#3b3558] bg-[#100e1e] text-xs font-mono text-white placeholder:text-slate-600 outline-none focus:border-amber-400"
                onKeyDown={(e) => e.key === "Enter" && savePreset()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPresetSave(false)}
                  className="flex-1 py-2 rounded-lg border border-[#2a243e] text-xs font-mono text-slate-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                  className="flex-1 py-2 rounded-lg border border-amber-500/60 text-amber-300 bg-amber-950/40 font-mono font-bold text-xs disabled:opacity-30"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}