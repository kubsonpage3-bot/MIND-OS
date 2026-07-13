import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SKILL_TREE } from "@/constants/rpgData";
import { Lock, RotateCcw, Save, Brain, Dumbbell, Coins, Sparkles, BookOpen, X, Check, ZoomIn, ZoomOut, House } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/soundEffects.js";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// ─── RESPEC COST ─────────────────────────────────────────────────────────────
function getRespecCost(unlockedCount) {
  return Math.max(50, unlockedCount * 80);
}

// ─── PRESET MANAGEMENT ───────────────────────────────────────────────────────
function loadPresets() {
  try { return JSON.parse(localStorage.getItem("mindos_skill_presets") || "[]"); } catch { return []; }
}
function savePresets(presets) { localStorage.setItem("mindos_skill_presets", JSON.stringify(presets)); }

// ─── CATEGORY ICONS ──────────────────────────────────────────────────────────
const CAT_ICONS = {
  mind: Brain,
  body: Dumbbell,
  wealth: Coins,
  spirit: Sparkles,
  knowledge: BookOpen,
};

// ─── GRAPH LAYOUT ENGINE ─────────────────────────────────────────────────────
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
const START_X = 120;
const START_Y = CANVAS_HEIGHT / 2;

// Horizontal tracks (Y offsets from center)
const BRANCH_Y_OFFSETS = {
  mind: -280,
  body: -140,
  wealth: 0,
  spirit: 140,
  knowledge: 280,
};

const TIER_X_SPACING = 140;

function getCoords(branchKey, tier) {
  const yOffset = BRANCH_Y_OFFSETS[branchKey];
  if (yOffset === undefined) return { x: START_X, y: START_Y };
  
  return {
    // Tier 1 starts at 140px away from START_X
    x: START_X + tier * TIER_X_SPACING,
    y: START_Y + yOffset,
  };
}

