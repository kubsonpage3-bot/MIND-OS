// @ts-nocheck
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { djangoApi } from "@/api/djangoClient";
import OptimizedImage from "./OptimizedImage";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Swords, Plus, Shield, Zap, Sparkles } from "lucide-react";
import { useHardwareBack } from "@/utils/modalStack";

const RANK_BORDER_COLOR = {
  'E': 'border-slate-500/50',
  'D': 'border-emerald-500/60',
  'C': 'border-blue-500/60',
  'B': 'border-purple-500/70',
  'A': 'border-amber-400/80',
  'S': 'border-rose-500/90',
  'SS': 'border-yellow-400',
  'SSS': 'border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]',
};

const RANK_COLORS = { 
  E: "#64748b", 
  D: "#22c55e", 
  C: "#3b82f6", 
  B: "#a855f7", 
  A: "#f59e0b", 
  S: "#ef4444", 
  SS: "#ffd700",
  SSS: "#fbbf24"
};

const SLOT_ROLES = [
  { id: "vanguard", role: "VANGUARD", icon: Shield },
  { id: "specialist", role: "SPECIALIST", icon: Zap },
  { id: "support", role: "SUPPORT", icon: Sparkles }
];

export default function ActivePartyWidget() {
  const { profile, refreshProfile } = useDjangoAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedAlly, setSelectedAlly] = useState(null);
  const queryClient = useQueryClient();

  useHardwareBack(!!selectedAlly, () => setSelectedAlly(null));

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

  const activeCount = slots.filter(Boolean).length;

  const handleEmptyClick = () => {
    navigate("/?app=mind&section=character&sub=shop&shopTab=allies");
  };

  return (
    <div 
      className="mb-4 rounded-xl border relative overflow-hidden bg-[var(--habit-panel)] border-[var(--habit-border)] pixel-corner-brackets"
      style={{ boxShadow: "0 4px 24px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05)" }}
    >
      {/* Background ambient light */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(ellipse at 50% 100%, var(--habit-purple) 0%, transparent 70%)"
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--habit-border)] bg-black/15 relative z-10">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-[var(--habit-purple)] animate-pulse" />
          <span className="font-game text-[10px] text-[var(--habit-text)] tracking-wider uppercase font-black flex items-center gap-2">
            {t('settings.active_party', 'ACTIVE PARTY')}
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--habit-purple)]/20 text-[var(--habit-purple)] border border-[var(--habit-purple)]/40 font-bold">
              {activeCount}/3 {t('active_party.allies_badge', 'ALLIES')}
            </span>
          </span>
        </div>
        
        <button
          onClick={handleEmptyClick}
          className="font-game text-[8px] text-[var(--habit-purple)] hover:text-white transition-colors flex items-center gap-1 hover:underline cursor-pointer"
        >
          [ {t('settings.recruit_allies_hint', 'RECRUIT IN SHOP →')} ]
        </button>
      </div>
      
      {/* Slots Grid */}
      <div className="p-3.5 relative z-10">
        <div className="grid grid-cols-3 gap-3">
          {slots.map((ally, index) => {
            const slotConfig = SLOT_ROLES[index];
            const RoleIcon = slotConfig.icon;

            if (ally) {
              const level = recruitedLevels[ally.id] || 1;
              const currentBuff = ally.levels?.[level - 1] || ally.buff_description || "";
              const rankColor = RANK_COLORS[ally.rank] || "#a855f7";
              const rankBorder = RANK_BORDER_COLOR[ally.rank] || 'border-purple-500/60';

              return (
                <motion.div 
                  key={`slot-${index}`}
                  onClick={() => setSelectedAlly(ally)}
                  whileHover={{ scale: 1.04, y: -2 }}
                  transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  className={`relative flex flex-col items-center justify-between p-2.5 rounded-xl border-2 ${rankBorder} bg-black/30 backdrop-blur-sm cursor-pointer overflow-hidden group`}
                  style={{
                    boxShadow: `0 4px 16px ${rankColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                  }}
                >
                  {/* Slot role badge */}
                  <div className="w-full flex items-center justify-between mb-1">
                    <span className="font-game text-[7px] text-[var(--habit-dim)] flex items-center gap-0.5">
                      <RoleIcon className="w-2.5 h-2.5" />
                      {t(`active_party.slot_roles.${slotConfig.id}`, slotConfig.role)}
                    </span>
                    <span 
                      className="font-game text-[7px] px-1 py-0.2 rounded font-black uppercase"
                      style={{ background: `${rankColor}25`, color: rankColor, border: `1px solid ${rankColor}60` }}
                    >
                      {ally.rank}
                    </span>
                  </div>

                  {/* Character Avatar with Pedestal */}
                  <div className="relative w-16 h-16 flex items-center justify-center my-1">
                    {/* Altar Pedestal Shadow/Glow */}
                    <div 
                      className="absolute bottom-0 w-12 h-3 rounded-full blur-[2px] opacity-70"
                      style={{ background: rankColor }}
                    />
                    <OptimizedImage 
                      src={ally.image} 
                      alt={ally.name}
                      className="w-14 h-14 object-contain relative z-10 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] transition-transform duration-200 group-hover:scale-110" 
                      style={{ imageRendering: 'pixelated' }} 
                    />
                    {/* Level badge */}
                    <span className="absolute -top-1 -right-1 z-20 font-game text-[7px] bg-black/80 text-white px-1 py-0.2 rounded border border-white/20 font-bold">
                      Lv.{level}
                    </span>
                  </div>

                  {/* Name & Buff */}
                  <div className="w-full text-center mt-1">
                    <div className="font-game text-[9px] font-bold truncate text-[var(--habit-text)] group-hover:text-white transition-colors">
                      {ally.name}
                    </div>
                    <div className="font-game text-[7.5px] truncate font-bold text-emerald-400 mt-0.5" style={{ textShadow: "0 0 6px rgba(52,211,153,0.5)" }}>
                      +{currentBuff}
                    </div>
                  </div>
                </motion.div>
              );
            } else {
              return (
                <motion.div 
                  key={`slot-${index}`}
                  onClick={handleEmptyClick}
                  whileHover={{ scale: 1.03, y: -2 }}
                  transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  className="relative flex flex-col items-center justify-between p-2.5 rounded-xl border-2 border-dashed border-[var(--habit-border)] hover:border-[var(--habit-purple)] bg-black/15 cursor-pointer overflow-hidden group min-h-[126px]"
                >
                  {/* Slot role label */}
                  <div className="w-full flex items-center justify-between mb-1">
                    <span className="font-game text-[7px] text-[var(--habit-dim)] flex items-center gap-0.5">
                      <RoleIcon className="w-2.5 h-2.5 opacity-60" />
                      {t(`active_party.slot_roles.${slotConfig.id}`, slotConfig.role)}
                    </span>
                    <span className="font-game text-[7px] text-[var(--habit-dim)] opacity-50">
                      {t('active_party.empty_slot', 'EMPTY')}
                    </span>
                  </div>

                  {/* Summon Altar Circle */}
                  <div className="relative w-14 h-14 flex items-center justify-center my-1">
                    {/* Magic Rune Circle */}
                    <div 
                      className="absolute inset-0 rounded-full border border-dashed border-[var(--habit-purple)]/30 group-hover:border-[var(--habit-purple)]/70 animate-rune-spin"
                    />
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--habit-purple)]/10 group-hover:bg-[var(--habit-purple)]/25 transition-colors"
                    >
                      <Plus className="w-5 h-5 text-[var(--habit-purple)] group-hover:scale-125 transition-transform" />
                    </div>
                  </div>

                  {/* Summon Label */}
                  <div className="w-full text-center mt-1">
                    <div className="font-game text-[8.5px] font-bold text-[var(--habit-purple)] tracking-wider">
                      {t('active_party.summon', '+ SUMMON')}
                    </div>
                    <div className="font-game text-[6.5px] text-[var(--habit-dim)]">
                      {t('active_party.tap_to_recruit', '[ TAP TO RECRUIT ]')}
                    </div>
                  </div>
                </motion.div>
              );
            }
          })}
        </div>
      </div>

      {/* Selected Ally Details Modal */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedAlly && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
              style={{
                paddingTop: 'max(1rem, env(safe-area-inset-top, 16px))',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
                touchAction: 'none'
              }}
              onClick={() => setSelectedAlly(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card border-2 rounded-2xl p-5 max-w-xs w-full space-y-4 max-h-[85svh] overflow-y-auto pixel-corner-brackets"
                style={{ 
                  borderColor: selectedAlly.color || "var(--habit-purple)", 
                  boxShadow: `0 0 40px ${selectedAlly.color || "var(--habit-purple)"}40` 
                }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 bg-black/40 flex items-center justify-center relative" style={{ borderColor: selectedAlly.color }}>
                    <div className="absolute inset-0 bg-radial from-white/10 to-transparent" />
                    <OptimizedImage
                      src={selectedAlly.image}
                      alt={selectedAlly.name}
                      className="w-20 h-20 object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div className="font-game font-black text-sm" style={{ color: selectedAlly.color }}>
                    {selectedAlly.name}
                  </div>
                  <div className="font-game text-[9px] text-muted-foreground/60">{selectedAlly.title}</div>
                  
                  <span className="font-game text-[8px] px-2 py-0.5 rounded font-black"
                    style={{ background: `${RANK_COLORS[selectedAlly.rank] || '#fff'}20`, color: RANK_COLORS[selectedAlly.rank] || '#fff', border: `1px solid ${RANK_COLORS[selectedAlly.rank] || '#fff'}50` }}>
                    RANK {selectedAlly.rank}
                  </span>

                  <div className="font-game text-[9px] mt-2 text-center text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30 w-full">
                    <span className="opacity-80">
                      {t('settings.lv_active_buff', 'Lv{{level}} Active Buff:', { level: recruitedLevels[selectedAlly.id] || 1 })}
                    </span>
                    <div className="text-white font-bold mt-0.5">
                      {selectedAlly.levels?.[(recruitedLevels[selectedAlly.id] || 1) - 1] || selectedAlly.buff_description}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => handleDismiss(selectedAlly.id)}
                    disabled={updateAlliesMutation.isPending}
                    className="w-full py-2.5 font-game font-bold text-[10px] rounded-xl border transition-colors bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {updateAlliesMutation.isPending ? t('settings.dismissing', 'DISMISSING...') : t('settings.dismiss_from_party', 'DISMISS FROM PARTY')}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedAlly(null);
                      handleEmptyClick();
                    }}
                    className="w-full py-2.5 font-game font-bold text-[10px] rounded-xl border border-[var(--habit-border)] hover:bg-white/10 transition-colors text-[var(--habit-text)] cursor-pointer"
                  >
                    {t('settings.view_in_allies', 'VIEW IN ALLIES')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
