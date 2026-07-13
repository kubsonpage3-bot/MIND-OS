import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Default preset to fallback on
const DEFAULT_PRESET = { work: 25, break: 5, longBreak: 15, cycles: 4 };

export default function PomodoroSettings() {
  const { t } = useTranslation();
  
  // We'll just load and save from localStorage for the durations
  const [settings, setSettings] = useState(DEFAULT_PRESET);

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('pomodoro_settings', JSON.stringify(settings));
    // Trigger a custom event so the Timer tab can listen to changes without React context overhead
    window.dispatchEvent(new Event('pomodoro_settings_updated'));
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
                onChange={e => setSettings(s => ({ ...s, [key]: parseInt(e.target.value) || 1 }))}
                className="font-mono text-sm"
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
