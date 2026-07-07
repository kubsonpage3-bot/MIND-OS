import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import OptimizedImage from "./OptimizedImage";
import { normalizeGold } from "@/lib/utils";
import GameCard from "@/components/ui/GameCard";

const RANK_ORDER = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];

export const SCROLL_BOSS_IMAGES = {
  // Original unique images
  misted_wanderer: "/images/webp/e233a83f3_generated_image.webp",
  nameless_bones: "/images/webp/ef51b9462_Screenshot2026-06-23213830.webp",
  herald_jackal: "/images/webp/e46cf7897_Screenshot2026-06-23213548.webp",
  ink_warden: "/images/webp/918a77bad_Screenshot2026-06-23213620.webp",
  abyssal_bellringer: "/images/webp/scroll_abyssal_bellringer.webp",
  frost_executioner: "/images/webp/scroll_frost_executioner.webp",
  weaving_shade: "/images/webp/scroll_weaving_shade.webp",
  ember_smith: "/images/webp/ef8a45965_Screenshot2026-06-23213700.webp",
  sanctuary_weeper: "/images/webp/eebb37437_generated_image.webp",
  shallow_leviathan: "/images/webp/e945b3bd4_generated_image.webp",
  faceless_king: "/images/webp/c7192c4a7_generated_image.webp",
  ore_golem: "/images/webp/5ef3ff7af_generated_image.webp",
  // New unique images replacing duplicates
  wounded_moon: "/images/webp/b8481b005_Screenshot2026-06-23224227.webp",
  choir_forgotten: "/images/webp/scroll_choir_forgotten.webp",
  bottomless_miser: "/images/webp/scroll_bottomless_miser.webp",
  winter_thorn: "/images/webp/scroll_winter_thorn.webp",
  king_ashen_throne: "/images/webp/scroll_ashen_throne.webp",
  eclipse_warden: "/images/webp/scroll_eclipse_warden.webp",
  nameless_god: "/images/webp/nameless_god.webp",
  final_dusk: "/images/webp/final_dusk.webp",
};

export const RANK_COLORS = {
  E: "#94a3b8", D: "#22c55e", C: "#3b82f6", B: "#9333ea",
  A: "#f59e0b", S: "#f0c040", SS: "#ff4444", SSS: "#ff00ff"
};

