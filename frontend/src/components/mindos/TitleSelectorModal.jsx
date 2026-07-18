// @ts-nocheck
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { djangoApi } from "@/api/djangoClient";
import { X, Check, Lock, Sparkles } from "lucide-react";

const CATEGORIES = [
  { id: "all", icon: "👑" },
  { id: "time", icon: "🌙" },
  { id: "streak", icon: "🔥" },
  { id: "spec", icon: "🔬" },
  { id: "craft", icon: "🧪" },
  { id: "combat", icon: "⚔️" },
  { id: "focus", icon: "⏱️" },
  { id: "social", icon: "🤝" },
  { id: "wealth", icon: "💰" },
  { id: "rank", icon: "🌟" },
];

export default function TitleSelectorModal({ profile, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedCat, setSelectedCat] = useState("all");
  const [errorMsg, setErrorMsg] = useState(null);

  // Lock body scroll while modal is open to prevent background scrolling leakage
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const playstyleInfo = profile?.playstyle_info || {};
  const activeTitle = playstyleInfo.active_title || { id: "awakened_one", name: "Awakened One", icon: "✨", color: "#94a3b8" };
  const titles = playstyleInfo.titles || [];
  const unlockedCount = playstyleInfo.unlocked_count || 1;
  const totalCount = playstyleInfo.total_count || 52;

  const equipMutation = useMutation({
    mutationFn: (titleId) => djangoApi.profile.equipTitle(titleId),
    onSuccess: (data) => {
      queryClient.setQueryData(["userprofile"], (old) => {
        if (!old) return old;
        return { ...old, ...(data.profile || {}) };
      });
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to equip title.");
    },
  });

  const filteredTitles = selectedCat === "all"
    ? titles
    : titles.filter((title) => title.category === selectedCat);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl max-h-[85vh] my-auto flex flex-col rounded-2xl border border-purple-500/30 bg-[#0c0919] shadow-2xl text-foreground relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-purple-500/20 flex items-center justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md shrink-0"
              style={{ background: `${activeTitle.color}20`, border: `1px solid ${activeTitle.color}50` }}
            >
              {activeTitle.icon || "👑"}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-mono text-white">
                  {t("titles.title_modal", "CHARACTER TITLES")}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  🏆 {unlockedCount} / {totalCount}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-mono text-slate-400 line-clamp-1">
                {t("titles.title_modal_subtitle", "Equip a unique playstyle title based on your behavioral habits or leave auto-selection enabled.")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono text-center shrink-0">
            {errorMsg}
          </div>
        )}

        {/* Category Tabs */}
        <div className="px-4 pt-3 pb-2 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none border-b border-slate-800/60 bg-slate-950/20">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCat === cat.id;
            const categoryLabel = t(`titles.categories.${cat.id}`, cat.id);

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs flex items-center gap-1.5 shrink-0 transition-all ${
                  isActive
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-500/20"
                    : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{categoryLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Current Active Banner */}
        <div className="mx-4 my-3 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>{t("titles.current_title", "Current Title")}:</span>
            <span className="font-bold" style={{ color: activeTitle.color }}>
              {t(`titles.${activeTitle.id}.name`, activeTitle.name)}
            </span>
          </div>

          {profile?.equipped_title && (
            <button
              onClick={() => equipMutation.mutate("")}
              disabled={equipMutation.isPending}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-300 transition-colors shrink-0"
            >
              {t("titles.reset_auto", "Reset to auto-selection")}
            </button>
          )}
        </div>

        {/* Scrollable Titles Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-0">
          {filteredTitles.map((title) => {
            const isEquipped = activeTitle.id === title.id && (profile?.equipped_title === title.id || (!profile?.equipped_title && title.is_equipped));
            const translatedName = t(`titles.${title.id}.name`, title.name);
            const translatedDesc = t(`titles.${title.id}.desc`, title.description);

            return (
              <div
                key={title.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden ${
                  title.unlocked
                    ? "bg-slate-900/60 hover:bg-slate-900/90"
                    : "bg-slate-950/40 opacity-70"
                }`}
                style={{
                  borderColor: isEquipped ? title.color : title.unlocked ? `${title.color}40` : "#1e1b30",
                  boxShadow: isEquipped ? `0 0 16px ${title.color}40` : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0 mt-0.5">{title.icon}</span>
                    <div>
                      <div className="text-xs font-bold font-mono" style={{ color: title.unlocked ? title.color : "#64748b" }}>
                        {translatedName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {translatedDesc}
                      </div>
                    </div>
                  </div>

                  {title.unlocked ? (
                    isEquipped ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> {t("titles.equipped", "EQUIPPED")}
                      </span>
                    ) : (
                      <button
                        onClick={() => equipMutation.mutate(title.id)}
                        disabled={equipMutation.isPending}
                        className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/60 border border-purple-500/40 text-purple-200 hover:text-white text-[10px] font-mono font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {t("titles.equip", "EQUIP")}
                      </button>
                    )
                  ) : (
                    <span className="p-1 rounded bg-slate-800 text-slate-500 shrink-0" title="Locked">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Progress bar for locked titles */}
                {!title.unlocked && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-500">
                      <span>Progress</span>
                      <span>{title.progress_text}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${title.progress_pct}%`, background: title.color }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
