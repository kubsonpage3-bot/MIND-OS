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
  const { profile } = useDjangoAuth();
  const rank = getRankDisplayData(member.rank_info?.current_id || 'F', member);
  const hpPct = member.max_hp > 0 ? Math.min((member.hp / member.max_hp) * 100, 100) : 0;
  const maxMp = member.max_mana || member.mana_max || 100;
  const mpPct = maxMp > 0 ? Math.min(((member.mana ?? 0) / maxMp) * 100, 100) : 0;
  const [showBuffs, setShowBuffs] = useState(false);

  const myMana = profile?.mana ?? 0;
  const myMaxMana = profile?.max_mana || profile?.mana_max || 100;

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
    { code: 'heal_1',        icon: '🩸', label: 'Heal +15 HP',    desc: 'Restores 15 HP to this ally', manaCost: 20, color: '#f87171', bg: 'rgba(127,29,29,0.5)', border: 'rgba(239,68,68,0.4)' },
    { code: 'mana_surge',    icon: '🔮', label: '+20 Mana',       desc: 'Transfers 20 Mana points to ally', manaCost: 25, color: '#c084fc', bg: 'rgba(88,28,135,0.5)', border: 'rgba(192,132,252,0.4)' },
    { code: 'gold_boost_12h',icon: '🪙', label: '+20% Gold (12h)', desc: 'Boosts gold drops by 20% for 12h', manaCost: 35, color: '#fb923c', bg: 'rgba(120,53,15,0.5)', border: 'rgba(251,146,60,0.4)' },
    { code: 'heal_2',        icon: '💖', label: 'Heal +30 HP',    desc: 'Restores 30 HP to this ally', manaCost: 40, color: '#f472b6', bg: 'rgba(131,24,67,0.5)', border: 'rgba(244,114,182,0.4)' },
    { code: 'xp_boost_24h',  icon: '⚡', label: '+25% XP (24h)', desc: 'Boosts XP gain by 25% for 24h', manaCost: 50, color: '#facc15', bg: 'rgba(120,53,15,0.5)', border: 'rgba(234,179,8,0.4)' },
    { code: 'streak_shield', icon: '🛡️', label: 'Streak Shield',  desc: 'Protects their streak for 1 day', manaCost: 60, color: '#60a5fa', bg: 'rgba(30,58,138,0.5)', border: 'rgba(96,165,250,0.4)' },
  ];

  const buffCooldownH = member.buff_cooldown_hours || 0;
  const buffReady = buffCooldownH === 0;
  const [buffFloat, setBuffFloat] = useState(null); // floating +BUFF text

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
            <div className="flex items-center gap-1.5 relative">
              {/* Floating buff animation */}
              <AnimatePresence>
                {buffFloat && (
                  <motion.div
                    key={buffFloat}
                    initial={{ opacity: 1, y: 0, scale: 1 }}
                    animate={{ opacity: 0, y: -32, scale: 1.2 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute -top-2 right-8 text-[11px] font-pixel font-bold text-amber-300 pointer-events-none z-10 whitespace-nowrap"
                    style={{ textShadow: '0 0 10px rgba(251,191,36,0.8)' }}
                  >
                    {buffFloat}
                  </motion.div>
                )}
              </AnimatePresence>

              {onBuff && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (buffReady) setShowBuffs(!showBuffs); }}
                  className="px-2.5 py-1 rounded-lg transition-all border flex items-center gap-1.5 text-[10px] font-pixel relative overflow-hidden"
                  style={{
                    background: buffReady
                      ? showBuffs ? 'rgba(234,179,8,0.25)' : 'rgba(234,179,8,0.12)'
                      : 'rgba(0,0,0,0.4)',
                    borderColor: buffReady ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.08)',
                    color: buffReady ? '#fbbf24' : '#6b7280',
                    boxShadow: buffReady ? '0 0 10px rgba(234,179,8,0.25)' : 'none',
                  }}
                  title={buffReady ? 'Bless this ally' : `Cooldown: ${buffCooldownH}h remaining`}
                >
                  <Zap className={`w-3 h-3 ${buffReady ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}`}
                    style={buffReady ? { animation: 'pulse 2s infinite' } : {}}
                  />
                  {buffReady
                    ? <span>{showBuffs ? 'CLOSE ✕' : '⚡ BLESS'}</span>
                    : <span>⏳ {buffCooldownH}h</span>
                  }
                </button>
              )}
              {showKick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${member.username} from the warband?`)) { onKick(); }
                  }}
                  className="p-1.5 rounded-lg transition-all bg-red-950/40 border border-red-500/30 hover:bg-red-900/60 text-red-400 shrink-0"
                  title="Remove from warband"
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

          {/* Dark Fantasy HP & MP Bars */}
          <div className="mt-2 space-y-1.5">
            {/* Segmented HP Bar */}
            <div className="space-y-0.5">
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

            {/* Segmented MP Bar */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[8px] font-pixel">
                <span className="text-cyan-400 flex items-center gap-1">
                  💧 MP
                </span>
                <span className="text-cyan-300/80">
                  {member.mana ?? 0} / {maxMp}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-sm bg-black/80 border border-blue-950/80 p-[1px] overflow-hidden">
                <motion.div
                  className="h-full rounded-[1px]"
                  initial={{ width: 0 }}
                  animate={{ width: `${mpPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)',
                    boxShadow: '0 0 6px rgba(56,189,248,0.5)',
                  }}
                />
              </div>
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

      {/* Buff Altar with Mana System */}
      <AnimatePresence>
        {showBuffs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 pt-3 border-t space-y-2.5"
              style={{ borderColor: 'rgba(234,179,8,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-[9px] font-pixel text-amber-300/80 uppercase tracking-widest">
                <span className="flex items-center gap-1">
                  <span>🕯️</span>
                  <span>Choose blessing</span>
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/70 border border-blue-500/40 text-cyan-300 font-bold shadow-[0_0_8px_rgba(56,189,248,0.25)]">
                  💧 MANA: {myMana} / {myMaxMana} MP
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BUFF_DEFS.map(b => {
                  const canAfford = myMana >= b.manaCost;
                  return (
                    <motion.button
                      key={b.code}
                      whileHover={canAfford ? { scale: 1.02 } : {}}
                      whileTap={canAfford ? { scale: 0.97 } : {}}
                      disabled={!canAfford}
                      onClick={() => {
                        if (!canAfford) {
                          toast.error(`Not enough Mana! Need ${b.manaCost} MP (you have ${myMana} MP).`);
                          return;
                        }
                        onBuff(b.code);
                        setShowBuffs(false);
                        setBuffFloat(`🔮 -${b.manaCost} MP ✦ Blessed!`);
                        setTimeout(() => setBuffFloat(null), 1200);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl border text-left transition-all relative overflow-hidden"
                      style={{
                        background: canAfford ? b.bg : 'rgba(10,5,15,0.6)',
                        borderColor: canAfford ? b.border : 'rgba(255,255,255,0.06)',
                        color: canAfford ? b.color : '#6b7280',
                        opacity: canAfford ? 1 : 0.45,
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                      }}
                      title={canAfford ? b.desc : `Requires ${b.manaCost} MP (You have ${myMana} MP)`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{b.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[10px] font-pixel font-bold leading-none">{b.label}</div>
                          <div className="text-[8px] font-mono text-slate-400 mt-0.5 leading-tight truncate">{b.desc}</div>
                        </div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-pixel font-bold shrink-0 border ${
                        canAfford
                          ? 'bg-blue-950/80 border-cyan-500/40 text-cyan-300 shadow-[0_0_6px_rgba(56,189,248,0.3)]'
                          : 'bg-red-950/50 border-red-500/30 text-red-400'
                      }`}>
                        💧 {b.manaCost} MP
                      </span>
                    </motion.button>
                  );
                })}
              </div>
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
          <span className="text-red-500 text-base">⚔️</span>
          <span className="text-[11px] font-pixel text-red-400 uppercase tracking-widest">
            Party Quest
          </span>
        </div>
        {quest.is_completed ? (
          <span className="text-[10px] font-pixel font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/50 shadow-[0_0_10px_rgba(251,191,36,0.4)]">
            ✓ Completed!
          </span>
        ) : (
          <span className={`text-[10px] font-pixel px-2 py-0.5 rounded border flex items-center gap-1 ${
            daysLeft <= 2
              ? 'text-red-400 bg-red-950/60 border-red-500/40'
              : 'text-amber-400 bg-black/60 border-amber-500/30'
          }`}>
            ⏳ {daysLeft}d left
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
        <div className="text-[9px] font-pixel uppercase tracking-widest text-purple-300/60 mb-1 flex items-center gap-1">
          <span>🔑</span> <span>Invite Code</span>
        </div>
        <div
          className="font-pixel font-black text-2xl tracking-[0.3em] text-purple-400"
          style={{ textShadow: '0 0 12px rgba(168,85,247,0.6)' }}
        >
          {code}
        </div>
        <div className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">
          Share this with friends to invite them.
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
        <span>{copied ? 'Copied ✓' : 'Copy'}</span>
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
      <div
        className="flex items-center gap-2 p-2.5 rounded-xl"
        style={{
          background: 'rgba(12,6,18,0.95)',
          border: '1.5px solid rgba(147,51,234,0.2)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        <input
          ref={chatInputRef}
          value={chatMsg}
          onChange={e => setChatMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
          placeholder="Write to your warband..."
          maxLength={200}
          className="flex-1 bg-transparent outline-none text-[11px] font-mono"
          style={{ color: '#e2e8f0' }}
        />
        <span className="text-[8px] font-mono text-slate-600">
          {chatMsg.length}/200
        </span>
        <button
          onClick={handleSendChat}
          disabled={!chatMsg.trim() || chatMutation.isPending}
          className="p-1.5 rounded-lg transition-all"
          style={{
            background: chatMsg.trim() ? 'rgba(147,51,234,0.7)' : 'rgba(30,20,40,0.8)',
            border: `1px solid ${chatMsg.trim() ? 'rgba(168,85,247,0.5)' : 'rgba(147,51,234,0.1)'}`,
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
                background: isChat
                  ? 'rgba(18,10,28,0.6)'
                  : 'rgba(14,8,22,0.95)',
                border: isChat
                  ? '1px solid rgba(147,51,234,0.15)'
                  : `1px solid ${cfg.color}30`,
              }}
            >
              {/* Colored left accent bar (non-chat only) */}
              {!isChat && <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${cfg.color}, transparent)` }} />}

              {isChat ? (
                // ─── Chat bubble ─────────────────────────────────────────────
                <div className="flex items-start gap-2 px-2.5 py-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-pixel font-black text-white"
                    style={{ background: 'rgba(147,51,234,0.6)', border: '1px solid rgba(168,85,247,0.4)' }}
                  >
                    {(event.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-pixel font-bold" style={{ color: '#c084fc' }}>
                        {event.username}
                      </span>
                      <span className="text-[8px] font-mono text-slate-600">
                        {relativeTime(event.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono mt-0.5 text-slate-300">
                      {event.content}
                    </div>
                  </div>
                </div>
              ) : (
                // ─── Regular feed event ──────────────────────────────────────
                <div className="px-3 pt-2.5 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{cfg.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-pixel font-bold text-xs text-slate-200">
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
            className="py-12 flex flex-col items-center gap-3"
          >
            <span className="text-4xl opacity-60">🕯️</span>
            <div className="text-center">
              <div className="text-[12px] font-pixel text-slate-500">The warband is quiet...</div>
              <div className="text-[10px] font-mono mt-1 text-slate-600">Complete tasks or send a message to fill the log.</div>
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
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[10px] font-pixel uppercase tracking-widest text-slate-500">Weekly Rankings</span>
        <span className="text-[9px] font-mono text-slate-600">Resets Monday</span>
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
              className="p-3 rounded-xl"
              style={{
                background: isMe
                  ? 'rgba(147,51,234,0.1)'
                  : i === 0
                    ? 'rgba(255,215,0,0.06)'
                    : 'rgba(14,8,20,0.9)',
                border: isMe
                  ? '1.5px solid rgba(168,85,247,0.45)'
                  : i === 0
                    ? '1.5px solid rgba(255,215,0,0.22)'
                    : '1px solid rgba(255,255,255,0.05)',
                boxShadow: i === 0 ? '0 4px 18px rgba(255,215,0,0.08)' : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Rank slot */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-pixel font-black text-sm"
                  style={{
                    background: i < 3 ? `${medalColor}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${i < 3 ? `${medalColor}40` : 'rgba(255,255,255,0.06)'}`,
                    color: medalColor,
                  }}
                >
                  {i === 0 ? '⚔' : i === 1 ? 'II' : i === 2 ? 'III' : `#${i + 1}`}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-pixel font-bold text-sm truncate" style={{ color: isMe ? '#c084fc' : '#e2e8f0' }}>
                      {mem.username}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-pixel font-bold px-1.5 py-0.5 rounded bg-purple-600/60 border border-purple-400/40 text-purple-200">YOU</span>
                    )}
                    <span className="text-[9px] font-mono text-slate-500">Lv.{mem.level}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{
                        background: isMe
                          ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                          : i === 0
                            ? 'linear-gradient(90deg, #b45309, #fbbf24)'
                            : 'linear-gradient(90deg, #065f46, #34d399)',
                        boxShadow: isMe ? '0 0 6px rgba(168,85,247,0.5)' : i === 0 ? '0 0 6px rgba(251,191,36,0.4)' : 'none',
                      }}
                    />
                  </div>
                </div>

                {/* XP value */}
                <div className="text-right shrink-0">
                  <div className="font-pixel font-black text-sm" style={{ color: i === 0 ? '#fbbf24' : isMe ? '#c084fc' : '#94a3b8' }}>
                    {(mem.weekly_xp || 0).toLocaleString()}
                  </div>
                  <div className="text-[8px] font-mono text-slate-600">XP this week</div>
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
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
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
          <div className="flex items-center gap-2 text-red-400/70">
            <span>⚔</span>
            <span className="tracking-widest">Warband</span>
          </div>
          {/* Member slots indicator */}
          <div className="flex items-center gap-1 text-[11px]" title={`${party.member_count} of ${memberCap} members`}>
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
                {party.member_count}/{memberCap} members
              </span>
              {party.streak > 0 && (
                <span className="text-[10px] font-pixel px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                  🔥 {party.streak}d streak
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
              { icon: '⚡', label: 'Weekly XP', value: (party.party_stats.total_weekly_xp || 0).toLocaleString(), color: '#facc15' },
              { icon: '🔥', label: 'Avg. Streak', value: `${party.party_stats.avg_streak || 0}d`, color: '#f97316' },
              { icon: '⚔️', label: 'Tasks Done', value: (party.party_stats.total_tasks_completed || 0).toLocaleString(), color: '#f87171' },
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
            <div className="text-[9px] font-pixel uppercase tracking-widest text-amber-300/70 mb-2 flex items-center gap-1">
              <span>🏅</span> <span>Achievements</span>
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
          { id: "members", label: "Members" },
          { id: "feed", label: "Activity" },
          { id: "leaderboard", label: "Rankings" },
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
