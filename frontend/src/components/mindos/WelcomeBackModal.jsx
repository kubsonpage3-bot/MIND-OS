// @ts-nocheck
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// ─── Category glow palette ───────────────────────────────────────────────────
const CATEGORY_COLORS = {
  STEM: '#3b82f6',
  Languages: '#00cc88',
  'Humanities & Arts': '#eab308',
  'Health & Fitness': '#ef4444',
  'Rest & Recovery': '#f97316',
  Mindfulness: '#9944ff',
  'Social & Communication': '#a855f7',
  'Reading & Writing': '#22c55e',
  'Work & Career': '#64748b',
  Other: '#94a3b8',
};

const DIFF_CONFIG = {
  trivial: { color: '#64748b', label: 'TRIVIAL', xp: 3,  gold: 2,  dmg: 1 },
  easy:    { color: '#22c55e', label: 'EASY',    xp: 6,  gold: 3,  dmg: 2 },
  medium:  { color: '#f59e0b', label: 'MEDIUM',  xp: 12, gold: 6,  dmg: 4 },
  hard:    { color: '#ef4444', label: 'HARD',    xp: 24, gold: 12, dmg: 8 },
};

// ─── Runic corner accent ─────────────────────────────────────────────────────
function RunicCorners({ color = 'rgba(148,68,255,0.5)', size = 10 }) {
  const s = { position: 'absolute', width: size, height: size, borderColor: color };
  return (
    <>
      <span style={{ ...s, top: 0, left: 0,  borderTop: '2px solid', borderLeft: '2px solid' }} />
      <span style={{ ...s, top: 0, right: 0, borderTop: '2px solid', borderRight: '2px solid' }} />
      <span style={{ ...s, bottom: 0, left: 0,  borderBottom: '2px solid', borderLeft: '2px solid' }} />
      <span style={{ ...s, bottom: 0, right: 0, borderBottom: '2px solid', borderRight: '2px solid' }} />
    </>
  );
}

// ─── Animated pixel checkmark ────────────────────────────────────────────────
function PixelCheck({ color }) {
  return (
    <motion.svg
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      width="12" height="12" viewBox="0 0 12 12" fill="none"
    >
      <motion.path
        d="M1.5 6.5L4.5 9.5L10.5 2.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28 }}
      />
    </motion.svg>
  );
}

// ─── Single daily quest row ──────────────────────────────────────────────────
function QuestRow({ task, checked, onToggle, index }) {
  const { t } = useTranslation();
  const accentColor = CATEGORY_COLORS[task.category] || '#9944ff';
  const diff = DIFF_CONFIG[task.difficulty?.toLowerCase()] || DIFF_CONFIG.medium;
  const taskXp = task.xp ?? diff.xp;
  const taskGold = task.gold ?? diff.gold;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onToggle(task.id)}
      className="w-full text-left relative"
      style={{
        background: checked
          ? `linear-gradient(135deg, ${accentColor}28, ${accentColor}10)`
          : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${checked ? accentColor + '60' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
        padding: '8px 10px',
        transition: 'all 0.15s ease',
        boxShadow: checked ? `0 0 12px ${accentColor}22` : 'none',
        cursor: 'pointer',
      }}
    >
      <RunicCorners color={checked ? accentColor + '80' : 'rgba(255,255,255,0.12)'} size={8} />

      <div className="flex items-center gap-2.5">
        {/* Pixel Checkbox */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 20, height: 20,
            background: checked ? accentColor : 'transparent',
            border: `2px solid ${checked ? accentColor : 'rgba(255,255,255,0.22)'}`,
            borderRadius: 3,
            boxShadow: checked ? `0 0 8px ${accentColor}60` : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {checked && <PixelCheck color="#fff" />}
        </div>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p
            className="font-pixel text-[11px] leading-tight truncate"
            style={{ color: checked ? '#fff' : 'rgba(255,255,255,0.7)' }}
          >
            {task.title}
          </p>
          {task.streak > 0 && (
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#f59e0b' }}>
              🔥 <span className="font-pixel">{task.streak}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{t('stats_panel.day_streak', 'DAY STREAK')}</span>
            </p>
          )}
        </div>

        {/* Right side: diff badge + est reward */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span
            className="font-pixel text-[9px] px-1.5 py-0.5 tracking-widest uppercase"
            style={{
              color: diff.color,
              background: diff.color + '22',
              border: `1px solid ${diff.color}44`,
              borderRadius: 3,
            }}
          >
            {t(`difficulties.${task.difficulty?.toLowerCase() || 'medium'}`, diff.label)}
          </span>
          {checked && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="font-pixel text-[9px]"
              style={{ color: '#22c55e' }}
            >
              +{taskXp}XP +{taskGold}G
            </motion.span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Animated counter ────────────────────────────────────────────────────────
function CountUp({ target, color, prefix = '+', suffix = '', duration = 1200 }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const steps = 40;
    const stepMs = duration / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVal(Math.round((target * i) / steps));
      if (i >= steps) clearInterval(timer);
    }, stepMs);
    return () => clearInterval(timer);
  }, [target, duration]);

  return (
    <span className="font-pixel text-2xl" style={{ color }}>
      {prefix}{val}{suffix}
    </span>
  );
}

