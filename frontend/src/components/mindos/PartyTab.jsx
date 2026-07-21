import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { djangoApi, getMediaUrl } from '@/api/djangoClient';
import { getRankDisplayData } from '@/lib/rankEngine';
import { Copy, Check, Users, LogOut, UserPlus, Swords } from 'lucide-react';
import { Crown, MessageSquare, Zap } from 'lucide-react';
import PartyMemberProfileSheet from './PartyMemberProfileSheet';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { CLASSES, CLASS_SPRITES } from '@/constants/rpgData';

// ─── Member Card ─────────────────────────────────────────────────────────────

const FALLBACK_SPRITES = {
  F:   "/images/webp/993830219_generated_image.webp",
  D:   "/images/webp/993830219_generated_image.webp",
  C:   "/images/webp/82c35d837_generated_image.webp",
  B:   "/images/webp/032923fd3_generated_image.webp",
  A:   "/images/webp/c1bdfbb0c_generated_image.webp",
  S:   "/images/webp/f6d9c9d1e_generated_image.webp",
  SS:  "/images/webp/f6d9c9d1e_generated_image.webp",
  SSS: "/images/webp/c5c7fecf4_generated_image.webp",
};

function MemberCard({ member, isOwner, showKick, onKick, onBuff, onClick }) {
  const rank = getRankDisplayData(member.rank_info?.current_id || 'F', member);
  const hpPct = member.max_hp > 0 ? Math.min((member.hp / member.max_hp) * 100, 100) : 0;
  const [showBuffs, setShowBuffs] = useState(false);

  const charClass = member.character_class?.toLowerCase();
  const rankId = member.rank_info?.current_id || 'F';
  const classInfo = CLASSES[charClass] || null;
  const classColor = classInfo?.color || '#878190';

  let spriteUrl = null;
  if (member.character_image) {
    spriteUrl = getMediaUrl(member.character_image);
  } else if (charClass && CLASS_SPRITES[charClass]) {
    const rawClassSprite = CLASS_SPRITES[charClass];
    spriteUrl = typeof rawClassSprite === 'object'
      ? (rawClassSprite[rankId] || rawClassSprite['F'])
      : rawClassSprite;
  } else {
    spriteUrl = FALLBACK_SPRITES[rankId] || FALLBACK_SPRITES['F'];
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-xl flex flex-col gap-2 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Portrait */}
        <div
          className="shrink-0 w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2 ring-1 ring-black/20 dark:ring-white/10 shadow-sm"
          style={{
            background: 'var(--habit-panel)',
            borderColor: classColor,
          }}
        >
          {spriteUrl ? (
            <img
              src={spriteUrl}
              alt={member.username}
              className="w-full h-full object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <span className="font-mono font-black text-sm uppercase" style={{ color: 'var(--habit-dim)' }}>
              {member.username?.charAt(0) || '?'}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="font-mono font-bold text-sm truncate"
                style={{ color: 'var(--habit-text)' }}
              >
                {member.username}
              </span>
              {isOwner && (
                <Crown className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
              )}
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--habit-border)', color: 'var(--habit-dim)' }}
              >
                Lv.{member.level}
              </span>
              {/* Rank badge */}
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold border"
                style={{ background: `${rank.color}22`, color: rank.color, borderColor: `${rank.color}66` }}
              >
                {rank.id === 'ASC' ? rank.label : rank.id}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onBuff && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowBuffs(!showBuffs); }}
                  className="p-1 rounded-md transition-all hover:bg-white/10"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                </button>
              )}
              {showKick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to kick ${member.username} from the party?`)) {
                      onKick();
                    }
                  }}
                  className="p-1 rounded-md transition-all hover:bg-red-500/10 text-red-400 shrink-0"
                  title="Kick Member"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono" style={{ color: 'var(--habit-dim)' }}>
              {member.character_class}
            </span>
            <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>
              🔥 {member.streak}d
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--habit-dim)' }}>
              {member.joined ? new Date(member.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>

          {/* HP bar */}
          <div className="mt-1.5 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[9px] font-mono" style={{ color: 'var(--habit-dim)' }}>
                HP
              </span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--habit-dim)' }}>
                {member.hp}/{member.max_hp}
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--habit-border)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${hpPct}%`,
                  background: hpPct > 50 ? '#00cc88' : hpPct > 25 ? '#f59e0b' : '#ef4444',
                  boxShadow: hpPct > 50 ? '0 0 4px #00cc8866' : '0 0 4px #ef444466',
                }}
              />
            </div>
          </div>
        </div>

        {/* Rank XP */}
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-mono" style={{ color: rank.color }}>
            {Math.floor(member.rank_xp)} / {member.rank_info?.next_threshold}
          </div>
          <div className="text-[9px] font-mono" style={{ color: 'var(--habit-dim)' }}>
            Rank XP
          </div>
        </div>
      </div>

      {/* Buff menu */}
      <AnimatePresence>
        {showBuffs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5 pt-2 flex gap-2"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onBuff('heal_1'); setShowBuffs(false); }}
              className="flex-1 py-1 text-[10px] font-mono rounded bg-green-500/10 text-green-400 border border-green-500/20"
            >
              + Heal
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBuff('focus_buff'); setShowBuffs(false); }}
              className="flex-1 py-1 text-[10px] font-mono rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
            >
              + Focus
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Invite Code Display ──────────────────────────────────────────────────────

