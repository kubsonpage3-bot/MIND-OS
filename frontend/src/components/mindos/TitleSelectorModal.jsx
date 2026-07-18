// @ts-nocheck
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoApi } from "@/api/djangoClient";
import { X, Check, Lock, Sparkles } from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "Все", icon: "👑" },
  { id: "time", label: "Время", icon: "🌙" },
  { id: "streak", label: "Стрики", icon: "🔥" },
  { id: "spec", label: "Дисциплины", icon: "🔬" },
  { id: "craft", label: "Крафт", icon: "🧪" },
  { id: "combat", label: "Боссы", icon: "⚔️" },
  { id: "focus", label: "Помидоро", icon: "⏱️" },
  { id: "social", label: "Пати", icon: "🤝" },
  { id: "wealth", label: "Богатство", icon: "💰" },
  { id: "rank", label: "Ранги", icon: "🌟" },
];

export default function TitleSelectorModal({ profile, onClose }) {
  const queryClient = useQueryClient();
  const [selectedCat, setSelectedCat] = useState("all");
  const [errorMsg, setErrorMsg] = useState(null);

  const playstyleInfo = profile?.playstyle_info || {};
  const activeTitle = playstyleInfo.active_title || { id: "awakened_one", name: "Пробуждённый", icon: "✨", color: "#94a3b8" };
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
      setErrorMsg(err.message || "Не удалось сменить титул.");
    },
  });

  const filteredTitles = selectedCat === "all"
    ? titles
    : titles.filter((t) => t.category === selectedCat);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-3xl my-auto p-5 md:p-6 rounded-2xl border border-purple-500/30 bg-[#0c0919] shadow-2xl text-foreground relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-purple-500/20 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md"
              style={{ background: `${activeTitle.color}20`, border: `1px solid ${activeTitle.color}50` }}
            >
              {activeTitle.icon || "👑"}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-mono text-white">ТИ ТУЛЫ ПЕРСОНАЖА</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  🏆 {unlockedCount} / {totalCount}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">
                Экипируйте уникальный титул по вашему стилю игры или оставьте авто-выбор.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono text-center">
            {errorMsg}
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCat === cat.id;
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
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Auto Title Toggle Button */}
        <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <div className="text-xs font-mono text-slate-300">
              Текущий титул: <span className="font-bold text-white" style={{ color: activeTitle.color }}>{activeTitle.name}</span>
            </div>
          </div>

          {profile?.equipped_title && (
            <button
              onClick={() => equipMutation.mutate("")}
              disabled={equipMutation.isPending}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              Сбросить к авто-выбору
            </button>
          )}
        </div>

        {/* Titles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {filteredTitles.map((t) => {
            const isEquipped = activeTitle.id === t.id && (profile?.equipped_title === t.id || (!profile?.equipped_title && t.is_equipped));

            return (
              <div
                key={t.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden ${
                  t.unlocked
                    ? "bg-slate-900/60 hover:bg-slate-900/90"
                    : "bg-slate-950/40 opacity-70"
                }`}
                style={{
                  borderColor: isEquipped ? t.color : t.unlocked ? `${t.color}40` : "#1e1b30",
                  boxShadow: isEquipped ? `0 0 16px ${t.color}40` : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    <div>
                      <div className="text-xs font-bold font-mono" style={{ color: t.unlocked ? t.color : "#64748b" }}>
                        {t.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 line-clamp-2 mt-0.5">
                        {t.description}
                      </div>
                    </div>
                  </div>

                  {t.unlocked ? (
                    isEquipped ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> ЭКИПИРОВАНО
                      </span>
                    ) : (
                      <button
                        onClick={() => equipMutation.mutate(t.id)}
                        disabled={equipMutation.isPending}
                        className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/60 border border-purple-500/40 text-purple-200 hover:text-white text-[10px] font-mono font-bold transition-all shrink-0 cursor-pointer"
                      >
                        ЭКИПИРОВАТЬ
                      </button>
                    )
                  ) : (
                    <span className="p-1 rounded bg-slate-800 text-slate-500 shrink-0" title="Заблокировано">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Progress bar for locked titles */}
                {!t.unlocked && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-500">
                      <span>Прогресс</span>
                      <span>{t.progress_text}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${t.progress_pct}%`, background: t.color }}
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
