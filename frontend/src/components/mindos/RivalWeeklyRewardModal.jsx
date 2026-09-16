// @ts-nocheck
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Gift, Lock, Sparkles } from "lucide-react";
import { djangoApi } from "@/api/djangoClient";
import { MUTATORS } from "@/constants/rpgData";
import { playSound } from "@/lib/soundEffects";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { useHardwareBack } from "@/utils/modalStack";
import AnimatedChestModal from "./AnimatedChestModal";

const CLAIMED_KEY = "mindos_rival_weekly_reward_claimed";

const CAT_LABELS = {
  amplifier: { label: "AMPLIFIERS", color: "#3b82f6" },
  economy: { label: "ECONOMY", color: "#f0c040" },
  streak: { label: "STREAK", color: "#f59e0b" },
  challenge: { label: "CHALLENGE", color: "#ef4444" },
  synergy: { label: "SYNERGY BUILDERS", color: "#aa44ff" },
  wild: { label: "WILD", color: "#00e5ff" },
};

const MUTATOR_CHEST_DEF = {
  chest_type: "mutator_cache",
  name: "MUTATOR CHEST",
  icon_url: "/static/items/standard_cache.webp",
};

function readClaimedWeek() {
  try {
    return localStorage.getItem(CLAIMED_KEY);
  } catch {
    return null;
  }
}

function writeClaimedWeek(week) {
  try {
    localStorage.setItem(CLAIMED_KEY, week);
  } catch {
    /* ignore */
  }
}

/**
 * Beat-Johan-this-week payoff: a claim screen, then two chained
 * AnimatedChestModal reveals (item chest + mutator chest) for the rewards
 * rival_service.compute_rival_data() already granted server-side. The
 * "claim" here is a presentation beat, not a second grant -- clicking it
 * just plays the reveal the player earned instead of dumping loot into
 * their inventory silently behind an easy-to-miss banner.
 */
