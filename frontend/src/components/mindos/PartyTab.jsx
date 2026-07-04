import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { djangoApi } from '@/api/djangoClient';
import { getRankDisplayData } from '@/lib/rankEngine';
import { Copy, Check, Users, LogOut, UserPlus, Swords } from 'lucide-react';

// ─── Member Card ─────────────────────────────────────────────────────────────

function MemberCard({ member }) {
  const rank = getRankDisplayData(member.rank_info?.current_id || 'F', member);
  const hpPct = member.max_hp > 0 ? Math.min((member.hp / member.max_hp) * 100, 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl flex items-center gap-3"
      style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
    >
      {/* Rank badge */}
      <div
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-mono font-black text-sm"
        style={{
          background: `${rank.color}22`,
          border: `2px solid ${rank.color}66`,
          color: rank.color,
        }}
      >
        {rank.id}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-mono font-bold text-sm truncate"
            style={{ color: 'var(--habit-text)' }}
          >
            {member.username}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
            style={{ background: 'var(--habit-border)', color: 'var(--habit-dim)' }}
          >
            Lv.{member.level}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono" style={{ color: 'var(--habit-dim)' }}>
            {member.character_class}
          </span>
          <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>
            🔥 {member.streak}d
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
          {member.rank_xp.toFixed(0)}
        </div>
        <div className="text-[9px] font-mono" style={{ color: 'var(--habit-dim)' }}>
          Rank XP
        </div>
      </div>
    </motion.div>
  );
}

// ─── Invite Code Display ──────────────────────────────────────────────────────

function InviteCodeDisplay({ code }) {
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
        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--habit-dim)' }}>
          Party Invite Code
        </div>
        <div
          className="font-mono font-black text-2xl tracking-[0.3em]"
          style={{ color: 'var(--habit-purple)', letterSpacing: '0.3em' }}
        >
          {code}
        </div>
        <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--habit-dim)' }}>
          Share this with friends to join your party
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: copied ? '#00cc8822' : 'var(--habit-border)',
          border: `1px solid ${copied ? '#00cc88' : 'var(--habit-border)'}`,
          color: copied ? '#00cc88' : 'var(--habit-dim)',
        }}
        title="Copy invite code"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── No-Party State ───────────────────────────────────────────────────────────

function NoPartyView({ onCreated, onJoined }) {
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
    onError: (err) => setError(err?.data?.error || err?.message || 'Failed to create party.'),
  });

  const joinMutation = useMutation({
    mutationFn: () => djangoApi.party.join(joinCode.trim().toUpperCase()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      onJoined?.();
    },
    onError: (err) => setError(err?.data?.error || err?.message || 'Failed to join party.'),
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
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--habit-text)' }}>
            Create Party
          </span>
        </div>
        <input
          style={inputStyle}
          placeholder="Party name…"
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
          {createMutation.isPending ? 'Creating…' : 'Create Party'}
        </button>
      </div>

      <div
        className="p-4 rounded-xl space-y-2"
        style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-3.5 h-3.5" style={{ color: '#00e5ff' }} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--habit-text)' }}>
            Join Party
          </span>
        </div>
        <input
          style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}
          placeholder="INVITE CODE"
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
          {joinMutation.isPending ? 'Joining…' : 'Join with Code'}
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

function PartyView({ party }) {
  const queryClient = useQueryClient();
  const [leaveError, setLeaveError] = useState('');

  const leaveMutation = useMutation({
    mutationFn: () => djangoApi.party.leave(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['party', 'members'] }),
    onError: (err) => setLeaveError(err?.data?.error || err?.message || 'Failed to leave party.'),
  });

  const handleLeave = () => {
    if (!confirm('Leave this party? You will need the invite code to rejoin.')) return;
    setLeaveError('');
    leaveMutation.mutate();
  };

  return (
    <div className="space-y-3">
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

      {/* Invite code */}
      <InviteCodeDisplay code={party.invite_code} />

      {/* Members */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--habit-dim)' }}>
          Party Members — {party.member_count}
        </div>
        <div className="space-y-2">
          <AnimatePresence>
            {(party.members || []).map((member) => (
              <MemberCard key={member.username} member={member} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Main PartyTab ────────────────────────────────────────────────────────────

export default function PartyTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['party', 'members'],
    queryFn: () => djangoApi.party.members(),
    // Poll every 20s, only while the tab is in the foreground
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center text-[11px] font-mono" style={{ color: 'var(--habit-dim)' }}>
        Loading party…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-[11px] font-mono" style={{ color: '#ef4444' }}>
        Failed to load party data.
      </div>
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
        >
          PARTY — Study Together
        </span>
      </div>

      <AnimatePresence mode="wait">
        {hasParty ? (
          <motion.div key="has-party" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PartyView party={party} />
          </motion.div>
        ) : (
          <motion.div key="no-party" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NoPartyView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
