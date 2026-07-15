import { useState, useEffect, memo } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useProfileMount } from "@/utils/perf";
import { getTierColor } from "@/lib/gameState";
import { CLASSES } from "@/constants/rpgData";
import { djangoApi, getMediaUrl } from "@/api/djangoClient";
import PixelCharacter from "./PixelCharacter";
import { getRankDisplayData } from "@/lib/rankEngine";
import { ShoppingCart, X, Hexagon, ChevronLeft, Share2 } from "lucide-react";
import FantasyIcon from "@/components/navigation/FantasyIcon";
import html2canvas from "html2canvas";
import ShareCard from "@/components/ui/ShareCard";
import { useTranslation } from "react-i18next";

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
import TabGuideModal from "./TabGuideModal";
import GameCard from "@/components/ui/GameCard";
import ItemDetailModal from "./ItemDetailModal";
import PrestigePanel from "./PrestigePanel";
import ScrollsPanel from "./ScrollsPanel";
import InventoryPanel from "./InventoryPanel";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { ANIM_CONFIG } from "@/lib/animations";

// Unified stat system: Final = Base (5) + Stat Points + Class Bonus + Equipment
const STAT_CONFIG = {
  pwr: { label: "PWR", desc: "Power — +2% boss damage per point above 5", color: "#ef4444" },
  def: { label: "DEF", desc: "Defense — -1% HP damage taken per point (max -50%)", color: "#3b82f6" },
  foc: { label: "FOC", desc: "Focus Amp — +1% focus efficiency per point above 5", color: "#22c55e" },
  mem: { label: "MEM", desc: "Memory — +1.5% fatigue resistance per point above 5", color: "#a855f7" },
  spd: { label: "SPD", desc: "Speed — extra task completions", color: "#f59e0b" },
  lck: { label: "LCK", desc: "Luck — Gold drop bonus", color: "#eab308" },
};

const SLOT_KEYS = ["headware", "neural_link", "core", "arms", "legs", "offhand", "ring1", "ring2"];

const TIER_ORDER = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];

const SUB_TAB_IDS = ["overview", "skills", "achievements", "shop"];

