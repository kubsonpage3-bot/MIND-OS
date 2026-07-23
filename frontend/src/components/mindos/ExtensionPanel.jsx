import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Puzzle, Copy, Check, RefreshCw, Unlink, Wifi, WifiOff } from 'lucide-react';
import { djangoFetch } from '@/api/djangoClient';

// ── API functions ──────────────────────────────────────────────────────────

const generateCode  = () => djangoFetch('extension/generate-code/', { method: 'POST' }).then((r) => r.json());
const revokeToken   = () => djangoFetch('extension/revoke/', { method: 'DELETE' });
const fetchStatus   = () => djangoFetch('extension/web-status/').then((r) => r.json());

// ── Component ──────────────────────────────────────────────────────────────

export default function ExtensionPanel() {
  const queryClient = useQueryClient();
  const [copied, setCopied]   = useState(false);
  const [codeData, setCodeData] = useState(null); // { code, expires_at }

  const { data: status, isLoading } = useQuery({
    queryKey: ['extension-status'],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: generateCode,
    onSuccess: (data) => {
      setCodeData(data);
      queryClient.invalidateQueries({ queryKey: ['extension-status'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeToken,
    onSuccess: () => {
      setCodeData(null);
      queryClient.invalidateQueries({ queryKey: ['extension-status'] });
    },
  });

  const copyCode = useCallback(() => {
    if (!codeData?.code) return;
    navigator.clipboard.writeText(codeData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeData]);

  const paired = status?.paired ?? false;

  const expiresIn = codeData?.expires_at
    ? Math.max(0, Math.round((new Date(codeData.expires_at) - Date.now()) / 1000))
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-1"
        style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}
      >
        <Puzzle className="w-4 h-4" style={{ color: 'var(--habit-purple)' }} />
        <span style={{ color: 'var(--habit-text)' }}>BROWSER EXTENSION</span>
      </div>

      {/* Status card */}
      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--habit-card)', borderColor: 'var(--habit-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--habit-dim)' }} />
            ) : paired ? (
              <Wifi className="w-4 h-4" style={{ color: '#22c55e' }} />
            ) : (
              <WifiOff className="w-4 h-4" style={{ color: 'var(--habit-dim)' }} />
            )}
            <span
              style={{
                fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13,
                color: paired ? '#22c55e' : 'var(--habit-dim)',
              }}
            >
              {isLoading ? 'Checking…' : paired ? 'Extension Connected' : 'Not Connected'}
            </span>
          </div>

          {paired && (
            <button
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all"
              style={{
                fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11,
                background: 'rgba(220,38,38,0.1)', color: '#ef4444',
                border: '1px solid rgba(220,38,38,0.25)',
              }}
            >
              <Unlink className="w-3 h-3" />
              {revokeMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--habit-dim)', lineHeight: 1.6 }}>
          {paired
            ? 'Your Firefox extension is synced. Gold, HP and the blocklist are shared with this account.'
            : 'Connect the MIND OS Firefox extension to sync gold, HP, and your site blocklist.'}
        </p>
      </div>

      {/* Pairing flow */}
      {!paired && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ background: 'var(--habit-card)', borderColor: 'var(--habit-border)' }}
        >
          <p style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, color: 'var(--habit-text)' }}>
            How to connect
          </p>
          <ol
            className="space-y-1"
            style={{ fontSize: 12, color: 'var(--habit-dim)', lineHeight: 1.7, paddingLeft: 16 }}
          >
            <li>1. Install the MIND OS Companion extension in Firefox</li>
            <li>2. Click <strong>Generate Code</strong> below — valid for 10 minutes</li>
            <li>3. Open the extension popup → enter the code → click Connect</li>
          </ol>

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full py-2.5 rounded-xl transition-all font-bold"
            style={{
              fontFamily: "'Nunito'", fontWeight: 800, fontSize: 14,
              background: 'var(--habit-purple)', color: '#fff',
              boxShadow: generateMutation.isPending ? 'none' : '0 0 12px var(--habit-purple-glow)',
              opacity: generateMutation.isPending ? 0.7 : 1,
            }}
          >
            {generateMutation.isPending ? '⏳ Generating…' : '🔑 Generate Pairing Code'}
          </button>

          <AnimatePresence>
            {codeData && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border p-4 text-center"
                style={{ background: 'var(--habit-sidebar)', borderColor: 'var(--habit-purple)' }}
              >
                <p style={{ fontSize: 11, color: 'var(--habit-dim)', marginBottom: 8, fontWeight: 700 }}>
                  PAIRING CODE — enter in extension popup
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span
                    style={{
                      fontFamily: 'monospace', fontSize: 26, fontWeight: 900, letterSpacing: '0.15em',
                      color: 'var(--habit-purple)',
                    }}
                  >
                    {codeData.code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 rounded-lg transition-all"
                    style={{ background: 'var(--habit-border)', color: 'var(--habit-dim)' }}
                    title="Copy"
                  >
                    {copied ? <Check className="w-4 h-4" style={{ color: '#22c55e' }} /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {expiresIn > 0 && (
                  <p style={{ fontSize: 11, color: 'var(--habit-dim)', marginTop: 8 }}>
                    Expires in ~{Math.ceil(expiresIn / 60)} min
                  </p>
                )}
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="mt-3 text-xs underline transition-all"
                  style={{ color: 'var(--habit-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Generate new code
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {generateMutation.isError && (
            <p style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>
              Failed to generate code. Try again.
            </p>
          )}
        </div>
      )}

      {/* Info box */}
      <div
        className="rounded-xl border p-4"
        style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.2)' }}
      >
        <p style={{ fontSize: 12, color: 'var(--habit-dim)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--habit-text)' }}>What the extension does:</strong>
          <br />
          🛡 Blocks distracting sites (you set which ones)
          <br />
          🔓 Pay gold to temporarily unblock — costs configured per site
          <br />
          ⏱ Pomodoro timer synced with your MIND OS sessions
          <br />
          🪙 Real-time gold &amp; HP bar from your profile
        </p>
      </div>
    </div>
  );
}
