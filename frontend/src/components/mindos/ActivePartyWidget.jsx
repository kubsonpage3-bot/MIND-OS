import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { djangoApi } from "@/api/djangoClient";
import OptimizedImage from "./OptimizedImage";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";


const RANK_BORDER_COLOR = {
  'C': 'border-blue-500/60',
  'B': 'border-orange-500/60',
  'A': 'border-purple-500/60',
  'S': 'border-yellow-500/60',
  'SS': 'border-yellow-400/80',
};

const RANK_COLORS = { E: "#888", D: "#22c55e", C: "#3b82f6", B: "#a855f7", A: "#f0c040", S: "#ff3355", SS: "#ffd700" };

export default function ActivePartyWidget() {
  const { profile, refreshProfile } = useDjangoAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedAlly, setSelectedAlly] = useState(null);
  const queryClient = useQueryClient();

  const updateAlliesMutation = useMutation({
    mutationFn: (newAllies) => djangoApi.profile.update({ active_allies: newAllies }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      refreshProfile();
    }
  });

  const { data: ALLIES = [] } = useQuery({
    queryKey: ["allies-config"],
    queryFn: () => djangoApi.allies.getConfig(),
    staleTime: Infinity,
  });

  let activeAllyIds = profile?.active_allies || [];
  if (typeof activeAllyIds === 'string') {
    try {
      activeAllyIds = JSON.parse(activeAllyIds);
    } catch {
      // If it's a plain string like "neko", put it in an array
      activeAllyIds = [activeAllyIds];
    }
  }
  if (!Array.isArray(activeAllyIds)) {
    activeAllyIds = [];
  }
  const recruitedLevels = profile?.recruited_allies || {};

  const handleDismiss = (allyId) => {
    if (updateAlliesMutation.isPending) return;
    const newAllies = activeAllyIds.filter(id => id !== allyId);
    updateAlliesMutation.mutate(newAllies, {
      onSuccess: () => {
        setSelectedAlly(null);
      }
    });
  };
  
  // Create 3 slots
  const slots = [0, 1, 2].map(index => {
    const allyId = activeAllyIds[index];
    if (allyId && recruitedLevels[allyId] !== undefined) {
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
    <div className="mb-4 rounded-none border-x-0 border-y md:border md:rounded-lg overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] shadow-sm pixel-bracket-box backdrop-blur-md relative">
      {/* Background subtle scanline */}
      <div className="absolute inset-0 pixel-scanlines opacity-10 pointer-events-none" />
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 relative z-10">
        <span className="font-mono font-bold text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          ⚔️ {t('settings.active_party', 'ACTIVE ALLIES')}
        </span>
      </div>
      
      <div className="px-4 pb-4 relative z-10">
        {allEmpty ? (
          <p className="font-mono text-xs text-center py-2" style={{ color: "var(--habit-dim)" }}>
            {t('settings.recruit_allies_hint', 'Recruit allies in Shop → Allies to strengthen your party')}
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
                  className={`border ${rankClass} rounded-lg p-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] bg-black/20 hover:bg-white/5 pixel-bracket-box`}
                >
                  <OptimizedImage src={ally.image} className="w-16 h-16 rounded object-contain" style={{ imageRendering: 'pixelated' }} />
                  <span className="font-mono text-xs font-bold text-center truncate w-full" style={{ color: "var(--habit-text)" }}>{ally.name}</span>
                  <span className="font-mono text-[10px] text-center truncate w-full font-bold text-green-400">+{currentBuff}</span>
                </div>
              );
            } else {
              return (
                <div 
                  key={`slot-${index}`}
                  className="border border-dashed border-purple-500/30 rounded-lg p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:border-purple-500/60 hover:bg-purple-500/5 bg-black/10"
                  onClick={handleEmptyClick}
                >
                  <div className="w-14 h-14 rounded flex items-center justify-center border border-dashed border-purple-500/20" style={{ background: "rgba(123, 97, 255, 0.08)" }}>
                    <span className="text-xl text-purple-400/60 font-mono">+</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{t('settings.add_ally', 'Add Ally')}</span>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1rem)' }}
            onClick={() => setSelectedAlly(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border rounded-2xl p-5 max-w-xs w-full space-y-4 max-h-[85svh] overflow-y-auto"
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
                  {t('settings.lv_active_buff', 'Lv{{level}} Active Buff:', { level: recruitedLevels[selectedAlly.id] || 1 })}<br />
                  <span className="text-foreground/80">{selectedAlly.levels[(recruitedLevels[selectedAlly.id] || 1) - 1]}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => handleDismiss(selectedAlly.id)}
                  disabled={updateAlliesMutation.isPending}
                  className="w-full py-2 font-mono font-bold text-xs rounded-xl border transition-colors bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateAlliesMutation.isPending ? t('settings.dismissing', 'DISMISSING...') : t('settings.dismiss_from_party', 'DISMISS FROM PARTY')}
                </button>

                <button
                  onClick={() => {
                    setSelectedAlly(null);
                    handleEmptyClick();
                  }}
                  className="w-full py-2 font-mono font-bold text-xs rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ borderColor: "var(--habit-border)", color: "var(--habit-text)" }}
                >
                  {t('settings.view_in_allies', 'VIEW IN ALLIES')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
