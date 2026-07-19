// @ts-nocheck
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { djangoApi } from "@/api/djangoClient";
import { X, Check, Sparkles } from "lucide-react";

export default function TitleSelectorModal({ profile, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
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

  // Only display unlocked titles
  const unlockedTitles = titles.filter((title) => title.unlocked);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg max-h-[85vh] my-auto flex flex-col rounded-2xl border border-purple-500/30 bg-[#0c0919] shadow-2xl text-foreground relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-purple-500/20 flex items-center justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md shrink-0 select-none"
              style={{ background: `${activeTitle.color}20`, border: `1px solid ${activeTitle.color}50` }}
            >
              {activeTitle.icon || "👑"}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold font-mono text-white leading-tight">
                  {t("titles.title_modal", "CHARACTER TITLES")}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 border border-purple-500/30 text-purple-300 select-none">
                  🏆 {unlockedCount} / {totalCount}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5 break-words leading-tight">
                {t("titles.title_modal_subtitle", "Equip a unique playstyle title based on your behavioral habits.")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {errorMsg && (
          <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono text-center shrink-0">
            {errorMsg}
          </div>
        )}

        {/* Current Active Banner */}
        <div className="mx-4 my-3 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="shrink-0">{t("titles.current_title", "Current")}:</span>
            <span className="font-bold truncate" style={{ color: activeTitle.color }}>
              {t(`titles.${activeTitle.id}.name`, activeTitle.name)}
            </span>
          </div>

          {profile?.equipped_title && (
            <button
              onClick={() => equipMutation.mutate("")}
              disabled={equipMutation.isPending}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 transition-colors shrink-0 cursor-pointer min-h-[32px]"
            >
              {t("titles.reset_auto", "Reset to auto")}
            </button>
          )}
        </div>

        {/* Scrollable Titles List */}
        {unlockedTitles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 font-mono text-xs">
            <Sparkles className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
            <span>{t("titles.no_unlocked", "No unlocked titles yet.")}</span>
            <span className="text-[10px] text-slate-600 mt-1">
              {t("titles.no_unlocked_hint", "Complete habits or achievements to earn titles.")}
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2.5 min-h-0">
            {unlockedTitles.map((title) => {
              const isEquipped = activeTitle.id === title.id && (profile?.equipped_title === title.id || (!profile?.equipped_title && title.is_equipped));
              const translatedName = t(`titles.${title.id}.name`, title.name);
              const translatedDesc = t(`titles.${title.id}.desc`, title.description);

              return (
                <div
                  key={title.id}
                  className="p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-4 transition-all relative overflow-hidden bg-slate-900/60 hover:bg-slate-900/90"
                  style={{
                    borderColor: isEquipped ? title.color : `${title.color}25`,
                    boxShadow: isEquipped ? `0 0 12px ${title.color}25` : "none",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xl sm:text-2xl shrink-0 select-none">{title.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold font-mono break-words leading-tight" style={{ color: title.color }}>
                        {translatedName}
                      </div>
                      {translatedDesc && (
                        <p className="text-[10px] sm:text-xs font-mono text-slate-400 mt-1 leading-normal break-words">
                          {translatedDesc}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    {isEquipped ? (
                      <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1.5 shrink-0 select-none">
                        <Check className="w-3.5 h-3.5" />
                        {t("titles.equipped", "EQUIPPED")}
                      </span>
                    ) : (
                      <button
                        onClick={() => equipMutation.mutate(title.id)}
                        disabled={equipMutation.isPending}
                        className="px-3.5 py-1.5 rounded-lg bg-purple-600/25 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 hover:text-white text-[10px] font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center min-h-[36px] min-w-[70px]"
                      >
                        {t("titles.equip", "EQUIP")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