function CharacterTab({ profile, logs, rankXP: rankXPProp, currentRankId, subTab: externalSubTab, onBack = undefined }) {
  useProfileMount("CharacterTab");
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const subTab = externalSubTab || "overview";
  const [shopTab, setShopTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("shopTab") || "gear";
    }
    return "gear";
  });

  const location = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const tab = p.get("shopTab");
    if (tab) {
      setShopTab(tab);
    }
  }, [location.search]);
  const [activeSlot, setActiveSlot] = useState(null);
  const [boughtItem, setBoughtItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const { bursts, trigger: triggerBurst } = usePixelBurst();

  const handleShare = async () => {
    try {
      setIsSharing(true);
      djangoApi.analytics.logEvent("share_card_generated");
      // Brief delay to ensure any layout shifts settle
      await new Promise(r => setTimeout(r, 100));

      const container = document.getElementById("share-card-container");
      if (!container) return;

      const canvas = await html2canvas(container, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const filename = `mind-os-${profile?.user__username || 'agent'}-progress.png`;

      if (navigator.share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], filename, { type: "image/png" });
          await navigator.share({
            title: "My MIND OS Progress",
            files: [file]
          });
          return;
        } catch (e) {
          console.error("Native share failed, falling back to download", e);
        }
      }

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Failed to generate share image", e);
    } finally {
      setIsSharing(false);
    }
  };

  const { data: shopItems = [], isLoading: isShopLoading } = useQuery({
    queryKey: ["shopItems"],
    queryFn: async () => {
      try {
        const response = await djangoApi.shop.getItems();
        return (response || []).map((item) => ({
          id: item.code,
          label: t(`items.${item.code}.name`, item.name),
          desc: t(`items.${item.code}.desc`, item.description),
          tier: item.tier,
          cost: item.cost,
          consumable: item.item_type === "consumable",
          stats: item.stats,
          slot: item.slot_type,
          icon_url: getMediaUrl(item.icon_url) || '/static/items/default.webp',
          healAmount: item.hp_boost
        }));
      } catch (err) {
        console.error("Failed to load shop items", err);
        return [];
      }
    }
  });

  const gold = profile?.gold || 0;
  // Gold is SSOT on the Django backend.
  // It is only mutated as a side-effect of shop/ally/skill mutations,
  // which each call invalidateQueries(['userprofile']) in their onSuccess.
  // We NEVER write gold directly from local state — that caused the reset resurrection bug.
  const spendGold = () => { }; // no-op: child panels use their own mutations


  // Use prop if provided, fallback to profile data
  const rankXP = rankXPProp !== undefined ? rankXPProp : (profile?.rank_xp || 0);

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
  const inventory = Array.isArray(rawInventory) ? rawInventory.map(ri => {
    const found = shopItems.find(i => i.id === ri.id);
    return found ? { ...found, ...ri } : ri;
  }) : [];

  const rawEquipped = profile?.equipped || [];
  const equipped = {};
  if (Array.isArray(rawEquipped)) {
    rawEquipped.forEach(eq => {
      const found = shopItems.find(i => i.id === eq.code);
      if (found && found.slot) {
        equipped[found.slot] = found;
      }
    });
  }

  // Equipped stats breakdown
  const equipStats = profile?.equip_stats || { pwr: 0, def: 0, foc: 0, mem: 0, spd: 0, lck: 0 };
  const classStats = profile?.class_stats || { pwr: 0, def: 0, foc: 0, mem: 0, spd: 0, lck: 0 };

  // Use backend stats as SSOT
  const statBreakdown = {};
  Object.keys(STAT_CONFIG).forEach(key => {
    const backendBase = profile?.[`base_${key}`] || 5;
    const total = profile?.total_stats?.[key] || backendBase;
    const equipBonus = equipStats[key] || 0;
    const classBonus = classStats[key] || 0;

    // We infer non-equip bonus (base + invested) from the backend base
    statBreakdown[key] = {
      base: backendBase,
      points: backendBase, // Base starts at 5, plus any invested points
      class: classBonus,
      equip: equipBonus,
      total: total,
    };
  });

  // Use currentRankId prop if provided for sync with header character icon
  const currentRankIdValue = currentRankId || profile?.rank_info?.current_id || "F";
  const currentRank = getRankDisplayData(currentRankIdValue, profile);
  const charHp = profile?.hp !== undefined ? profile.hp : 100;
  const charMaxHp = profile?.hp_max || 100;
  const hpPct = Math.max(0, (charHp / charMaxHp) * 100);
  const hpColor = hpPct > 50 ? "#ef4444" : hpPct > 25 ? "#f59e0b" : "#ff0000";

  const handleChooseClass = async (classId) => {
    const cls = CLASSES[classId];

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
  };

  const handleSkillUsed = () => {
    // Skills use React Query mutations internally, refetch profile if needed
    queryClient.invalidateQueries({ queryKey: ["userprofile"] });
  };

  const handleSkillTreeUpdate = async (newTree, node) => {
    if (node) {
      try {
        const res = await djangoApi.skills.buy(node.id);
        queryClient.setQueryData(["userprofile"], res.profile);
      } catch (e) {
        console.error("Failed to buy skill node:", e);
      }
    }
  };

  const handleAlliesUpdate = async (newAllies, ally) => {
    if (ally) {
      try {
        const res = await djangoApi.allies.recruit(ally.id);
        queryClient.setQueryData(["userprofile"], res.profile);
      } catch (e) {
        console.error("Failed to recruit ally:", e);
      }
    }
  };

  const handleMutatorsUpdate = () => {
  };

  const handlePrestige = () => {
    // Prestige logic is now handled fully in PrestigePanel
  };

  const mutation = useMutation({
    mutationFn: (/** @type {any} */ buyData) => djangoApi.shop.buy(buyData.item_id),
    onMutate: async (/** @type {any} */ buyData) => {
      await queryClient.cancelQueries({ queryKey: ["userprofile"] });
      /** @type {any} */
      const prevProfile = queryClient.getQueryData(["userprofile"]);

      if (prevProfile) {
        const item = shopItems.find(i => i.id === buyData.item_id);
        const healAmount = item && item.consumable ? (item.healAmount || 0) : 0;
        const newHp = healAmount
          ? Math.min(prevProfile.hp_max, prevProfile.hp + healAmount)
          : prevProfile.hp;

        const newInventory = healAmount
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
      is_consumable: !!item.consumable
    });
  };

  const equipItem = (item) => {
    playSound('success');

    // Optimistically update
    /** @type {any} */
    const prevProfile = queryClient.getQueryData(["userprofile"]);
    if (prevProfile) {
      // Toggle logic for optimistic update
      const newInventory = (Array.isArray(prevProfile.inventory) ? prevProfile.inventory : []).map(i => {
        if (i.id === item.id) return { ...i, is_equipped: !i.is_equipped };
        const foundItem = shopItems.find(s => s.id === i.id);
        if (foundItem && foundItem.slot === item.slot && !item.is_equipped) return { ...i, is_equipped: false };
        return i;
      });
      queryClient.setQueryData(["userprofile"], { ...prevProfile, inventory: newInventory });
    }

    djangoApi.inventory.equip(item.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    }).catch(err => {
      console.error("Failed to equip item", err);
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    });
    setActiveSlot(null);
  };

  const unequip = (slot) => {
    playSound('click');
    const eqId = rawEquipped[slot]?.id || rawEquipped[slot];
    if (eqId) {
      djangoApi.inventory.equip(eqId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      });
    }
    setActiveSlot(null);
  };

  const upgradeStat = async (stat) => {
    if ((profile?.unspent_stat_points || 0) <= 0) return;
    playSound('level_up');

    const nextVal = (profile?.[`base_${stat}`] || 5) + 1;
    const nextPoints = (profile?.unspent_stat_points || 0) - 1;

    // Optimistic Update
    /** @type {any} */
    const prevProfile = queryClient.getQueryData(["userprofile"]);
    if (prevProfile) {
      queryClient.setQueryData(["userprofile"], {
        ...prevProfile,
        [`base_${stat}`]: nextVal,
        unspent_stat_points: nextPoints
      });
    }

    try {
      await djangoApi.profile.update({
        [`base_${stat}`]: nextVal,
        unspent_stat_points: nextPoints
      });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
    } catch (e) {
      console.error("Failed to upgrade stat on backend:", e);
      if (prevProfile) {
        queryClient.setQueryData(["userprofile"], prevProfile);
      }
    }
  };

  const gearItems = shopItems.filter(i => !i.consumable);
  const consumables = shopItems.filter(i => i.consumable);

  // If no class chosen, show selector
  if (!classData.chosen) {
    return <ClassSelector onChoose={handleChooseClass} isPremium={profile?.is_premium || false} />;
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
          <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 14, color: classColor }}>{chosenClass ? t(`rpgData.classes.${chosenClass.id}.name`, chosenClass.name) : ""}</span>
          {profile?.prestige_count > 0 && (
            <span style={{ fontFamily: "'PixeloidSans'", fontSize: 8, background: "var(--habit-border)", color: "var(--habit-gold)", border: "1px solid var(--habit-border)", padding: "2px 6px", borderRadius: 4 }}>
              ×{profile?.prestige_count} PRESTIGE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-accent/50 disabled:opacity-50"
            style={{ color: "var(--habit-gold)" }}
            title="Share Progress"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 15, color: "var(--habit-gold)" }}>
            🪙 <AnimatedNumber value={normalizeGold(gold)} formatter={(v) => Math.round(v).toLocaleString()} />G
          </span>
        </div>
      </div>

      {/* Sub-tab navigation handled by sidebar */}

      {/* OVERVIEW */}
      {subTab === "overview" && (
        <div className="space-y-4">
          <TabGuideModal guideId="character" profile={profile} />
          {/* Character sprite */}
          <div className="rounded-2xl p-5 flex flex-col items-center gap-3"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${currentRank.color}18 0%, var(--habit-panel) 80%)`,
              border: `2px solid ${currentRank.color}44`,
              boxShadow: `0 4px 20px ${currentRank.color}18`,
            }}>
            <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={160} hideLabel={true} />
            <div className="font-mono text-xs font-black tracking-widest" style={{ color: classColor }}>{chosenClass ? String(t(`rpgData.classes.${chosenClass.id}.name`, chosenClass.name)) : ""}</div>
            <div className="font-mono text-sm font-bold px-3 py-1 rounded-lg"
              style={{ color: currentRank.color, background: `${currentRank.color}20`, border: `1px solid ${currentRank.color}50` }}>
              {currentRank.id} — {t(`ranks.${currentRank.id}`, currentRank.label)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/50 italic text-center">"{chosenClass ? t(`rpgData.classes.${chosenClass.id}.lore`, chosenClass.lore) : ""}"</div>
          </div>

          {/* HP + Mana bars */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
                <span>HP</span>
                <span style={{ color: hpColor }}>
                  <AnimatedNumber value={Math.round(charHp)} />/{charMaxHp}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${hpPct}%` }}
                  transition={ANIM_CONFIG.springBar}
                  style={{ background: hpColor, boxShadow: `0 0 6px ${hpColor}66` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground/50">
                <span>MANA</span>
                <span style={{ color: classColor }}>
                  <AnimatedNumber value={Math.round(profile?.mana || 0)} />/{profile?.mana_max || chosenClass.maxMana}
                </span>
              </div>
              <div className="h-2 rounded-none bg-muted overflow-hidden mt-1" style={{ imageRendering: "pixelated" }}>
                <motion.div
                  className="h-full"
                  animate={{ width: `${Math.min(100, ((profile?.mana || 0) / (profile?.mana_max || chosenClass.maxMana)) * 100)}%` }}
                  transition={ANIM_CONFIG.springBar}
                  style={{ background: classColor, boxShadow: `0 0 6px ${classColor}66` }}
                />
              </div>
            </div>
          </div>

          {/* Unified Stats Panel */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('character.character_stats')}</span>
              {(profile?.unspent_stat_points || 0) > 0 && (
                <span className="font-mono text-xs text-primary flex items-center gap-1">
                  <FantasyIcon size={12}><Hexagon /></FantasyIcon> {profile?.unspent_stat_points} {t('character.pts_label')}
                </span>
              )}
            </div>

            {/* Stats table with breakdown */}
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider pb-2 border-b border-border/40">
                <div className="text-left col-span-2">{t('character.stat_effect')}</div>
                <div className="text-center">{t('character.col_class')}</div>
                <div className="text-center">{t('character.col_equip')}</div>
                <div className="text-center">{t('character.col_base')}</div>
                <div className="text-right">{t('character.col_total')}</div>
              </div>

              {/* Stat rows */}
              {Object.entries(statBreakdown).map(([key, breakdown]) => {
                const cfg = STAT_CONFIG[key];
                const canUpgrade = (profile?.unspent_stat_points || 0) > 0;
                // Compute live effect label based on totalValue
                const totalValue = breakdown.total;
                let effectLabel = "";
                if (key === "pwr") {
                  effectLabel = `+${(totalValue * 0.5).toFixed(1)} ${t('character.pwr_effect_short')}`;
                } else if (key === "def") {
                  effectLabel = `-${Math.round((1 - (100 / (100 + totalValue))) * 100)}% ${t('character.def_effect_short')} `;
                } else if (key === "foc") {
                  effectLabel = `+${(totalValue * 0.5).toFixed(1)}% ${t('character.foc_effect_short')}`;
                } else if (key === "mem") {
                  effectLabel = `-${Math.round((1 - (100 / (100 + totalValue))) * 100)}% ${t('character.mem_effect_short')}`;
                } else if (key === "spd") {
                  effectLabel = `+${(totalValue * 0.5).toFixed(1)} ${t('character.spd_effect_short')}`;
                } else if (key === "lck") {
                  effectLabel = `+${totalValue}% ${t('character.lck_effect_short')}`;
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
              {t('character.formula')}
            </div>
          </div>

          {/* Equipment slots */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--habit-panel)", border: "1px solid var(--habit-border)" }}>
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('character.equipment')}</span>
            <div className="grid grid-cols-4 gap-2">
              {SLOT_KEYS.map((slot) => {
                const eq = equipped[slot];
                const label = t(`slots.${slot}`, slot.toUpperCase());
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
          <PrestigePanel prestige={{ count: profile?.prestige_count || 0 }} rankXP={rankXP} onPrestige={handlePrestige} />
        </div>
      )}

      {/* SKILLS */}
      {subTab === "skills" && (
        <div className="space-y-4">
          <SkillPanel classId={classData.chosen} />
          <TabGuideModal guideId="skill_tree" profile={profile} />
          <SkillTreePanel
            skillTree={profile?.unlocked_skills || []}
            onUpdate={handleSkillTreeUpdate}
            gold={gold}
            onSpendGold={spendGold}
          />
        </div>
      )}

      {/* ACHIEVEMENTS */}
      {subTab === "achievements" && (
        <AchievementsPanel profile={profile} logs={logs || []} alliesData={profile?.recruited_allies || {}} prestigeData={{ count: profile?.prestige_count || 0 }} onClaimReward={() => { }} />
      )}

      {/* SHOP */}
      {subTab === "shop" && (
        <div className="space-y-3">
          <TabGuideModal guideId="shop" profile={profile} />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground uppercase flex items-center gap-1.5">
              <FantasyIcon size={14}><ShoppingCart /></FantasyIcon> {t('character.shop_title')}
            </span>
            <span className="font-mono text-xs font-bold" style={{ color: "#f0c040" }}>
              🪙 <AnimatedNumber value={normalizeGold(gold)} formatter={(v) => Math.round(v).toLocaleString()} />G
            </span>
          </div>

          {/* ── Daily Featured Deal ── */}
          {(() => {
            const today = new Date().toDateString();
            const seed = today.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const allItems = shopItems.length > 0 ? [...shopItems] : [{ id: "placeholder", label: "Loading...", cost: 100, tier: "Common", consumable: true }];
            const featuredItem = allItems[seed % allItems.length];
            const discountPct = 20 + (seed % 3) * 10; // 20%, 30%, or 40%
            const discountedCost = Math.max(1, Math.round(featuredItem.cost * (1 - discountPct / 100)));
            const canAfford = gold >= discountedCost;
            const tierColor = getTierColor(featuredItem.tier);
            const isOwned = !featuredItem.consumable && (inventory || []).some(i => i.id === featuredItem.id);
            // Bonus unique items not in regular shop (only in featured slot)
            const bonusPool = [
              { id: "daily_xp_surge", label: "XP Surge Scroll", tier: "Epic", cost: 0, consumable: true, effect: "+100% XP for 2h", icon_url: "/static/items/daily_xp_surge.webp" },
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
                  <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: "#f0c040" }}>{t('character.daily_deal')}</span>
                  <span className="font-mono text-[8px] text-muted-foreground/40">{t('character.resets_midnight')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded border flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ borderColor: `${dealTierColor}60`, background: "rgba(10,8,6,0.8)", imageRendering: "pixelated" }}>
                    <img src={dealItem.icon_url || '/static/items/default.webp'} alt={dealItem.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold" style={{ color: dealTierColor }}>{dealItem.label}</div>
                    <div className="text-[9px] font-mono text-muted-foreground/60">{dealItem.effect || ('stats' in dealItem && dealItem.stats ? Object.entries(dealItem.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : "")}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!isBonusDay && (
                        <span className="text-[9px] font-mono line-through text-muted-foreground/40">{featuredItem.cost}G</span>
                      )}
                      <span className="text-xs font-mono font-bold" style={{ color: "#f0c040" }}>{dealItem.cost}G</span>
                      {!isBonusDay && (
                        <span className="text-[8px] font-mono px-1 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>-{discountPct}%</span>
                      )}
                      {isBonusDay && (
                        <span className="text-[8px] font-mono px-1 rounded" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>{t('character.exclusive')}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { buyItem(dealItem); }}
                    disabled={!canBuyDeal}
                    className="px-3 py-1.5 text-[10px] font-mono font-bold rounded border transition-all shrink-0 disabled:opacity-30"
                    style={{ borderColor: canBuyDeal ? "#f0c040" : "#2a2010", color: canBuyDeal ? "#f0c040" : "#4a3810", background: canBuyDeal ? "rgba(240,192,64,0.12)" : "transparent" }}
                  >
                    {isBought ? t('character.bought') : `${dealItem.cost}G`}
                  </button>
                </div>
              </div>
            );
          })()}
          <div className="flex gap-1 flex-wrap">
            {["gear", "consumables", "scrolls", "inventory", "allies", "mutators"].map(tab => (
              <button key={tab} onClick={() => setShopTab(tab)}
                className="px-3 py-1 text-[10px] font-mono uppercase rounded transition-all"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: shopTab === tab ? "var(--habit-purple)" : "var(--habit-border)",
                  color: shopTab === tab ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
                  background: shopTab === tab ? "var(--habit-purple-light)" : "transparent",
                }}
              >{t(`shop_tabs.${tab}`, tab)}</button>
            ))}
          </div>
          {shopTab === "scrolls" && (
            <ScrollsPanel gold={gold} onSpendGold={spendGold} />
          )}
          {shopTab === "inventory" && (
            <InventoryPanel gs={{ inventory, consumables: {} }} onSave={() => { }} onToggleEquip={equipItem} />
          )}
          {shopTab === "allies" && (
            <>
              <TabGuideModal guideId="allies" profile={profile} />
              <AlliesPanel onSpendGold={spendGold} />
            </>
          )}
          {shopTab === "mutators" && (
            <>
              <TabGuideModal guideId="mutators" profile={profile} />
              <MutatorsPanel onSpendGold={spendGold} />
            </>
          )}
          <div className={`${shopTab === "gear" || shopTab === "consumables" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1" : "space-y-2"}`}>
            {(shopTab === "scrolls" || shopTab === "inventory" || shopTab === "allies" || shopTab === "mutators") ? null : (shopTab === "gear" ? gearItems : consumables)
              .sort((a, b) => a.cost - b.cost)
              .map((item, idx) => {
                const canAfford = gold >= item.cost;
                const owned = inventory.some(i => i.id === item.id);
                const isBought = boughtItem === item.id;
                const tierColor = getTierColor(item.tier);
                return (
                  <GameCard
                    key={item.id}
                    isActive={isBought}
                    borderColor={tierColor}
                    glowColor="#f0c040"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      scale: isBought ? [1, 1.04, 1] : 1,
                    }}
                    transition={{
                      opacity: { duration: 0.2, delay: idx * 0.045 },
                      scale: isBought ? { duration: 0.35, ease: "easeOut" } : {},
                    }}
                    className="flex flex-col text-center p-3 relative cursor-pointer"
                    style={{ imageRendering: "pixelated" }}
                    onClick={() => setSelectedItem(item)}
                  >
                    {/* Pixel scanlines */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                      style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 3px)" }} />

                    {/* Flash on buy */}
                    <PixelFlash active={isBought} color="#f0c040" />

                    {/* Buy burst particles */}
                    {isBought && <PixelBurstLayer bursts={bursts} />}

                    {/* Icon */}
                    <div className="w-14 h-14 mx-auto rounded border flex items-center justify-center shrink-0 overflow-hidden z-10 bg-gray-100 dark:bg-gray-800/50 mb-2"
                      style={{ borderColor: `${tierColor}50`, imageRendering: "pixelated" }}>
                      <motion.div
                        whileHover={{ scale: 1.15, rotate: [-2, 2, -2, 0] }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full p-2"
                        style={{ imageRendering: "pixelated" }}
                      >
                        <img src={item.icon_url || '/static/items/default.webp'} alt={item.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                      </motion.div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-start">
                      <div className="text-xs font-mono font-bold truncate px-1" style={{ color: tierColor }}>
                        {item.label}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground/60 mt-1 line-clamp-2 px-1 mb-3">
                        {item.stats ? Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : (item.description || item.effect)}
                      </div>
                    </div>

                    <motion.button
                      onClick={(e) => { e.stopPropagation(); buyItem(item); }}
                      disabled={!canAfford || (!item.consumable && owned)}
                      whileTap={canAfford && !((!item.consumable) && owned) ? { scale: 0.88, y: 2 } : {}}
                      className="w-full mt-auto py-2 text-[10px] font-mono font-bold rounded border transition-colors shrink-0 relative overflow-hidden"
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
                        {(!item.consumable && owned) ? t('character.owned') : isBought ? t('character.bought') : `${item.cost}G`}
                      </span>
                    </motion.button>
                  </GameCard>
                );
              })}
          </div>
        </div>
      )}

      {/* Equip modal */}
      {activeSlot && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          style={{ touchAction: 'none', overscrollBehavior: 'none' }}
          onClick={() => setActiveSlot(null)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="font-mono text-xs font-bold">{String(t(`slots.${activeSlot}`, activeSlot?.toUpperCase()))} — {t('character.select_slot')}</span>
              <button onClick={() => setActiveSlot(null)} className="p-1 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
              {inventory.filter(i => i.slot === activeSlot).length === 0 ? (
                <div className="text-xs text-muted-foreground/50 font-mono text-center py-8">{t('character.no_items_slot')}</div>
              ) : inventory.filter(i => i.slot === activeSlot).map((item, idx) => (
                <button key={idx} onClick={() => equipItem(item)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-all text-left">
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: getTierColor(item.tier) }}>{item.label}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {item.stats && Object.entries(item.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ")}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">{item.tier}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Shared Item Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.label}
        tierColor={selectedItem ? getTierColor(selectedItem.tier) : undefined}
        actionButton={
          selectedItem && (
            <button
              onClick={() => { buyItem(selectedItem); setSelectedItem(null); }}
              disabled={gold < selectedItem.cost || (!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))}
              className="w-full py-3 text-xs font-mono font-bold rounded border transition-colors relative overflow-hidden"
              style={{
                borderColor: (gold >= selectedItem.cost && !(!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))) ? "#f0c040" : "#1e293b",
                color: (gold >= selectedItem.cost && !(!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))) ? "#f0c040" : "#475569",
                background: (gold >= selectedItem.cost && !(!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))) ? "#f0c04015" : "transparent",
                opacity: (!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id)) ? 0.4 : 1,
              }}
            >
              {(!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))
                ? t('character.owned')
                : `${selectedItem.cost}G - ${t('inventory.buy', 'Buy')}`
              }
            </button>
          )
        }
      />

      {/* Off-screen container for generating Shareable Image */}
      <div
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          width: 1080,
          height: 1080
        }}
      >
        <div id="share-card-container">
          <ShareCard profile={profile} />
        </div>
      </div>
    </div>
  );
}

export default memo(CharacterTab);