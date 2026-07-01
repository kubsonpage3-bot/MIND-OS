import { useState } from "react";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadStreakData() {
  try {
    const raw = localStorage.getItem("mindos_streak");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { streakCount: 0, lastStreakLogDate: null, streakLogHistory: [] };
}

function saveStreakData(data) {
  localStorage.setItem("mindos_streak", JSON.stringify(data));
}

export default function StreakControl() {
  const [data, setData] = useState(loadStreakData);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const today = getTodayStr();
  const alreadyLogged = data.lastStreakLogDate === today;

  const handleLog = () => {
    if (alreadyLogged) return;
    const next = {
      streakCount: data.streakCount + 1,
      lastStreakLogDate: today,
      streakLogHistory: [...(data.streakLogHistory || []), today],
    };
    setData(next);
    saveStreakData(next);
    // +10 MP on streak log
    try {
      const cls = JSON.parse(localStorage.getItem("mindos_class") || "{}");
      if (cls.chosen) {
        const maxMana = cls.maxMana || 100;
        cls.mana = Math.min(maxMana, (cls.mana || 0) + 10);
        localStorage.setItem("mindos_class", JSON.stringify(cls));
      }
    } catch {}
    setToast(`Day ${next.streakCount} logged — +10 MP restored 🔥`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReset = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 4000);
      return;
    }
    const next = { streakCount: 0, lastStreakLogDate: null, streakLogHistory: [] };
    setData(next);
    saveStreakData(next);
    setShowConfirm(false);
  };

  return (
    <div className="flex flex-col items-end gap-0.5 relative">
      {/* Toast */}
      {toast && (
        <div className="absolute bottom-full right-0 mb-2 z-50 bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground whitespace-nowrap shadow-xl">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
          <span className="text-ps font-bold">+{data.streakCount}</span>
          <span>day streak</span>
        </div>
        <button
          onClick={handleLog}
          disabled={alreadyLogged}
          className="text-[10px] font-mono px-2 py-1 rounded border transition-all"
          style={{
            borderColor: alreadyLogged ? "#444" : "#3388ff",
            color: alreadyLogged ? "#555" : "#3388ff",
            background: alreadyLogged ? "transparent" : "rgba(51,136,255,0.08)",
            cursor: alreadyLogged ? "not-allowed" : "pointer",
          }}
        >
          {alreadyLogged ? "✓ LOGGED" : "✓ LOG TODAY"}
        </button>
      </div>

      <button
        onClick={handleReset}
        className="text-[9px] font-mono text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
      >
        {showConfirm ? "click again to confirm reset" : "reset streak"}
      </button>
    </div>
  );
}