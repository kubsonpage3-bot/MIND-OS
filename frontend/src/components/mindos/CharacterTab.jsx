// @ts-nocheck
import { useState, useEffect, useMemo, memo } from "react";
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
import { showRewardToast } from "./RewardToast";

import MutatorsPanel from "./MutatorsPanel";
import TabGuideModal from "./TabGuideModal";
import GameCard from "@/components/ui/GameCard";
import ItemDetailModal from "./ItemDetailModal";
import ConsumableDetailModal from "./ConsumableDetailModal";
import PrestigePanel from "./PrestigePanel";
import ScrollsPanel from "./ScrollsPanel";
import InventoryPanel from "./InventoryPanel";
import ChestPanel from "./ChestPanel";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { ANIM_CONFIG } from "@/lib/animations";
import { getFeatureLocks } from "@/lib/featureLock";
import FeatureLockScreen from "@/components/ui/FeatureLockScreen";
import { getValidSubTab } from "@/lib/navigation";

// Unified stat system: Final = Base (5) + Stat Points + Class Bonus + Equipment
const STAT_CONFIG = {
  pwr: { label: "PWR", desc: "Power — +2% boss damage per point above 5", color: "#ef4444" },
  def: { label: "DEF", desc: "Defense — -1% HP damage taken per point (max -50%)", color: "#3b82f6" },
  foc: { label: "FOC", desc: "Focus Amp — +1% focus efficiency per point above 5", color: "#22c55e" },
  mem: { label: "MEM", desc: "Memory — +1.5% fatigue resistance per point above 5", color: "#a855f7" },
  spd: { label: "SPD", desc: "Speed — extra task completions", color: "#f59e0b" },
  lck: { label: "LCK", desc: "Luck — Gold drop bonus", color: "#eab308" },
};

const STAT_ICONS = {
  pwr: "/images/stats/pwr.jpg",
  def: "/images/stats/def.jpg",
  foc: "/images/stats/foc.jpg",
  mem: "/images/stats/mem.jpg",
  spd: "/images/stats/spd.jpg",
  lck: "/images/stats/lck.jpg",
};

const SLOT_KEYS = ["headware", "neural_link", "core", "arms", "legs", "offhand", "ring1", "ring2"];

const TIER_ORDER = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];

const SUB_TAB_IDS = ["overview", "skills", "shop"];

