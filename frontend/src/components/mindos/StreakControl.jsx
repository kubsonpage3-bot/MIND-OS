import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { djangoApi } from "@/api/djangoClient";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StreakControl() {
  const { t } = useTranslation();
  const { profile } = useDjangoAuth();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Track daily log status locally so we don't spam the button
  const [lastLogDate, setLastLogDate] = useState(() => localStorage.getItem("mindos_streak_last_log"));

  const today = getTodayStr();
  const alreadyLogged = lastLogDate === today;
  const currentStreak = profile?.streak || 0;

  const mutation = useMutation({
    mutationFn: (newStreak) => djangoApi.profile.update({ streak: newStreak }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
    }
  });

  const handleLog = () => {
    if (alreadyLogged) return;
    const nextStreak = currentStreak + 1;
    
    setLastLogDate(today);
    localStorage.setItem("mindos_streak_last_log", today);
    mutation.mutate(nextStreak);

    setToast(`Day ${nextStreak} logged 🔥`);
    setTimeout(() => setToast(null), 3000);
  };


  const handleReset = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 4000);
      return;
    }
    setLastLogDate(null);
    localStorage.removeItem("mindos_streak_last_log");
    mutation.mutate(0);
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
          <span className="text-ps font-bold">+{currentStreak}</span>
          <span>{t('streakControl.dayStreak')}</span>
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