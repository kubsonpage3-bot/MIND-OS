import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast from 'react-hot-toast';

// Default preset to fallback on (stored as strings locally for easy input clearing)
const DEFAULT_PRESET = { work: '25', break: '5', longBreak: '15', cycles: '4' };

export default function PomodoroSettings() {
  const { t } = useTranslation();
  
  // Stored as strings in local state to allow deleting characters
  const [settings, setSettings] = useState(DEFAULT_PRESET);

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          work: String(parsed.work || 25),
          break: String(parsed.break || 5),
          longBreak: String(parsed.longBreak || 15),
          cycles: String(parsed.cycles || 4),
        });
      } catch (e) {}
    }
  }, []);

  const handleSave = () => {
    // Parse strings to safe integers (minimum 1)
    const work = Math.max(1, parseInt(settings.work, 10) || 25);
    const breakVal = Math.max(1, parseInt(settings.break, 10) || 5);
    const longBreak = Math.max(1, parseInt(settings.longBreak, 10) || 15);
    const cycles = Math.max(1, parseInt(settings.cycles, 10) || 4);

    const parsed = { work, break: breakVal, longBreak, cycles };

    localStorage.setItem('pomodoro_settings', JSON.stringify(parsed));
    
    // Sync the inputs state to clean parsed numbers
    setSettings({
      work: String(work),
      break: String(breakVal),
      longBreak: String(longBreak),
      cycles: String(cycles),
    });

    // Trigger a custom event so the Timer tab can listen to changes
    window.dispatchEvent(new Event('pomodoro_settings_updated'));
    toast.success(t('pomodoro.settings.saved', 'Settings saved!'));
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
