import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { getGearClassColor, GEAR_CLASS_NAMES } from '@/lib/gameState';
import { getMediaUrl, djangoApi } from "@/api/djangoClient";
import { playSound } from "@/lib/soundEffects";
import { useProfileSync } from "@/hooks/useProfileSync";
import GameCard from "@/components/ui/GameCard";
import { usePixelBurst, PixelBurstLayer, PixelFlash } from "./PixelParticles";
import { Coins, Database, Loader2, Sparkles, Terminal, CheckCircle2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ChestPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useProfileSync();
  const { bursts, trigger: triggerBurst } = usePixelBurst();

  const [decryptingChest, setDecryptingChest] = useState(null);
  const [decryptionStage, setDecryptionStage] = useState(0);
  const [wonItem, setWonItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isEquipped, setIsEquipped] = useState(false);

  const gold = profile?.gold || 0;

  // Fetch chests list
  const { data: chests, isLoading } = useQuery({
    queryKey: ['chests'],
    queryFn: djangoApi.chests.getChests,
  });

  const stages = [
    "ESTABLISHING CONTEXT UPLINK...",
    "EXTRACTING ENCRYPTED DATA BLOCKS...",
    "DECRYPTING SECURITY CORE...",
    "REASSEMBLING CYBERNETIC PROTOCOL...",
    "DECRYPTION COMPLETE!"
  ];

  // Mutate: open chest
  const openMutation = useMutation({
    mutationFn: (chestType) => djangoApi.chests.open(chestType),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      // Run sequential decryption animation
      setDecryptionStage(0);
      let currentStage = 0;
      playSound('click');

      const interval = setInterval(() => {
        currentStage++;
        if (currentStage < stages.length) {
          setDecryptionStage(currentStage);
          playSound('boss_idle_tick');
        } else {
          clearInterval(interval);
          setWonItem(data.item);
          setIsEquipped(false);
          setDecryptingChest(null);
          
          const classColor = getGearClassColor(data.item.gear_class);
          triggerBurst(classColor, 20);
          playSound('critical');
        }
      }, 500);
    },
    onError: (err) => {
      setDecryptingChest(null);
      playSound('error');
      setErrorMessage(err.message || "Decryption failed.");
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
      setErrorMessage(err.message || "Failed to equip item.");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  });

  const handleOpenChest = (chest) => {
    if (decryptingChest || openMutation.isPending) return;
    if (gold < chest.cost_gold) {
      playSound('error');
      setErrorMessage("Insufficient Credits");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    setWonItem(null);
    setDecryptingChest(chest);
    openMutation.mutate(chest.chest_type);
  };

  const getChestDesign = (chestType) => {
    if (chestType === "quantum_safe") {
      return {
        themeColor: "#a855f7",
        glowColor: "#f59e0b",
        bgGradient: "linear-gradient(135deg, rgba(88, 28, 135, 0.25) 0%, rgba(15, 12, 30, 0.95) 80%)",
        borderColor: "rgba(168, 85, 247, 0.4)",
        btnBg: "border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
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
        <span className="font-mono text-xs text-muted-foreground/60 tracking-wider">LOADING CACHE MANIFEST...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">Decryptor Shop</span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          (Unlock rare cyberware and weapon caches)
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

      {/* Decryption overlay */}
      <AnimatePresence>
        {decryptingChest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <div 
              className="w-full max-w-md p-6 border-2 font-mono text-xs bg-black rounded-none relative overflow-hidden"
              style={{
                borderColor: getChestDesign(decryptingChest.chest_type).themeColor,
                boxShadow: `0 0 20px ${getChestDesign(decryptingChest.chest_type).themeColor}40`
              }}
            >
              {/* Retro scanline overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

              <div className="flex items-center gap-2 text-green-400 border-b border-green-500/20 pb-3 mb-4">
                <Terminal className="w-4 h-4 animate-pulse" />
                <span className="font-bold tracking-widest">DECRYPTOR SYSTEM ACTIVE</span>
              </div>

              <div className="space-y-3 font-mono text-[10px] min-h-[140px]">
                {stages.map((stg, i) => {
                  if (i > decryptionStage) return null;
                  return (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -5 }} 
                      animate={{ opacity: 1, x: 0 }}
                      className={i === decryptionStage ? "text-primary font-bold animate-pulse" : "text-muted-foreground/60"}
                    >
                      &gt; {stg} {i < decryptionStage && "✅"}
                    </motion.div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[8px] text-muted-foreground mb-1">
                  <span>PROGRESS</span>
                  <span>{Math.round(((decryptionStage + 1) / stages.length) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-gray-900 border border-gray-800 overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-primary"
                    style={{
                      background: getChestDesign(decryptingChest.chest_type).themeColor,
                      boxShadow: `0 0 8px ${getChestDesign(decryptingChest.chest_type).themeColor}`
                    }}
                    animate={{ width: `${((decryptionStage + 1) / stages.length) * 100}%` }}
                    transition={{ ease: "easeInOut", duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-sm font-black tracking-wider text-white uppercase" style={{ textShadow: `0 0 10px ${design.themeColor}50` }}>
                    {chest.name}
                  </h3>
                  <p className="text-[10px] font-mono text-muted-foreground/75 mt-1 leading-relaxed max-w-[280px]">
                    {chest.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded">
                  <Coins className="w-3.5 h-3.5" />
                  {chest.cost_gold}G
                </div>
              </div>

              {/* Rarity Drop Rates */}
              <div className="mt-4 p-2 bg-black/45 border border-white/5 rounded">
                <span className="font-mono text-[9px] text-muted-foreground/50 tracking-widest uppercase">Decryption Matrix</span>
                <div className="grid grid-cols-6 gap-1 mt-2 text-[10px] font-mono">
                  {['E', 'D', 'C', 'B', 'A', 'S'].map(cls => {
                    const rate = chest.drop_rates[cls];
                    const color = getGearClassColor(cls);
                    if (!rate || parseFloat(rate) === 0) return null;
                    return (
                      <div key={cls} className="flex flex-col items-center border border-white/[0.03] py-1 bg-white/[0.01]">
                        <span className="font-black px-1 rounded text-[9px]" style={{ color, background: `${color}15` }}>
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
                  className={`w-full h-11 font-mono text-xs font-bold border transition-all flex items-center justify-center gap-2 select-none active:scale-[0.98] ${design.btnBg} disabled:opacity-40 disabled:pointer-events-none`}
                >
                  {openMutation.isPending && decryptingChest?.chest_type === chest.chest_type ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      DECRYPTING...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      DECRYPT CACHE ({chest.cost_gold}G)
                    </>
                  )}
                </button>
              </div>
            </GameCard>
          );
        })}
      </div>

      {/* Won Item Reveal Modal */}
      <AnimatePresence>
        {wonItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-sm rounded-none border-[2.5px] p-6 text-center bg-black relative"
              style={{
                borderColor: getGearClassColor(wonItem.gear_class),
                boxShadow: `0 0 30px ${getGearClassColor(wonItem.gear_class)}50`,
                imageRendering: 'pixelated'
              }}
            >
              {/* Particle layers */}
              <PixelBurstLayer bursts={bursts} />
              <PixelFlash active={true} color={getGearClassColor(wonItem.gear_class)} />

              {/* Close Button */}
              <button 
                onClick={() => setWonItem(null)} 
                className="absolute top-3 right-3 text-muted-foreground/60 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <span className="font-mono text-[9px] font-bold text-green-400 tracking-widest block mb-1">
                [ DECRYPTION COMPLETE ]
              </span>

              {/* Item rarity class */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span 
                  className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded border"
                  style={{
                    color: getGearClassColor(wonItem.gear_class),
                    borderColor: `${getGearClassColor(wonItem.gear_class)}60`,
                    background: `${getGearClassColor(wonItem.gear_class)}15`
                  }}
                >
                  {wonItem.gear_class}
                </span>
                <span className="text-[10px] font-mono tracking-wider font-bold" style={{ color: getGearClassColor(wonItem.gear_class) }}>
                  {GEAR_CLASS_NAMES[wonItem.gear_class]}
                </span>
              </div>

              {/* Glowing title */}
              <h2 
                className="text-lg font-mono font-black tracking-wider uppercase mt-2 mb-4" 
                style={{ 
                  color: getGearClassColor(wonItem.gear_class),
                  textShadow: `0 0 15px ${getGearClassColor(wonItem.gear_class)}60`
                }}
              >
                {wonItem.name}
              </h2>

              {/* Item icon container */}
              <div 
                className="mx-auto w-24 h-24 border bg-gray-900/60 flex items-center justify-center relative mb-4"
                style={{
                  borderColor: `${getGearClassColor(wonItem.gear_class)}60`,
                  boxShadow: `0 0 15px ${getGearClassColor(wonItem.gear_class)}20`,
                  imageRendering: 'pixelated'
                }}
              >
                {wonItem.icon_url ? (
                  <img 
                    src={getMediaUrl(wonItem.icon_url)} 
                    alt={wonItem.name} 
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <span className="font-mono text-3xl" style={{ color: getGearClassColor(wonItem.gear_class) }}>
                    {wonItem.name[0]}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs font-mono text-muted-foreground/80 leading-relaxed px-2">
                {wonItem.description || "No database descriptor available."}
              </p>

              {/* Item stats list */}
              {wonItem.stats && Object.keys(wonItem.stats).length > 0 && (
                <div className="mt-4 p-3 bg-white/[0.02] border border-white/[0.04] rounded text-left">
                  <div className="text-[8px] font-mono text-muted-foreground/45 uppercase tracking-widest text-left mb-1.5">
                    Modifications
                  </div>
                  <div className="space-y-1">
                    {Object.entries(wonItem.stats).map(([stat, val]) => (
                      <div key={stat} className="flex justify-between items-center text-xs font-mono text-white/95">
                        <span className="uppercase text-muted-foreground">{stat.replace('_', ' ')}</span>
                        <span className="font-bold text-green-400">+{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-wider mt-3">
                Slot: {wonItem.slot_type?.replace('_', ' ') || "unknown"}
              </div>

              {/* Action options */}
              <div className="mt-6 flex flex-col gap-2">
                {!isEquipped ? (
                  <button
                    onClick={() => equipMutation.mutate(wonItem.code)}
                    disabled={equipMutation.isPending}
                    className="h-11 font-mono text-xs font-black border transition-all flex items-center justify-center gap-1 cursor-pointer select-none active:scale-[0.98] disabled:opacity-40"
                    style={{
                      background: getGearClassColor(wonItem.gear_class),
                      borderColor: getGearClassColor(wonItem.gear_class),
                      color: '#000'
                    }}
                  >
                    {equipMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      "EQUIP CYBERWARE"
                    )}
                  </button>
                ) : (
                  <div className="h-11 font-mono text-xs font-bold border border-green-500/30 text-green-400 bg-green-500/10 flex items-center justify-center gap-1.5 select-none rounded">
                    <CheckCircle2 className="w-4 h-4" />
                    EQUIPPED TO SYSTEM
                  </div>
                )}
                
                <button
                  onClick={() => setWonItem(null)}
                  className="h-11 font-mono text-xs font-bold border border-white/10 text-muted-foreground hover:text-white hover:bg-white/[0.02] flex items-center justify-center select-none active:scale-[0.98]"
                >
                  DISMISS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