export const SCROLLS = [
  { id: "misted_wanderer", rank: "E", name: "Misted Wanderer", scrollName: "Scroll of the Misted Wanderer", quote: "\"You cannot find what you cannot see.\"", price: 50, boss: "Misted Wanderer", bossHP: 500, color: "#94a3b8", daysLimit: 14, reward: { gold: 100, xp: 50, mp: 10, sp: 1 }, uniqueItem: { id: "wanderers_hood", label: "Wanderer's Hood", slot: "headware", effect: "+2% gold from Habits", tier: "Unique" } },
  { id: "nameless_bones", rank: "E", name: "Nameless Bones", scrollName: "Scroll of the Nameless Bones", quote: "\"Even dust remembers what it was.\"", price: 60, boss: "Nameless Skeleton", bossHP: 600, color: "#94a3b8", daysLimit: 14, reward: { gold: 120, xp: 60, mp: 10, sp: 1 }, uniqueItem: { id: "bone_bracelet", label: "Bone Bracelet", slot: "ring1", effect: "+2% XP from Dailies", tier: "Unique" } },
  { id: "herald_jackal", rank: "D", name: "Jackal's Howl", scrollName: "Scroll of the Jackal's Howl", quote: "\"I herald only one thing — your end.\"", price: 120, boss: "Herald Jackal", bossHP: 1500, color: "#22c55e", daysLimit: 14, reward: { gold: 250, xp: 150, mp: 15, sp: 2 }, uniqueItem: { id: "heralds_fang", label: "Herald's Fang", slot: "neural_link", effect: "+3% XP from Exercise tasks", tier: "Unique" } },
  { id: "ink_warden", rank: "D", name: "Ink Mark", scrollName: "Scroll of the Ink Mark", quote: "\"Every word written is a chain forged.\"", price: 130, boss: "Ink Warden", bossHP: 1800, color: "#22c55e", daysLimit: 14, reward: { gold: 280, xp: 180, mp: 15, sp: 2 }, uniqueItem: { id: "wardens_quill", label: "Warden's Quill", slot: "offhand", effect: "+3% XP from Study tasks", tier: "Unique" } },
  { id: "abyssal_bellringer", rank: "C", name: "Echoing Bell", scrollName: "Scroll of the Echoing Bell", quote: "\"The toll rings for you alone.\"", price: 220, boss: "Abyssal Bellringer", bossHP: 3500, color: "#3b82f6", daysLimit: 14, reward: { gold: 500, xp: 300, mp: 20, sp: 3 }, uniqueItem: { id: "echo_bell", label: "Echo Bell", slot: "offhand", effect: "+4% Focus stat gain", tier: "Unique" } },
  { id: "frost_executioner", rank: "C", name: "Bloodfrost", scrollName: "Scroll of Bloodfrost", quote: "\"Cold doesn't kill. Hesitation does.\"", price: 230, boss: "Frost Executioner", bossHP: 4000, color: "#3b82f6", daysLimit: 14, reward: { gold: 550, xp: 350, mp: 20, sp: 3 }, uniqueItem: { id: "frostbite_blade", label: "Frostbite Blade", slot: "arms", effect: "+4% damage to bosses", tier: "Unique" } },
  { id: "weaving_shade", rank: "C", name: "Spinning Silk", scrollName: "Scroll of Spinning Silk", quote: "\"Every thread is a trap I've already set.\"", price: 210, boss: "Weaving Shade", bossHP: 3200, color: "#3b82f6", daysLimit: 14, reward: { gold: 480, xp: 280, mp: 20, sp: 3 }, uniqueItem: { id: "silk_mantle", label: "Silk-Woven Mantle", slot: "core", effect: "−5% HP loss on missed daily", tier: "Unique" } },
  { id: "ember_smith", rank: "B", name: "Forge Wrath", scrollName: "Scroll of Forge Wrath", quote: "\"I forge weapons. You are merely the ore.\"", price: 380, boss: "Ember Smith", bossHP: 8000, color: "#9333ea", daysLimit: 14, reward: { gold: 900, xp: 600, mp: 30, sp: 5 }, uniqueItem: { id: "ember_gauntlet", label: "Ember Gauntlet", slot: "arms", effect: "+5% gold from To-Dos", tier: "Unique" } },
  { id: "sanctuary_weeper", rank: "B", name: "Sanctuary's Tear", scrollName: "Scroll of the Sanctuary's Tear", quote: "\"I weep not for you, but for what I must do.\"", price: 390, boss: "Sanctuary Weeper", bossHP: 9000, color: "#9333ea", daysLimit: 14, reward: { gold: 950, xp: 650, mp: 30, sp: 5 }, uniqueItem: { id: "glass_tear", label: "Glass Tear", slot: "neural_link", effect: "+5 HP on a perfect day", tier: "Unique" } },
  { id: "shallow_leviathan", rank: "B", name: "Black Tide", scrollName: "Scroll of the Black Tide", quote: "\"The ocean does not drown — it invites.\"", price: 400, boss: "Shallow Leviathan", bossHP: 10000, color: "#9333ea", daysLimit: 14, reward: { gold: 1000, xp: 700, mp: 30, sp: 5 }, uniqueItem: { id: "leviathan_scale", label: "Leviathan Scale", slot: "core", effect: "+5% MP regen", tier: "Unique" } },
  { id: "faceless_king", rank: "A", name: "Ashen Name", scrollName: "Scroll of the Ashen Name", quote: "\"I have no face because I am everyone's fear.\"", price: 650, boss: "Faceless King", bossHP: 20000, color: "#f59e0b", daysLimit: 14, reward: { gold: 2000, xp: 1500, mp: 50, sp: 8 }, uniqueItem: { id: "crown_of_ash", label: "Crown of Ash", slot: "headware", effect: "+8% XP from all tasks", tier: "Unique" } },
  { id: "ore_golem", rank: "A", name: "Mine's Groan", scrollName: "Scroll of the Mine's Groan", quote: "\"The mountain does not fall. It buries.\"", price: 660, boss: "Ore Golem", bossHP: 22000, color: "#f59e0b", daysLimit: 14, reward: { gold: 2200, xp: 1600, mp: 50, sp: 8 }, uniqueItem: { id: "golems_grip", label: "Golem's Grip", slot: "arms", effect: "+8% gold from Habits", tier: "Unique" } },
  { id: "wounded_moon", rank: "A", name: "Lunar Scar", scrollName: "Scroll of the Lunar Scar", quote: "\"Even a wound becomes a crown if you survive it.\"", price: 680, boss: "Wounded Moon", bossHP: 25000, color: "#f59e0b", daysLimit: 14, reward: { gold: 2500, xp: 1800, mp: 50, sp: 8 }, uniqueItem: { id: "scar_shard", label: "Scar Shard", slot: "ring2", effect: "+8% damage to bosses", tier: "Unique" } },
  { id: "choir_forgotten", rank: "S", name: "Forgotten Choir", scrollName: "Scroll of the Forgotten Choir", quote: "\"We sing the names of those erased by time.\"", price: 1100, boss: "Choir of the Forgotten", bossHP: 60000, color: "#f0c040", daysLimit: 14, reward: { gold: 5000, xp: 4000, mp: 80, sp: 15 }, uniqueItem: { id: "forgotten_score", label: "Forgotten Score", slot: "offhand", effect: "+10% to one domain's stat ceiling", tier: "Unique" } },
  { id: "bottomless_miser", rank: "S", name: "Abyssal Greed", scrollName: "Scroll of Abyssal Greed", quote: "\"There is never enough. Not gold. Not time. Not you.\"", price: 1150, boss: "Bottomless Miser", bossHP: 70000, color: "#f0c040", daysLimit: 14, reward: { gold: 6000, xp: 4500, mp: 80, sp: 15 }, uniqueItem: { id: "abyssal_purse", label: "Abyssal Purse", slot: "ring2", effect: "+12% gold from all sources", tier: "Unique" } },
  { id: "winter_thorn", rank: "S", name: "Winter's Thorn", scrollName: "Scroll of Winter's Thorn", quote: "\"Beauty and ruin wear the same face.\"", price: 1200, boss: "Winter Thorn", bossHP: 80000, color: "#f0c040", daysLimit: 14, reward: { gold: 7000, xp: 5000, mp: 80, sp: 15 }, uniqueItem: { id: "winter_plate", label: "Winter Plate", slot: "core", effect: "immune to 1 missed daily/week", tier: "Unique" } },
  { id: "king_ashen_throne", rank: "SS", name: "Ashen Throne", scrollName: "Scroll of the Ashen Throne", quote: "\"Every throne is built on someone's grave. Yours will be no different.\"", price: 2000, boss: "King of the Ashen Throne", bossHP: 180000, color: "#ff4444", daysLimit: 14, reward: { gold: 15000, xp: 12000, mp: 120, sp: 25 }, uniqueItem: { id: "throne_seal", label: "Throne Seal", slot: "ring1", effect: "+15% Power Score", tier: "Unique" } },
  { id: "eclipse_warden", rank: "SS", name: "Eclipse Eye", scrollName: "Scroll of the Eclipse Eye", quote: "\"I do not block the light. I consume it.\"", price: 2100, boss: "Eclipse Warden", bossHP: 200000, color: "#ff4444", daysLimit: 14, reward: { gold: 18000, xp: 14000, mp: 120, sp: 25 }, uniqueItem: { id: "eclipse_eye", label: "Eclipse Eye", slot: "neural_link", effect: "unlocks an extra ally slot", tier: "Unique" } },
  { id: "nameless_god", rank: "SSS", name: "Nameless God", scrollName: "Scroll of the Nameless God", quote: "\"I was worshipped before language existed. I will remain after it ends.\"", price: 4000, boss: "Nameless Machine-God", bossHP: 600000, color: "#ff00ff", daysLimit: 14, reward: { gold: 50000, xp: 40000, mp: 200, sp: 60 }, uniqueItem: { id: "mask_nameless", label: "Mask of the Nameless", slot: "headware", effect: "+25% boss rewards, permanently", tier: "Unique" } },
  { id: "final_dusk", rank: "SSS", name: "Final Dusk", scrollName: "Scroll of the Final Dusk", quote: "\"This is not the end of the world. It is the end of yours.\"", price: 4200, boss: "The Final Dusk", bossHP: 700000, color: "#ff00ff", daysLimit: 14, reward: { gold: 60000, xp: 50000, mp: 200, sp: 60 }, uniqueItem: { id: "blade_final_dusk", label: "Blade of the Final Dusk", slot: "arms", effect: "doubles damage against all bosses", tier: "Unique" } },
];

