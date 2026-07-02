import { useState } from "react";

import { SKILL_TREE } from "@/constants/rpgData";
import { Lock, RotateCcw, Save } from "lucide-react";
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

// ─── SVG CONNECTOR LINES ─────────────────────────────────────────────────────
// Renders an SVG line connecting node index `from` to `to` (left to right in a row of `cols`)
function BranchConnectors({ branch, unlocked, cols = 3 }) {
  const nodes = branch.nodes;
  // Build pairs based on `requires`
  const pairs = nodes.flatMap((node, i) => {
    if (!node.requires) return [];
    const fromIdx = nodes.findIndex(n => n.id === node.requires);
    if (fromIdx < 0) return [];
    return [{ from: fromIdx, to: i }];
  });

  if (pairs.length === 0) return null;

  return (
    <div className="relative pointer-events-none" style={{ height: 0 }}>
      {pairs.map(({ from, to }, idx) => {
        const fromRow = Math.floor(from / cols);
        const fromCol = from % cols;
        const toRow = Math.floor(to / cols);
        const toCol = to % cols;

        const isActive = unlocked.includes(nodes[from].id);
        const isReachable = unlocked.includes(nodes[from].id) && !unlocked.includes(nodes[to].id);
        const color = isActive ? branch.color : "#2a2a3a";

        // Same row: horizontal connector
        if (fromRow === toRow) {
          return (
            <motion.div
              key={idx}
              className="absolute"
              style={{
                top: `calc(${fromRow * 100}% - 20px)`,
                left: `calc(${(fromCol + 1) / cols * 100}%)`,
                width: `calc(${1 / cols * 100}%)`,
                height: 2,
                background: isActive
                  ? `linear-gradient(90deg, ${color}, ${color}aa)`
                  : "#2a2a3a",
                boxShadow: isActive ? `0 0 6px ${color}80` : "none",
                transition: "all 0.4s ease",
              }}
            />
          );
        }

        // Cross-row: vertical
        return (
          <motion.div
            key={idx}
            className="absolute"
            style={{
              top: `calc(${fromRow * 100}% + 20px)`,
              left: `calc(${(fromCol + 0.5) / cols * 100}% - 1px)`,
              width: 2,
              height: `calc(${(toRow - fromRow) * 100}% - 40px)`,
              background: isActive
                ? `linear-gradient(180deg, ${color}, ${color}88)`
                : "#2a2a3a",
              boxShadow: isActive ? `0 0 6px ${color}60` : "none",
              transition: "all 0.4s ease",
            }}
          />
        );
      })}
    </div>
  );
}