// ─── Results Screen ──────────────────────────────────────────────────────────
function ResultsScreen({ result, onDismiss }) {
  const { t } = useTranslation();
  const { total_xp = 0, total_gold = 0, total_dmg = 0, died = false, log = [] } = result;
  const completedLog = log.filter(l => l.type === 'checkin_done');
  const missedLog    = log.filter(l => l.type === 'checkin_missed');
  const hasSomething = total_xp > 0 || total_gold > 0 || total_dmg > 0;

  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', damping: 22, stiffness: 280 }}
      className="flex flex-col"
    >
      {/* Title */}
      <div className="px-5 pt-5 pb-3 text-center border-b border-white/[0.08]">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.05, damping: 12 }}
          className="text-3xl mb-1.5"
        >
          {died ? '💀' : total_xp > 0 ? '⚔️' : '🌑'}
        </motion.div>
        <h2
          className="font-pixel uppercase tracking-widest"
          style={{ fontSize: 13, color: died ? '#ef4444' : '#c4a3ff', letterSpacing: '0.18em' }}
        >
          {died ? t('welcome_back.fallen_battle', 'FALLEN IN BATTLE') : t('welcome_back.day_resolved', 'DAY RESOLVED')}
        </h2>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {t('welcome_back.judged_desc', "Yesterday's deeds have been judged")}
        </p>
      </div>

      {/* Big stats */}
      <div className="px-5 py-4 flex justify-around">
        {total_xp > 0 && (
          <div className="text-center">
            <CountUp target={total_xp} color="#a78bfa" prefix="+" suffix=" XP" />
            <p className="text-[9px] font-pixel mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('welcome_back.experience', 'EXPERIENCE')}</p>
          </div>
        )}
        {total_gold > 0 && (
          <div className="text-center">
            <CountUp target={total_gold} color="#fbbf24" prefix="+" suffix=" G" duration={1000} />
            <p className="text-[9px] font-pixel mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('welcome_back.gold', 'GOLD')}</p>
          </div>
        )}
        {total_dmg > 0 && (
          <div className="text-center">
            <CountUp target={Math.round(total_dmg)} color="#ef4444" prefix="-" suffix=" HP" duration={900} />
            <p className="text-[9px] font-pixel mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('welcome_back.damage', 'DAMAGE')}</p>
          </div>
        )}
        {!hasSomething && (
          <p className="text-[11px] font-pixel" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('welcome_back.nothing_resolved', 'NOTHING RESOLVED')}</p>
        )}
      </div>

      {/* Log per task */}
      {(completedLog.length > 0 || missedLog.length > 0) && (
        <div
          className="mx-4 mb-4 rounded-lg overflow-y-auto"
          style={{
            maxHeight: 140,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {completedLog.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.05]"
            >
              <span className="font-pixel text-[10px] truncate flex-1 mr-2" style={{ color: '#86efac' }}>
                ✅ {item.title}
              </span>
              <span className="font-pixel text-[10px] shrink-0" style={{ color: '#a78bfa' }}>+{item.xp}xp</span>
              <span className="font-pixel text-[10px] shrink-0 ml-1.5" style={{ color: '#fbbf24' }}>+{item.gold}g</span>
            </div>
          ))}
          {missedLog.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.05]"
            >
              <span className="font-pixel text-[10px] truncate flex-1 mr-2" style={{ color: '#fca5a5' }}>
                ☠️ {item.title}
              </span>
              <span className="font-pixel text-[10px] shrink-0" style={{ color: '#ef4444' }}>
                -{Math.round(item.damage || 0)} HP
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Auto-close progress + dismiss button */}
      <div className="px-4 pb-5 flex flex-col gap-2">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #9944ff, #6622cc)' }}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 4.5, ease: 'linear' }}
          />
        </div>
        <button
          onClick={onDismiss}
          className="w-full py-2.5 font-pixel text-[11px] tracking-widest uppercase relative overflow-hidden cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #9444ff, #6622cc)',
            color: '#fff',
            borderRadius: 6,
            border: '1px solid rgba(148,68,255,0.5)',
            boxShadow: '0 4px 16px rgba(148,68,255,0.35)',
          }}
        >
          {t('welcome_back.enter_new_day', 'ENTER THE NEW DAY ⚔️')}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Checkin Screen ──────────────────────────────────────────────────────────
