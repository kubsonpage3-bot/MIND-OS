import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { useProfileSync } from '@/hooks/useProfileSync';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Bell, BellOff, Volume2 } from 'lucide-react';

const DEFAULT_PRESET = { work: '25', break: '5', longBreak: '15', cycles: '4' };

const PRESETS = [
  { label: 'Classic', icon: '🍅', work: '25', break: '5', longBreak: '15', cycles: '4' },
  { label: 'Short',   icon: '⚡', work: '15', break: '3', longBreak: '10', cycles: '4' },
  { label: 'Deep',    icon: '🧠', work: '50', break: '10', longBreak: '20', cycles: '3' },
  { label: 'Custom',  icon: '⚙️', work: null,  break: null, longBreak: null,  cycles: null },
];

const SOUND_MODES = [
  { id: 'none', label: 'None', icon: '🔇' },
  { id: 'beep', label: 'Beep', icon: '📣' },
  { id: 'bell', label: 'Bell', icon: '🔔' },
];

/** Play a short tone via Web Audio API */
function playTone(type = 'beep') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'bell') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } else {
      // beep
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }

    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available
  }
}

export default function PomodoroSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useProfileSync();

  const [settings, setSettings] = useState(DEFAULT_PRESET);
  const [activePreset, setActivePreset] = useState('Classic');
  const [soundMode, setSoundMode] = useState('beep');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Load from profile
  useEffect(() => {
    if (profile?.pomodoro_settings) {
      const ps = profile.pomodoro_settings;
      setSettings({
        work: String(ps.work ?? 25),
        break: String(ps.break ?? 5),
        longBreak: String(ps.longBreak ?? 15),
        cycles: String(ps.cycles ?? 4),
      });
      if (ps.soundMode) setSoundMode(ps.soundMode);
    }
  }, [profile?.pomodoro_settings]);

  // Check existing notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const profileMutation = useMutation({
    mutationFn: (newData) => djangoApi.profile.update(newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      toast.success(t('pomodoro.settings.saved', 'Settings saved!'));
    },
    onError: () => {
      toast.error(t('pomodoro.settings.error', 'Failed to save settings.'));
    },
  });

  const handlePresetClick = (preset) => {
    if (preset.work === null) {
      setActivePreset('Custom');
      return;
    }
    setActivePreset(preset.label);
    setSettings({ work: preset.work, break: preset.break, longBreak: preset.longBreak, cycles: preset.cycles });
  };

  const handleSave = () => {
    const work = Math.max(1, parseInt(settings.work, 10) || 25);
    const breakVal = Math.max(1, parseInt(settings.break, 10) || 5);
    const longBreak = Math.max(1, parseInt(settings.longBreak, 10) || 15);
    const cycles = Math.max(1, parseInt(settings.cycles, 10) || 4);
    profileMutation.mutate({
      pomodoro_settings: { work, break: breakVal, longBreak, cycles, soundMode },
    });
  };

  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications not supported');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(false);
      toast('Notifications disabled for this session', { icon: '🔕' });
    } else {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notifications enabled!');
        new Notification('MIND OS Pomodoro', { body: 'Notifications are now active ✓' });
      } else {
        toast.error('Notification permission denied');
      }
    }
  };

  return (
    <div className="p-4 space-y-4">

      {/* ── Quick Presets ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <h3 className="text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-widest border-b border-border pb-2 mb-3">
          {t('pomodoro.settings.presets', 'Quick Presets')}
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map(p => {
            const isActive = activePreset === p.label;
            return (
              <button
                key={p.label}
                onClick={() => handlePresetClick(p)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all duration-150 active:scale-95"
                style={{
                  background: isActive ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: isActive ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.07)',
                  boxShadow: isActive ? '0 0 12px rgba(168,85,247,0.2)' : 'none',
                }}
              >
                <span className="text-lg leading-none">{p.icon}</span>
                <span
                  className="text-[9px] font-mono font-bold"
                  style={{ color: isActive ? '#a855f7' : 'rgba(255,255,255,0.4)' }}
                >
                  {p.label}
                </span>
                {p.work && (
                  <span className="text-[8px] font-mono text-white/25">
                    {p.work}/{p.break}m
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Timer Durations ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-xl p-4 space-y-4"
      >
        <h3 className="text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-widest border-b border-border pb-2">
          {t('pomodoro.settings.durations', 'Timer Durations')}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Focus (min)', key: 'work' },
            { label: 'Break (min)', key: 'break' },
            { label: 'Long Break (min)', key: 'longBreak' },
            { label: 'Cycles until Long', key: 'cycles' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-[9px] font-mono text-muted-foreground mb-1.5 block uppercase tracking-wider">
                {label}
              </label>
              <Input
                type="number"
                value={settings[key]}
                onChange={e => {
                  setActivePreset('Custom');
                  setSettings(s => ({ ...s, [key]: e.target.value }));
                }}
                className="font-mono text-sm h-9"
                min="1"
              />
            </div>
          ))}
        </div>
        <Button
          onClick={handleSave}
          disabled={profileMutation.isPending}
          className="w-full font-mono text-xs h-10"
        >
          {profileMutation.isPending
            ? t('common.saving', 'Saving...')
            : t('pomodoro.settings.save', 'Save Settings')}
        </Button>
      </motion.div>

      {/* ── Sound & Notifications ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-4 space-y-4"
      >
        <h3 className="text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-widest border-b border-border pb-2">
          {t('pomodoro.settings.sound', 'Sound & Notifications')}
        </h3>

        {/* Sound mode */}
        <div>
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Session end sound
          </p>
          <div className="flex gap-2">
            {SOUND_MODES.map(m => {
              const isActive = soundMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSoundMode(m.id);
                    if (m.id !== 'none') playTone(m.id);
                  }}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all duration-150 active:scale-95"
                  style={{
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                    borderColor: isActive ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.07)',
                  }}
                >
                  <span className="text-base">{m.icon}</span>
                  <span
                    className="text-[9px] font-mono font-bold"
                    style={{ color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.35)' }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Browser notifications toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {notificationsEnabled
              ? <Bell className="w-4 h-4 text-emerald-400" />
              : <BellOff className="w-4 h-4 text-muted-foreground" />}
            <div>
              <p className="text-[10px] font-mono font-bold text-white/70">Browser Notifications</p>
              <p className="text-[8px] font-mono text-muted-foreground">
                {notificationsEnabled ? 'Active — notified when sessions end' : 'Disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleNotifications}
            className="relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0"
            style={{
              background: notificationsEnabled
                ? 'linear-gradient(90deg, #059669, #34d399)'
                : 'rgba(255,255,255,0.1)',
            }}
          >
            <motion.div
              animate={{ x: notificationsEnabled ? 20 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
            />
          </button>
        </div>
      </motion.div>

    </div>
  );
}
