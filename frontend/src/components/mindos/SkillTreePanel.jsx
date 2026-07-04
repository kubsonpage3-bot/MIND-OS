import { useState, useRef, useEffect } from "react";
import { SKILL_TREE } from "@/constants/rpgData";
import { Lock, RotateCcw, Save, Brain, Dumbbell, Coins, Sparkles, BookOpen, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/soundEffects.js";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { showRewardToast } from "@/components/mindos/RewardToast";

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
const CANVAS_SIZE = 1000;
const CENTER_X = CANVAS_SIZE / 2;
const CENTER_Y = CANVAS_SIZE / 2;

// Standard branch angles (0 is top, goes clockwise)
const BRANCH_ANGLES = {
  mind: -90,
  body: -18,
  wealth: 54,
  spirit: 126,
  knowledge: 198,
};

// Base radius per tier, and subtle angle wiggle to make it "organic"
const TIER_LAYOUT = {
  1: { r: 80, aOffset: 0 },
  2: { r: 160, aOffset: 12 },
  3: { r: 240, aOffset: -8 },
  4: { r: 320, aOffset: 15 },
  5: { r: 400, aOffset: -10 },
  6: { r: 480, aOffset: 0 },
};

function getCoords(branchKey, tier) {
  const baseAngle = BRANCH_ANGLES[branchKey];
  const layout = TIER_LAYOUT[tier];
  if (!layout) return { x: CENTER_X, y: CENTER_Y };
  
  const angleDeg = baseAngle + layout.aOffset;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  return {
    x: CENTER_X + layout.r * Math.cos(angleRad),
    y: CENTER_Y + layout.r * Math.sin(angleRad),
  };
}

// Build a flat array of all nodes with absolute coordinates
function buildGraphData() {
  const nodes = [];
  const links = [];
  
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
          });
        }
      } else {
        // Root node connects to center
        links.push({
          id: `center->${node.id}`,
          branchKey,
          color: branch.color,
          x1: CENTER_X,
          y1: CENTER_Y,
          x2: coords.x,
          y2: coords.y,
          sourceId: "center",
          targetId: node.id,
        });
      }
    });
  });
  
  return { nodes, links };
}

const GRAPH_DATA = buildGraphData();

