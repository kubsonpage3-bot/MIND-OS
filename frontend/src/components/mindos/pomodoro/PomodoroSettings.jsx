import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { useProfileSync } from '@/hooks/useProfileSync';
import toast from 'react-hot-toast';

// Default preset to fallback on (stored as strings locally for easy input clearing)
const DEFAULT_PRESET = { work: '25', break: '5', longBreak: '15', cycles: '4' };

export default function PomodoroSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useProfileSync();
  
  // Stored as strings in local state to allow deleting characters
  const [settings, setSettings] = useState(DEFAULT_PRESET);

  // Sync local state when profile settings load
  useEffect(() => {
    if (profile?.pomodoro_settings) {
      const ps = profile.pomodoro_settings;
      setSettings({
        work: String(ps.work ?? 25),
        break: String(ps.break ?? 5),
        longBreak: String(ps.longBreak ?? 15),
        cycles: String(ps.cycles ?? 4),
      });
    }
  }, [profile?.pomodoro_settings]);

  const profileMutation = useMutation({
    mutationFn: (newData) => djangoApi.profile.update(newData),
    onSuccess: () => {
      // Phase 2: State Synchronization Protocol (NO ZOMBIE CACHES)
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      toast.success(t('pomodoro.settings.saved', 'Settings saved!'));
    },
    onError: (err) => {
      toast.error(t('pomodoro.settings.error', 'Failed to save settings.'));
    }
  });

  const handleSave = () => {
    // Parse strings to safe integers (minimum 1)
    const work = Math.max(1, parseInt(settings.work, 10) || 25);
    const breakVal = Math.max(1, parseInt(settings.break, 10) || 5);
    const longBreak = Math.max(1, parseInt(settings.longBreak, 10) || 15);
    const cycles = Math.max(1, parseInt(settings.cycles, 10) || 4);

    const parsed = { work, break: breakVal, longBreak, cycles };

    profileMutation.mutate({ pomodoro_settings: parsed });
  };


  return (
    <div className="p-4 space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase text-muted-foreground border-b border-border pb-2">
          {t('pomodoro.settings.durations', 'Timer Durations')}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Focus (min)", key: "work" },
            { label: "Break (min)", key: "break" },
            { label: "Long Break (min)", key: "longBreak" },
            { label: "Cycles until Long", key: "cycles" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-[10px] font-mono text-muted-foreground mb-1 block uppercase">
                {label}
              </label>
              <Input
                type="number"
                value={settings[key]}
                onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                className="font-mono text-sm"
                min="1"
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} className="w-full font-mono mt-4">
          {t('pomodoro.settings.save', 'Save Settings')}
        </Button>
      </div>


      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase text-muted-foreground border-b border-border pb-2">
          {t('pomodoro.settings.sound', 'Sound & Notifications')}
        </h3>
        <p className="text-xs font-mono text-muted-foreground">
          {t('pomodoro.settings.comingSoon', 'Sound configurations coming soon.')}
        </p>
      </div>
    </div>
  );
}