// Build a flat array of all nodes with absolute coordinates
function buildGraphData() {
  const nodes = [];
  const links = [];

  // Center/Start Node
  nodes.push({
    id: "center",
    isStart: true,
    color: "#fff",
    x: START_X,
    y: START_Y,
    categoryName: "ORIGIN",
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
        const parentNode = branch.nodes.find(n => n.id === node.requires);
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
            isOrthogonal: false // Horizontal line
          });
        }
      } else {
        // Root node connects to START using an orthogonal path
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
          isOrthogonal: true
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
  const [confirmPreset, setConfirmPreset] = useState(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const unlocked = profile?.unlocked_skills || [];
  const sp = profile?.skill_points || 0;
  const currentGold = profile?.gold || gold;

  const canUnlock = (node) => {
    if (unlocked.includes(node.id)) return false;
    if (node.requires && !unlocked.includes(node.requires)) return false;
    if (sp < node.sp) return false;
    if (currentGold < node.gold) return false;
    return true;
  };

  const buyMutation = useMutation({
    mutationFn: (skillCode) => djangoApi.skills.buy(skillCode),
    onSuccess: () => {
      playSound('purchase');
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      refreshProfile();
    },
    onError: (err) => {
      playSound('error');
      showRewardToast({ label: `❌ Failed to unlock: ${err.message || 'Error'}` });
    }
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
      playSound('error');
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      refreshProfile();
      setShowRespec(false);
      setSelectedNodeId(null);
    },
    onError: (err) => {
      showRewardToast({ label: `❌ Respec failed: ${err.message || 'Error'}` });
    }
  });

  const doRespec = () => {
    if (currentGold < respecCost) return;
    respecMutation.mutate();
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const newPreset = { name: presetName.trim(), nodes: [...unlocked], savedAt: Date.now() };
    const updated = [...presets.filter(p => p.name !== presetName.trim()), newPreset].slice(-3);
    savePresets(updated);
    setPresets(updated);
    setPresetName("");
    setShowPresetSave(false);
    playSound('success');
  };

  const loadPreset = (preset) => {
    const newNodes = preset.nodes.filter(id => !unlocked.includes(id));
    const spNeeded = newNodes.reduce((acc, id) => {
      const node = GRAPH_DATA.nodes.find(n => n.id === id);
      return acc + (node?.sp || 0);
    }, 0);
    const goldNeeded = newNodes.reduce((acc, id) => {
      const node = GRAPH_DATA.nodes.find(n => n.id === id);
      return acc + (node?.gold || 0);
    }, 0);
    
    if (spNeeded > sp || goldNeeded > currentGold) {
      playSound('error');
      setConfirmPreset(null);
      return;
    }
    playSound('purchase');
    newNodes.forEach(id => {
      buyMutation.mutate(id);
      djangoApi.analytics.logEvent("skill_purchased");
    });
    setConfirmPreset(null);
  };

  const selectedNode = GRAPH_DATA.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="relative flex flex-col h-[600px] bg-[#0a0a0f] rounded-xl overflow-hidden border border-border/10">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-[#0a0a0f] to-transparent pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">{t('skill_tree.title')}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono font-bold" style={{ color: "#f0c040", textShadow: "0 0 10px rgba(240,192,64,0.5)" }}>
              {sp} SP
            </div>
            <button
              onClick={() => setShowPresetSave(true)}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono border rounded transition-colors bg-black/50 backdrop-blur"
              style={{ borderColor: "#f0c04040", color: "#f0c040" }}
            >
              <Save className="w-2.5 h-2.5" /> {t('skill_tree.btn_save')}
            </button>
            <button
              onClick={() => setShowRespec(true)}
              disabled={unlocked.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono border rounded transition-colors bg-black/50 backdrop-blur disabled:opacity-30"
              style={{ borderColor: "#ef444440", color: "#ef4444" }}
            >
              <RotateCcw className="w-2.5 h-2.5" /> {t('skill_tree.btn_respec')}
            </button>
          </div>
        </div>

        {/* Presets Row */}
        {presets.length > 0 && (
          <div className="mt-2 flex gap-2 pointer-events-auto">
            {presets.map(p => (
              <button
                key={p.name}
                onClick={() => loadPreset(p)}
                className="px-2 py-1 text-[9px] font-mono rounded border transition-colors bg-black/50 backdrop-blur hover:bg-primary/20"
                style={{ borderColor: "rgba(240,192,64,0.3)", color: "#f0c040" }}
              >
                📋 {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <TransformWrapper
        minScale={0.3}
        maxScale={2.0}
        initialScale={1}
        centerOnInit={true}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]" style={{ touchAction: "none" }}>
            {/* Controls Panel */}
            <div className="absolute top-4 right-4 z-50 flex flex-col gap-1.5 bg-black/60 backdrop-blur border border-white/10 rounded-lg p-1.5 shadow-xl">
              <button onClick={() => zoomIn()} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => zoomOut()} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={() => resetTransform()} className="p-2 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors" title="Reset View"><House className="w-4 h-4" /></button>
            </div>
            
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
              <div 
                className="relative"
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
              >
                {/* Background Grid Pattern - FTB Style Stone/Grid */}
                <div 
                  className="absolute inset-0" 
                  style={{ 
                    backgroundColor: '#1e1e1e',
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                    backgroundSize: '40px 40px' 
                  }}
          />

          {/* SVG Connectors - Chain Style */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {GRAPH_DATA.links.map(link => {
              const isSourceUnlocked = link.sourceId === "center" || unlocked.includes(link.sourceId);
              const isTargetUnlocked = unlocked.includes(link.targetId);
              
              // Determine if target is available
              const targetNode = GRAPH_DATA.nodes.find(n => n.id === link.targetId);
              const targetCanAfford = targetNode ? (sp >= (targetNode.sp || 0) && currentGold >= (targetNode.gold || 0)) : false;
              const isTargetAvailable = isSourceUnlocked && !isTargetUnlocked && targetCanAfford;

              const isMastered = isTargetUnlocked;
              
              // Leading into locked node -> dark gray. Else -> branch color
              const frontColor = (isMastered || isTargetAvailable) ? link.color : "#4a4a4a";

              let pathStr = "";
              if (link.isOrthogonal) {
                const midX = link.x1 + 60;
                pathStr = `${link.x1},${link.y1} ${midX},${link.y1} ${midX},${link.y2} ${link.x2},${link.y2}`;
              } else {
                pathStr = `${link.x1},${link.y1} ${link.x2},${link.y2}`;
              }

              return (
                <g key={link.id}>
                  {/* Back shadow/chain outline line */}
                  <motion.polyline
                    points={pathStr}
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                  {/* Front colored line */}
                  <motion.polyline
                    points={pathStr}
                    fill="none"
                    stroke={frontColor}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {GRAPH_DATA.nodes.map(node => {
            const isUnlocked = node.isStart || unlocked.includes(node.id);
            const prereqMet = node.isStart || !node.requires || unlocked.includes(node.requires);
            const isSelected = selectedNodeId === node.id;
            
            let state = "LOCKED";
            if (isUnlocked) state = "MASTERED";
            else if (prereqMet && sp >= (node.sp || 0) && currentGold >= (node.gold || 0)) state = "AVAILABLE";

            // Colors based on state
            let outerBorderColor = "#5a5a5a";
            let slotBg = "#2b2b2b";
            let slotIconColor = "#888888";
            let showCheckmark = false;
            let showPulse = false;
            let outerRingColor = "transparent";
            let outerRingOpacity = 0;

            if (state === "MASTERED") {
              outerBorderColor = "#c99a2e";
              slotBg = "#3a2f14";
              slotIconColor = node.color || "#fff";
              showCheckmark = true;
              outerRingColor = "#c99a2e";
              outerRingOpacity = 0.5;
            } else if (state === "AVAILABLE") {
              outerBorderColor = "#e8e8e8";
              slotBg = "#2b2b2b";
              slotIconColor = node.color || "#fff";
              showPulse = true;
              outerRingColor = "#e8e8e8";
              outerRingOpacity = 0.4;
            }

            // Start node override
            if (node.isStart) {
              outerBorderColor = "#c99a2e";
              slotBg = "#3a2f14";
              slotIconColor = "#fff";
              showCheckmark = false;
            }

            const Icon = node.isStart ? Sparkles : (CAT_ICONS[node.branchKey] || Sparkles);
            
            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: node.x - 32,
                  top: node.y - 32,
                  width: 64,
                  height: 64,
                  zIndex: isSelected ? 30 : 10,
                }}
              >
                {/* Subtle Outer Ring (Animated if available) */}
                {(state === "AVAILABLE" || state === "MASTERED") && (
                  <motion.div
                    className="absolute inset-0 rounded-sm pointer-events-none"
                    style={{
                      border: `1px solid ${outerRingColor}`,
                      margin: "-4px",
                    }}
                    animate={showPulse ? { opacity: [0.4, 0.7, 0.4] } : { opacity: outerRingOpacity }}
                    transition={showPulse ? { duration: 2, ease: "easeInOut", repeat: Infinity } : {}}
                  />
                )}

                <motion.button
                  onClick={(e) => {
                    setSelectedNodeId(node.id);
                    playSound("click");
                  }}
                  className="w-full h-full relative flex items-center justify-center transition-all duration-300 outline-none"
                  style={{
                    backgroundColor: slotBg,
                    border: `3px solid ${outerBorderColor}`,
                    boxShadow: `
                      inset 2px 2px 0px rgba(255,255,255,0.15),
                      inset -2px -2px 0px rgba(0,0,0,0.5),
                      ${isSelected ? '0 0 0 2px #fff' : 'none'}
                    `,
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {state === "LOCKED" ? (
                    <Lock className="w-8 h-8 text-muted-foreground/40" />
                  ) : (
                    <Icon 
                      className="w-8 h-8" 
                      style={{ color: slotIconColor }} 
                    />
                  )}
                  
                  {/* Mastered Checkmark Badge */}
                  {showCheckmark && !node.isStart && (
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-zinc-900 border-2 border-[#c99a2e] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#c99a2e]" strokeWidth={3} />
                    </div>
                  )}
                </motion.button>
                
                {/* Node Label */}
                {!node.isStart && (
                  <div 
                    className="absolute -bottom-7 w-48 -ml-8 text-center pointer-events-none"
                    style={{
                      fontFamily: "'Nunito', sans-serif",
                      fontSize: "10px",
                      fontWeight: 800,
                      color: state === "MASTERED" ? node.color : state === "AVAILABLE" ? "#e8d8b0" : "rgba(200,170,80,0.4)",
                      textShadow: "0 1px 4px #000, 0 1px 8px #000"
                    }}
                  >
                    {t(`rpgData.skillTree.${node.id}.name`, node.name)}
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>

      {/* Info Panel (Bottom Docked) */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-40 border-t bg-black/95 backdrop-blur-md p-3 md:p-4"
            style={{ borderTopColor: `${selectedNode.color}40` }}
          >
            <button 
              onClick={() => setSelectedNodeId(null)}
              className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-white"
            >
              <X size={16} />
            </button>
            
            <div className="flex gap-2 md:gap-4 items-start w-full">
              <div 
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 border-2"
                style={{
                  borderColor: selectedNode.color,
                  background: `${selectedNode.color}20`,
                  boxShadow: `0 0 15px ${selectedNode.color}40`
                }}
              >
                {(() => {
                  const SIcon = CAT_ICONS[selectedNode.branchKey] || Sparkles;
                  return <SIcon className="w-5 h-5 md:w-6 md:h-6" style={{ color: selectedNode.color }} />;
                })()}
              </div>
              
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  <h3 className="font-mono font-bold text-xs md:text-sm truncate" style={{ color: selectedNode.color }}>
                    {t(`rpgData.skillTree.${selectedNode.id}.name`, selectedNode.name)}
                  </h3>
                  <span className="text-[8px] md:text-[9px] font-mono px-1.5 rounded bg-white/10 text-white/70 whitespace-nowrap">
                    TIER {selectedNode.tier}
                  </span>
                </div>
                <div className="text-[9px] md:text-[10px] font-mono text-muted-foreground mt-1 leading-relaxed line-clamp-3 md:line-clamp-none break-words">
                  {t(`rpgData.skillTree.${selectedNode.id}.desc`, selectedNode.desc)}
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end justify-center min-w-[70px] md:min-w-[100px]">
                {unlocked.includes(selectedNode.id) ? (
                  <div className="flex items-center gap-1 font-mono font-bold text-[10px] md:text-[11px]" style={{ color: selectedNode.color }}>
                    <Check size={14} /> {t('skill_tree.status_active')}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-mono font-bold mb-1 md:mb-1.5" style={{ color: `${selectedNode.color}aa` }}>
                      <span className={sp < selectedNode.sp ? "text-red-400" : ""}>{selectedNode.sp} SP</span>
                      <span className={currentGold < selectedNode.gold ? "text-red-400" : ""}>{selectedNode.gold} G</span>
                    </div>
                    <button
                      onClick={() => unlock(selectedNode)}
                      disabled={!canUnlock(selectedNode) || buyMutation.isPending}
                      className="w-full px-2 py-1 md:px-4 md:py-1.5 rounded-lg border text-[10px] md:text-xs font-mono font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ 
                        borderColor: selectedNode.color, 
                        color: selectedNode.color,
                        background: `${selectedNode.color}15`
                      }}
                    >
                      {buyMutation.isPending ? "..." : t('skill_tree.btn_unlock')}
                    </button>
                  </>
                )}
                
                {/* Prerequisite warning */}
                {!unlocked.includes(selectedNode.id) && selectedNode.requires && !unlocked.includes(selectedNode.requires) && (
                  <div className="text-[7px] md:text-[8px] font-mono text-red-400 mt-1 uppercase whitespace-nowrap">
                    {t('skill_tree.req_prev')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Respec Modal */}
      <AnimatePresence>
        {showRespec && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setShowRespec(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="rounded-2xl border p-6 max-w-xs w-full space-y-4 text-center"
              style={{ background: "rgba(14,10,8,0.98)", borderColor: "rgba(239,68,68,0.4)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-2xl">⚠️</div>
              <div className="font-mono text-sm font-bold text-red-400">{t('skill_tree.respec_title')}</div>
              <div className="text-xs font-mono text-muted-foreground">
                {t('skill_tree.respec_desc', { count: unlocked.length })}<br />
                {t('skill_tree.cost')} <span className="text-yellow-400 font-bold">{respecCost}G</span>
                {gold < respecCost && <span className="text-red-400 block mt-1">{t('skill_tree.not_enough_gold')}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRespec(false)}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono text-muted-foreground border-border/50 hover:bg-accent/20">
                  {t('skill_tree.btn_cancel')}
                </button>
                <button
                  onClick={doRespec}
                  disabled={gold < respecCost}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono font-bold disabled:opacity-30 transition-colors"
                  style={{ borderColor: "#ef444460", color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
                >
                  {t('skill_tree.btn_confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Preset Modal */}
      <AnimatePresence>
        {showPresetSave && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setShowPresetSave(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="rounded-2xl border p-6 max-w-xs w-full space-y-4"
              style={{ background: "rgba(14,10,8,0.98)", borderColor: "rgba(240,192,64,0.3)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="font-mono text-sm font-bold" style={{ color: "#f0c040" }}>{t('skill_tree.preset_title')}</div>
              <div className="text-[10px] font-mono text-muted-foreground/60">
                {t('skill_tree.preset_desc', { count: unlocked.length })}
              </div>
              <input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder={t('skill_tree.preset_placeholder')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
                onKeyDown={e => e.key === "Enter" && savePreset()}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowPresetSave(false)}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono text-muted-foreground border-border/50 hover:bg-accent/20">
                  {t('skill_tree.btn_cancel')}
                </button>
                <button
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono font-bold disabled:opacity-30"
                  style={{ borderColor: "#f0c04060", color: "#f0c040", background: "rgba(240,192,64,0.1)" }}
                >
                  {t('skill_tree.btn_save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}