export default function SkillTreePanel({ skillTree, onUpdate, gold, onSpendGold }) {
  const [showRespec, setShowRespec] = useState(false);
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState(loadPresets);
  const [confirmPreset, setConfirmPreset] = useState(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const scrollRef = useRef(null);
  
  // Drag panning state
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const hasDragged = useRef(false);
  
  const { profile, refreshProfile } = useDjangoAuth();
  const queryClient = useQueryClient();

  const unlocked = profile?.unlocked_skills || [];
  const sp = profile?.skill_points || 0;
  const currentGold = profile?.gold || gold;

  // Center canvas on mount
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollLeft = (CANVAS_SIZE - el.clientWidth) / 2;
      el.scrollTop = (CANVAS_SIZE - el.clientHeight) / 2;
    }
  }, []);

  const handlePointerDown = (e) => {
    // Only process mouse events (let touch rely on native scroll)
    if (e.pointerType !== 'mouse') return;
    // Only left click
    if (e.button !== 0) return;
    
    setIsDragging(true);
    hasDragged.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop
    };
  };

  const handlePointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasDragged.current = true;
    }
    
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    scrollRef.current.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // Don't reset hasDragged here so click events can read it,
    // it will be reset on the next pointer down.
  };

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
          <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Organic Skill Tree</div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono font-bold" style={{ color: "#f0c040", textShadow: "0 0 10px rgba(240,192,64,0.5)" }}>
              {sp} SP
            </div>
            <button
              onClick={() => setShowPresetSave(true)}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono border rounded transition-colors bg-black/50 backdrop-blur"
              style={{ borderColor: "#f0c04040", color: "#f0c040" }}
            >
              <Save className="w-2.5 h-2.5" /> SAVE
            </button>
            <button
              onClick={() => setShowRespec(true)}
              disabled={unlocked.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono border rounded transition-colors bg-black/50 backdrop-blur disabled:opacity-30"
              style={{ borderColor: "#ef444440", color: "#ef4444" }}
            >
              <RotateCcw className="w-2.5 h-2.5" /> RESPEC
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
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-auto relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y" }} // Hide scrollbar for immersion
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div 
          className="relative"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        >
          {/* Background Grid Pattern (optional, subtle) */}
          <div 
            className="absolute inset-0 opacity-[0.03]" 
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
          />

          {/* SVG Connectors */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {GRAPH_DATA.links.map(link => {
              const isSourceUnlocked = link.sourceId === "center" || unlocked.includes(link.sourceId);
              const isTargetUnlocked = unlocked.includes(link.targetId);
              const isActive = isTargetUnlocked;
              const isAvailable = isSourceUnlocked && !isTargetUnlocked;
              
              let strokeColor = "#2a2a3a";
              if (isActive) strokeColor = link.color;
              else if (isAvailable) strokeColor = `${link.color}55`;

              return (
                <motion.line
                  key={link.id}
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke={strokeColor}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeLinecap="round"
                  style={{
                    filter: isActive ? `drop-shadow(0 0 4px ${link.color})` : "none",
                  }}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              );
            })}
          </svg>

          {/* Central Core */}
          <div 
            className="absolute flex items-center justify-center rounded-full"
            style={{ 
              left: CENTER_X - 30, top: CENTER_Y - 30, width: 60, height: 60,
              background: "radial-gradient(circle, #fff 0%, #f0c040 30%, transparent 70%)",
              boxShadow: "0 0 40px rgba(240,192,64,0.5)",
            }}
          >
            <div className="w-4 h-4 bg-white rounded-full blur-sm" />
          </div>

          {/* Nodes */}
          {GRAPH_DATA.nodes.map(node => {
            const isUnlocked = unlocked.includes(node.id);
            const prereqMet = !node.requires || unlocked.includes(node.requires);
            const isSelected = selectedNodeId === node.id;
            
            const Icon = CAT_ICONS[node.branchKey] || Sparkles;
            
            return (
              <motion.button
                key={node.id}
                onClick={(e) => {
                  if (hasDragged.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  setSelectedNodeId(node.id);
                  playSound("click");
                }}
                className="absolute flex items-center justify-center rounded-full transition-all duration-300"
                style={{
                  left: node.x - 22,
                  top: node.y - 22,
                  width: 44,
                  height: 44,
                  border: `2px solid ${isUnlocked ? node.color : prereqMet ? `${node.color}80` : "#2a2a3a"}`,
                  background: isUnlocked ? `${node.color}20` : "#0a0a0f",
                  boxShadow: isUnlocked 
                    ? `0 0 15px ${node.color}60, inset 0 0 10px ${node.color}40` 
                    : isSelected ? `0 0 0 2px #fff` : "none",
                  zIndex: isSelected ? 30 : 10,
                  opacity: !prereqMet && !isUnlocked ? 0.4 : 1,
                }}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
              >
                {!isUnlocked && !prereqMet ? (
                  <Lock className="w-4 h-4 text-muted-foreground/50" />
                ) : (
                  <Icon 
                    className="w-5 h-5" 
                    style={{ 
                      color: isUnlocked ? node.color : prereqMet ? `${node.color}90` : "#444",
                      filter: isUnlocked ? `drop-shadow(0 0 4px ${node.color})` : "none"
                    }} 
                  />
                )}
                
                {/* Node Label (always visible but small) */}
                <div 
                  className="absolute -bottom-6 w-32 text-center pointer-events-none"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: "9px",
                    fontWeight: 800,
                    color: isUnlocked ? node.color : prereqMet ? "#e8d8b0" : "rgba(200,170,80,0.4)",
                    textShadow: "0 1px 4px #000, 0 1px 8px #000"
                  }}
                >
                  {node.name}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

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
                    {selectedNode.name}
                  </h3>
                  <span className="text-[8px] md:text-[9px] font-mono px-1.5 rounded bg-white/10 text-white/70 whitespace-nowrap">
                    TIER {selectedNode.tier}
                  </span>
                </div>
                <div className="text-[9px] md:text-[10px] font-mono text-muted-foreground mt-1 leading-relaxed line-clamp-3 md:line-clamp-none break-words">
                  {selectedNode.desc}
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end justify-center min-w-[70px] md:min-w-[100px]">
                {unlocked.includes(selectedNode.id) ? (
                  <div className="flex items-center gap-1 font-mono font-bold text-[10px] md:text-[11px]" style={{ color: selectedNode.color }}>
                    <Check size={14} /> ACTIVE
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
                      {buyMutation.isPending ? "..." : "UNLOCK"}
                    </button>
                  </>
                )}
                
                {/* Prerequisite warning */}
                {!unlocked.includes(selectedNode.id) && selectedNode.requires && !unlocked.includes(selectedNode.requires) && (
                  <div className="text-[7px] md:text-[8px] font-mono text-red-400 mt-1 uppercase whitespace-nowrap">
                    Req. Prev
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
              <div className="font-mono text-sm font-bold text-red-400">RESPEC SKILL TREE</div>
              <div className="text-xs font-mono text-muted-foreground">
                All {unlocked.length} nodes will be reset. SP refunded.<br />
                Cost: <span className="text-yellow-400 font-bold">{respecCost}G</span>
                {gold < respecCost && <span className="text-red-400 block mt-1">Not enough gold!</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRespec(false)}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono text-muted-foreground border-border/50 hover:bg-accent/20">
                  CANCEL
                </button>
                <button
                  onClick={doRespec}
                  disabled={gold < respecCost}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono font-bold disabled:opacity-30 transition-colors"
                  style={{ borderColor: "#ef444460", color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
                >
                  CONFIRM
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
              <div className="font-mono text-sm font-bold" style={{ color: "#f0c040" }}>SAVE BUILD PRESET</div>
              <div className="text-[10px] font-mono text-muted-foreground/60">
                Saves your current {unlocked.length} unlocked nodes. Max 3 presets.
              </div>
              <input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="e.g. Study Week, Combat Build"
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
                onKeyDown={e => e.key === "Enter" && savePreset()}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowPresetSave(false)}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono text-muted-foreground border-border/50 hover:bg-accent/20">
                  CANCEL
                </button>
                <button
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                  className="flex-1 py-2 rounded-lg border text-xs font-mono font-bold disabled:opacity-30"
                  style={{ borderColor: "#f0c04060", color: "#f0c040", background: "rgba(240,192,64,0.1)" }}
                >
                  SAVE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}