function InviteCodeDisplay({ code }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="p-3 rounded-xl flex items-center justify-between gap-3"
      style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
    >
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--habit-dim)' }}>{t('partyTab.inviteCodeLabel')}</div>
        <div
          className="font-mono font-black text-2xl tracking-[0.3em]"
          style={{ color: 'var(--habit-purple)', letterSpacing: '0.3em' }}
        >
          {code}
        </div>
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--habit-dim)' }}>{t('partyTab.inviteDesc')}</div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: copied ? '#00cc8822' : 'var(--habit-border)',
          border: `1px solid ${copied ? '#00cc88' : 'var(--habit-border)'}`,
          color: copied ? '#00cc88' : 'var(--habit-dim)',
        }}
        title={t('partyTab.copyInvite')}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── No-Party State ───────────────────────────────────────────────────────────

function NoPartyView({ onCreated, onJoined }) {
  const { t } = useTranslation();
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => djangoApi.party.create(createName.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      onCreated?.();
    },
    onError: (/** @type {any} */ err) => setError(err?.data?.error || err?.message || 'Failed to create party.'),
  });

  const joinMutation = useMutation({
    mutationFn: () => djangoApi.party.join(joinCode.trim().toUpperCase()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      onJoined?.();
    },
    onError: (/** @type {any} */ err) => setError(err?.data?.error || err?.message || 'Failed to join party.'),
  });

  const inputStyle = {
    background: 'var(--habit-bg)',
    border: '1px solid var(--habit-border)',
    color: 'var(--habit-text)',
    fontFamily: "'Nunito'",
    fontSize: 13,
    borderRadius: 10,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
  };

  const btnStyle = (active) => ({
    fontFamily: "'Nunito'",
    fontWeight: 800,
    fontSize: 12,
    borderRadius: 10,
    padding: '8px 16px',
    border: 'none',
    cursor: active ? 'pointer' : 'not-allowed',
    opacity: active ? 1 : 0.4,
    transition: 'all 0.15s',
  });

  return (
    <div className="space-y-3">
      <div
        className="p-4 rounded-xl space-y-2"
        style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Swords className="w-3.5 h-3.5" style={{ color: 'var(--habit-purple)' }} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--habit-text)' }}>{t('partyTab.createParty')}</span>
        </div>
        <input
          style={inputStyle}
          placeholder={t('partyTab.partyNamePlaceholder')}
          value={createName}
          onChange={(e) => { setCreateName(e.target.value); setError(''); }}
          maxLength={64}
          onKeyDown={(e) => e.key === 'Enter' && createName.trim() && createMutation.mutate()}
        />
        <button
          onClick={() => createMutation.mutate()}
          disabled={!createName.trim() || createMutation.isPending}
          style={{
            ...btnStyle(!!createName.trim() && !createMutation.isPending),
            background: 'var(--habit-purple)',
            color: 'white',
            boxShadow: createName.trim() ? '0 2px 12px var(--habit-purple-glow)' : 'none',
          }}
        >
          {createMutation.isPending ? t('partyTab.creatingBtn') : t('partyTab.createParty')}
        </button>
      </div>

      <div
        className="p-4 rounded-xl space-y-2"
        style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-3.5 h-3.5" style={{ color: '#00e5ff' }} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--habit-text)' }}>{t('partyTab.joinParty')}</span>
        </div>
        <input
          style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}
          placeholder={t('partyTab.inviteCode')}
          value={joinCode}
          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
          maxLength={6}
          onKeyDown={(e) => e.key === 'Enter' && joinCode.trim().length === 6 && joinMutation.mutate()}
        />
        <button
          onClick={() => joinMutation.mutate()}
          disabled={joinCode.trim().length !== 6 || joinMutation.isPending}
          style={{
            ...btnStyle(joinCode.trim().length === 6 && !joinMutation.isPending),
            background: '#00e5ff22',
            color: '#00e5ff',
            border: '1px solid #00e5ff44',
          }}
        >
          {joinMutation.isPending ? t('partyTab.joiningBtn') : t('partyTab.joinBtn')}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-3 py-2 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444', color: '#ef4444' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Has-Party State ──────────────────────────────────────────────────────────


