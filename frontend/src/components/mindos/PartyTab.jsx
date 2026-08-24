import { useTranslation } from 'react-i18next';
import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { djangoApi, getMediaUrl } from '@/api/djangoClient';
import { getRankDisplayData } from '@/lib/rankEngine';
import { Copy, Check, Users, LogOut, UserPlus, Swords, Settings, Send } from 'lucide-react';
import { Crown, MessageSquare, Zap } from 'lucide-react';
import PartyMemberProfileSheet from './PartyMemberProfileSheet';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { CLASSES, CLASS_SPRITES } from '@/constants/rpgData';
import { toast } from 'react-hot-toast';

// ─── Member Card (Dark Fantasy Champion Slab) ───────────────────────────────

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
  const { t } = useTranslation();
  const rank = getRankDisplayData(member.rank_info?.current_id || 'F', member);
  const hpPct = member.max_hp > 0 ? Math.min((member.hp / member.max_hp) * 100, 100) : 0;
  const [showBuffs, setShowBuffs] = useState(false);

  const charClass = member.character_class?.toLowerCase();
  const rankId = member.rank_info?.current_id || 'F';
  const classInfo = CLASSES[charClass] || null;
  const classColor = classInfo?.color || '#a855f7';
  const didDailyToday = member.did_dailies_today === true;

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

  const BUFF_DEFS = [
    { code: 'heal_1',        icon: '🩸', label: 'Blood Mend (+15)',    cls: 'text-red-400 border-red-500/30 bg-red-950/40 hover:border-red-400' },
    { code: 'heal_2',        icon: '💖', label: 'Soul Restore (+30)', cls: 'text-pink-400 border-pink-500/30 bg-pink-950/40 hover:border-pink-400' },
    { code: 'xp_boost_24h',  icon: '⚡', label: 'Arcane Surge (+25%)', cls: 'text-yellow-400 border-yellow-500/30 bg-amber-950/40 hover:border-yellow-400' },
    { code: 'gold_boost_12h',icon: '🪙', label: 'Cursed Spoils (+20%)', cls: 'text-amber-400 border-amber-500/30 bg-amber-950/40 hover:border-amber-400' },
    { code: 'mana_surge',    icon: '🔮', label: 'Void Mana (+20 MP)', cls: 'text-purple-400 border-purple-500/30 bg-purple-950/40 hover:border-purple-400' },
    { code: 'streak_shield', icon: '🛡️', label: 'Iron Aegis (Shield)', cls: 'text-blue-400 border-blue-500/30 bg-blue-950/40 hover:border-blue-400' },
  ];

  const buffCooldownH = member.buff_cooldown_hours || 0;
  const buffReady = buffCooldownH === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`p-3.5 rounded-xl flex flex-col gap-2.5 relative overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: 'linear-gradient(135deg, rgba(22,15,30,0.95) 0%, rgba(10,7,14,0.98) 100%)',
        border: '1.5px solid rgba(147,51,234,0.2)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
      }}
      onClick={onClick}
    >
      {/* Gothic Corner Accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-red-500/40" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-500/40" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-red-500/40" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-red-500/40" />

      <div className="flex items-center gap-3">
        {/* Champion Portrait + Soul Orb */}
        <div className="relative shrink-0">
          <div
            className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center border-2 shadow-lg"
            style={{
              background: 'radial-gradient(circle, rgba(147,51,234,0.2) 0%, rgba(5,3,8,0.9) 100%)',
              borderColor: classColor,
              boxShadow: `0 0 12px ${classColor}33`,
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
              <span className="font-pixel font-black text-sm uppercase text-amber-300">
                {member.username?.charAt(0) || '?'}
              </span>
            )}
          </div>
          {/* Soul status indicator */}
          <span
            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black flex items-center justify-center text-[7px]"
            style={{
              background: didDailyToday ? '#22c55e' : '#ef4444',
              boxShadow: didDailyToday ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
            }}
            title={didDailyToday ? t('party_extra.dailies_done', 'Soul Awake ✓') : t('party_extra.dailies_not_done', 'In Slumber')}
          >
            {didDailyToday ? '✦' : '✖'}
          </span>
        </div>

        {/* Info & Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-pixel font-bold text-sm truncate text-slate-100">
                {member.username}
              </span>
              {isOwner && (
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
              )}
              <span className="text-[10px] font-pixel px-1.5 py-0.5 rounded bg-black/60 text-amber-300/80 border border-amber-500/20 shrink-0">
                Lv.{member.level}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-pixel font-bold border"
                style={{ background: `${rank.color}22`, color: rank.color, borderColor: `${rank.color}66`, boxShadow: `0 0 6px ${rank.color}33` }}
              >
                {rank.id === 'ASC' ? rank.label : rank.id}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onBuff && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (buffReady) setShowBuffs(!showBuffs); }}
                  className="px-2 py-1 rounded-md transition-all border flex items-center gap-1 text-[10px] font-pixel"
                  style={{
                    background: buffReady ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.4)',
                    borderColor: buffReady ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.1)',
                    color: buffReady ? '#fbbf24' : '#6b7280',
                    boxShadow: buffReady ? '0 0 8px rgba(234,179,8,0.3)' : 'none',
                  }}
                  title={buffReady ? 'Bless Champion' : `Blessing cooldown: ${buffCooldownH}h left`}
                >
                  <Zap className={`w-3 h-3 ${buffReady ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-gray-500'}`} />
                  <span>{buffReady ? 'BLESS' : `${buffCooldownH}h`}</span>
                </button>
              )}
              {showKick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('party_extra.kick_confirm', `Banish ${member.username} from the Order?`, { name: member.username }))) {
                      onKick();
                    }
                  }}
                  className="p-1 rounded-md transition-all bg-red-950/40 border border-red-500/40 hover:bg-red-900/60 text-red-400 shrink-0"
                  title={t('party_extra.kick_tooltip', 'Banish Member')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono capitalize text-purple-300 font-semibold">
              {member.character_class}
            </span>
            <span className="text-[10px] font-pixel text-amber-400 flex items-center gap-0.5">
              🔥 {member.streak}d
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/60">
              {member.joined ? new Date(member.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>

          {/* Dark Fantasy Segmented HP Bar */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[9px] font-pixel">
              <span className="text-red-400 flex items-center gap-1">
                ❤️ HP
              </span>
              <span className="text-red-300/80">
                {member.hp} / {member.max_hp}
              </span>
            </div>
            <div className="h-2 w-full rounded-sm bg-black/80 border border-red-950/80 p-[1px] overflow-hidden">
              <motion.div
                className="h-full rounded-[1px]"
                initial={{ width: 0 }}
                animate={{ width: `${hpPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  background: 'linear-gradient(90deg, #7f1d1d 0%, #dc2626 50%, #ef4444 100%)',
                  boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Rank XP */}
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-pixel font-bold" style={{ color: rank.color, textShadow: `0 0 8px ${rank.color}50` }}>
            {Math.floor(member.rank_xp)}
          </div>
          <div className="text-[8px] font-pixel text-muted-foreground/60 uppercase tracking-widest">
            {t('party_extra.rank_xp', 'GLORY XP')}
          </div>
        </div>
      </div>

      {/* Runic Blessing Altar (Buff menu) */}
      <AnimatePresence>
        {showBuffs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-purple-500/20 pt-2.5 mt-1"
          >
            <div className="text-[9px] font-pixel text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span>🕯️</span> <span>ALTAR OF BLESSINGS</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {BUFF_DEFS.map(b => (
                <button
                  key={b.code}
                  onClick={(e) => { e.stopPropagation(); onBuff(b.code); setShowBuffs(false); }}
                  className={`py-2 px-2 text-[9px] font-pixel rounded-lg border flex items-center justify-start gap-2 transition-transform hover:scale-102 ${b.cls}`}
                >
                  <span className="text-base">{b.icon}</span>
                  <span className="truncate">{b.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Achievement Badges (Gothic Medallions) ────────────────────────────────────

const ACHIEVEMENT_META = {
  streak_7:      { icon: '🔥', label: '7-Day Embers' },
  streak_30:     { icon: '🏆', label: '30-Day Pyre' },
  streak_100:    { icon: '💀', label: '100-Day Immortal' },
  full_house:    { icon: '👑', label: 'Grand Coven' },
  first_quest:   { icon: '🩸', label: 'First Blood' },
  quest_master:  { icon: '🎯', label: 'Abyssal Slayer' },
  buff_master:   { icon: '🕯️', label: 'High Priest' },
  all_streaks:   { icon: '🔗', label: 'Soulbound' },
  quest_streak_3:{ icon: '⚡', label: 'Wrath III' },
  top_scorer:    { icon: '🌟', label: 'Exalted Paragon' },
};

function PartyAchievementBadges({ achievements }) {
  if (!achievements || achievements.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {achievements.map(a => {
        const meta = ACHIEVEMENT_META[a.code] || { icon: '🏅', label: a.code };
        return (
          <motion.div
            key={a.code}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            title={`${meta.label} — ${new Date(a.unlocked_at).toLocaleDateString()}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-pixel cursor-help border"
            style={{
              background: 'linear-gradient(135deg, rgba(30,15,40,0.8) 0%, rgba(10,5,15,0.95) 100%)',
              borderColor: 'rgba(234,179,8,0.3)',
              color: '#fde047',
              boxShadow: '0 0 8px rgba(234,179,8,0.15)',
            }}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Weekly Quest Block (Abyssal Covenant Quest) ──────────────────────────────

function PartyWeeklyQuestBlock({ quest }) {
  if (!quest) return null;

  const pct = quest.target_value > 0
    ? Math.min(100, Math.round((quest.current_value / quest.target_value) * 100))
    : 0;

  const questLabel = (quest.quest_type || '').replace(/_/g, ' ');
  const daysLeft = quest.days_left ?? '?';

  return (
    <div
      className="p-4 rounded-xl space-y-3 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(25,10,30,0.95) 0%, rgba(12,6,18,0.98) 100%)',
        border: '1.5px solid rgba(220,38,38,0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-lg animate-pulse">⚔️</span>
          <span className="text-[11px] font-pixel text-red-400 uppercase tracking-widest">
            COVENANT_CRUSADE // ABYSSAL_RAID
          </span>
        </div>
        {quest.is_completed ? (
          <span className="text-[10px] font-pixel font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/50 shadow-[0_0_10px_rgba(251,191,36,0.4)]">
            👑 VICTORY ACHIEVED!
          </span>
        ) : (
          <span className="text-[10px] font-pixel text-amber-400 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
            <span>⏳</span> {daysLeft}d left
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-pixel">
          <span className="capitalize text-slate-300">
            {questLabel}
          </span>
          <span className="text-amber-400 font-bold">
            {quest.current_value} / {quest.target_value} ({pct}%)
          </span>
        </div>
        
        {/* Boss HP / Raid Progress Bar */}
        <div className="h-3 w-full rounded-sm bg-black/90 border border-red-950 p-[1px] overflow-hidden relative">
          <motion.div
            className="h-full rounded-[1px]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              background: quest.is_completed
                ? 'linear-gradient(90deg, #991b1b 0%, #eab308 50%, #fef08a 100%)'
                : 'linear-gradient(90deg, #7f1d1d 0%, #dc2626 50%, #f59e0b 100%)',
              boxShadow: '0 0 12px rgba(220,38,38,0.6)',
            }}
          />
          {/* Milestone markers */}
          <div className="absolute inset-0 flex justify-between px-[25%] pointer-events-none opacity-40">
            <div className="w-[1px] h-full bg-white/40" />
            <div className="w-[1px] h-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Party Settings Modal ─────────────────────────────────────────────────────

function PartySettingsModal({ party, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(party?.name || '');
  const [description, setDescription] = useState(party?.description || '');
  const [memberCap, setMemberCap] = useState(party?.member_cap || 8);
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => djangoApi.party.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      onClose();
    },
    onError: (err) => setError(err?.data?.error || err?.message || 'Failed to save settings.'),
  });

  const inputStyle = {
    background: 'rgba(10,7,15,0.95)',
    border: '1px solid rgba(147,51,234,0.3)',
    color: '#f3e8ff',
    fontFamily: "'Nunito'",
    fontSize: 13,
    borderRadius: 10,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    resize: 'vertical',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl p-5 space-y-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(20,12,28,0.98) 0%, rgba(8,5,12,0.99) 100%)',
          border: '1.5px solid rgba(147,51,234,0.4)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
          <span className="font-pixel text-sm text-purple-300">⚙️ COVENANT_SETTINGS</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground uppercase tracking-wider block mb-1">Covenant Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} maxLength={64} placeholder="Order name" />
          </div>
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground uppercase tracking-wider block mb-1">Pledge & Lore <span className="normal-case text-[9px]">(140 chars)</span></label>
            <textarea
              style={{ ...inputStyle, minHeight: 60 }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={140}
              placeholder="Inscribe the mission of your brotherhood..."
            />
            <div className="text-right text-[9px] font-mono text-muted-foreground/60">{description.length}/140</div>
          </div>
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground uppercase tracking-wider block mb-1">Max Champions: {memberCap}</label>
            <input
              type="range" min={2} max={8} step={1}
              value={memberCap}
              onChange={e => setMemberCap(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground/60">
              <span>2</span><span>8</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-xs font-mono px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400">{error}</div>
        )}

        <button
          disabled={!name.trim() || updateMutation.isPending}
          onClick={() => updateMutation.mutate({ name: name.trim(), description, member_cap: memberCap })}
          className="w-full py-2.5 rounded-xl font-pixel font-bold text-sm transition-all"
          style={{
            background: 'linear-gradient(90deg, #7c3aed 0%, #9333ea 100%)',
            color: 'white',
            boxShadow: '0 0 14px rgba(147,51,234,0.4)',
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          {updateMutation.isPending ? 'Inscribing...' : 'Save Settings'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Invite Code Display (Blood Seal Summoning Cipher) ─────────────────────────

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
      className="p-3.5 rounded-xl flex items-center justify-between gap-3 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(20,10,28,0.95) 0%, rgba(10,5,15,0.98) 100%)',
        border: '1.5px solid rgba(147,51,234,0.3)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <div>
        <div className="text-[9px] font-pixel uppercase tracking-widest text-purple-300/80 mb-1 flex items-center gap-1">
          <span>📜</span> <span>RUNE_OF_SUMMONING // BLOOD_SEAL</span>
        </div>
        <div
          className="font-pixel font-black text-2xl tracking-[0.3em] text-purple-400"
          style={{ textShadow: '0 0 12px rgba(168,85,247,0.6)' }}
        >
          {code}
        </div>
        <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
          {t('partyTab.inviteDesc', 'Bestow this secret glyph upon allies to summon them to your Order.')}
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-pixel"
        style={{
          background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(147,51,234,0.2)',
          border: `1px solid ${copied ? '#22c55e' : '#a855f7'}`,
          color: copied ? '#4ade80' : '#e9d5ff',
          boxShadow: copied ? '0 0 12px rgba(34,197,94,0.4)' : '0 0 8px rgba(147,51,234,0.2)',
        }}
        title={t('partyTab.copyInvite')}
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        <span>{copied ? 'SEALED ✓' : 'INSCRIBE'}</span>
      </button>
    </div>
  );
}

// ─── No-Party State (Dark Fantasy Summoning Altars) ───────────────────────────

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
    onError: (/** @type {any} */ err) => setError(err?.data?.error || err?.message || 'Failed to forge covenant.'),
  });

  const joinMutation = useMutation({
    mutationFn: () => djangoApi.party.join(joinCode.trim().toUpperCase()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      onJoined?.();
    },
    onError: (/** @type {any} */ err) => setError(err?.data?.error || err?.message || 'Failed to answer summon.'),
  });

  const inputStyle = {
    background: 'rgba(10,5,15,0.95)',
    border: '1.5px solid rgba(147,51,234,0.3)',
    color: '#f3e8ff',
    fontFamily: "'Nunito'",
    fontSize: 13,
    borderRadius: 10,
    padding: '9px 14px',
    width: '100%',
    outline: 'none',
  };

  return (
    <div className="space-y-4">
      {/* Altar 1: Forge a Covenant */}
      <div
        className="p-5 rounded-2xl space-y-3 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(28,12,30,0.95) 0%, rgba(12,6,16,0.98) 100%)',
          border: '1.5px solid rgba(220,38,38,0.35)',
          boxShadow: '0 4px 20px rgba(220,38,38,0.15)',
        }}
      >
        <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
          <Swords className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-xs font-pixel text-red-300 uppercase tracking-widest">
            🩸 FORGE A NEW COVENANT
          </span>
        </div>
        <input
          style={inputStyle}
          placeholder="Name your Order (e.g. Knights of Abyss)..."
          value={createName}
          onChange={(e) => { setCreateName(e.target.value); setError(''); }}
          maxLength={64}
          onKeyDown={(e) => e.key === 'Enter' && createName.trim() && createMutation.mutate()}
        />
        <button
          onClick={() => createMutation.mutate()}
          disabled={!createName.trim() || createMutation.isPending}
          className="w-full py-2.5 rounded-xl font-pixel font-bold text-xs transition-all flex items-center justify-center gap-2"
          style={{
            background: createName.trim() ? 'linear-gradient(90deg, #991b1b 0%, #dc2626 100%)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${createName.trim() ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
            color: createName.trim() ? 'white' : '#6b7280',
            boxShadow: createName.trim() ? '0 0 14px rgba(239,68,68,0.4)' : 'none',
            cursor: createName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {createMutation.isPending ? 'FORGING ORDER...' : '⚔️ FORGE COVENANT'}
        </button>
      </div>

      {/* Altar 2: Join by Summoning Glyph */}
      <div
        className="p-5 rounded-2xl space-y-3 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(20,10,32,0.95) 0%, rgba(8,5,18,0.98) 100%)',
          border: '1.5px solid rgba(168,85,247,0.35)',
          boxShadow: '0 4px 20px rgba(168,85,247,0.15)',
        }}
      >
        <div className="flex items-center gap-2 border-b border-purple-500/20 pb-2">
          <UserPlus className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-pixel text-purple-300 uppercase tracking-widest">
            🗝️ ENTER SUMMONING GLYPH
          </span>
        </div>
        <input
          style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 800 }}
          placeholder="6-DIGIT GLYPH (E.G. P7N197)"
          value={joinCode}
          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
          maxLength={6}
          onKeyDown={(e) => e.key === 'Enter' && joinCode.trim().length === 6 && joinMutation.mutate()}
        />
        <button
          onClick={() => joinMutation.mutate()}
          disabled={joinCode.trim().length !== 6 || joinMutation.isPending}
          className="w-full py-2.5 rounded-xl font-pixel font-bold text-xs transition-all flex items-center justify-center gap-2"
          style={{
            background: joinCode.trim().length === 6 ? 'linear-gradient(90deg, #7c3aed 0%, #9333ea 100%)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${joinCode.trim().length === 6 ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
            color: joinCode.trim().length === 6 ? 'white' : '#6b7280',
            boxShadow: joinCode.trim().length === 6 ? '0 0 14px rgba(168,85,247,0.4)' : 'none',
            cursor: joinCode.trim().length === 6 ? 'pointer' : 'not-allowed',
          }}
        >
          {joinMutation.isPending ? 'ANSWERING SUMMON...' : '🔮 ANSWER SUMMON'}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-3 py-2 rounded-xl text-xs font-pixel bg-red-950/50 border border-red-500/50 text-red-400 text-center"
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
  const [chatMsg, setChatMsg] = useState('');
  const chatInputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['party', 'feed'],
    queryFn: () => djangoApi.party.feed(),
    refetchInterval: 10_000,
  });

  const reactMutation = useMutation({
    mutationFn: (/** @type {{eventId: number, emoji: string}} */ { eventId, emoji }) => djangoApi.party.react(eventId, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['party', 'feed'] })
  });

  const chatMutation = useMutation({
    mutationFn: (msg) => djangoApi.party.chat(msg),
    onSuccess: () => {
      setChatMsg('');
      queryClient.invalidateQueries({ queryKey: ['party', 'feed'] });
    },
    onError: (err) => toast.error(err?.data?.error || 'Failed to send message'),
  });

  const handleSendChat = () => {
    const msg = chatMsg.trim();
    if (!msg || chatMutation.isPending) return;
    chatMutation.mutate(msg);
  };

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
    task:           { icon: '✅', label: 'completed', color: '#00cc88' },
    level_up:       { icon: '🆙', label: 'leveled up to', color: '#f59e0b' },
    rank_up:        { icon: '⭐', label: 'ranked up to', color: '#f0c040' },
    buff_sent:      { icon: '💪', label: 'sent a buff:', color: '#7B61FF' },
    milestone:      { icon: '🏆', label: 'hit a milestone:', color: '#ffd700' },
    chat:           { icon: null, label: null, color: 'var(--habit-purple)' },
    default:        { icon: '⚡', label: 'did something:', color: 'var(--habit-dim)' },
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
      {/* Chat Input */}
      <div className="flex items-center gap-2 p-2 rounded-xl"
        style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}
      >
        <input
          ref={chatInputRef}
          value={chatMsg}
          onChange={e => setChatMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
          placeholder="Say something to the party... (Enter to send)"
          maxLength={200}
          className="flex-1 bg-transparent outline-none text-[11px] font-mono"
          style={{ color: 'var(--habit-text)' }}
        />
        <span className="text-[8px] font-mono" style={{ color: 'var(--habit-dim)' }}>
          {chatMsg.length}/200
        </span>
        <button
          onClick={handleSendChat}
          disabled={!chatMsg.trim() || chatMutation.isPending}
          className="p-1.5 rounded-lg transition-all"
          style={{
            background: chatMsg.trim() ? 'var(--habit-purple)' : 'var(--habit-border)',
            opacity: chatMsg.trim() ? 1 : 0.4,
          }}
        >
          <Send className="w-3 h-3 text-white" />
        </button>
      </div>

      <AnimatePresence>
        {events.map(event => {
          const cfg = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.default;
          const isChat = event.event_type === 'chat';
          const isReacted = event.user_reacted;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{
                background: isChat ? 'transparent' : 'var(--habit-panel)',
                border: isChat ? 'none' : '1px solid var(--habit-border)',
              }}
            >
              {/* Colored top accent bar (non-chat only) */}
              {!isChat && <div className="h-0.5 w-full" style={{ background: cfg.color }} />}

              {isChat ? (
                // ─── Chat bubble ─────────────────────────────────────────────
                <div className="flex items-start gap-2 px-1 py-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'var(--habit-purple)', fontSize: 9, color: 'white', fontWeight: 800 }}
                  >
                    {(event.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--habit-purple)' }}>
                        {event.username}
                      </span>
                      <span className="text-[8px] font-mono" style={{ color: 'var(--habit-dim)' }}>
                        {relativeTime(event.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--habit-text)' }}>
                      {event.content}
                    </div>
                  </div>
                </div>
              ) : (
                // ─── Regular feed event ──────────────────────────────────────
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
              )}
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
              <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--habit-dim)', opacity: 0.6 }}>Type a message above or complete tasks to fill the feed!</div>
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['party', 'feed'] });
      queryClient.invalidateQueries({ queryKey: ['party', 'members'] });
      toast.success(`Buff sent to ${variables.username}! 💪`, { duration: 3000 });
    },
    onError: (err) => {
      toast.error(err?.data?.error || 'Failed to send buff');
    }
  });

  const handleLeave = () => {
    if (!confirm('Leave this party? You will need the invite code to rejoin.')) return;
    setLeaveError('');
    leaveMutation.mutate();
  };

  const currentUsername = profile?.username;
  const isCurrentUserOwner = party.created_by_username === currentUsername;
  const memberCap = party.member_cap || 8;

  return (
    <div className="space-y-4">
      {/* Gothic Warband Sanctuary Header */}
      <div
        className="p-5 rounded-2xl space-y-4 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.18) 0%, rgba(12,7,18,0.98) 75%)',
          border: '1.5px solid rgba(220,38,38,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), inset 0 0 20px rgba(0,0,0,0.8)',
        }}
      >
        {/* Gothic Corner Brackets */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-red-500/60" />
        <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-red-500/60" />
        <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-red-500/60" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-red-500/60" />

        <div className="flex items-center justify-between border-b border-red-500/20 pb-2.5 text-[10px] font-pixel">
          <div className="flex items-center gap-2 text-red-400">
            <span className="animate-pulse">⚔️</span>
            <span>ORDER_OF_CRUSADE // WARBAND_SANCTUARY</span>
          </div>
          {/* Soul Crystal Slots Indicator */}
          <div className="flex items-center gap-1 text-[11px]" title={`${party.member_count} of ${memberCap} slots filled`}>
            {Array.from({ length: memberCap }).map((_, i) => (
              <span key={i} className={i < party.member_count ? "text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]" : "text-slate-700"}>
                {i < party.member_count ? "◆" : "◇"}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-pixel font-bold text-xl truncate text-slate-100" style={{ textShadow: '0 0 12px rgba(220,38,38,0.5)' }}>
                {party.name}
              </span>
              <span className="text-[10px] font-pixel px-2 py-0.5 rounded bg-black/60 text-red-300 border border-red-500/30 shrink-0">
                {party.member_count}/{memberCap} CHAMPIONS
              </span>
              {party.streak > 0 && (
                <span className="text-[10px] font-pixel px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                  🔥 {party.streak}d PYRE
                </span>
              )}
            </div>
            {party.description && (
              <p className="text-xs font-mono text-left text-slate-300/80 leading-relaxed italic">
                "{party.description}"
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCurrentUserOwner && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-xl transition-all bg-black/50 border border-purple-500/30 hover:border-purple-400 text-purple-300"
                title="Covenant Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleLeave}
              disabled={leaveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-pixel font-bold transition-all"
              style={{
                background: 'rgba(153,27,27,0.2)',
                border: '1.5px solid rgba(239,68,68,0.4)',
                color: '#f87171',
                boxShadow: '0 0 8px rgba(239,68,68,0.2)',
                opacity: leaveMutation.isPending ? 0.5 : 1,
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              {leaveMutation.isPending ? 'BANISHING…' : 'LEAVE'}
            </button>
          </div>
        </div>

        {/* Warband Telemetry Altar Tiles */}
        {party.party_stats && (
          <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-red-500/20">
            {[
              { icon: '⚡', label: 'ARCANE GLORY', value: (party.party_stats.total_weekly_xp || 0).toLocaleString(), color: '#facc15' },
              { icon: '🔥', label: 'SOUL PYRE', value: `${party.party_stats.avg_streak || 0}d`, color: '#f97316' },
              { icon: '🗡️', label: 'SLAIN QUESTS', value: (party.party_stats.total_tasks_completed || 0).toLocaleString(), color: '#f87171' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/60 border border-white/[0.06] shadow-inner">
                <span className="text-lg">{icon}</span>
                <span className="text-xs font-pixel font-black mt-0.5" style={{ color, textShadow: `0 0 8px ${color}50` }}>{value}</span>
                <span className="text-[8px] font-pixel text-muted-foreground/60 tracking-wider mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Achievements row */}
        {party.achievements && party.achievements.length > 0 && (
          <div className="pt-2.5 border-t border-red-500/20">
            <div className="text-[9px] font-pixel uppercase tracking-widest text-amber-300/80 mb-2 flex items-center gap-1">
              <span>🏅</span> <span>WARBAND_MEDALLIONS</span>
            </div>
            <PartyAchievementBadges achievements={party.achievements} />
          </div>
        )}
      </div>

      {leaveError && (
        <div className="px-3 py-2 rounded-xl text-xs font-pixel bg-red-950/60 border border-red-500/50 text-red-400 text-center">
          {leaveError}
        </div>
      )}

      {/* Sub-tab switcher */}
      <div className="flex gap-1.5 p-1 rounded-2xl overflow-x-auto bg-black/60 border border-red-950/80" onPointerDown={(e) => e.stopPropagation()}>
        {[
          { id: "members", label: "CHAMPIONS" },
          { id: "feed", label: "CHRONICLES" },
          { id: "leaderboard", label: "HALL OF FAME" },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex-1 px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-pixel"
              style={{
                background: isActive ? "linear-gradient(90deg, #7f1d1d 0%, #991b1b 100%)" : "transparent",
                color: isActive ? "#ffffff" : "#9ca3af",
                boxShadow: isActive ? "0 0 12px rgba(220,38,38,0.5)" : "none",
                border: `1px solid ${isActive ? "rgba(239,68,68,0.5)" : "transparent"}`,
              }}
            >
              {t.id === 'members' && <Users className="w-3.5 h-3.5" />}
              {t.id === 'feed' && <MessageSquare className="w-3.5 h-3.5" />}
              {t.id === 'leaderboard' && <Crown className="w-3.5 h-3.5" />}
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'members' && (
          <motion.div key="members" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-3">
            {/* Weekly Quest Block */}
            {party.weekly_quest && (
              <PartyWeeklyQuestBlock quest={party.weekly_quest} />
            )}

            <InviteCodeDisplay code={party.invite_code} />
            <div className="space-y-2">
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

      <AnimatePresence>
        {showSettingsModal && (
          <PartySettingsModal
            party={party}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </AnimatePresence>
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
