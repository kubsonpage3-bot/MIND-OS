// @ts-nocheck
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  RefreshCw,
  Unlink,
  Wifi,
  WifiOff,
  KeyRound,
  Laptop,
  Monitor,
  Globe,
  Clock,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { djangoApi } from '@/api/djangoClient';

export default function ExtensionPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [activeCodeData, setActiveCodeData] = useState(null);

  // Poll extension status and connected devices every 10s
  const { data: status, isLoading } = useQuery({
    queryKey: ['extension-status'],
    queryFn: () =>
      djangoApi.extension?.getStatus
        ? djangoApi.extension.getStatus()
        : Promise.resolve({ paired: false, device_count: 0, devices: [] }),
    refetchInterval: 10000,
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId = null) =>
      djangoApi.extension?.revoke
        ? djangoApi.extension.revoke(deviceId)
        : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extension-status'] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      djangoApi.extension?.generateCode
        ? djangoApi.extension.generateCode()
        : Promise.resolve(),
    onSuccess: (data) => {
      setActiveCodeData(data);
      queryClient.invalidateQueries({ queryKey: ['extension-status'] });
    },
  });

  const copyCode = useCallback(() => {
    if (!activeCodeData?.code) return;
    navigator.clipboard.writeText(activeCodeData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeCodeData]);

  const paired = status?.paired ?? false;
  const devices = status?.devices || [];
  const deviceCount = status?.device_count || devices.length;

  const expiresIn = activeCodeData?.expires_at
    ? Math.max(
        0,
        Math.round(
          (new Date(activeCodeData.expires_at).getTime() - Date.now()) / 1000
        )
      )
    : 0;

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return t('extension_ui.never_synced', 'awaiting first sync');
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return t('extension_ui.just_now', 'just now');
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return dateStr;
    }
  };

  const getDeviceIcon = (deviceName = '') => {
    const lower = deviceName.toLowerCase();
    if (lower.includes('laptop') || lower.includes('macbook')) {
      return <Laptop className="w-4 h-4 text-sky-400" />;
    }
    if (lower.includes('desktop') || lower.includes('pc') || lower.includes('windows')) {
      return <Monitor className="w-4 h-4 text-emerald-400" />;
    }
    return <Globe className="w-4 h-4 text-purple-400" />;
  };

  return (
    <div className="space-y-4">
      {/* ── Overview Status Card ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-4.5 transition-all relative overflow-hidden"
        style={{
          background: 'var(--habit-card, rgba(20,12,30,0.85))',
          borderColor: 'var(--habit-border, rgba(255,255,255,0.1))',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            {isLoading ? (
              <RefreshCw className="w-4.5 h-4.5 animate-spin" style={{ color: 'var(--habit-dim)' }} />
            ) : paired ? (
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
            )}
            <div>
              <span className="font-pixel text-xs font-bold tracking-wide" style={{ color: paired ? '#34d399' : 'var(--habit-dim)' }}>
                {isLoading
                  ? t('extension_ui.checking', 'Checking…')
                  : paired
                  ? t('extension_ui.connected', 'Extension Connected')
                  : t('extension_ui.not_connected', 'Not Connected')}
              </span>
              {paired && (
                <span className="text-[10px] font-mono ml-2 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {t('extension_ui.devices_count', { count: deviceCount, defaultValue: `${deviceCount} devices synced` })}
                </span>
              )}
            </div>
          </div>

          {paired && (
            <button
              onClick={() => revokeMutation.mutate(null)}
              disabled={revokeMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-pixel transition-all hover:bg-red-500/20 cursor-pointer"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
              title="Disconnect all paired devices"
            >
              <Unlink className="w-3.5 h-3.5" />
              {revokeMutation.isPending ? t('extension_ui.disconnecting', 'Disconnecting…') : t('extension_ui.disconnect_all', 'Disconnect All')}
            </button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground/80 mt-1">
          {paired
            ? t('extension_ui.desc_connected', 'Your extensions are synced. Gold, HP, site blocklist, and Pomodoro timer are shared across all your computers.')
            : t('extension_ui.desc_not_connected', 'Connect the MIND OS browser extension to sync gold, HP, and your site blocklist.')}
        </p>
      </div>

      {/* ── Connected Devices List ────────────────────────────────────────── */}
      {paired && devices.length > 0 && (
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{
            background: 'var(--habit-card, rgba(20,12,30,0.85))',
            borderColor: 'var(--habit-border, rgba(255,255,255,0.1))',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="font-pixel text-[11px] uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
              <span>💻</span> {t('extension_ui.devices_title', 'Connected Devices')}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {devices.length} active
            </span>
          </div>

          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-2.5 rounded-xl border transition-all"
                style={{
                  background: 'var(--habit-sidebar, rgba(10,6,16,0.7))',
                  borderColor: 'var(--habit-border, rgba(255,255,255,0.08))',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 shrink-0">
                    {getDeviceIcon(device.device_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-pixel text-xs text-zinc-200 truncate">
                      {device.device_name || 'Browser Extension'}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {t('extension_ui.last_sync', { time: formatRelativeTime(device.last_used_at), defaultValue: `Last sync: ${formatRelativeTime(device.last_used_at)}` })}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => revokeMutation.mutate(device.id)}
                  disabled={revokeMutation.isPending}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Disconnect this device"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Generate Pairing Code (Always available for Laptop / PC / etc.) ── */}
      <div
        className="rounded-2xl border p-4.5 space-y-3.5"
        style={{
          background: 'var(--habit-card, rgba(20,12,30,0.85))',
          borderColor: 'var(--habit-border, rgba(255,255,255,0.1))',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
      >
        <div className="flex items-center justify-between">
          <p className="font-pixel text-xs font-bold tracking-wide text-zinc-100 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            {t('extension_ui.how_to_connect', 'How to connect a new device / browser:')}
          </p>
        </div>

        <ol className="space-y-1.5 text-xs text-muted-foreground/80 pl-4 list-decimal leading-relaxed">
          <li>{t('extension_ui.step1', 'Install the MIND OS Companion extension in Firefox or Chrome')}</li>
          <li>
            {t('extension_ui.step2_prefix', 'Click')}{' '}
            <strong className="text-zinc-200">{t('extension_ui.generate_code_btn', 'Generate Code')}</strong>{' '}
            {t('extension_ui.step2_suffix', 'below — valid for 10 minutes')}
          </li>
          <li>{t('extension_ui.step3', 'Open the extension popup → enter the code → click Connect')}</li>
        </ol>

        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full py-3 rounded-xl transition-all font-pixel text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
            color: '#fff',
            border: '1px solid rgba(168,85,247,0.4)',
            boxShadow: generateMutation.isPending ? 'none' : '0 0 16px rgba(147,51,234,0.35)',
            opacity: generateMutation.isPending ? 0.7 : 1,
          }}
        >
          <Plus className="w-4 h-4" />
          {generateMutation.isPending
            ? t('extension_ui.generating_code', '⏳ Generating…')
            : t('extension_ui.generate_code_full', '🔑 Generate Code for New Device')}
        </button>

        <AnimatePresence>
          {activeCodeData && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="rounded-xl border p-4 text-center space-y-2 relative overflow-hidden"
              style={{
                background: 'var(--habit-sidebar, rgba(10,6,16,0.95))',
                borderColor: 'var(--habit-purple, #9333ea)',
                boxShadow: '0 0 20px rgba(147,51,234,0.2)',
              }}
            >
              <p className="text-[11px] font-pixel tracking-wider text-purple-300 font-bold">
                {t('extension_ui.pairing_code_header', 'PAIRING CODE — enter in extension popup')}
              </p>
              <div className="flex items-center justify-center gap-3 py-1">
                <span
                  className="font-mono text-2xl md:text-3xl font-black tracking-widest text-transparent bg-clip-text"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #c084fc 0%, #f472b6 100%)',
                  }}
                >
                  {activeCodeData.code}
                </span>
                <button
                  onClick={copyCode}
                  className="p-2.5 rounded-xl transition-all cursor-pointer border border-white/10 hover:bg-white/10"
                  style={{ background: 'var(--habit-border, rgba(255,255,255,0.06))' }}
                  title="Copy Code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-zinc-300" />
                  )}
                </button>
              </div>

              {expiresIn > 0 && (
                <p className="text-[11px] font-mono text-muted-foreground/70">
                  {t('extension_ui.expires_in', {
                    min: Math.ceil(expiresIn / 60),
                    defaultValue: `Expires in ~${Math.ceil(expiresIn / 60)} min`,
                  })}
                </p>
              )}

              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="text-[11px] font-mono underline text-purple-400 hover:text-purple-300 transition-colors pt-1 block mx-auto cursor-pointer"
              >
                {t('extension_ui.generate_new_code', 'Generate new code')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {generateMutation.isError && (
          <p className="text-xs text-red-400 text-center font-mono">
            {t('extension_ui.generate_error', 'Failed to generate code. Try again.')}
          </p>
        )}
      </div>

      {/* ── Feature Highlights ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-4"
        style={{
          background: 'rgba(124,58,237,0.06)',
          borderColor: 'rgba(124,58,237,0.2)',
        }}
      >
        <p className="text-xs text-muted-foreground/90 leading-relaxed space-y-1">
          <strong className="text-zinc-200 block mb-1">
            {t('extension_ui.what_it_does', 'What the extension does:')}
          </strong>
          <span>🛡 {t('extension_ui.feat_blocks', 'Blocks distracting sites (you set which ones)')}</span>
          <br />
          <span>🔓 {t('extension_ui.feat_pay_gold', 'Pay gold to temporarily unblock — costs configured per site')}</span>
          <br />
          <span>⏱ {t('extension_ui.feat_pomodoro', 'Pomodoro timer synced with your MIND OS sessions in real time')}</span>
          <br />
          <span>🪙 {t('extension_ui.feat_realtime_bar', 'Real-time Gold & HP bar from your profile')}</span>
        </p>
      </div>
    </div>
  );
}