// ─── Feed View ────────────────────────────────────────────────────────────────
function PartyFeedView({ party }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['party', 'feed'],
    queryFn: () => djangoApi.party.feed(),
    refetchInterval: 15_000
  });

  const reactMutation = useMutation({
    mutationFn: (/** @type {{eventId: number, emoji: string}} */ { eventId, emoji }) => djangoApi.party.react(eventId, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['party', 'feed'] })
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--habit-panel)' }} />
        ))}
      </div>
    );
  }

  const events = data?.results || data || [];

  const EVENT_CONFIG = {
    task_completed: { icon: '✅', label: 'completed', color: '#00cc88' },
    level_up: { icon: '🆙', label: 'leveled up to', color: '#f59e0b' },
    buff_sent: { icon: '💪', label: 'sent a buff:', color: '#7B61FF' },
    milestone: { icon: '🏆', label: 'hit a milestone:', color: '#ffd700' },
    default: { icon: '⚡', label: 'did something:', color: 'var(--habit-dim)' },
  };

  function relativeTime(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {events.map(event => {
          const cfg = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.default;
          const isReacted = event.user_reacted;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
            >
              {/* Colored top accent bar */}
              <div className="h-0.5 w-full" style={{ background: cfg.color }} />
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{cfg.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs" style={{ color: 'var(--habit-text)' }}>
                          {event.username}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--habit-dim)' }}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] font-mono font-semibold truncate max-w-[120px]" style={{ color: cfg.color }}>
                          {event.content}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--habit-dim)' }}>
                    {relativeTime(event.created_at)}
                  </span>
                </div>
                {/* Reactions */}
                <div className="flex gap-1.5">
                  {['🔥', '👏', '💪', '🎉'].map(emoji => {
                    const count = event.reactions?.filter(r => r.emoji === emoji).length || 0;
                    const myReact = event.user_reacted === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={() => reactMutation.mutate({ eventId: event.id, emoji })}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all"
                        style={{
                          background: myReact ? `${cfg.color}33` : 'var(--habit-border)',
                          border: `1px solid ${myReact ? cfg.color : 'transparent'}`,
                          transform: myReact ? 'scale(1.08)' : 'scale(1)',
                        }}
                      >
                        <span className="text-xs">{emoji}</span>
                        {count > 0 && <span className="text-[9px] font-mono font-bold" style={{ color: myReact ? cfg.color : 'var(--habit-dim)' }}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}
        {events.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-10 flex flex-col items-center gap-3"
          >
            <span className="text-4xl">🌑</span>
            <div className="text-center">
              <div className="text-[12px] font-mono font-bold" style={{ color: 'var(--habit-dim)' }}>{t('partyTab.noActivity')}</div>
              <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--habit-dim)', opacity: 0.6 }}>{t('partyTab.completeTaskFeed')}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Leaderboard View ──────────────────────────────────────────────────────────
function PartyLeaderboardView() {
  const { t } = useTranslation();
  const { profile } = useDjangoAuth();
  const currentUsername = profile?.username;

  const { data, isLoading } = useQuery({
    queryKey: ['party', 'leaderboard'],
    queryFn: () => djangoApi.party.leaderboard(),
    refetchInterval: 30_000
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--habit-panel)' }} />
        ))}
      </div>
    );
  }

  const leaderboard = data?.leaderboard || [];
  const totalXP = leaderboard.reduce((s, m) => s + (m.weekly_xp || 0), 1);

  const MEDALS = ['🥇', '🥈', '🥉'];
  const MEDAL_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">{t('partyTab.weeklyRank')}</span>
        <span className="text-[10px] font-mono text-white/30">{t('partyTab.resetsMonday')}</span>
      </div>
      <AnimatePresence>
        {leaderboard.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 flex flex-col items-center gap-3">
            <span className="text-4xl">📊</span>
            <div className="text-center">
              <div className="text-[12px] font-mono font-bold" style={{ color: 'var(--habit-dim)' }}>{t('partyTab.noXpYet')}</div>
              <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--habit-dim)', opacity: 0.6 }}>{t('partyTab.completeToClimb')}</div>
            </div>
          </motion.div>
        )}
        {leaderboard.map((mem, i) => {
          const isMe = mem.user_id === profile?.user_id || mem.raw_username === currentUsername || mem.username === currentUsername;
          const pct = Math.min(100, ((mem.weekly_xp || 0) / totalXP) * 100);
          const medal = MEDALS[i];
          const medalColor = MEDAL_COLORS[i] || 'var(--habit-dim)';
          return (
            <motion.div
              key={mem.username}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl space-y-2"
              style={{
                background: isMe
                  ? 'rgba(123, 97, 255, 0.12)'
                  : i === 0 ? 'rgba(255, 215, 0, 0.07)'
                    : 'var(--habit-panel)',
                border: isMe
                  ? '1px solid rgba(123, 97, 255, 0.5)'
                  : i === 0 ? '1px solid rgba(255, 215, 0, 0.25)'
                    : '1px solid var(--habit-border)',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Medal / rank number */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: i < 3 ? `${medalColor}22` : 'var(--habit-border)' }}>
                  {medal
                    ? <span className="text-base">{medal}</span>
                    : <span className="font-mono font-black text-xs" style={{ color: 'var(--habit-dim)' }}>#{i + 1}</span>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm truncate" style={{ color: isMe ? 'var(--habit-purple)' : 'var(--habit-text)' }}>
                      {mem.username}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--habit-purple)', color: 'white' }}>YOU</span>
                    )}
                    <span className="text-[9px] font-mono" style={{ color: 'var(--habit-dim)' }}>Lv.{mem.level}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--habit-border)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{
                        background: isMe ? 'var(--habit-purple)' : i === 0 ? '#ffd700' : '#00cc88',
                        boxShadow: isMe ? '0 0 6px var(--habit-purple)' : 'none',
                      }}
                    />
                  </div>
                </div>

                {/* XP value */}
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-sm" style={{ color: i === 0 ? '#ffd700' : isMe ? 'var(--habit-purple)' : 'var(--habit-text)' }}>
                    {(mem.weekly_xp || 0).toLocaleString()}
                  </div>
                  <div className="text-[8px] font-mono" style={{ color: 'var(--habit-dim)' }}>{t('partyTab.xpThisWeek')}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Has-Party State ──────────────────────────────────────────────────────────

function PartyView({ party }) {
  const queryClient = useQueryClient();
  const { profile } = useDjangoAuth();
  const [activeTab, setActiveTab] = useState('members');
  const [leaveError, setLeaveError] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  const leaveMutation = useMutation({
    mutationFn: () => djangoApi.party.leave(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['party', 'members'] }),
    onError: (/** @type {any} */ err) => setLeaveError(err?.data?.error || err?.message || 'Failed to leave party.'),
  });

  const kickMutation = useMutation({
    mutationFn: (userId) => djangoApi.party.kick(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      queryClient.invalidateQueries({ queryKey: ['party', 'feed'] });
    },
    onError: (/** @type {any} */ err) => {
      alert(err?.data?.error || err?.message || 'Failed to kick member.');
    }
  });

  const buffMutation = useMutation({
    mutationFn: (/** @type {{username: string, code: string}} */ { username, code }) => djangoApi.party.buff(username, code),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['party', 'feed'] });
    }
  });

  const handleLeave = () => {
    if (!confirm('Leave this party? You will need the invite code to rejoin.')) return;
    setLeaveError('');
    leaveMutation.mutate();
  };

  const currentUsername = profile?.username;
  const isCurrentUserOwner = party.created_by_username === currentUsername;

  return (
    <div className="space-y-4">
      {/* Party header */}
      <div
        className="px-4 py-3 rounded-xl flex items-center justify-between"
        style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--habit-purple)' }} />
          <span className="font-mono font-black text-sm" style={{ color: 'var(--habit-text)' }}>
            {party.name}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--habit-border)', color: 'var(--habit-dim)' }}
          >
            {party.member_count}/8
          </span>
          {party.streak > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b40' }}
            >
              🔥 {party.streak}d
            </span>
          )}
        </div>
        <button
          onClick={handleLeave}
          disabled={leaveMutation.isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid #ef444440',
            color: '#ef4444',
            opacity: leaveMutation.isPending ? 0.5 : 1,
          }}
        >
          <LogOut className="w-3 h-3" />
          {leaveMutation.isPending ? 'Leaving…' : 'Leave'}
        </button>
      </div>

      {leaveError && (
        <div className="px-3 py-2 rounded-xl text-xs font-mono" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444', color: '#ef4444' }}>
          {leaveError}
        </div>
      )}

      {/* Sub-tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: "var(--habit-border)" }} onPointerDown={(e) => e.stopPropagation()}>
        {[
          { id: "members", label: "MEMBERS" },
          { id: "feed", label: "FEED" },
          { id: "leaderboard", label: "RANKING" },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex-1 px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
              style={{
                fontFamily: "'Nunito'",
                fontWeight: isActive ? 800 : 600,
                fontSize: 11,
                background: isActive ? "var(--habit-purple)" : "transparent",
                color: isActive ? "var(--habit-sidebar-active-text)" : "var(--habit-dim)",
                boxShadow: isActive ? "0 2px 8px var(--habit-purple-glow)" : "none",
                letterSpacing: "0.08em",
              }}
            >
              {t.id === 'members' && <Users className="w-3 h-3" />}
              {t.id === 'feed' && <MessageSquare className="w-3 h-3" />}
              {t.id === 'leaderboard' && <Crown className="w-3 h-3" />}
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'members' && (
          <motion.div key="members" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <InviteCodeDisplay code={party.invite_code} />
            <div className="mt-4 space-y-2">
              {(party.members || []).map((member) => (
                <MemberCard
                  key={member.username}
                  member={member}
                  isOwner={member.role === 'OWNER'}
                  showKick={isCurrentUserOwner && member.username !== currentUsername}
                  onKick={() => kickMutation.mutate(member.user_id)}
                  onBuff={(code) => buffMutation.mutate({ username: member.username, code })}
                  onClick={() => setSelectedMember(member)}
                />
              ))}
            </div>
          </motion.div>
        )}
        {activeTab === 'feed' && (
          <motion.div key="feed" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <PartyFeedView party={party} />
          </motion.div>
        )}
        {activeTab === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <PartyLeaderboardView />
          </motion.div>
        )}
      </AnimatePresence>

      <PartyMemberProfileSheet
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        userId={selectedMember?.user_id}
        memberName={selectedMember?.username}
      />
    </div>
  );
}

export default function PartyTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['party', 'members'],
    queryFn: () => djangoApi.party.members(),
    // Poll every 20s, only while the tab is in the foreground
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center text-[11px] font-mono" style={{ color: 'var(--habit-dim)' }}>{t('partyTab.loading')}</div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-[11px] font-mono" style={{ color: '#ef4444' }}>{t('partyTab.error')}</div>
    );
  }

  const party = data?.party !== undefined ? data.party : data;
  const hasParty = party && party.invite_code;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5" style={{ color: 'var(--habit-purple)' }} />
        <span
          className="text-[11px] font-mono font-bold uppercase tracking-widest"
          style={{ color: 'var(--habit-dim)' }}
        >{t('partyTab.header')}</span>
      </div>

      <AnimatePresence mode="wait">
        {hasParty ? (
          <motion.div key="has-party" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PartyView party={party} />
          </motion.div>
        ) : (
          <motion.div key="no-party" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NoPartyView onCreated={undefined} onJoined={undefined} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