export default function RivalWeeklyRewardModal({ weeklyReward, rivalName }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState("hidden"); // hidden | intro | item | mutator
  const [itemEquipped, setItemEquipped] = useState(false);
  const [mutatorActivated, setMutatorActivated] = useState(false);

  const week = weeklyReward?.week || null;

  useEffect(() => {
    if (!week) {
      setStage("hidden");
      return;
    }
    setStage(readClaimedWeek() === week ? "hidden" : "intro");
    setItemEquipped(false);
    setMutatorActivated(false);
  }, [week]);

  const { data: chests } = useQuery({
    queryKey: ["chests"],
    queryFn: djangoApi.chests.getChests,
    enabled: stage !== "hidden",
  });

  const equipMutation = useMutation({
    mutationFn: (itemCode) => djangoApi.inventory.equip(itemCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setItemEquipped(true);
      playSound("success");
    },
    onError: (err) => {
      showRewardToast({ label: `❌ ${err.message || t("rivalTab.equipFailed", "Failed to equip item.")}` });
    },
  });

  const activateMutatorMutation = useMutation({
    mutationFn: ({ id, duration }) => djangoApi.mutators.toggle(id, { duration }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      setMutatorActivated(true);
      playSound("success");
    },
    onError: (err) => {
      showRewardToast({ label: `❌ ${err.message || t("rivalTab.activateFailed", "Failed to activate mutator.")}` });
    },
  });

  const finishClaim = () => {
    if (week) writeClaimedWeek(week);
    setStage("hidden");
    queryClient.invalidateQueries({ queryKey: ["rival"] });
  };

  useHardwareBack(stage !== "hidden", finishClaim);

  if (stage === "hidden" || !weeklyReward) return null;

  const itemChestDef = chests?.find((c) => c.chest_type === weeklyReward.item?.chest_type) || {
    chest_type: weeklyReward.item?.chest_type,
    name: weeklyReward.item?.chest_name || "QUANTUM SAFE",
    icon_url: "/static/items/standard_cache.webp",
  };

  const mutatorId = weeklyReward.mutator?.mutator_id;
  const mutDef = mutatorId ? MUTATORS.find((m) => m.id === mutatorId) : null;
  const catCfg = CAT_LABELS[mutDef?.cat] || { label: "MUTATOR", color: "#00e5ff" };
  const synergyMut = mutDef?.synergy ? MUTATORS.find((m) => m.id === mutDef.synergy) : null;
  const mutatorWonItem = mutatorId
    ? {
        isMutator: true,
        id: mutatorId,
        name: t(`rpgData.mutators.${mutatorId}.name`, mutDef?.name || mutatorId),
        gear_class: "MUTATOR",
        badge: "MUTATOR",
        categoryName: catCfg.label,
        category: mutDef?.cat,
        color: catCfg.color,
        icon_url: mutDef?.icon,
        description: t(`rpgData.mutators.${mutatorId}.desc`, mutDef?.desc || ""),
        synergyName: synergyMut ? t(`rpgData.mutators.${synergyMut.id}.name`, synergyMut.name) : null,
      }
    : null;

  const hasItem = !!weeklyReward.item;
  const hasMutator = !!mutatorWonItem;

  const goToFirstChest = () => {
    playSound("critical");
    if (hasItem) setStage("item");
    else if (hasMutator) setStage("mutator");
    else finishClaim();
  };

  return createPortal(
    <AnimatePresence>
      {stage === "intro" && (
        <motion.div
          key="rival-weekly-reward-intro"
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(2,1,10,0.92)", backdropFilter: "blur(10px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative w-full max-w-sm rounded-2xl border-2 overflow-hidden"
            style={{
              borderColor: "rgba(245,158,11,0.55)",
              background: "linear-gradient(160deg, rgba(0,0,0,0.97) 0%, rgba(245,158,11,0.08) 100%)",
              boxShadow: "0 0 40px rgba(245,158,11,0.35), 0 0 90px rgba(245,158,11,0.15)",
            }}
          >
            {/* Ambient pulse */}
            <motion.div
              className="absolute -top-16 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
              animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.1, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 220, height: 220, background: "radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%)" }}
            />

            <div className="relative p-6 flex flex-col items-center text-center gap-4">
              <motion.div
                initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  boxShadow: "0 0 24px rgba(245,158,11,0.6)",
                }}
              >
                <Trophy className="w-8 h-8" style={{ color: "#000" }} />
              </motion.div>

              <div>
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase font-bold" style={{ color: "#f59e0b" }}>
                  {t("rivalTab.weeklyVictory", "WEEKLY VICTORY")}
                </div>
                <h2 className="font-mono text-lg font-black uppercase tracking-wide mt-1" style={{ color: "#fff" }}>
                  {t("rivalTab.weeklyWinTitle", "You beat {{name}} this week!", { name: rivalName })}
                </h2>
              </div>

              {/* Reward preview slots */}
              <div className="w-full grid grid-cols-2 gap-3 mt-1">
                {hasItem && (
                  <div
                    className="rounded-xl border p-3 flex flex-col items-center gap-1.5"
                    style={{ borderColor: "rgba(0,229,255,0.35)", background: "rgba(0,229,255,0.06)" }}
                  >
                    <Lock className="w-4 h-4" style={{ color: "#00e5ff" }} />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                      {t("rivalTab.rewardSlot", "Reward")} 1
                    </span>
                    <span className="font-mono text-[10px] font-bold" style={{ color: "#00e5ff" }}>
                      {itemChestDef.name}
                    </span>
                  </div>
                )}
                {hasMutator && (
                  <div
                    className="rounded-xl border p-3 flex flex-col items-center gap-1.5"
                    style={{ borderColor: "rgba(170,68,255,0.35)", background: "rgba(170,68,255,0.06)" }}
                  >
                    <Lock className="w-4 h-4" style={{ color: "#c084fc" }} />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                      {t("rivalTab.rewardSlot", "Reward")} {hasItem ? 2 : 1}
                    </span>
                    <span className="font-mono text-[10px] font-bold" style={{ color: "#c084fc" }}>
                      {t("rivalTab.mutatorChest", "Mutator Chest")}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={goToFirstChest}
                className="w-full h-12 mt-1 rounded-xl font-mono text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.98] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#000",
                  boxShadow: "0 0 20px rgba(245,158,11,0.5)",
                }}
              >
                <Gift className="w-4 h-4" />
                {t("rivalTab.claimReward", "Claim Reward")}
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {stage === "item" && (
        <AnimatedChestModal
          key="rival-weekly-item-chest"
          open
          chest={itemChestDef}
          wonItem={weeklyReward.item}
          isEquipped={itemEquipped}
          isEquipping={equipMutation.isPending}
          onEquip={() => weeklyReward.item && equipMutation.mutate(weeklyReward.item.code)}
          onClose={() => (mutatorWonItem ? setStage("mutator") : finishClaim())}
          chestThemeColor="#00e5ff"
        />
      )}

      {stage === "mutator" && mutatorWonItem && (
        <AnimatedChestModal
          key="rival-weekly-mutator-chest"
          open
          chest={MUTATOR_CHEST_DEF}
          wonItem={mutatorWonItem}
          isEquipped={mutatorActivated}
          isEquipping={activateMutatorMutation.isPending}
          onEquip={() =>
            activateMutatorMutation.mutate({ id: mutatorId, duration: mutDef?.durationDays })
          }
          onClose={finishClaim}
          chestThemeColor="#c084fc"
          equipLabel={t("chest_modal.activate_mutator", "ACTIVATE MUTATOR")}
          equippedLabel={t("chest_modal.mutator_active", "MUTATOR ACTIVE")}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