function CharacterTab({ profile, logs, rankXP: rankXPProp, currentRankId, subTab: externalSubTab, onBack = undefined }) {
  useProfileMount("CharacterTab");
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { skillsLocked, alliesLocked, mutatorsLocked, skillsUnlockRank, alliesUnlockRank, mutatorsUnlockRank } = getFeatureLocks(profile);
  const subTab = getValidSubTab("character", externalSubTab);
  const [shopTab, setShopTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const val = p.get("shopTab");
      return (val && val !== "inventory") ? val : "chests";
    }
    return "chests";
  });

  const location = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const tab = p.get("shopTab");
    if (tab) {
      setShopTab(tab === "inventory" ? "chests" : tab);
    }
  }, [location.search]);

  useEffect(() => {
    const handleOpenShopTab = (e) => {
      const targetTab = e.detail?.tab || "chests";
      setShopTab(targetTab);
    };
    window.addEventListener("mindos:open_shop_tab", handleOpenShopTab);
    return () => window.removeEventListener("mindos:open_shop_tab", handleOpenShopTab);
  }, []);
  const [activeSlot, setActiveSlot] = useState(null);
  const [boughtItem, setBoughtItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedConsumable, setSelectedConsumable] = useState(null);
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
          code: item.code,
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

  const consumables = useMemo(() => shopItems.filter(i => i.consumable), [shopItems]);

  const { data: activeEffectsData } = useQuery({
    queryKey: ['active_effects'],
    queryFn: () => djangoApi.skills.getActiveEffects(),
    staleTime: 30_000,
  });

  const activeEffectsMap = useMemo(() => {
    const effects = activeEffectsData?.active_effects || [];
    return Object.fromEntries(effects.map(e => [e.skill_id, {
      active: true,
      skill_id: e.skill_id,
      expiresAt: e.expires_at ? new Date(e.expires_at).getTime() : null,
    }]));
  }, [activeEffectsData]);

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
    const found = shopItems.find(i => i.id === ri.id || i.id === ri.code);
    // Preserve code from shopItems — ri.code from Django serializer is the canonical item code.
    // found.id === item.code, so we ensure code is never lost after merge.
    return found ? { ...found, ...ri, code: ri.code || found.id } : ri;
  }) : [];

  const equipped = {};
  inventory.forEach(invItem => {
    if (invItem.is_equipped && invItem.slot) {
      const itemTier = invItem.gear_class || invItem.tier;
      const itemName = invItem.label || invItem.name || invItem.code || "Item";
      equipped[invItem.slot] = {
        ...invItem,
        id: invItem.id || invItem.code,
        code: invItem.code || invItem.id,
        label: itemName,
        name: itemName,
        tier: itemTier,
        gear_class: itemTier,
        slot: invItem.slot,
      };
    }
  });

  // Fallback check for profile.equipped array
  const rawEquipped = profile?.equipped || [];
  if (Array.isArray(rawEquipped)) {
    rawEquipped.forEach(eq => {
      const itemCode = eq.code || eq.id;
      const found = inventory.find(i => i.id === itemCode || i.code === itemCode) || shopItems.find(i => i.id === itemCode);
      if (found && found.slot && !equipped[found.slot]) {
        const itemTier = found.gear_class || found.tier;
        const itemName = found.label || found.name || found.code || "Item";
        equipped[found.slot] = {
          ...found,
          id: itemCode,
          code: itemCode,
          label: itemName,
          name: itemName,
          tier: itemTier,
          gear_class: itemTier,
          slot: found.slot,
        };
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
  const currentRankIdValue = currentRankId || profile?.rank_info?.current_id || "E";
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
      await queryClient.cancelQueries({ queryKey: ["inventory"] });
      /** @type {any} */
      const prevProfile = queryClient.getQueryData(["userprofile"]);

      if (prevProfile) {
        queryClient.setQueryData(["userprofile"], {
          ...prevProfile,
          gold: Math.max(0, prevProfile.gold - buyData.cost),
        });
      }

      setBoughtItem(buyData.item_id);
      triggerBurst("#f0c040", 10);
      setTimeout(() => setBoughtItem(null), 800);

      return { prevProfile };
    },
    onSuccess: (data, buyData) => {
      const item = shopItems.find(i => i.id === buyData.item_id);
      const itemName = item?.label || buyData.item_id;
      showRewardToast({
        label: String(t('shop.bought_toast', `Purchased ${itemName}! Added to Inventory.`, { name: itemName })),
        gold: -buyData.cost,
      });
    },
    onError: (err, buyData, context) => {
      if (context?.prevProfile) {
        queryClient.setQueryData(["userprofile"], context.prevProfile);
      }
      showRewardToast({ label: `❌ Purchase failed: ${err.message || 'Error'}` });
      console.error("Shop purchase failed:", err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["active_effects"] });
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
      const targetId = item.id || item.code;
      const targetSlot = item.slot;
      const willBeEquipped = !item.is_equipped;

      const newInventory = (Array.isArray(prevProfile.inventory) ? prevProfile.inventory : []).map(i => {
        const itemId = i.id || i.code;
        if (itemId === targetId) return { ...i, is_equipped: willBeEquipped };
        if (willBeEquipped && i.slot === targetSlot) return { ...i, is_equipped: false };
        return i;
      });
      queryClient.setQueryData(["userprofile"], { ...prevProfile, inventory: newInventory });
    }

    const itemCode = item.code || item.id;
    djangoApi.inventory.equip(itemCode).then(() => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }).catch(err => {
      console.error("Failed to equip item", err);
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    });
    setActiveSlot(null);
  };

  const unequip = (slot) => {
    playSound('click');
    const eq = equipped[slot];
    const eqCode = eq?.code || eq?.id;
    if (eqCode) {
      djangoApi.inventory.equip(eqCode).then(() => {
        queryClient.invalidateQueries({ queryKey: ["userprofile"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      }).catch(err => {
        console.error("Failed to unequip item", err);
        queryClient.invalidateQueries({ queryKey: ["userprofile"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
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

  // If no class chosen, show selector
  if (!classData.chosen) {
    return <ClassSelector onChoose={handleChooseClass} isPremium={profile?.is_premium || false} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="flex items-center justify-between rounded-2xl relative overflow-hidden"
        style={{
          background: "var(--habit-card-gradient, linear-gradient(135deg, rgba(20,10,28,0.95) 0%, rgba(10,5,15,0.98) 100%))",
          border: "1.5px solid var(--habit-border)",
          boxShadow: "var(--habit-card-shadow, 0 4px 18px rgba(0,0,0,0.5))",
          padding: "10px 16px",
        }}
      >
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: classColor }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className="font-pixel font-bold text-sm" style={{ color: classColor }}>
            {chosenClass ? String(t(`rpgData.classes.${chosenClass.id}.name`, chosenClass.name)) : "Wanderer"}
          </span>
          {profile?.prestige_count > 0 && (
            <span className="font-pixel text-[9px] bg-amber-500/15 text-amber-500 border border-amber-500/40 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              ★ ×{profile.prestige_count} PRESTIGE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="flex items-center justify-center w-8 h-8 rounded-xl transition-all bg-black/5 dark:bg-white/[0.04] border border-[var(--habit-border)] hover:bg-black/10 dark:hover:bg-white/[0.08] hover:border-amber-500/40 disabled:opacity-50"
            style={{ color: "#fbbf24" }}
            title="Share Progress"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <span className="font-pixel font-black text-sm flex items-center gap-1" style={{ color: "#f59e0b", textShadow: "0 0 10px rgba(245,158,11,0.3)" }}>
            <span>🪙</span>
            <AnimatedNumber value={normalizeGold(gold)} formatter={(v) => Math.round(v).toLocaleString()} />G
          </span>
        </div>
      </div>

      {/* Sub-tab navigation handled by sidebar */}

      {/* OVERVIEW */}
      {subTab === "overview" && (
        <div className="space-y-4">
          <TabGuideModal guideId="character" profile={profile} />

          {/* 🏛️ Hero Sanctuary (Пьедестал Чемпиона) */}
          <div
            className="rounded-2xl p-5 flex flex-col items-center gap-4 relative overflow-hidden"
            style={{
              background: "var(--habit-sanctuary-bg, radial-gradient(ellipse at 50% 35%, rgba(20,10,28,0.95) 60%, rgba(8,5,12,0.98) 100%))",
              border: "1.5px solid var(--habit-border)",
              boxShadow: "var(--habit-sanctuary-shadow, 0 8px 32px rgba(0,0,0,0.8))",
            }}
          >
            {/* Gothic Corner Brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: `${currentRank.color}80` }} />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: `${currentRank.color}80` }} />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: `${currentRank.color}80` }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: `${currentRank.color}80` }} />

            {/* Sanctuary Protocol Header */}
            <div className="w-full flex items-center justify-between border-b border-[var(--habit-border)] pb-2.5 text-[10px] font-pixel">
              <div className="flex items-center gap-2" style={{ color: currentRank.color }}>
                <span className="animate-pulse">✦</span>
                <span className="tracking-widest uppercase">{t('character.sanctuary', 'Hero Sanctuary')}</span>
              </div>
              <div className="flex items-center gap-2">
                {profile?.level && (
                  <span className="px-2 py-0.5 rounded bg-[var(--habit-card-sub)] border border-[var(--habit-border)] text-amber-500 font-bold text-[9px] font-pixel shadow-xs">
                    LV.{profile.level}
                  </span>
                )}
                {profile?.prestige_count > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-500 font-bold text-[9px] font-pixel">
                    ★ {profile.prestige_count} PRESTIGE
                  </span>
                )}
              </div>
            </div>

            {/* Character Pedestal with Magic Aura */}
            <div className="relative flex items-center justify-center my-1">
              {/* Rotating Rune Circle behind character */}
              <motion.div
                className="absolute w-44 h-44 rounded-full border border-dashed pointer-events-none opacity-25"
                style={{ borderColor: currentRank.color }}
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute w-36 h-36 rounded-full border pointer-events-none opacity-20"
                style={{ borderColor: classColor, boxShadow: `0 0 25px ${classColor}50` }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={160} hideLabel={true} />
            </div>

            {/* Hero Title & Class Crest */}
            <div className="flex flex-col items-center gap-2 text-center z-10">
              <div
                className="font-pixel font-bold text-lg tracking-wider capitalize"
                style={{ color: classColor, textShadow: `0 0 14px ${classColor}60` }}
              >
                {chosenClass ? String(t(`rpgData.classes.${chosenClass.id}.name`, chosenClass.name)) : "Wanderer"}
              </div>

              {/* Rank Medallion */}
              <div
                className="font-pixel text-xs font-bold px-3.5 py-1.5 rounded-xl border flex items-center gap-2 shadow-lg"
                style={{
                  color: currentRank.color,
                  background: 'var(--habit-panel)',
                  borderColor: 'var(--habit-border)',
                  boxShadow: `0 0 16px ${currentRank.color}30, inset 0 0 8px ${currentRank.color}15`,
                }}
              >
                <span className="text-amber-400">⚜</span>
                <span>{currentRank.id} — {t(`ranks.${currentRank.id}`, currentRank.label)}</span>
                <span className="text-amber-400">⚜</span>
              </div>

              {chosenClass?.lore && (
                <p className="text-[10px] font-mono text-muted-foreground/60 italic max-w-md px-2 mt-0.5 leading-relaxed">
                  "{String(t(`rpgData.classes.${chosenClass.id}.lore`, chosenClass.lore))}"
                </p>
              )}
            </div>
          </div>



          {/* ⚡ Runic Attributes Matrix (Матрица Характеристик) */}
          <div
            className="rounded-2xl p-4 space-y-3 relative overflow-hidden"
            style={{
              background: "var(--habit-card-gradient, linear-gradient(135deg, rgba(20,12,30,0.95) 0%, rgba(10,6,16,0.98) 100%))",
              border: "1.5px solid var(--habit-border)",
              boxShadow: "var(--habit-card-shadow, 0 4px 20px rgba(0,0,0,0.6))",
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--habit-border)] pb-2.5">
              <span className="font-pixel text-[11px] text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                <span>⚡</span> {t('character.character_stats', 'CHARACTER ATTRIBUTES')}
              </span>
              {(profile?.unspent_stat_points || 0) > 0 ? (
                <span className="font-pixel text-[10px] px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/50 text-amber-500 font-bold flex items-center gap-1 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                  <span>✨</span> {profile?.unspent_stat_points} {t('character.pts_label', 'POINTS')}
                </span>
              ) : (
                <span className="text-[9px] font-pixel text-muted-foreground/50">
                  TOTAL = BASE + CLASS + EQUIP
                </span>
              )}
            </div>

            {/* 2-Column Grid of Attribute Slabs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(statBreakdown).map(([key, breakdown]) => {
                const cfg = STAT_CONFIG[key];
                const canUpgrade = (profile?.unspent_stat_points || 0) > 0;
                const statIcon = {
                  pwr: "⚔️",
                  def: "🛡️",
                  foc: "🎯",
                  mem: "🧠",
                  spd: "⚡",
                  lck: "🍀"
                }[key] || "✨";

                const totalValue = breakdown.total;
                let effectLabel = "";
                let detailedTooltip = "";
                if (key === "pwr") {
                  effectLabel = `+${(totalValue * 0.5).toFixed(1)}% XP • +${totalValue} ATK`;
                  detailedTooltip = `+${(totalValue * 0.5).toFixed(1)}% XP bonus to tasks & +${totalValue} Boss Attack Damage`;
                } else if (key === "def") {
                  const red = Math.round((1 - (100 / (100 + totalValue))) * 100);
                  effectLabel = `-${red}% ${t('character.def_effect_short', 'HP dmg taken')}`;
                  detailedTooltip = `Reduces HP damage taken from failed habits and missed dailies by ${red}%`;
                } else if (key === "foc") {
                  const crit = (totalValue * 0.5).toFixed(1);
                  const trainBonus = Math.max(0, totalValue - 5);
                  effectLabel = `+${crit}% ${t('character.foc_effect_short', 'Crit chance')}`;
                  detailedTooltip = `+${crit}% Critical Focus chance (2x XP/Gold/ATK) & +${trainBonus}% Focus training bonus`;
                } else if (key === "mem") {
                  const red = Math.round((1 - (100 / (100 + totalValue))) * 100);
                  const fatigueBonus = (Math.max(0, totalValue - 5) * 1.5).toFixed(1);
                  effectLabel = `-${red}% ${t('character.mem_effect_short', 'Mana cost')}`;
                  detailedTooltip = `-${red}% Skill mana cost & +${fatigueBonus}% fatigue resistance in training`;
                } else if (key === "spd") {
                  effectLabel = `+${(totalValue * 0.5).toFixed(1)}% ${t('character.spd_effect_short', 'Base Gold')}`;
                  detailedTooltip = `+${(totalValue * 0.5).toFixed(1)}% Gold bonus to all task completions`;
                } else if (key === "lck") {
                  const drop = (totalValue * 0.2).toFixed(1);
                  effectLabel = `+${totalValue}% Gold • +${drop}% Drop`;
                  detailedTooltip = `+${totalValue}% Gold multiplier & +${drop}% random item drop chance per completed task`;
                }

                return (
                  <motion.div
                    key={key}
                    whileHover={{ scale: 1.01 }}
                    title={detailedTooltip}
                    className="p-2.5 rounded-xl border flex items-center justify-between gap-2.5 relative overflow-hidden"
                    style={{
                      background: "var(--habit-stat-slab-bg, rgba(10,5,15,0.85))",
                      borderColor: canUpgrade ? `${cfg.color}50` : "var(--habit-border)",
                      boxShadow: canUpgrade ? `0 0 10px ${cfg.color}20` : "none",
                    }}
                  >
                    {/* Left: Icon & Names */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border relative bg-[var(--habit-panel)] flex items-center justify-center"
                        style={{
                          borderColor: `${cfg.color}50`,
                          boxShadow: `0 0 10px ${cfg.color}30`,
                        }}
                      >
                        <img
                          src={STAT_ICONS[key]}
                          alt={cfg.label}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-pixel font-bold text-xs" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-[var(--habit-panel)] text-[var(--habit-dim)] border border-[var(--habit-border)] truncate">
                            {effectLabel}
                          </span>
                        </div>
                        {/* Breakdown pills */}
                        <div className="flex items-center gap-1 text-[8px] font-mono mt-0.5 text-muted-foreground/60">
                          <span title="Class bonus" style={{ color: breakdown.class > 0 ? classColor : 'inherit' }}>
                            C:{breakdown.class > 0 ? `+${breakdown.class}` : breakdown.class}
                          </span>
                          <span>•</span>
                          <span title="Equipment bonus" style={{ color: breakdown.equip > 0 ? '#f0c040' : 'inherit' }}>
                            E:{breakdown.equip > 0 ? `+${breakdown.equip}` : breakdown.equip}
                          </span>
                          <span>•</span>
                          <span title="Base points">
                            B:{breakdown.points}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Total + Upgrade Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-pixel font-black text-sm" style={{ color: cfg.color, textShadow: `0 0 8px ${cfg.color}40` }}>
                        {breakdown.total}
                      </span>
                      {canUpgrade && (
                        <button
                          onClick={() => upgradeStat(key)}
                          className="px-2 py-1 rounded-md font-pixel font-bold text-xs transition-all flex items-center justify-center"
                          style={{
                            background: "linear-gradient(90deg, #b45309 0%, #f59e0b 100%)",
                            border: "1px solid #fbbf24",
                            color: "white",
                            boxShadow: "0 0 8px rgba(245,158,11,0.5)",
                          }}
                          title={`Upgrade ${cfg.label}`}
                        >
                          +1
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* 🛡️ Gothic Armory (Реликварий Экипировки - 8 слотов) */}
          <div
            className="rounded-2xl p-4 space-y-3 relative overflow-hidden"
            style={{
              background: "var(--habit-card-gradient, linear-gradient(135deg, rgba(20,10,30,0.95) 0%, rgba(10,5,15,0.98) 100%))",
              border: "1.5px solid var(--habit-border)",
              boxShadow: "var(--habit-card-shadow, 0 4px 20px rgba(0,0,0,0.6))",
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--habit-border)] pb-2.5">
              <span className="font-pixel text-[11px] text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                <span>🛡️</span> {t('character.equipment', 'ARMORY OF RELICS')}
              </span>
              <span className="text-[9px] font-pixel text-[var(--habit-dim)] px-2 py-0.5 rounded bg-[var(--habit-card-sub)] border border-[var(--habit-border)]">
                {Object.values(equipped).filter(Boolean).length} / 8 EQUIPPED
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {SLOT_KEYS.map((slot) => {
                const eq = equipped[slot];
                const slotLabel = t(`slots.${slot}`, slot.toUpperCase().replace('_', ' '));
                const tierColor = eq ? getTierColor(eq.tier || eq.gear_class) : null;
                const itemName = eq ? (eq.label || eq.name || eq.code) : null;
                const slotWatermark = {
                  headware: "👑",
                  neural_link: "📜",
                  core: "💎",
                  arms: "⚔️",
                  legs: "👢",
                  offhand: "🛡️",
                  ring1: "💍",
                  ring2: "💍"
                }[slot] || "📦";

                return (
                  <motion.div
                    key={slot}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setActiveSlot(slot)}
                    title={eq ? `${itemName} (${slotLabel})` : slotLabel}
                    className="aspect-square rounded-xl border flex flex-col items-center justify-center relative cursor-pointer transition-all p-1.5 overflow-hidden group"
                    style={{
                      background: eq 
                        ? `radial-gradient(circle at 50% 30%, ${tierColor}25 0%, var(--habit-panel) 100%)` 
                        : "var(--habit-slot-empty-bg, rgba(10,5,15,0.7))",
                      borderColor: eq ? `${tierColor}80` : "var(--habit-border)",
                      boxShadow: eq ? `0 0 14px ${tierColor}33, inset 0 0 10px ${tierColor}15` : "inset 0 1px 4px rgba(0,0,0,0.15)",
                    }}
                  >
                    {eq ? (
                      <>
                        {/* Unequip button top-right */}
                        <button
                          onClick={e => { e.stopPropagation(); unequip(slot); }}
                          title="Unequip item"
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/80 hover:bg-red-500 text-white/70 hover:text-white flex items-center justify-center text-[9px] font-bold z-10 transition-colors shadow"
                        >
                          ✕
                        </button>

                        {/* Rarity Corner Accent */}
                        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2" style={{ borderColor: tierColor }} />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2" style={{ borderColor: tierColor }} />

                        {/* Item Icon / Graphic with glow */}
                        <div className="w-10 h-10 rounded-lg border overflow-hidden flex items-center justify-center bg-[var(--habit-panel)] mb-1 shrink-0 relative"
                          style={{ borderColor: `${tierColor}60`, imageRendering: 'pixelated', boxShadow: `0 0 10px ${tierColor}40` }}>
                          {eq.icon_url ? (
                            <img src={getMediaUrl(eq.icon_url)} alt={itemName} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                          ) : (
                            <span className="font-pixel text-sm font-bold" style={{ color: tierColor }}>{itemName[0]}</span>
                          )}
                        </div>

                        {/* Item Name */}
                        <span className="text-[8px] font-pixel font-bold text-center truncate w-full px-0.5" style={{ color: tierColor }}>
                          {itemName}
                        </span>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 opacity-35 group-hover:opacity-75 transition-opacity">
                        <span className="text-xl filter grayscale group-hover:grayscale-0 transition-all">{slotWatermark}</span>
                        <span className="text-[7px] font-pixel uppercase tracking-wider text-muted-foreground text-center">
                          {slotLabel}
                        </span>
                      </div>
                    )}
                  </motion.div>
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
        skillsLocked ? (
          <FeatureLockScreen feature="skills" requiredRank={skillsUnlockRank} profile={profile} />
        ) : (
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
        )
      )}



      {/* SHOP */}
      {subTab === "shop" && (
        <div className="space-y-3">
          <TabGuideModal guideId="shop" profile={profile} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground uppercase flex items-center gap-1.5">
                <FantasyIcon size={14}><ShoppingCart /></FantasyIcon> {t('character.shop_title')}
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400 font-bold">
                {currentRankIdValue} RANK
              </span>
            </div>
            <span className="font-mono text-xs font-bold" style={{ color: "#f0c040" }}>
              🪙 <AnimatedNumber value={normalizeGold(gold)} formatter={(v) => Math.round(v).toLocaleString()} />G
            </span>
          </div>

          {/* ── Daily Featured Deal ── */}
          {(() => {
            const d = new Date();
            const year = d.getFullYear();
            const start = new Date(year, 0, 0);
            const diff = d - start;
            const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
            const seed = Math.abs((year * 366 + dayOfYear * 31 + d.getMonth() * 7) ^ 0x5F3759DF);

            const consumableShopItems = shopItems.filter(i => i.consumable);
            const allItems = consumableShopItems.length > 0 ? consumableShopItems : [{ id: "placeholder", label: "Loading...", cost: 100, tier: "Common", consumable: true }];
            const featuredItem = allItems[seed % allItems.length];
            const discountPct = 25 + (seed % 4) * 5; // 25%, 30%, 35%, or 40%
            const discountedCost = Math.max(1, Math.round(featuredItem.cost * (1 - discountPct / 100)));

            const bonusPoolCodes = ["daily_xp_surge", "focus_scroll", "boss_damage_plus", "large_heal"];
            const bonusItemCode = bonusPoolCodes[seed % bonusPoolCodes.length];
            const bonusItem = shopItems.find(i => i.id === bonusItemCode) || featuredItem;
            const isBonusDay = seed % 4 === 0; // Every 4 days an exclusive bonus item appears
            const dealItem = isBonusDay ? bonusItem : { ...featuredItem, cost: discountedCost };
            const dealTierColor = getTierColor(dealItem.tier);
            const isOwned = !dealItem.consumable && (inventory || []).some(i => i.id === dealItem.id);
            const isBought = boughtItem === dealItem.id;
            const canBuyDeal = gold >= dealItem.cost && (!isOwned || dealItem.consumable);

            return (
              <div
                onClick={() => {
                  try { playSound('click'); } catch(e) {}
                  if (dealItem.consumable) {
                    setSelectedConsumable(dealItem);
                  } else {
                    setSelectedItem(dealItem);
                  }
                }}
                className="rounded-xl border px-3 py-2 relative overflow-hidden backdrop-blur-md transition-all cursor-pointer hover:border-amber-400/50"
                style={{ borderColor: "rgba(240,192,64,0.3)", background: "rgba(240,192,64,0.05)", boxShadow: "0 0 12px rgba(240,192,64,0.06)" }}>
                {/* Subtle Shimmer */}
                <motion.div className="absolute inset-0 pointer-events-none"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
                  style={{ background: "linear-gradient(90deg,transparent,rgba(240,192,64,0.1),transparent)", width: "35%" }}
                />
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded border flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ borderColor: `${dealTierColor}60`, background: "rgba(240,192,64,0.1)", imageRendering: "pixelated" }}>
                      <img src={dealItem.icon_url || '/static/items/default.webp'} alt={dealItem.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(240,192,64,0.15)", color: "#f0c040" }}>
                          {t('character.daily_deal')}
                        </span>
                        <span className="text-xs font-mono font-bold truncate" style={{ color: dealTierColor }}>
                          {dealItem.label}
                        </span>
                        {!isBonusDay && (
                          <span className="text-[9px] font-mono px-1 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                            -{discountPct}%
                          </span>
                        )}
                        {isBonusDay && (
                          <span className="text-[9px] font-mono px-1 rounded" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                            {t('character.exclusive')}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground/70 truncate mt-0.5">
                        {dealItem.effect || ('stats' in dealItem && dealItem.stats ? Object.entries(dealItem.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" · ") : dealItem.description || "")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="text-right">
                      {!isBonusDay && (
                        <div className="text-[9px] font-mono line-through text-muted-foreground/40 leading-none">{featuredItem.cost}G</div>
                      )}
                      <div className="text-xs font-mono font-bold leading-tight" style={{ color: "#f0c040" }}>{dealItem.cost}G</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); buyItem(dealItem); }}
                      disabled={!canBuyDeal}
                      className="px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition-all shrink-0 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                      style={{
                        borderColor: canBuyDeal ? "#f0c040" : "rgba(240,192,64,0.2)",
                        color: canBuyDeal ? "#f0c040" : "rgba(240,192,64,0.4)",
                        background: canBuyDeal ? "rgba(240,192,64,0.15)" : "transparent"
                      }}
                    >
                      {isBought ? t('character.bought') : `${dealItem.cost}G`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex gap-1 flex-wrap">
            {["chests", "consumables", "scrolls", "allies", "mutators"].map(tab => {
              const isTabLocked = (tab === "allies" && alliesLocked) || (tab === "mutators" && mutatorsLocked);
              return (
                <button key={tab} onClick={() => setShopTab(tab)}
                  className="px-3 py-1 text-[10px] font-mono uppercase rounded transition-all flex items-center gap-1"
                  style={{
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: shopTab === tab ? "var(--habit-purple)" : "var(--habit-border)",
                    color: isTabLocked ? "var(--habit-dim)" : (shopTab === tab ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)"),
                    background: shopTab === tab ? "var(--habit-purple-light)" : "transparent",
                    opacity: isTabLocked ? 0.6 : 1,
                  }}
                >
                  {isTabLocked && "🔒 "}
                  {t(`shop_tabs.${tab}`, tab)}
                </button>
              );
            })}
          </div>
          {shopTab === "scrolls" && (
            <ScrollsPanel gold={gold} onSpendGold={spendGold} />
          )}
          {shopTab === "chests" && (
            <div className="space-y-6">
              <ChestPanel />
              <div className="pt-5 border-t border-border/40">
                <InventoryPanel gs={{ inventory, consumables: activeEffectsMap }} onSave={() => { }} onToggleEquip={equipItem} />
              </div>
            </div>
          )}
          {shopTab === "allies" && (
            alliesLocked ? (
              <FeatureLockScreen feature="allies" requiredRank={alliesUnlockRank} profile={profile} />
            ) : (
              <>
                <TabGuideModal guideId="allies" profile={profile} />
                <AlliesPanel onSpendGold={spendGold} />
              </>
            )
          )}
          {shopTab === "mutators" && (
            mutatorsLocked ? (
              <FeatureLockScreen feature="mutators" requiredRank={mutatorsUnlockRank} profile={profile} />
            ) : (
              <>
                <TabGuideModal guideId="mutators" profile={profile} />
                <MutatorsPanel onSpendGold={spendGold} />
              </>
            )
          )}
          {shopTab === "consumables" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
              {consumables
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
                    onClick={() => {
                      try { playSound('click'); } catch (e) {}
                      setSelectedConsumable(item);
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
                        borderColor: canAfford && !(!item.consumable && owned) ? "#f0c040" : "var(--habit-border)",
                        color: canAfford && !(!item.consumable && owned) ? "#f0c040" : "var(--habit-dim)",
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
          )}
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

      {/* Consumable Detail Modal (Allies / Boss Style) */}
      <ConsumableDetailModal
        item={selectedConsumable}
        isOpen={!!selectedConsumable}
        onClose={() => setSelectedConsumable(null)}
        onBuy={(item) => buyItem(item)}
        cost={selectedConsumable?.cost}
        gold={gold}
        isBought={boughtItem === selectedConsumable?.id}
        inInventoryCount={selectedConsumable ? (inventory || []).filter(i => (i.id === selectedConsumable.id || (selectedConsumable.code && i.code === selectedConsumable.code))).length : 0}
        isActive={selectedConsumable ? (activeEffectsMap[selectedConsumable.code || selectedConsumable.id]?.active && (!activeEffectsMap[selectedConsumable.code || selectedConsumable.id]?.expiresAt || Date.now() < activeEffectsMap[selectedConsumable.code || selectedConsumable.id]?.expiresAt)) : false}
        activeData={selectedConsumable ? activeEffectsMap[selectedConsumable.code || selectedConsumable.id] : null}
      />

      {/* Shared Item Detail Modal for non-consumables / gear */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={!!selectedItem && !selectedItem.consumable}
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
                borderColor: (gold >= selectedItem.cost && !(!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))) ? "#f0c040" : "var(--habit-border)",
                color: (gold >= selectedItem.cost && !(!selectedItem.consumable && inventory.some(i => i.id === selectedItem.id))) ? "#f0c040" : "var(--habit-dim)",
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