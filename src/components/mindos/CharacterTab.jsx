import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { SHOP_ITEMS, ITEM_ICON_MAP, getTierColor, loadGameState, saveGameState } from "@/lib/gameState";
import { loadRPGData, saveRPGData, CLASSES } from "@/lib/rpgSystem";
import { djangoApi } from "@/api/djangoClient";
import PixelCharacter from "./PixelCharacter";
import { getRankFromXP } from "@/lib/rankEngine";
import { ShoppingCart, X, Hexagon, ChevronLeft } from "lucide-react";
import FantasyIcon from "@/components/navigation/FantasyIcon";
import { getPwrBossDamageMultiplier, getDefDamageReduction, getLckGoldMultiplier, getSpdGoldBonus } from "@/lib/mutatorEngine";
import { motion } from "framer-motion";
import { usePixelBurst, PixelBurstLayer, PixelFlash } from "./PixelParticles";
import { playSound } from "@/lib/soundEffects.js";
import { normalizeGold } from "@/lib/utils";
import ClassSelector from "./ClassSelector";
import SkillPanel from "./SkillPanel";
import SkillTreePanel from "./SkillTreePanel";
import AlliesPanel from "./AlliesPanel";
import AchievementsPanel from "./AchievementsPanel";
import MutatorsPanel from "./MutatorsPanel";
import PrestigePanel from "./PrestigePanel";
import ScrollsPanel from "./ScrollsPanel";
import InventoryPanel from "./InventoryPanel";

// Unified stat system: Final = Base (5) + Stat Points + Class Bonus + Equipment
const STAT_CONFIG = {
  pwr: { label: "PWR", desc: "Power — +2% boss damage per point above 5", color: "#ef4444" },
  def: { label: "DEF", desc: "Defense — -1% HP damage taken per point (max -50%)", color: "#3b82f6" },
  foc: { label: "FOC", desc: "Focus Amp — +1% focus efficiency per point above 5", color: "#22c55e" },
  mem: { label: "MEM", desc: "Memory — +1.5% fatigue resistance per point above 5", color: "#a855f7" },
  spd: { label: "SPD", desc: "Speed — extra task completions", color: "#f59e0b" },
  lck: { label: "LCK", desc: "Luck — Gold drop bonus", color: "#eab308" },
};

const SLOT_LABELS = {
  headware: "HEADWARE", neural_link: "NEURAL LINK", core: "CORE",
  arms: "ARMS", legs: "LEGS", offhand: "OFFHAND", ring1: "RING I", ring2: "RING II",
};

const TIER_ORDER = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];

const SUB_TABS = [
  { id: "overview", label: "Overview" },
  { id: "skills", label: "Skills" },
  { id: "skill_tree", label: "Skill Tree" },
  { id: "allies", label: "Allies" },
  { id: "achievements", label: "Achievements" },
  { id: "mutators", label: "Mutators" },
  { id: "shop", label: "Shop" },
];