export default function SkillTreePanel({ skillTree, onUpdate, gold, onSpendGold }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showRespec, setShowRespec] = useState(false);
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState(loadPresets);
  const [confirmPreset, setConfirmPreset] = useState(null);
  
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

  const unlock = (node, branchKey) => {
    if (!canUnlock(node)) return;
    buyMutation.mutate(node.id);
  };

  const respecCost = getRespecCost(unlocked.length);

  const respecMutation = useMutation({
    mutationFn: () => djangoApi.skills.respec(),
    onSuccess: () => {
      playSound('error'); // standard for reset
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      refreshProfile();
      setShowRespec(false);
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
    // Calculate how many new nodes need SP
    const newNodes = preset.nodes.filter(id => !unlocked.includes(id));
    const allNodes = Object.values(SKILL_TREE).flatMap(b => b.nodes);
    const spNeeded = newNodes.reduce((acc, id) => {
      const node = allNodes.find(n => n.id === id);
      return acc + (node?.sp || 0);
    }, 0);
    const goldNeeded = newNodes.reduce((acc, id) => {
      const node = allNodes.find(n => n.id === id);
      return acc + (node?.gold || 0);
    }, 0);
    if (spNeeded > sp || goldNeeded > currentGold) {
      playSound('error');
      setConfirmPreset(null);
      return;
    }
    playSound('purchase');
    // We would need a multi-buy endpoint or sequentially buy them.
    // For now, sequentially mutate. This is a bit heavy, but it works.
    newNodes.forEach(id => {
      buyMutation.mutate(id);
    });
    setConfirmPreset(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Skill Tree</div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-mono font-bold" style={{ color: "#f0c040" }}>{sp} SP</div>
          <button
            onClick={() => setShowPresetSave(true)}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono border rounded transition-colors"
            style={{ borderColor: "#f0c04040", color: "#f0c040" }}
            title="Save current build as preset"
          >
            <Save className="w-2.5 h-2.5" /> SAVE BUILD
          </button>
          <button
            onClick={() => setShowRespec(true)}
            disabled={unlocked.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono border rounded transition-colors disabled:opacity-30"
            style={{ borderColor: "#ef444440", color: "#ef4444" }}
            title={`Respec all nodes — costs ${respecCost}G`}
          >
            <RotateCcw className="w-2.5 h-2.5" /> RESPEC ({respecCost}G)
          </button>
        </div>
      </div>

      {/* Saved Presets */}
      {presets.length > 0 && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "rgba(240,192,64,0.15)", background: "rgba(20,18,12,0.8)" }}>
          <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">Saved Builds</div>
          <div className="flex gap-2 flex-wrap">
            {presets.map(p => (
              <button
                key={p.name}
                onClick={() => loadPreset(p)}
                className="px-2 py-1 text-[9px] font-mono rounded border transition-colors hover:bg-primary/10"
                style={{ borderColor: "rgba(240,192,64,0.3)", color: "#f0c040" }}
              >
                📋 {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Branch panels */}
      {Object.entries(SKILL_TREE).map(([branchKey, branch]) => (
        <div key={branchKey} className="rounded-xl border p-3 space-y-3"
          style={{ borderColor: `${branch.color}20`, background: "rgba(14,12,10,0.85)" }}>
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: branch.color }}>
            <span style={{ textShadow: `0 0 8px ${branch.color}80` }}>── {branch.label} ──</span>
            <span className="text-muted-foreground/30 font-normal">
              {unlocked.filter(id => branch.nodes.find(n => n.id === id)).length}/{branch.nodes.length}
            </span>
          </div>

          {/* Nodes grid with connector lines */}
          <div className="relative">
            {/* SVG connectors rendered behind */}
            <div className="absolute inset-0 z-0">
              {branch.nodes.flatMap((node, toIdx) => {
                if (!node.requires) return [];
                const fromIdx = branch.nodes.findIndex(n => n.id === node.requires);
                if (fromIdx < 0) return [];
                const cols = 3;
                const fromCol = fromIdx % cols;
                const toCol = toIdx % cols;
                const fromRow = Math.floor(fromIdx / cols);
                const toRow = Math.floor(toIdx / cols);
                const isActive = unlocked.includes(node.requires);
                const color = isActive ? branch.color : "#2a2a3a";
                const cellW = 100 / cols;
                // horizontal: same row
                if (fromRow === toRow) {
                  const left = (fromCol + 1) * cellW + "%";
                  const w = (toCol - fromCol - 1) * cellW + cellW + "%";
                  const top = `calc(${fromRow * (100 / Math.ceil(branch.nodes.length / cols))}% + 24px)`;
                  return [(
                    <div key={`${fromIdx}-${toIdx}`}
                      className="absolute pointer-events-none transition-all duration-500"
                      style={{ left, top, width: `calc(${cellW}%)`, height: 2, background: color, boxShadow: isActive ? `0 0 6px ${color}80` : "none" }}
                    />
                  )];
                }
                // vertical: different rows — center of from col down
                const leftPct = (fromCol + 0.5) * cellW;
                return [(
                  <div key={`${fromIdx}-${toIdx}`}
                    className="absolute pointer-events-none transition-all duration-500"
                    style={{ left: `calc(${leftPct}% - 1px)`, top: `calc(${fromRow * 72 + 56}px)`, width: 2, height: `calc(${(toRow - fromRow) * 72 - 16}px)`, background: color, boxShadow: isActive ? `0 0 6px ${color}60` : "none" }}
                  />
                )];
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 relative z-10">
              {branch.nodes.map((node) => {
                const isUnlocked = unlocked.includes(node.id);
                const prereqMet = !node.requires || unlocked.includes(node.requires);
                const affordable = sp >= node.sp && gold >= node.gold;
                const canBuy = prereqMet && affordable && !isUnlocked;

                return (
                  <div
                    key={node.id}
                    className="relative"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <button
                      onClick={() => unlock(node, branchKey)}
                      disabled={!canBuy}
                      className="w-full p-2 rounded-lg border text-center transition-all"
                      style={{
                        borderColor: isUnlocked
                          ? branch.color
                          : canBuy ? `${branch.color}55` : "rgba(240,192,64,0.08)",
                        background: isUnlocked
                          ? `${branch.color}18`
                          : canBuy ? `${branch.color}08` : "rgba(10,8,6,0.6)",
                        boxShadow: isUnlocked ? `0 0 10px ${branch.color}40, inset 0 0 6px ${branch.color}15` : "none",
                        opacity: (!prereqMet && !isUnlocked) ? 0.45 : 1,
                      }}
                    >
                      {!isUnlocked && !prereqMet && <Lock className="w-3 h-3 mx-auto mb-1" style={{ color: "rgba(240,192,64,0.3)" }} />}
                      <div className="text-[9px] font-mono font-bold leading-tight"
                        style={{ color: isUnlocked ? branch.color : prereqMet ? "#e8d8b0" : "rgba(200,170,80,0.4)" }}>
                        {node.name}
                      </div>
                      {/* Show description for all nodes — dimmed if locked */}
                      <div className="text-[7px] font-mono mt-0.5 leading-tight"
                        style={{
                          color: isUnlocked
                            ? `${branch.color}cc`
                            : prereqMet
                              ? "rgba(200,180,140,0.65)"
                              : "rgba(150,130,80,0.3)",
                        }}>
                        {node.desc}
                      </div>
                      {!isUnlocked && prereqMet && (
                        <div className="text-[8px] font-mono mt-1 font-bold" style={{ color: `${branch.color}99` }}>
                          {node.sp}SP · {node.gold}G
                        </div>
                      )}
                      {isUnlocked && (
                        <div className="text-[8px] font-mono mt-0.5 font-bold" style={{ color: branch.color }}>✦ ACTIVE</div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Respec confirmation modal */}
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

      {/* Save preset modal */}
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