function CheckinScreen({ dailies, onSubmit, isSubmitting }) {
  const [checked, setChecked] = useState(new Set());
  const { t } = useTranslation();

  const toggleItem = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkedCount = checked.size;
  const missedCount  = dailies.length - checkedCount;

  const estXp = [...checked].reduce((sum, id) => {
    const task = dailies.find((d) => d.id === id);
    if (!task) return sum;
    const diff = DIFF_CONFIG[task?.difficulty?.toLowerCase()] || DIFF_CONFIG.medium;
    return sum + (task.xp ?? diff.xp);
  }, 0);
  const estGold = [...checked].reduce((sum, id) => {
    const task = dailies.find((d) => d.id === id);
    if (!task) return sum;
    const diff = DIFF_CONFIG[task?.difficulty?.toLowerCase()] || DIFF_CONFIG.medium;
    return sum + (task.gold ?? diff.gold);
  }, 0);
  const estDmg = dailies
    .filter((d) => !checked.has(d.id))
    .reduce((sum, d) => {
      const diff = DIFF_CONFIG[d.difficulty?.toLowerCase()] || DIFF_CONFIG.medium;
      return sum + (d.hp_damage ?? diff.dmg);
    }, 0);

  return (
    <motion.div
      key="checkin"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -40 }}
      className="flex flex-col"
    >
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(148,68,255,0.18) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(148,68,255,0.18)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)' }}
        />
        <motion.div
          initial={{ scale: 0, y: -10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', delay: 0.08, damping: 14 }}
          className="text-3xl mb-2"
        >
          🌅
        </motion.div>
        <h2
          className="font-pixel uppercase tracking-widest mb-1"
          style={{ fontSize: 13, color: '#c4a3ff', letterSpacing: '0.18em' }}
        >
          {t('welcome_back.title', 'DAWN REPORT')}
        </h2>
        <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {t('welcome_back.subtitle')}
        </p>
        <div className="flex justify-center mt-2.5">
          <span
            className="font-pixel text-[9px] px-2.5 py-1 tracking-widest uppercase"
            style={{
              background: 'rgba(148,68,255,0.18)',
              border: '1px solid rgba(148,68,255,0.35)',
              borderRadius: 4,
              color: '#a78bfa',
            }}
          >
            {t('welcome_back.quests_pending', { count: dailies.length, defaultValue: `⚔️ ${dailies.length} QUESTS PENDING` })}
          </span>
        </div>
      </div>

      {/* Quest list */}
      <div
        className="px-4 py-3 space-y-2 overflow-y-auto"
        style={{ maxHeight: 240, scrollbarWidth: 'thin', scrollbarColor: 'rgba(148,68,255,0.3) transparent' }}
      >
        {dailies.map((task, i) => (
          <QuestRow
            key={task.id}
            task={task}
            checked={checked.has(task.id)}
            onToggle={toggleItem}
            index={i}
          />
        ))}
      </div>

      {/* Live summary bar */}
      <div
        className="mx-4 mb-3 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[9px]" style={{ color: '#22c55e' }}>✅ {checkedCount}</span>
            {estXp > 0 && <span className="font-pixel text-[9px]" style={{ color: '#a78bfa' }}>+{estXp} XP</span>}
            {estGold > 0 && <span className="font-pixel text-[9px]" style={{ color: '#fbbf24' }}>+{estGold} G</span>}
          </div>
          {missedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-pixel text-[9px]" style={{ color: '#ef4444' }}>☠️ {missedCount}</span>
              <span className="font-pixel text-[9px]" style={{ color: '#ef4444' }}>-{estDmg} HP</span>
            </div>
          )}
        </div>
        {missedCount === 0 && checkedCount === dailies.length && dailies.length > 0 && (
          <p className="font-pixel text-[9px] text-center mt-1" style={{ color: '#22c55e' }}>
            {t('welcome_back.perfect_yesterday', '★ PERFECT YESTERDAY! NO DAMAGE ★')}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-5 flex gap-2">
        <button
          onClick={() => onSubmit([])}
          disabled={isSubmitting}
          className="relative font-pixel text-[10px] px-4 py-2.5 tracking-wide uppercase disabled:opacity-40 cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.45)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
          }}
        >
          <RunicCorners color="rgba(255,255,255,0.12)" size={8} />
          {t('welcome_back.skip')}
        </button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ boxShadow: '0 4px 24px rgba(148,68,255,0.55)' }}
          onClick={() => onSubmit([...checked])}
          disabled={isSubmitting}
          className="relative flex-1 font-pixel text-[11px] py-2.5 tracking-widest uppercase disabled:opacity-40 overflow-hidden cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #9444ff, #6622cc)',
            color: '#fff',
            borderRadius: 6,
            border: '1px solid rgba(148,68,255,0.5)',
            boxShadow: '0 4px 16px rgba(148,68,255,0.35)',
          }}
        >
          <motion.span
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', repeatDelay: 1.5 }}
          />
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
              />
              {t('welcome_back.resolving', 'RESOLVING...')}
            </span>
          ) : (
            t('welcome_back.start_day')
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Main exported modal ─────────────────────────────────────────────────────
export default function WelcomeBackModal({ dailies, onSubmit, isSubmitting }) {
  const [result, setResult] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const handleSubmit = (completedIds) => {
    onSubmit(completedIds, {
      onSuccess: (data) => {
        setResult(data);
      },
    });
  };

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="w-full max-w-[420px] relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #140a28 0%, #0b0618 60%, #0a0512 100%)',
          border: '1.5px solid rgba(148,68,255,0.35)',
          borderRadius: 14,
          boxShadow: [
            '0 30px 70px rgba(0,0,0,0.8)',
            '0 0 0 1px rgba(148,68,255,0.15)',
            'inset 0 1px 0 rgba(255,255,255,0.06)',
            '0 0 60px rgba(148,68,255,0.12)',
          ].join(', '),
        }}
      >
        {/* Gothic corner accents */}
        <span style={{ position:'absolute', top:0,    left:0,  width:18, height:18, borderTop:   '2.5px solid rgba(148,68,255,0.7)', borderLeft:   '2.5px solid rgba(148,68,255,0.7)' }} />
        <span style={{ position:'absolute', top:0,    right:0, width:18, height:18, borderTop:   '2.5px solid rgba(148,68,255,0.7)', borderRight:  '2.5px solid rgba(148,68,255,0.7)' }} />
        <span style={{ position:'absolute', bottom:0, left:0,  width:18, height:18, borderBottom:'2.5px solid rgba(148,68,255,0.7)', borderLeft:   '2.5px solid rgba(148,68,255,0.7)' }} />
        <span style={{ position:'absolute', bottom:0, right:0, width:18, height:18, borderBottom:'2.5px solid rgba(148,68,255,0.7)', borderRight:  '2.5px solid rgba(148,68,255,0.7)' }} />

        {/* Ambient top glow */}
        <div
          className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(148,68,255,0.22) 0%, transparent 70%)' }}
        />

        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 4px)' }}
        />

        <AnimatePresence mode="wait">
          {result ? (
            <ResultsScreen
              key="results"
              result={result}
              onDismiss={() => setDismissed(true)}
            />
          ) : (
            <CheckinScreen
              key="checkin"
              dailies={dailies}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
