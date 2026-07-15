import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Trash2, Archive, Brain, Users, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { useMutation } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";

export default function ResetPanel() {
  const { t } = useTranslation();
  const { refreshProfile } = useDjangoAuth();
  const [resetting, setResetting] = useState(false);

  const resetMutation = useMutation({
    mutationFn: /** @param {string} type */ (type) => djangoApi.profile.reset(type),
    onSuccess: async (data, variables) => {
      // Phase 2 Compliance: Invalidate specific queries based on reset type
      if (variables === "training") {
        queryClientInstance.invalidateQueries({ queryKey: ["trainingLogs"] });
        queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
      } else if (variables === "streak") {
        queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
        queryClientInstance.invalidateQueries({ queryKey: ["player-stats"] });
      } else if (variables === "tasks") {
        queryClientInstance.invalidateQueries({ queryKey: ["tasks"] });
        queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
      } else if (variables === "allies") {
        queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
        queryClientInstance.invalidateQueries({ queryKey: ["player-stats"] });
      } else if (variables === "skills") {
        queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
        queryClientInstance.invalidateQueries({ queryKey: ["player-stats"] });
      } else if (variables === "stats") {
        queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
        queryClientInstance.invalidateQueries({ queryKey: ["player-stats"] });
        queryClientInstance.invalidateQueries({ queryKey: ["inventory"] });
        queryClientInstance.invalidateQueries({ queryKey: ["active_effects"] });
        queryClientInstance.invalidateQueries({ queryKey: ["combat_encounters"] });
        queryClientInstance.invalidateQueries({ queryKey: ["trainingLogs"] });
      } else if (variables === "nuclear") {
        queryClientInstance.clear();

        // Force-clear the SW cache to prevent stale data
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          } catch (e) {
            console.error("Failed to clear SW cache:", e);
          }
        }

        // Clear specific legacy offline-engine localStorage state
        const keysToClear = [
          "mindos_game_state",
          "mindos_tasks",
          "mindos_class",
          "mindos_activity_logs",
          "mindos_hidden_activities",
          "mindos_prestige",
          "mindos_scrolls",
          "mindos_mutators",
          "mindos_allies",
          "mindos_skill_tree",
        ];
        keysToClear.forEach(key => localStorage.removeItem(key));
      }

      if (variables !== "nuclear") {
        alert("Reset completed successfully.");
      }
    },
    onError: (err) => {
      alert("Error resetting: " + (err.message || err));
      setResetting(false);
    }
  });

  const resetTrainingActivities = async () => {
    if (!confirm("Reset all activity logs to Rank F? This will delete all your logged sessions and restore all hidden activities. Cognitive stats (Gf/Gc/Ps/Vm) remain. Continue?")) return;
    setResetting(true);
    localStorage.removeItem("mindos_hidden_activities");
    localStorage.removeItem("mindos_activity_logs");
    resetMutation.mutate("training", { onSettled: () => setResetting(false) });
  };

  const resetStreak = async () => {
    if (!confirm("Reset your streak counter? This will set it to 0.")) return;
    setResetting(true);
    resetMutation.mutate("streak", { onSettled: () => setResetting(false) });
  };

  const resetTasks = () => {
    if (!confirm("Delete all tasks (habits, dailies, to-dos)? This cannot be undone.")) return;
    setResetting(true);
    localStorage.removeItem("mindos_tasks");
    resetMutation.mutate("tasks", { onSettled: () => setResetting(false) });
  };

  const resetAllies = async () => {
    if (!confirm("Reset ally progress? All unlocked allies will be locked again.")) return;
    setResetting(true);
    resetMutation.mutate("allies", { onSettled: () => setResetting(false) });
  };

  const resetSkillTree = async () => {
    if (!confirm("Reset skill tree unlocks? All SP will be refunded.")) return;
    setResetting(true);
    resetMutation.mutate("skills", { onSettled: () => setResetting(false) });
  };

  const resetStats = () => {
    if (!confirm("Reset cognitive stats, rank, gold, class? This cannot be undone.")) return;
    setResetting(true);
    localStorage.removeItem("mindos_game_state");
    localStorage.removeItem("mindos_class");
    resetMutation.mutate("stats", { onSettled: () => setResetting(false) });
  };

  const resetAllData = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL progress. Cannot be undone. Continue?")) return;
    const confirmation = prompt("Type 'RESET' to confirm:");
    if (confirmation !== "RESET") return;
    setResetting(true);

    // Clear all localStorage mindos_ keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("mindos_")) localStorage.removeItem(key);
    });

    try {
      await resetMutation.mutateAsync("nuclear");
      // Reload the page to take the user to the character creation screen without logging out
      window.location.href = '/';
    } catch (e) {
      console.error("Nuclear reset failed:", e);
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t("reset_panel.title")}</span>
      </div>

      {/* Soft Resets */}
      <div className="space-y-3">
        {/* Training Activities Reset */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t("reset_panel.training_title")}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.training_desc")}</p>
          <button
            onClick={resetTrainingActivities}
            disabled={resetting}
            className="w-full py-2 rounded-lg border border-blue-500/40 text-blue-400 font-mono text-xs hover:bg-blue-500/10 transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Activities to Rank F"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3"
        >
          <div className="flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t("reset_panel.streak_title")}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.streak_desc")}</p>
          <button
            onClick={resetStreak}
            disabled={resetting}
            className="w-full py-2 rounded-lg border border-[var(--habit-border)] text-muted-foreground font-mono text-xs hover:bg-accent transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Streak"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t("reset_panel.tasks_title")}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.tasks_desc")}</p>
          <button
            onClick={resetTasks}
            disabled={resetting}
            className="w-full py-2 rounded-lg border border-orange-500/40 text-orange-400 font-mono text-xs hover:bg-orange-500/10 transition-colors disabled:opacity-50"
          >
            {resetting ? "Clearing..." : "Clear Tasks"}
          </button>
        </motion.div>
      </div>

      {/* Module Resets */}
      <div className="space-y-3">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3"
        >
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t("reset_panel.allies_title")}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.allies_desc")}</p>
          <button
            onClick={resetAllies}
            disabled={resetting}
            className="w-full py-2 rounded-lg border border-purple-500/40 text-purple-400 font-mono text-xs hover:bg-purple-500/10 transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Allies"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{t("reset_panel.skilltree_title")}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.skilltree_desc")}</p>
          <button
            onClick={resetSkillTree}
            disabled={resetting}
            className="w-full py-2 rounded-lg border border-blue-500/40 text-blue-400 font-mono text-xs hover:bg-blue-500/10 transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Skills"}
          </button>
        </motion.div>
      </div>

      {/* Major Resets */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-red-400" />
          <span className="font-mono text-xs font-bold text-red-400">{t("reset_panel.stats_title")}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.stats_desc")}</p>
        <button
          onClick={resetStats}
          disabled={resetting}
          className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 font-mono text-xs hover:bg-red-500/10 transition-colors"
        >
          {resetting ? "Resetting..." : "Reset Progress"}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25 }}
        className="p-4 rounded-xl border border-red-700/30 bg-red-700/5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
          <span className="font-mono text-xs font-bold text-red-500">⚠ Nuclear Reset</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t("reset_panel.nuclear_desc")}</p>
        <button
          onClick={resetAllData}
          disabled={resetting}
          className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
        >
          {resetting ? "Deleting..." : "DELETE ALL DATA"}
        </button>
      </motion.div>
    </div>
  );
}