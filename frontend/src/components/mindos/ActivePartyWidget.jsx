import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { djangoApi } from "@/api/djangoClient";
import OptimizedImage from "./OptimizedImage";
import { motion, AnimatePresence } from "framer-motion";

const RANK_BORDER_COLOR = {
  'C': 'border-blue-500/60',
  'B': 'border-orange-500/60',
  'A': 'border-purple-500/60',
  'S': 'border-yellow-500/60',
  'SS': 'border-yellow-400/80',
};

const RANK_COLORS = { E: "#888", D: "#22c55e", C: "#3b82f6", B: "#a855f7", A: "#f0c040", S: "#ff3355", SS: "#ffd700" };

export default function ActivePartyWidget() {
  const { profile } = useDjangoAuth();
  const navigate = useNavigate();
  const [selectedAlly, setSelectedAlly] = useState(null);

  const { data: ALLIES = [] } = useQuery({
    queryKey: ["allies-config"],
    queryFn: () => djangoApi.allies.getConfig(),
    staleTime: Infinity,
  });

  let activeAllyIds = profile?.active_allies || [];
  if (typeof activeAllyIds === 'string') {
    try {
      activeAllyIds = JSON.parse(activeAllyIds);
    } catch(e) {
      // If it's a plain string like "neko", put it in an array
      activeAllyIds = [activeAllyIds];
    }
  }
  if (!Array.isArray(activeAllyIds)) {
    activeAllyIds = [];
  }
  const recruitedLevels = profile?.recruited_allies || {};
  
  // Create 3 slots
  const slots = [0, 1, 2].map(index => {
    const allyId = activeAllyIds[index];
    if (allyId) {
      return ALLIES.find(a => a.id === allyId) || null;
    }
    return null;
  });

  const allEmpty = slots.every(slot => slot === null);

  const handleEmptyClick = () => {
    // Navigate to Character -> Shop -> Allies using the AppShell routing
    navigate("/?app=mind&section=character&sub=shop&shopTab=allies");
  };

  return (
    <div className="mb-4 rounded-none border-x-0 border-y md:border md:rounded-2xl overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "var(--habit-text)" }}>
          ⚔️ ACTIVE PARTY
        </span>
      </div>
      
      <div className="px-4 pb-4">
        {allEmpty ? (
          <p className="text-white/40 text-sm text-center py-2">
            Recruit allies in Shop → Allies to strengthen your party
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          {slots.map((ally, index) => {
            if (ally) {
              const level = recruitedLevels[ally.id] || 1;
              const currentBuff = ally.levels[level - 1] || ally.buff_description || "";
              const rankClass = RANK_BORDER_COLOR[ally.rank] || 'border-purple-500/40';

              return (
                <div 
                  key={`slot-${index}`}
                  onClick={() => setSelectedAlly(ally)}
                  className={`border ${rankClass} rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-white/5 transition-colors`}
                >
                  <OptimizedImage src={ally.image} className="w-16 h-16 rounded-lg object-cover bg-black/50" style={{ imageRendering: 'pixelated' }} />
                  <span className="text-xs font-bold text-white text-center truncate w-full">{ally.name}</span>
                  <span className="text-[10px] text-green-400 text-center truncate w-full">+{currentBuff}</span>
                </div>
              );
            } else {
              return (
                <div 
                  key={`slot-${index}`}
                  className="border border-dashed border-white/20 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-white/40 transition-colors"
                  onClick={handleEmptyClick}
                >
                  <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center">
                    <span className="text-2xl text-white/30">+</span>
                  </div>
                  <span className="text-xs text-white/40 mt-1">Add Ally</span>
                </div>
              );
            }
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedAlly && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
            onClick={() => setSelectedAlly(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border rounded-2xl p-5 max-w-xs w-full space-y-4"
              style={{ borderColor: `${selectedAlly.color}60`, boxShadow: `0 0 40px ${selectedAlly.color}30` }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2" style={{ borderColor: selectedAlly.color }}>
                  <OptimizedImage
                    src={selectedAlly.image}
                    alt={selectedAlly.name}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
                <div className="font-mono font-black text-sm" style={{ color: selectedAlly.color }}>{selectedAlly.name}</div>
                <div className="text-[9px] font-mono text-muted-foreground/50">{selectedAlly.title}</div>
                
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                  style={{ background: `${RANK_COLORS[selectedAlly.rank]}20`, color: RANK_COLORS[selectedAlly.rank], border: `1px solid ${RANK_COLORS[selectedAlly.rank]}50` }}>
                  RANK {selectedAlly.rank}
                </span>

                <div className="text-[10px] font-mono mt-2 text-center text-green-400">
                  Lv{recruitedLevels[selectedAlly.id] || 1} Active Buff:<br />
                  <span className="text-foreground/80">{selectedAlly.levels[(recruitedLevels[selectedAlly.id] || 1) - 1]}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedAlly(null);
                  handleEmptyClick();
                }}
                className="w-full py-2 font-mono font-bold text-xs rounded-xl border border-white/20 hover:bg-white/10 transition-colors mt-2"
              >
                VIEW IN ALLIES
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
