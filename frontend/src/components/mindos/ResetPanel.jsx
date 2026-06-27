import { useState } from "react";
import { RotateCcw, Trash2, Archive, Brain, Users, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

export default function ResetPanel() {
  const { refreshProfile } = useDjangoAuth();
  const [resetting, setResetting] = useState(false);

  const resetTrainingActivities = async () => {
    if (!confirm("Reset all activity logs to Rank F? This will delete all your logged sessions and restore all hidden activities. Cognitive stats (Gf/Gc/Ps/Vm) remain. Continue?")) return;
    setResetting(true);
    try {
      // 1. Clear hidden activities in localStorage
      localStorage.removeItem("mindos_hidden_activities");
      // 2. Clear activity logs in localStorage
      localStorage.removeItem("mindos_activity_logs");
      alert("Training activities reset to Rank F. Refreshing...");
      window.location.reload();
    } catch (e) {
      alert("Error resetting: " + e.message);
      setResetting(false);
    }
  };

  const resetStreak = async () => {
    if (!confirm("Reset your streak counter? This will set it to 0.")) return;
    setResetting(true);
    try {
      localStorage.removeItem("mindos_streak");
      alert("Streak reset.");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
      setResetting(false);
    }
  };

  const resetTasks = async () => {
    if (!confirm("Delete all tasks (habits, dailies, to-dos)? This cannot be undone.")) return;
    setResetting(true);
    try {
      localStorage.removeItem("mindos_tasks");
      const userTasks = await djangoApi.tasks.list();
      await Promise.all(userTasks.map(t => djangoApi.tasks.delete(t.id)));
      alert("Tasks cleared.");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
      setResetting(false);
    }
  };

  const resetAllies = async () => {
    if (!confirm("Reset ally progress? All unlocked allies will be locked again.")) return;
    setResetting(true);
    try {
      localStorage.removeItem("mindos_allies");
      alert("Allies reset.");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
      setResetting(false);
    }
  };

  const resetSkillTree = async () => {
    if (!confirm("Reset skill tree unlocks? All SP will be refunded.")) return;
    setResetting(true);
    try {
      localStorage.removeItem("mindos_skill_tree");
      localStorage.removeItem("mindos_skillTree");
      alert("Skill tree reset.");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
      setResetting(false);
    }
  };

  const resetStats = async () => {
    if (!confirm("Reset cognitive stats, rank, gold, class? This cannot be undone.")) return;
    setResetting(true);
    try {
      localStorage.removeItem("mindos_game_state");
      localStorage.removeItem("mindos_class");
      localStorage.removeItem("mindos_rank_xp");
      localStorage.removeItem("mindos_streak");
      localStorage.removeItem("mindos_skill_tree");
      localStorage.removeItem("mindos_skillTree");
      localStorage.removeItem("mindos_allies");
      localStorage.removeItem("mindos_mutators");
      localStorage.removeItem("mindos_prestige");
      localStorage.removeItem("mindos_scrolls");

      // Reset profile on Django backend
      await djangoApi.profile.update({
        hp: 100,
        mana: 50,
        gold: 0,
        level: 1,
        xp: 0,
        character_class: "",
        gf: 80.0,
        gc: 80.0,
        ps: 80.0,
        vm: 80.0,
        gf_ceiling: 120,
        gc_ceiling: 120,
        ps_ceiling: 120,
        vm_ceiling: 120,
        initialized: false
      });
      await refreshProfile();

      alert("Stats reset. Refreshing...");
      window.location.reload();
    } catch (e) {
      alert("Error resetting stats: " + e.message);
      setResetting(false);
    }
  };

  const resetAllData = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL progress. Cannot be undone. Continue?")) return;
    const confirmation = prompt("Type 'RESET' to confirm:");
    if (confirmation !== "RESET") return;
    setResetting(true);
    try {
      // Clear all localStorage mindos_ keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("mindos_")) localStorage.removeItem(key);
      });
      // Delete tasks from Django
      const userTasks = await djangoApi.tasks.list();
      await Promise.all(userTasks.map(t => djangoApi.tasks.delete(t.id)));
      // Reset profile
      await djangoApi.profile.update({
        hp: 100,
        mana: 50,
        gold: 0,
        level: 1,
        xp: 0,
        character_class: "",
        gf: 80.0,
        gc: 80.0,
        ps: 80.0,
        vm: 80.0,
        gf_ceiling: 120,
        gc_ceiling: 120,
        ps_ceiling: 120,
        vm_ceiling: 120,
        initialized: false
      });
      await refreshProfile();

      alert("All data cleared. Refreshing...");
      window.location.reload();
    } catch (e) {
      alert("Error during reset: " + e.message);
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Reset Options</span>
      </div>

      {/* Soft Resets */}
      <div className="space-y-3">
        {/* Training Activities Reset */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 rounded-xl border border-border bg-card space-y-3"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">Reset Training Activities</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">Deletes all logged sessions (resets subject ranks to F) and restores any hidden activities. Cognitive stats (Gf/Gc/Ps/Vm) are unchanged.</p>
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
          className="p-4 rounded-xl border border-border bg-card space-y-3"
        >
          <div className="flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">Reset Streak</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">Reset streak counter without penalty</p>
          <button
            onClick={resetStreak}
            disabled={resetting}
            className="w-full py-2 rounded-lg border border-border text-muted-foreground font-mono text-xs hover:bg-accent transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Streak"}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl border border-border bg-card space-y-3"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">Reset Tasks</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">Delete all habits, dailies, and to-dos</p>
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
          className="p-4 rounded-xl border border-border bg-card space-y-3"
        >
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">Reset Allies</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">Lock all allies again</p>
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
          className="p-4 rounded-xl border border-border bg-card space-y-3"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">Reset Skill Tree</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">Refund all SP points</p>
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
          <span className="font-mono text-xs font-bold text-red-400">Reset Stats & Progress</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Reset cognitive stats, rank, gold, class, skills, allies (keeps tasks)</p>
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
        <p className="text-[10px] text-muted-foreground/70">Delete EVERYTHING. Cannot be undone.</p>
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