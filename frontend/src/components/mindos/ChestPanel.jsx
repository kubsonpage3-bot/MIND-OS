// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { getGearClassColor } from '@/lib/gameState';
import { getMediaUrl, djangoApi } from "@/api/djangoClient";
import { playSound } from "@/lib/soundEffects";
import { useProfileSync } from "@/hooks/useProfileSync";
import GameCard from "@/components/ui/GameCard";
import { Coins, Database, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHardwareBack } from "@/utils/modalStack";
import AnimatedChestModal from "./AnimatedChestModal";

export default function ChestPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useProfileSync();

  const [decryptingChest, setDecryptingChest] = useState(null);
  const [wonItem, setWonItem] = useState(null);
  const [activeChestForModal, setActiveChestForModal] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isEquipped, setIsEquipped] = useState(false);

  useHardwareBack(!!activeChestForModal, () => {
    setWonItem(null);
    setActiveChestForModal(null);
    setDecryptingChest(null);
  });

  const gold = profile?.gold || 0;

  // Fetch chests list
  const { data: chests, isLoading } = useQuery({
    queryKey: ['chests'],
    queryFn: djangoApi.chests.getChests,
  });


  // Mutate: open chest
  const openMutation = useMutation({
    mutationFn: (chestType) => djangoApi.chests.open(chestType),
    onSuccess: (/** @type {any} */ data) => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      // Pass the won item to modal — it handles its own animation phases
      setWonItem(data.item);
      setIsEquipped(false);
      setDecryptingChest(null);
    },
    onError: (err) => {
      setDecryptingChest(null);
      setActiveChestForModal(null);
      setWonItem(null);
      playSound('error');
      setErrorMessage(err.message || t("chest_panel.decryption_failed", "Decryption failed."));
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  // Mutate: equip item
  const equipMutation = useMutation({
    mutationFn: (itemCode) => djangoApi.inventory.equip(itemCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsEquipped(true);
      playSound('success');
    },
    onError: (err) => {
      playSound('error');
      setErrorMessage(err.message || t("chest_panel.failed_to_equip", "Failed to equip item."));
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  const handleOpenChest = (chest) => {
    if (decryptingChest || openMutation.isPending) return;
    if (gold < chest.cost_gold) {
      playSound('error');
      setErrorMessage(t("chest_panel.insufficient_credits", "Insufficient Credits"));
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    // Open the animated modal immediately (Phase 1 - Charging)
    setActiveChestForModal(chest);
    setWonItem(null);
    setIsEquipped(false);
    setDecryptingChest(chest);
    openMutation.mutate(chest.chest_type);
  };

  const handleModalClose = () => {
    setWonItem(null);
    setActiveChestForModal(null);
    setDecryptingChest(null);
  };

  const getChestDesign = (chestType) => {
    if (chestType === "sovereign_reliquary") {
      return {
        themeColor: "#c084fc",
        glowColor: "#a855f7",
        bgGradient: "linear-gradient(135deg, rgba(88, 28, 135, 0.35) 0%, rgba(15, 10, 28, 0.95) 80%)",
        borderColor: "rgba(192, 132, 252, 0.5)",
        btnBg: "border-purple-500/40 text-purple-300 bg-purple-500/15 hover:bg-purple-500/25"
      };
    }
    if (chestType === "apex_vault") {
      return {
        themeColor: "#f59e0b",
        glowColor: "#d97706",
        bgGradient: "linear-gradient(135deg, rgba(180, 83, 9, 0.3) 0%, rgba(28, 18, 8, 0.95) 80%)",
        borderColor: "rgba(245, 158, 11, 0.45)",
        btnBg: "border-amber-500/40 text-amber-400 bg-amber-500/15 hover:bg-amber-500/25"
      };
    }
    if (chestType === "quantum_safe") {
      return {
        themeColor: "#00e5ff",
        glowColor: "#0284c7",
        bgGradient: "linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(8, 20, 32, 0.95) 80%)",
        borderColor: "rgba(0, 229, 255, 0.4)",
        btnBg: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
      };
    }
    return {
      themeColor: "#3b82f6",
      glowColor: "#6b7280",
      bgGradient: "linear-gradient(135deg, rgba(30, 41, 59, 0.2) 0%, rgba(10, 12, 20, 0.95) 80%)",
      borderColor: "rgba(59, 130, 246, 0.35)",
      btnBg: "border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
    };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="font-mono text-xs text-muted-foreground/60 tracking-wider">{t('chest_panel.loading', 'LOADING CACHE MANIFEST...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">{t('chest_panel.title', 'Decryptor Shop')}</span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {t('chest_panel.subtitle', '(Unlock rare cyberware and weapon caches)')}
        </span>
      </div>

      {/* Error alert toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-3 rounded-lg text-xs font-mono text-center border bg-red-950/20 border-red-500/40 text-red-400 flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated chest opening modal (phases: charge → crack → burst → reveal) */}
      <AnimatedChestModal
        open={!!activeChestForModal}
        chest={activeChestForModal}
        wonItem={wonItem}
        isEquipped={isEquipped}
        isEquipping={equipMutation.isPending}
        onEquip={() => wonItem && equipMutation.mutate(wonItem.code)}
        onClose={handleModalClose}
        chestThemeColor={activeChestForModal ? getChestDesign(activeChestForModal.chest_type).themeColor : "#f59e0b"}
      />

      {/* Chest list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chests?.map((chest) => {
          const design = getChestDesign(chest.chest_type);
          
          return (
            <GameCard
              key={chest.chest_type}
              isActive={false}
              borderColor={design.borderColor}
              glowColor={design.themeColor}
              className="flex flex-col p-4 rounded-xl relative border animate-none"
              style={{
                background: design.bgGradient
              }}
            >
              {/* Scanline pattern */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

              <div className="flex gap-4 items-center">
                {/* Chest Image */}
                {chest.icon_url && (
                  <div 
                    className="w-16 h-16 shrink-0 border bg-black/40 flex items-center justify-center p-1 rounded relative overflow-hidden"
                    style={{
                      borderColor: design.borderColor,
                      boxShadow: `0 0 10px ${design.themeColor}20`
                    }}
                  >
                    <img 
                      src={getMediaUrl(chest.icon_url)} 
                      alt={chest.name} 
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-mono text-sm font-black tracking-wider text-white uppercase" style={{ textShadow: `0 0 10px ${design.themeColor}50` }}>
                      {chest.name}
                    </h3>
                    <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded shrink-0">
                      <Coins className="w-3 h-3" />
                      {chest.cost_gold}G
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground/75 mt-1 leading-relaxed">
                    {chest.description}
                  </p>
                </div>
              </div>

              {/* Rarity Drop Rates */}
              <div className="mt-4 p-2 bg-black/45 border border-white/5 rounded">
                <span className="font-mono text-[9px] text-muted-foreground/50 tracking-widest uppercase">{t('chest_panel.decryption_matrix', 'Decryption Matrix')}</span>
                <div className="grid gap-1 mt-2 text-[10px] font-mono" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(32px, 1fr))' }}>
                  {Object.entries(chest.drop_rates).map(([cls, rate]) => {
                    const color = getGearClassColor(cls);
                    if (!rate || parseFloat(rate) === 0) return null;
                    const isSSSClass = cls === 'SSS';
                    const isSSClass = cls === 'SS';
                    return (
                      <div key={cls} className="flex flex-col items-center border border-white/[0.03] py-1 bg-white/[0.01]">
                        <span
                          className={`font-black px-1 rounded text-[9px]${isSSSClass ? ' animate-pulse' : ''}`}
                          style={{
                            color: isSSSClass ? undefined : color,
                            background: `${color}15`,
                            ...(isSSSClass && {
                              background: 'linear-gradient(90deg,#ff0080,#ff8c00,#FFD700,#00ff88,#00cfff,#CC00FF)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              filter: 'drop-shadow(0 0 4px #CC00FF)',
                            }),
                            ...(isSSClass && {
                              textShadow: `0 0 8px ${color}`,
                            }),
                          }}
                        >
                          {cls}
                        </span>
                        <span className="text-white/60 mt-1 text-[8px] font-bold">{rate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4">
                <button
                  onClick={() => handleOpenChest(chest)}
                  disabled={decryptingChest || openMutation.isPending}
                  className={`w-full h-11 font-mono text-xs font-bold border transition-all flex items-center justify-center gap-2 select-none active:scale-[0.98] cursor-pointer ${design.btnBg} disabled:opacity-40 disabled:pointer-events-none`}
                >
                  {openMutation.isPending && decryptingChest?.chest_type === chest.chest_type ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      {t('chest_panel.decrypting', 'DECRYPTING...')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t('chest_panel.decrypt_cache', { gold: chest.cost_gold, defaultValue: `DECRYPT CACHE (${chest.cost_gold}G)` })}
                    </>
                  )}
                </button>
              </div>
            </GameCard>
          );
        })}
      </div>
    </div>
  );
}
