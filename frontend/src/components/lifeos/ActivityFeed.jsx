import { useTranslation } from "react-i18next";

export default function ActivityFeed({ gs }) {
  const { t } = useTranslation();
  const typeStyles = {
    "habit+":  { color: "text-green-400",  icon: "✅" },
    "habit-":  { color: "text-red-400",    icon: "❌" },
    "daily":   { color: "text-blue-400",   icon: "📅" },
    "todo":    { color: "text-purple-300", icon: "📝" },
    "reward":  { color: "text-yellow-400", icon: "🎁" },
    "levelup": { color: "text-yellow-300", icon: "⬆️" },
    "death":   { color: "text-red-500",    icon: "💀" },
    "perfect": { color: "text-yellow-300", icon: "🌟" },
    "drop":    { color: "text-cyan-400",   icon: "💎" },
  };

  if (!gs.logs || gs.logs.length === 0) {
    return (
      <div className="text-center text-purple-600 text-sm py-12 font-mono">
        {t("lifeos_columns.no_activity", "No activity yet. Complete tasks to see your log!")}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-2">
      <h2 className="text-purple-200 font-bold text-sm uppercase tracking-wider mb-3">{t("lifeos_columns.activity_log", "📜 Activity Log")}</h2>
      {gs.logs.map((log, i) => {
        const style = typeStyles[log.type] || { color: "text-purple-400", icon: "•" };
        const time = new Date(log.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-purple-800/30 bg-purple-950/30">
            <span className="text-base shrink-0">{style.icon}</span>
            <div className="flex-1">
              <span className={`text-sm font-mono ${style.color}`}>{log.msg}</span>
            </div>
            <span className="text-[10px] text-purple-700 shrink-0">{time}</span>
          </div>
        );
      })}
    </div>
  );
}