export default function CharacterTab({ profile, logs, rankXP: rankXPProp, currentRankId, subTab: externalSubTab, onBack = undefined }) {
  const queryClient = useQueryClient();
  const [gs, setGs] = useState(() => loadGameState());
  const [rpg, setRpg] = useState(() => loadRPGData());
  const subTab = externalSubTab || "overview";
  const [shopTab, setShopTab] = useState("gear");
  const [activeSlot, setActiveSlot] = useState(null);
  const [boughtItem, setBoughtItem] = useState(null);
  const { bursts, trigger: triggerBurst } = usePixelBurst();

  // Reload RPG data from storage on mount
  useEffect(() => { setRpg(loadRPGData()); }, []);

  const save = (newGs) => { setGs(newGs); saveGameState(newGs); };

  const gold = profile?.gold || 0;
  const spendGold = (amount) => {
    // For legacy sub-panels that still rely on local gs
    const ng = { ...gs, gold: Math.max(0, (gs.gold || 0) - amount) };
    save(ng);
  };

  // Use prop if provided (synced from Dashboard), fallback to localStorage
  const rankXP = rankXPProp !== undefined ? rankXPProp : (() => { try { return JSON.parse(localStorage.getItem("mindos_rank_xp") || "{}").rankXP || 0; } catch { return 0; } })();

  // Auto-sync legacy localStorage class to backend
  useEffect(() => {
    const syncLocalClass = async () => {
      const localRpg = loadRPGData();
      if (profile && profile.character_class === "Wanderer" && localRpg?.classData?.chosen) {
        const cls = CLASSES[localRpg.classData.chosen];
        if (cls) {
          try {
            await djangoApi.profile.update({
              character_class: localRpg.classData.chosen,
              mana: localRpg.classData.mana || cls.maxMana,
              mana_max: cls.maxMana
            });
            queryClient.invalidateQueries({ queryKey: ["userprofile"] });
          } catch (e) {
            console.error("Auto-sync class failed:", e);
          }
        }
      }
    };
    syncLocalClass();
  }, [profile?.character_class]);

  // Class data
  const classData = { 
    chosen: profile?.character_class !== "Wanderer" ? profile?.character_class : null,
    mana: profile?.mana || 0,
    maxMana: profile?.mana_max || 100
  };
  const chosenClass = classData.chosen ? CLASSES[classData.chosen] : null;
  const classColor = chosenClass?.color || "#3b82f6";

  // Map inventory and equipment from profile
  const rawInventory = profile?.inventory || [];
  const inventory = rawInventory.map(ri => SHOP_ITEMS.find(i => i.id === ri.id) || ri);
  
  const rawEquipped = profile?.equipped || {};
  const equipped = {};
  Object.keys(rawEquipped).forEach(slot => {
     const eqId = rawEquipped[slot]?.id || rawEquipped[slot];
     equipped[slot] = SHOP_ITEMS.find(i => i.id === eqId) || rawEquipped[slot];
  });

  // Equipped stats breakdown
  const equipStats = { pwr: 0, def: 0, foc: 0, mem: 0, spd: 0, lck: 0 };
  Object.values(equipped).forEach(item => {
    if (item?.stats) Object.entries(item.stats).forEach(([k, v]) => { equipStats[k] = (equipStats[k] || 0) + v; });
  });
  
  // Calculate final stats: Base (5) + Stat Points + Class Bonus + Equipment
  const baseStat = 5;
  const statBreakdown = {};
  Object.keys(STAT_CONFIG).forEach(key => {
    const statPointsBonus = (gs.stats?.[key] || 0); // Points invested above base
    const classBonus = chosenClass?.stats?.[key] || 0;
    const equipBonus = equipStats[key] || 0;
    const total = baseStat + statPointsBonus + classBonus + equipBonus;
    statBreakdown[key] = {
      base: baseStat,
      points: statPointsBonus,
      class: classBonus,
      equip: equipBonus,
      total: total,
    };
  });

  // Use currentRankId prop if provided for sync with header character icon
  const currentRank = currentRankId ? { ...getRankFromXP(rankXP), id: currentRankId } : getRankFromXP(rankXP);
  const charHp = profile?.hp !== undefined ? profile.hp : 100;
  const charMaxHp = profile?.hp_max || 100;
  const hpPct = Math.max(0, (charHp / charMaxHp) * 100);
  const hpColor = hpPct > 50 ? "#ef4444" : hpPct > 25 ? "#f59e0b" : "#ff0000";

  const handleChooseClass = async (classId) => {
    const cls = CLASSES[classId];
    const newClassData = { chosen: classId, mana: cls.maxMana, maxMana: cls.maxMana, skills: [] };
    
    try {
      await djangoApi.profile.update({
        character_class: classId,
        mana: cls.maxMana,
        mana_max: cls.maxMana
      });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    } catch (e) {
      console.error("Failed to sync class with backend:", e);
    }

    saveRPGData("mindos_class", newClassData);
    setRpg(prev => ({ ...prev, classData: newClassData }));
  };

  const handleSkillUsed = (skill, newClassData) => {
    setRpg(prev => ({ ...prev, classData: newClassData }));
  };

  const handleSkillTreeUpdate = (newTree) => {
    setRpg(prev => ({ ...prev, skillTree: newTree }));
  };

  const handleAlliesUpdate = (newAllies) => {
    setRpg(prev => ({ ...prev, alliesData: newAllies }));
  };

  const handleMutatorsUpdate = (newMut) => {
    setRpg(prev => ({ ...prev, mutators: newMut }));
  };

  const handlePrestige = async (newPrestige) => {
    setRpg(prev => ({ ...prev, prestige: newPrestige }));
    try {
      await djangoApi.profile.update({ prestige_count: newPrestige.count });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    } catch (e) {
      console.error("Failed to sync prestige with backend:", e);
    }
  };

  const mutation = useMutation({
    mutationFn: djangoApi.shop.buy,
    onMutate: async (buyData) => {
      await queryClient.cancelQueries({ queryKey: ["userprofile"] });
      /** @type {any} */
      const prevProfile = queryClient.getQueryData(["userprofile"]);

      if (prevProfile) {
        const newHp = buyData.heal_amount 
          ? Math.min(prevProfile.hp_max, prevProfile.hp + buyData.heal_amount)
          : prevProfile.hp;
        
        const newInventory = buyData.heal_amount 
          ? prevProfile.inventory 
          : [...(prevProfile.inventory || []), { id: buyData.item_id }];

        queryClient.setQueryData(["userprofile"], {
          ...prevProfile,
          gold: Math.max(0, prevProfile.gold - buyData.cost),
          hp: newHp,
          inventory: newInventory
        });
      }

      setBoughtItem(buyData.item_id);
      triggerBurst(buyData.heal_amount ? "#ef4444" : "#f0c040", 10);
      setTimeout(() => setBoughtItem(null), 800);

      return { prevProfile };
    },
    onError: (err, buyData, context) => {
      if (context?.prevProfile) {
        queryClient.setQueryData(["userprofile"], context.prevProfile);
      }
      console.error("Shop purchase failed:", err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }
  });

  const buyItem = (item) => {
    if (gold < item.cost) return;
    playSound('purchase');
    
    mutation.mutate({
      item_id: item.id,
      cost: item.cost,
      heal_amount: item.healAmount || 0,
      is_consumable: !!item.healAmount
    });
  };

  const equipItem = (item) => {
    playSound('success');
    const ne = { ...rawEquipped, [item.slot]: item.id };
    
    // Optimistically update
    /** @type {any} */
    const prevProfile = queryClient.getQueryData(["userprofile"]);
    if (prevProfile) queryClient.setQueryData(["userprofile"], { ...prevProfile, equipped: ne });
    
    djangoApi.profile.update({ equipped: ne }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    });
    setActiveSlot(null);
  };

  const unequip = (slot) => {
    playSound('click');
    const ne = { ...rawEquipped }; 
    delete ne[slot];
    
    // Optimistically update
    /** @type {any} */
    const prevProfile = queryClient.getQueryData(["userprofile"]);
    if (prevProfile) queryClient.setQueryData(["userprofile"], { ...prevProfile, equipped: ne });

    djangoApi.profile.update({ equipped: ne }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    });
  };

  const upgradeStat = (stat) => {
    if ((gs.statPoints || 0) <= 0) return;
    save({ ...gs, statPoints: (gs.statPoints || 0) - 1, stats: { ...gs.stats, [stat]: ((gs.stats?.[stat] || 0) + 1) } });
  };

  const gearItems = SHOP_ITEMS.filter(i => !i.consumable);
  const consumables = SHOP_ITEMS.filter(i => i.consumable);

  // If no class chosen, show selector
  if (!classData.chosen) {
    return <ClassSelector onChoose={handleChooseClass} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-2 rounded-2xl" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", padding: "10px 16px" }}>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-accent"
              style={{ color: classColor }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 14, color: classColor }}>{chosenClass?.name}</span>
          {rpg.prestige?.count > 0 && (
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 8, background: "var(--habit-border)", color: "var(--habit-gold)", border: "1px solid var(--habit-border)", padding: "2px 6px", borderRadius: 4 }}>
              ×{rpg.prestige.count} PRESTIGE
            </span>
          )}
        </div>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 15, color: "var(--habit-gold)" }}>🪙 {normalizeGold(gold).toLocaleString()}G</span>
      </div>

      {/* Sub-tab navigation handled by sidebar */}

      {/* OVERVIEW */}
      {subTab === "overview" && (
        <div className="space-y-4">
          {/* Character sprite */}
          <div className="rounded-2xl p-5 flex flex-col items-center gap-3"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${currentRank.color}18 0%, var(--habit-panel) 80%)`,
              border: `2px solid ${currentRank.color}44`,
              boxShadow: `0 4px 20px ${currentRank.color}18`,
            }}>
            <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={160} />
            <div className="font-mono text-xs font-black tracking-widest" style={{ color: classColor }}>{chosenClass.name}</div>
            <div className="font-mono text-sm font-bold px-3 py-1 rounded-lg"
              style={{ color: currentRank.color, background: `${currentRank.color}20`, border: `1px solid ${currentRank.color}50` }}>
              {currentRank.id} — {currentRank.label}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/50 italic text-center">"{chosenClass.lore}"</div>
          </div>

          {/* HP + Mana bars */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
                <span>HP</span><span style={{ color: hpColor }}>{Math.round(charHp)}/{charMaxHp}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}66` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
                <span>MANA</span>
                <span style={{ color: classColor }}>{Math.round(profile?.mana || 0)}/{profile?.mana_max || chosenClass.maxMana}</span>
              </div>
              <div className="h-2 rounded-none bg-muted overflow-hidden mt-1" style={{ imageRendering: "pixelated" }}>
                <div className="h-full"
                  style={{ width: `${Math.min(100, ((profile?.mana || 0) / (profile?.mana_max || chosenClass.maxMana)) * 100)}%`, background: classColor, boxShadow: `0 0 6px ${classColor}66` }} />
              </div>
            </div>
          </div>

          {/* Unified Stats Panel */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Character Stats</span>
              {(gs.statPoints || 0) > 0 && (
                <span className="font-mono text-xs text-primary flex items-center gap-1">
                  <FantasyIcon size={12}><Hexagon /></FantasyIcon> {gs.statPoints} pts
                </span>
              )}
            </div>
            
            {/* Stats table with breakdown */}
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider pb-2 border-b border-border/40">
                <div className="text-left col-span-2">Stat / Effect</div>
                <div className="text-center">Class</div>
                <div className="text-center">Equip</div>
                <div className="text-center">Pts</div>
                <div className="text-right">Total</div>
              </div>
              
              {/* Stat rows */}
              {Object.entries(statBreakdown).map(([key, breakdown]) => {
                const cfg = STAT_CONFIG[key];
                const canUpgrade = (gs.statPoints || 0) > 0;
                // Compute live effect label
                let effectLabel = "";
                if (key === "pwr") {
                  const mult = getPwrBossDamageMultiplier();
                  effectLabel = `+${Math.round((mult - 1) * 100)}% boss dmg`;
                } else if (key === "def") {
                  const red = getDefDamageReduction();
                  effectLabel = `-${Math.round(red * 100)}% HP dmg`;
                } else if (key === "foc") {
                  effectLabel = `+${Math.max(0, breakdown.total - 5)}% focus eff`;
                } else if (key === "mem") {
                  effectLabel = `+${Math.round(Math.max(0, breakdown.total - 5) * 1.5)}% fatigue res`;
                } else if (key === "spd") {
                  const bonus = getSpdGoldBonus();
                  effectLabel = `+${bonus.toFixed(1)}G/task`;
                } else if (key === "lck") {
                  const mult = getLckGoldMultiplier();
                  effectLabel = `+${Math.round((mult - 1) * 100)}% gold`;
                }
                return (
                  <div key={key} className="grid grid-cols-6 gap-2 items-center text-[9px] font-mono">
                    <div className="col-span-2 text-left">
                      <div className="font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
                      <div className="text-[7px] font-mono" style={{ color: cfg.color + "99" }}>{effectLabel}</div>
                    </div>
                    <div className="text-center" style={{ color: breakdown.class > 0 ? classColor : '#64748b' }}>
                      {breakdown.class > 0 ? `+${breakdown.class}` : breakdown.class}
                    </div>
                    <div className="text-center" style={{ color: breakdown.equip > 0 ? '#f0c040' : '#64748b' }}>
                      {breakdown.equip > 0 ? `+${breakdown.equip}` : breakdown.equip}
                    </div>
                    <div className="text-center flex items-center justify-center gap-1">
                      <span style={{ color: breakdown.points > 0 ? '#3b82f6' : '#64748b' }}>
                        {breakdown.points > 0 ? `+${breakdown.points}` : breakdown.points}
                      </span>
                      {canUpgrade && (
                       <button onClick={() => upgradeStat(key)}
                         className="w-4 h-4 pixel-btn border-2 border-primary/40 text-primary hover:bg-primary/30 font-bold leading-none flex items-center justify-center"
                         style={{ background: "rgba(240,192,64,0.15)", boxShadow: "0 1px 0 rgba(0,0,0,0.4)" }}>
                         +
                       </button>
                      )}
                    </div>
                    <div className="text-right font-bold text-foreground">{breakdown.total}</div>
                  </div>
                );
              })}
            </div>
            
            {/* Formula explanation */}
            <div className="text-[8px] font-mono text-muted-foreground/40 pt-2 border-t border-border/40">
              Total = Base ({baseStat}) + Class Bonus + Equipment + Stat Points
            </div>
          </div>

          {/* Equipment slots */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Equipment</span>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(SLOT_LABELS).map(([slot, label]) => {
                const eq = equipped[slot];
                return (
                  <div key={slot} onClick={() => setActiveSlot(slot)}
                    className="aspect-square rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all p-1.5">
                    {eq ? (
                      <>
                        <span className="text-[9px] font-mono text-center" style={{ color: getTierColor(eq.tier) }}>{eq.label.substring(0, 8)}</span>
                        <button onClick={e => { e.stopPropagation(); unequip(slot); }} className="text-[8px] text-muted-foreground/40 hover:text-red-400">✕</button>
                      </>
                    ) : (
                      <span className="text-[9px] font-mono text-muted-foreground/30 text-center">{label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prestige panel */}
          <PrestigePanel prestige={rpg.prestige} rankXP={rankXP} onPrestige={handlePrestige} />
        </div>
      )}

      {/* SKILLS */}
      {subTab === "skills" && (
        <SkillPanel classId={classData.chosen} />
      )}

      {/* SKILL TREE */}
      {subTab === "skill_tree" && (
        <SkillTreePanel
          skillTree={rpg.skillTree}
          onUpdate={handleSkillTreeUpdate}
          gold={gold}
          onSpendGold={spendGold}
        />
      )}

      {/* ALLIES */}
      {subTab === "allies" && (
        <AlliesPanel
          alliesData={rpg.alliesData}
          onUpdate={handleAlliesUpdate}
          gold={gold}
          onSpendGold={spendGold}
        />
      )}

      {/* ACHIEVEMENTS */}
      {subTab === "achievements" && (
        <AchievementsPanel logs={logs || []} alliesData={rpg.alliesData} prestigeData={rpg.prestige} />
      )}

      {/* MUTATORS */}
      {subTab === "mutators" && (
        <MutatorsPanel mutators={rpg.mutators} onUpdate={handleMutatorsUpdate} gold={gold} onSpendGold={spendGold} />
      )}

      {/* SHOP */}
      {subTab === "shop" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground uppercase flex items-center gap-1.5">
              <FantasyIcon size={14}><ShoppingCart /></FantasyIcon> SHOP
            </span>
            <span className="font-mono text-xs font-bold" style={{ color: "#f0c040" }}>🪙 {normalizeGold(gold).toLocaleString()}G</span>
          </div>

          {/* ── Daily Featured Deal ── */}
          {(() => {
            const today = new Date().toDateString();
            const seed = today.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const allItems = [...SHOP_ITEMS];
            const featuredItem = allItems[seed % allItems.length];
            const discountPct = 20 + (seed % 3) * 10; // 20%, 30%, or 40%
            const discountedCost = Math.max(1, Math.round(featuredItem.cost * (1 - discountPct / 100)));
            const canAfford = gold >= discountedCost;
            const tierColor = getTierColor(featuredItem.tier);
            const isOwned = !featuredItem.consumable && (gs.inventory || []).some(i => i.id === featuredItem.id);
            // Bonus unique items not in regular shop (only in featured slot)
            const bonusPool = [
              { id: "daily_xp_surge", label: "XP Surge Scroll", tier: "Epic", cost: 0, consumable: true, effect: "+100% XP for 2h", slot: "consumable" },
              { id: "daily_gold_rush", label: "Gold Rush Token", tier: "Rare", cost: 0, consumable: true, effect: "+200G instantly", slot: "consumable" },
            ];
            const bonusItem = bonusPool[seed % bonusPool.length];
            const isBonusDay = seed % 5 === 0; // every 5 days a unique bonus item appears
            const dealItem = isBonusDay ? { ...bonusItem, cost: 150 } : { ...featuredItem, cost: discountedCost };
            const dealTierColor = getTierColor(dealItem.tier);
            const isBought = boughtItem === dealItem.id;
            const canBuyDeal = gold >= dealItem.cost && (!isOwned || dealItem.consumable);

            return (
              <div className="rounded-xl border p-3 space-y-2 relative overflow-hidden"
                style={{ borderColor: "rgba(240,192,64,0.35)", background: "linear-gradient(135deg,rgba(30,22,8,0.95),rgba(20,15,5,0.98))" }}>
                {/* Shimmer */}
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
                  style={{ background: "linear-gradient(90deg,transparent,rgba(240,192,64,0.08),transparent)", width: "40%" }}
                />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: "#f0c040" }}>⭐ DAILY DEAL</span>
                  <span className="font-mono text-[8px] text-muted-foreground/40">Resets at midnight</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded border flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ borderColor: `${dealTierColor}60`, background: "rgba(10,8,6,0.8)", imageRendering: "pixelated" }}>
                    {ITEM_ICON_MAP[dealItem.id]
                      ? <img src={ITEM_ICON_MAP[dealItem.id]} alt={dealItem.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                      : <span className="text-lg">⭐</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold" style={{ color: dealTierColor }}>{dealItem.label}</div>
                    <div className="text-[9px] font-mono text-muted-foreground/60">{dealItem.effect || ('stats' in dealItem && dealItem.stats ? Object.entries(dealItem.stats).map(([k,v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : "")}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!isBonusDay && (
                        <span className="text-[9px] font-mono line-through text-muted-foreground/40">{featuredItem.cost}G</span>
                      )}
                      <span className="text-xs font-mono font-bold" style={{ color: "#f0c040" }}>{dealItem.cost}G</span>
                      {!isBonusDay && (
                        <span className="text-[8px] font-mono px-1 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>-{discountPct}%</span>
                      )}
                      {isBonusDay && (
                        <span className="text-[8px] font-mono px-1 rounded" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>EXCLUSIVE</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { buyItem(dealItem); }}
                    disabled={!canBuyDeal}
                    className="px-3 py-1.5 text-[10px] font-mono font-bold rounded border transition-all shrink-0 disabled:opacity-30"
                    style={{ borderColor: canBuyDeal ? "#f0c040" : "#2a2010", color: canBuyDeal ? "#f0c040" : "#4a3810", background: canBuyDeal ? "rgba(240,192,64,0.12)" : "transparent" }}
                  >
                    {isBought ? "✦ BOUGHT" : `${dealItem.cost}G`}
                  </button>
                </div>
              </div>
            );
          })()}
          <div className="flex gap-1 flex-wrap">
            {["gear", "consumables", "scrolls", "inventory"].map(t => (
              <button key={t} onClick={() => setShopTab(t)}
                className="px-3 py-1 text-[10px] font-mono uppercase rounded transition-all"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: shopTab === t ? "var(--habit-purple)" : "var(--habit-border)",
                  color: shopTab === t ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
                  background: shopTab === t ? "var(--habit-purple-light)" : "transparent",
                }}
              >{t}</button>
            ))}
          </div>
          {shopTab === "scrolls" && (
            <ScrollsPanel gold={gold} onSpendGold={spendGold} />
          )}
          {shopTab === "inventory" && (
            <InventoryPanel gs={gs} onSave={save} />
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(shopTab === "scrolls" || shopTab === "inventory") ? null : (shopTab === "gear" ? gearItems : consumables)
              .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
              .map((item, idx) => {
                const canAfford = gold >= item.cost;
                const owned = inventory.some(i => i.id === item.id);
                const isBought = boughtItem === item.id;
                const tierColor = getTierColor(item.tier);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: isBought ? [1, 1.04, 1] : 1,
                    }}
                    transition={{
                      opacity: { duration: 0.2, delay: idx * 0.045 },
                      x: { duration: 0.2, delay: idx * 0.045 },
                      scale: isBought ? { duration: 0.35, ease: "easeOut" } : {},
                    }}
                    className="flex items-center justify-between p-3 rounded-none border bg-muted/10 gap-2 relative overflow-hidden"
                    style={{
                      borderColor: isBought ? "#f0c04080" : "hsl(var(--border))",
                      boxShadow: isBought ? "0 0 16px #f0c04050" : "none",
                      imageRendering: "pixelated",
                    }}
                  >
                    {/* Pixel scanlines */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                      style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                    {/* Flash on buy */}
                    <PixelFlash active={isBought} color="#f0c040" />

                    {/* Buy burst particles */}
                    {isBought && <PixelBurstLayer bursts={bursts} />}

                    {/* Icon */}
                    <div className="shrink-0 relative">
                      {ITEM_ICON_MAP[item.id] ? (
                        <motion.div
                          animate={isBought ? { rotate: [0, -8, 8, -4, 0], scale: [1, 1.15, 1] } : {}}
                          transition={{ duration: 0.4 }}
                          className="w-9 h-9 rounded-none border overflow-hidden"
                          style={{ imageRendering: "pixelated", background: "#0a0818", borderColor: `${tierColor}60`, boxShadow: `0 0 6px ${tierColor}30` }}
                        >
                          <img src={ITEM_ICON_MAP[item.id]} alt={item.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                        </motion.div>
                      ) : (
                        <div className="w-9 h-9 rounded-none border border-border/40 bg-muted/20 flex items-center justify-center font-mono text-xs" style={{ color: tierColor }}>
                          {item.label[0]}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold" style={{ color: tierColor }}>{item.label}</span>
                        <span className="text-[9px] font-mono text-muted-foreground/40 tracking-widest">{item.tier}</span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                        {item.stats ? Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : item.effect}
                      </div>
                    </div>

                    <motion.button
                      onClick={() => buyItem(item)}
                      disabled={!canAfford || (!item.consumable && owned)}
                      whileTap={canAfford && !((!item.consumable) && owned) ? { scale: 0.88, y: 2 } : {}}
                      className="ml-2 px-3 py-1.5 text-[10px] font-mono font-bold rounded-none border transition-colors shrink-0 relative overflow-hidden"
                      style={{
                        borderColor: canAfford && !(!item.consumable && owned) ? "#f0c040" : "#1e293b",
                        color: canAfford && !(!item.consumable && owned) ? "#f0c040" : "#475569",
                        background: canAfford && !(!item.consumable && owned) ? "#f0c04015" : "transparent",
                        opacity: (!item.consumable && owned) ? 0.4 : 1,
                      }}
                    >
                      {/* Pixel shimmer on affordable */}
                      {canAfford && !owned && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          animate={{ x: ["-100%", "120%"] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 2 }}
                          style={{ background: "linear-gradient(90deg, transparent, #f0c04040, transparent)", width: "50%" }}
                        />
                      )}
                      <span className="relative z-10">
                        {(!item.consumable && owned) ? "■ OWNED" : isBought ? "✦ BOUGHT" : `${item.cost}G`}
                      </span>
                    </motion.button>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* Equip modal */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setActiveSlot(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold">{SLOT_LABELS[activeSlot]} — SELECT</span>
              <button onClick={() => setActiveSlot(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            {inventory.filter(i => i.slot === activeSlot).length === 0 ? (
              <div className="text-xs text-muted-foreground/50 font-mono text-center py-4">No items for this slot.</div>
            ) : inventory.filter(i => i.slot === activeSlot).map((item, idx) => (
              <button key={idx} onClick={() => equipItem(item)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                <div>
                  <div className="text-xs font-mono font-bold" style={{ color: getTierColor(item.tier) }}>{item.label}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {item.stats && Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ")}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/50">{item.tier}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}