// Removed localStorage functions

function getTimeLeft(activatedAt, daysLimit) {
  if (!activatedAt) return null;
  const rem = activatedAt + daysLimit * 86400000 - Date.now();
  if (rem <= 0) return "EXPIRED";
  const days = Math.floor(rem / 86400000);
  const hours = Math.floor((rem % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

export default function ScrollsPanel({ gold, onSpendGold }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmScroll, setConfirmScroll] = useState(null);

  // 1. Загружаем активные энкаунтеры с сервера
  const { data: encountersData = [] } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
    refetchInterval: 10000,
  });

  const encounters = Array.isArray(encountersData) ? encountersData : (encountersData?.results || []);

  // 2. Получаем ранг пользователя из профиля (уже закэшированного)
  const { data: profile } = useQuery({
    queryKey: ['userprofile'],
    queryFn: djangoApi.profile.get,
    staleTime: 5000,
  });

  const currentRankId = profile?.rank_info?.current_id || "F";

  // Находим активного босса
  const activeEncounter = encounters.find(e => !e.is_defeated);
  
  // Мутация призыва босса
  /** @type {import('@tanstack/react-query').UseMutationResult<any, any, { bossId: string, cost: number }>} */
  const summonMutation = useMutation({
    mutationFn: ({ bossId, cost }) => djangoApi.combat.summon(bossId, cost),
    onMutate: async ({ bossId, cost }) => {
      await queryClient.cancelQueries({ queryKey: ['combat_encounters'] });
      await queryClient.cancelQueries({ queryKey: ['userprofile'] });

      // Оптимистично списываем золото и добавляем фейковый энкаунтер
      queryClient.setQueryData(['userprofile'], (/** @type {any} */ old) => old ? { ...old, gold: old.gold - cost } : old);
      
      const staticBoss = SCROLLS.find(s => s.id === bossId);
      queryClient.setQueryData(['combat_encounters'], (/** @type {any} */ old) => [
        { id: 'temp', boss: { id_name: bossId, hp_max: staticBoss.bossHP }, hp_current: staticBoss.bossHP, is_defeated: false, started_at: new Date().toISOString() },
        ...(old || [])
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combat_encounters'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
    },
    onError: (err) => {
      console.error(err);
      queryClient.invalidateQueries({ queryKey: ['combat_encounters'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
    }
  });

  const handleBuy = (scroll) => {
    if (activeEncounter) return;
    setConfirmScroll(scroll);
  };

  const confirmBuy = () => {
    if (!confirmScroll) return;
    summonMutation.mutate({ bossId: confirmScroll.id, cost: confirmScroll.price });
    djangoApi.analytics.logEvent("boss_summoned");
    setConfirmScroll(null);
  };

  const claimReward = (scroll) => {
    // В новой системе награда начисляется автоматически при убийстве
    // Нам больше не нужно это модальное окно, но можно оставить для визуального эффекта
    // Если нужно, удалим позже
  };

  const groupedByRank = RANK_ORDER.reduce((acc, rank) => {
    const items = SCROLLS.filter(s => s.rank === rank);
    if (items.length) acc[rank] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-sm font-bold text-foreground tracking-wide">{t('scrolls.title')}</div>
          <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">{t('scrolls.subtitle')}</div>
        </div>
        <div className="font-mono text-sm font-bold" style={{ color: "#f0c040" }}>🪙 {normalizeGold(gold).toLocaleString()}G</div>
      </div>



      {/* Scroll list */}
      {Object.entries(groupedByRank).map(([rank, scrolls]) => {
        const color = RANK_COLORS[rank];
        const rankIdx = RANK_ORDER.indexOf(currentRankId);
        const reqIdx = RANK_ORDER.indexOf(rank);
        const rankUnlocked = rankIdx >= reqIdx;
        return (
          <div key={rank} className="space-y-3">
            {/* Rank header */}
            <div className="flex items-center gap-3">
              <div className="font-mono text-xs font-black tracking-widest px-3 py-1 rounded-full" style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}>
                {t('scrolls.rank', { rank })}
              </div>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
              {!rankUnlocked && <span className="text-[10px] font-mono text-muted-foreground/40">{t('scrolls.requires_rank', { rank })}</span>}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {scrolls.map(scroll => {
                // Ищем этого босса в истории энкаунтеров пользователя
                const encounter = encounters.find(e => e.boss?.id_name === scroll.id && !e.is_defeated);
                const wasDefeated = encounters.some(e => e.boss?.id_name === scroll.id && e.is_defeated);
                
                const isActive = !!encounter;
                const isDefeated = wasDefeated && !isActive; // Если когда-то был побежден и сейчас не активен
                const canAfford = gold >= scroll.price;
                const timeLeft = isActive ? getTimeLeft(new Date(encounter.started_at).getTime(), scroll.daysLimit) : null;
                const bossHP = isActive ? encounter.hp_current : scroll.bossHP;
                const hpPct = Math.max(0, (bossHP / scroll.bossHP) * 100);

                return (
                  <GameCard
                    key={scroll.id}
                    isActive={isActive}
                    borderColor={isDefeated ? "#22c55e" : color}
                    glowColor={color}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      opacity: !rankUnlocked && !isActive && !isDefeated ? 0.45 : 1,
                      background: isDefeated ? "#22c55e08" : undefined
                    }}
                  >
                    {/* Active pulse overlay */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        animate={{ opacity: [0, 0.06, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5 }}
                        style={{ background: color }}
                      />
                    )}

                    <div className="flex gap-3 p-3">
                      {/* Boss image */}
                      <motion.div
                        className="shrink-0 relative"
                        animate={isActive ? { y: [0, -3, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                      >
                        <div className="rounded-lg overflow-hidden" style={{ width: 72, height: 86, border: `2px solid ${color}50`, boxShadow: isActive ? `0 0 14px ${color}60` : `0 0 6px ${color}30` }}>
                          <OptimizedImage
                            src={SCROLL_BOSS_IMAGES[scroll.id]}
                            alt={scroll.boss}
                            className="w-full h-full object-cover"
                            style={{ imageRendering: "pixelated", filter: !rankUnlocked && !isActive && !isDefeated ? "grayscale(0.7) brightness(0.6)" : `brightness(${isDefeated ? 0.5 : 1})` }}
                          />
                        </div>
                        {/* Rank badge on image */}
                        <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-mono font-black"
                          style={{ background: color, color: "#000", boxShadow: `0 0 6px ${color}` }}>
                          {rank}
                        </div>
                        {isDefeated && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                            <span className="text-xl">✓</span>
                          </div>
                        )}
                      </motion.div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                        <div>
                          <div className="font-mono text-xs font-black tracking-wide" style={{ color: isActive ? color : isDefeated ? "#22c55e" : "#e2e0ff" }}>
                            {scroll.scrollName}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">{scroll.boss}</div>
                          <div className="font-mono text-[10px] italic mt-1" style={{ color: `${color}99` }}>{scroll.quote}</div>
                        </div>

                        {/* Reward info */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-mono text-muted-foreground/50">
                            <span style={{ color: `${color}cc` }}>★ {scroll.uniqueItem.label}</span>
                            <span className="text-muted-foreground/30"> · {scroll.uniqueItem.effect}</span>
                          </div>
                        </div>

                        {/* Bottom row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-mono text-muted-foreground/40">
                            +{normalizeGold(scroll.reward.gold).toLocaleString()}G · +{scroll.reward.sp}SP · +{scroll.reward.mp}MP
                          </div>
                          {isActive && (
                            <span className="text-[11px] font-mono text-red-400 font-bold shrink-0">{t('scrolls.active_dashboard')}</span>
                          )}
                          {!isActive && !isDefeated && rankUnlocked && (
                            <button
                              onClick={() => handleBuy(scroll)}
                              disabled={!canAfford || !!activeEncounter || summonMutation.isPending}
                              className="shrink-0 px-3 py-1.5 text-[11px] font-mono font-black rounded-lg transition-all"
                              style={{
                                background: canAfford && !activeEncounter ? color : "transparent",
                                color: canAfford && !activeEncounter ? "#000" : "#4a4060",
                                border: `1.5px solid ${canAfford && !activeEncounter ? color : "#2a2040"}`,
                                boxShadow: canAfford && !activeEncounter ? `0 0 10px ${color}50` : "none",
                                opacity: activeEncounter ? 0.4 : 1,
                              }}
                            >
                              {activeEncounter ? t('scrolls.btn_active') : summonMutation.isPending && confirmScroll?.id === scroll.id ? t('scrolls.btn_summoning') : t('scrolls.btn_summon', { price: scroll.price })}
                            </button>
                          )}
                          {!rankUnlocked && !isActive && !isDefeated && (
                            <span className="text-[10px] font-mono text-muted-foreground/30 shrink-0">{t('scrolls.need_rank', { rank })}</span>
                          )}
                          {isDefeated && (
                            <span className="text-[11px] font-mono text-green-400 font-bold shrink-0">{t('scrolls.defeated')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </GameCard>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmScroll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setConfirmScroll(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-5 text-center"
              style={{ border: `2px solid ${confirmScroll.color}`, boxShadow: `0 0 40px ${confirmScroll.color}40` }}
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="w-28 h-32 mx-auto"
              >
                <OptimizedImage
                  src={SCROLL_BOSS_IMAGES[confirmScroll.id]}
                  alt={confirmScroll.boss}
                  className="w-full h-full object-cover rounded-xl"
                  style={{ imageRendering: "pixelated", filter: `drop-shadow(0 0 16px ${confirmScroll.color})` }}
                />
              </motion.div>
              <div>
                <div className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest mb-1">{t('scrolls.modal_summoning')}</div>
                <div className="font-mono text-lg font-black" style={{ color: confirmScroll.color }}>{confirmScroll.boss}</div>
                <div className="font-mono text-xs text-muted-foreground/60 mt-1">{confirmScroll.scrollName}</div>
                <div className="font-mono text-xs italic mt-1" style={{ color: `${confirmScroll.color}99` }}>{confirmScroll.quote}</div>
              </div>
              <div className="text-sm font-mono text-muted-foreground/70 leading-relaxed">
                {t('scrolls.modal_time_limit_part1')}<span className="text-white font-bold">{t('scrolls.modal_time_limit_part2')}</span>{t('scrolls.modal_time_limit_part3')}<br />
                {t('scrolls.modal_consequence')}
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-left space-y-1.5">
                <div className="font-mono text-xs font-bold" style={{ color: confirmScroll.color }}>★ {confirmScroll.uniqueItem.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground/60">{confirmScroll.uniqueItem.effect}</div>
                <div className="font-mono text-[11px] text-yellow-400">+{normalizeGold(confirmScroll.reward.gold).toLocaleString()}G · +{confirmScroll.reward.sp}SP · +{confirmScroll.reward.mp}MP</div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmScroll(null)}
                  className="flex-1 py-2.5 rounded-xl font-mono text-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('scrolls.btn_cancel')}
                </button>
                <button
                  onClick={confirmBuy}
                  className="flex-1 py-2.5 rounded-xl font-mono text-sm font-black transition-all"
                  style={{ background: confirmScroll.color, color: "#000", boxShadow: `0 0 16px ${confirmScroll.color}60` }}
                >
                  {t('scrolls.btn_modal_summon', { price: confirmScroll.price })}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reward claim modals removed as backend handles it */}
    </div>
  );
}