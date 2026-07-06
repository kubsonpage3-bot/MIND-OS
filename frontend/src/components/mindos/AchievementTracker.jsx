import { useEffect, useRef } from "react";
import { showRewardToast } from "@/components/mindos/RewardToast";
import { playSound } from "@/lib/soundEffects";
import { useQueryClient } from "@tanstack/react-query";
import { ACHIEVEMENTS } from "@/constants/rpgData";

export default function AchievementTracker() {
  const queryClient = useQueryClient();
  const prevUnlocked = useRef(new Set());

  useEffect(() => {
    const handleUnlocked = (e) => {
      const achievements = e.detail || [];
      if (!achievements.length) return;

      let newFound = false;

      achievements.forEach(ach => {
        const achId = typeof ach === 'string' ? ach : ach.code;
        let achName = typeof ach === 'string' ? ach : (ach.name || achId);

        // Map to real name without underscores if we only have an ID
        if (typeof ach === 'string' || achName === achId) {
          const found = ACHIEVEMENTS.find(a => a.id === achId);
          achName = found ? found.name : achId.replace(/_/g, ' ').toUpperCase();
        }

        if (!prevUnlocked.current.has(achId)) {
          prevUnlocked.current.add(achId);
          newFound = true;
          showRewardToast({ label: `🏆 UNLOCKED: ${achName}` });
          playSound('success');
        }
      });

      if (newFound) {
        queryClient.invalidateQueries({ queryKey: ["userProfile"] });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
    };

    const handleDeath = () => {
      showRewardToast({ label: "💀 YOU DIED! Rank demoted. HP restored.", type: 'error' });
      playSound('death');
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };

    window.addEventListener("mindos-achievements-unlocked", handleUnlocked);
    window.addEventListener("mindos-death", handleDeath);
    
    return () => {
      window.removeEventListener("mindos-achievements-unlocked", handleUnlocked);
      window.removeEventListener("mindos-death", handleDeath);
    };
  }, [queryClient]);

  return null;
}
