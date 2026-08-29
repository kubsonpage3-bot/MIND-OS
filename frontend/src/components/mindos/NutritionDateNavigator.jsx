// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar as CalendarIcon,
  Layers,
  Grid,
  CalendarDays,
  Sparkles,
  Zap,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr, lang = 'en') {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

function formatWeekday(dateStr, lang = 'en') {
  return new Date(dateStr + 'T12:00').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
  }).slice(0, 3);
}

function getMonday(targetDateStr) {
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const dayOfWeek = (target.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const monday = new Date(target);
  monday.setDate(target.getDate() - dayOfWeek);
  return monday;
}

function getWeekDays(targetDateStr, numWeeks = 1) {
  const monday = getMonday(targetDateStr);
  const days = [];
  const totalDays = numWeeks * 7;
  for (let i = 0; i < totalDays; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const str = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    days.push(str);
  }
  return days;
}

function getMonthMatrix(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  return { daysInMonth, startDayOfWeek };
}

// ─── Single Day Pill Component ────────────────────────────────────────────────
function DayPill({ dateStr, isSelected, isToday, entry, onSelect, lang = 'en', goalCalories = 2000 }) {
  const [, , dd] = dateStr.split('-');
  const weekday = formatWeekday(dateStr, lang);
  const cal = entry?.calories || 0;

  let statusColor = 'transparent';
  let badgeText = null;

  if (cal > 0) {
    const ratio = cal / goalCalories;
    if (ratio >= 0.85 && ratio <= 1.15) {
      statusColor = '#10b981'; // Green: on target
    } else if (ratio > 1.15) {
      statusColor = '#f74e52'; // Red: over
    } else {
      statusColor = '#f59e0b'; // Amber: in progress
    }
    badgeText = cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : `${Math.round(cal)}`;
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -1.5 }}
      onClick={() => onSelect(dateStr)}
      className="relative flex flex-col items-center justify-between pt-2 pb-1.5 px-0.5 rounded-xl transition-all select-none overflow-hidden"
      style={{
        background: isSelected
          ? 'transparent'
          : isToday
          ? 'rgba(245, 158, 11, 0.08)'
          : 'var(--habit-border)',
        border: isToday && !isSelected ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid transparent',
        cursor: 'pointer',
        minHeight: 60,
      }}
    >
      {isSelected && (
        <motion.div
          layoutId="active-date-pill"
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.45)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      {/* Weekday abbreviation */}
      <span
        className="relative z-10 text-[9px] font-extrabold uppercase tracking-wider leading-tight"
        style={{ color: isSelected ? '#000' : 'var(--habit-dim, #888)' }}
      >
        {weekday}
      </span>

      {/* Day number */}
      <span
        className="relative z-10 text-[13.5px] font-black leading-none my-0.5"
        style={{ color: isSelected ? '#000' : 'var(--habit-text)' }}
      >
        {parseInt(dd, 10)}
      </span>

      {/* Calorie badge or Status Dot */}
      <div className="relative z-10 flex items-center justify-center min-h-[14px]">
        {badgeText ? (
          <span
            className="text-[8px] font-mono font-black px-1 rounded-full leading-tight"
            style={{
              background: isSelected ? 'rgba(0,0,0,0.22)' : `${statusColor}22`,
              color: isSelected ? '#000' : statusColor,
              border: isSelected ? 'none' : `1px solid ${statusColor}40`,
            }}
          >
            {badgeText}
          </span>
        ) : (
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: isSelected ? 'rgba(0,0,0,0.3)' : 'transparent',
              border: isSelected ? 'none' : '1px solid var(--habit-border)',
            }}
          />
        )}
      </div>
    </motion.button>
  );
}

// ─── Main Component: NutritionDateNavigator ───────────────────────────────────
export default function NutritionDateNavigator({
  selectedDate,
  onSelectDate,
  calendarData = [],
  onOpenCalendar,
  goalCalories = 2000,
}) {
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState('1week'); // '1week' | '2weeks' | 'month'

  const today = todayStr();
  const isToday = selectedDate === today;

  // Calendar map for quick lookup
  const calMap = {};
  (calendarData || []).forEach((d) => {
    calMap[d.date] = d;
  });

  // Week range label (e.g. "Aug 24 – Aug 30")
  const oneWeekDays = getWeekDays(selectedDate, 1);
  const twoWeekDays = getWeekDays(selectedDate, 2);

  const weekRangeLabel = useMemo(() => {
    if (!oneWeekDays.length) return '';
    const [, sm, sd] = oneWeekDays[0].split('-');
    const [, em, ed] = oneWeekDays[6].split('-');
    return `${parseInt(sd, 10)}.${parseInt(sm, 10)} — ${parseInt(ed, 10)}.${parseInt(em, 10)}`;
  }, [oneWeekDays]);

  // Month breakdown for inline month view
  const [currentYear, currentMonth] = selectedDate.split('-').map(Number);
  const { daysInMonth, startDayOfWeek } = getMonthMatrix(currentYear, currentMonth);
  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString(
    i18n.language === 'ru' ? 'ru-RU' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div
      className="rounded-2xl p-3.5 transition-all"
      style={{
        background: 'var(--habit-panel)',
        border: '1px solid var(--habit-border)',
      }}
    >
      {/* ── Top Header Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Left: Navigation Buttons (Previous Day / Week) */}
        <div className="flex items-center gap-1 bg-[var(--habit-border)] p-0.5 rounded-xl">
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => onSelectDate(addDays(selectedDate, -7))}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-60 hover:opacity-100 hover:text-[var(--habit-gold,#f59e0b)]"
            style={{ cursor: 'pointer' }}
            title={t('nutrition.prev_week', '« -7d')}
          >
            <ChevronsLeft size={13} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => onSelectDate(addDays(selectedDate, -1))}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:text-[var(--habit-gold,#f59e0b)]"
            style={{ cursor: 'pointer' }}
            title={t('nutrition.prev_day', '< -1d')}
          >
            <ChevronLeft size={14} />
          </motion.button>
        </div>

        {/* Center: Interactive Date Header */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onOpenCalendar}
          className="flex items-center gap-1.5 px-2 py-1 rounded-xl transition-all hover:bg-white/5 group"
          style={{ cursor: 'pointer' }}
          title={t('nutrition.open_calendar', 'Open Full Calendar')}
        >
          <CalendarIcon size={13} style={{ color: 'var(--habit-gold, #f59e0b)' }} />
          <div className="text-center">
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--habit-text)', lineHeight: 1.1 }}>
              {isToday ? t('nutrition.today', 'Today') : formatDate(selectedDate, i18n.language)}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--habit-dim, #888)', fontWeight: 700, marginTop: 1 }}>
              {new Date(selectedDate + 'T12:00').toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                weekday: 'short',
              })} · <span className="opacity-60">{weekRangeLabel}</span>
            </div>
          </div>
        </motion.button>

        {/* Right: Next Buttons + Segmented Mode Switcher */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-[var(--habit-border)] p-0.5 rounded-xl">
            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => onSelectDate(addDays(selectedDate, 1))}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:text-[var(--habit-gold,#f59e0b)]"
              style={{ cursor: 'pointer' }}
              title={t('nutrition.next_day', '> +1d')}
            >
              <ChevronRight size={14} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => onSelectDate(addDays(selectedDate, 7))}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-60 hover:opacity-100 hover:text-[var(--habit-gold,#f59e0b)]"
              style={{ cursor: 'pointer' }}
              title={t('nutrition.next_week', '» +7d')}
            >
              <ChevronsRight size={13} />
            </motion.button>
          </div>

          {/* Segmented View Mode Pill Switcher (1W / 2W / M) */}
          <div className="flex items-center p-0.5 rounded-xl bg-[var(--habit-border)]">
            {[
              { mode: '1week', label: '1W', title: '1 Week (7 Days)' },
              { mode: '2weeks', label: '2W', title: '2 Weeks (14 Days)' },
              { mode: 'month', label: 'M', title: 'Month Matrix' },
            ].map(({ mode, label, title }) => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wide transition-all"
                  style={{
                    background: isActive ? 'var(--habit-panel)' : 'transparent',
                    color: isActive ? 'var(--habit-gold, #f59e0b)' : 'var(--habit-dim)',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                    cursor: 'pointer',
                  }}
                  title={title}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── View Mode: 1-Week (7-Day Grid) ─────────────────────────────────── */}
      {viewMode === '1week' && (
        <motion.div
          key="1week"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-7 gap-1.5 w-full"
        >
          {oneWeekDays.map((d) => (
            <DayPill
              key={d}
              dateStr={d}
              isSelected={d === selectedDate}
              isToday={d === today}
              entry={calMap[d]}
              onSelect={onSelectDate}
              lang={i18n.language}
              goalCalories={goalCalories}
            />
          ))}
        </motion.div>
      )}

      {/* ── View Mode: 2-Weeks (14-Day Horizon: This Week + Next Week) ───────── */}
      {viewMode === '2weeks' && (
        <motion.div
          key="2weeks"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="space-y-2"
        >
          {/* Week 1 */}
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-wider mb-1 opacity-50 px-1">
              {t('nutrition.this_week', 'Current Week')}
            </div>
            <div className="grid grid-cols-7 gap-1 w-full">
              {twoWeekDays.slice(0, 7).map((d) => (
                <DayPill
                  key={d}
                  dateStr={d}
                  isSelected={d === selectedDate}
                  isToday={d === today}
                  entry={calMap[d]}
                  onSelect={onSelectDate}
                  lang={i18n.language}
                  goalCalories={goalCalories}
                />
              ))}
            </div>
          </div>

          {/* Week 2 (Next Week) */}
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-wider mb-1 opacity-50 px-1 flex items-center gap-1 text-[var(--habit-gold,#f59e0b)]">
              <Sparkles size={10} /> {t('nutrition.upcoming_week', 'Next Week (Plan Ahead)')}
            </div>
            <div className="grid grid-cols-7 gap-1 w-full">
              {twoWeekDays.slice(7, 14).map((d) => (
                <DayPill
                  key={d}
                  dateStr={d}
                  isSelected={d === selectedDate}
                  isToday={d === today}
                  entry={calMap[d]}
                  onSelect={onSelectDate}
                  lang={i18n.language}
                  goalCalories={goalCalories}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── View Mode: Inline Month Heatmap Matrix ─────────────────────────── */}
      {viewMode === 'month' && (
        <motion.div
          key="month"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pt-2 border-t border-[var(--habit-border)]"
        >
          {/* Month Header */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span style={{ fontSize: 12, fontWeight: 900, textTransform: 'capitalize', color: 'var(--habit-text)' }}>
              {monthName}
            </span>
            <button
              onClick={onOpenCalendar}
              className="text-[10px] font-bold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
              style={{ color: 'var(--habit-gold, #f59e0b)' }}
            >
              {t('nutrition.open_full_cal', 'Open Full Modal →')}
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
              <div key={w} className="text-[9px] font-bold opacity-40">
                {w}
              </div>
            ))}
          </div>

          {/* Month Cells Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const entry = calMap[dateStr];
              const isSelected = dateStr === selectedDate;
              const isItemToday = dateStr === today;
              const cal = entry?.calories || 0;

              let dotColor = 'transparent';
              if (cal > 0) {
                const ratio = cal / goalCalories;
                if (ratio >= 0.85 && ratio <= 1.15) dotColor = '#10b981';
                else if (ratio > 1.15) dotColor = '#f74e52';
                else dotColor = '#f59e0b';
              }

              return (
                <motion.button
                  key={dateStr}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onSelectDate(dateStr)}
                  className="h-8 rounded-lg flex flex-col items-center justify-center p-0.5 transition-all relative"
                  style={{
                    background: isSelected
                      ? 'var(--habit-gold, #f59e0b)'
                      : isItemToday
                      ? 'rgba(245,158,11,0.12)'
                      : 'var(--habit-border)',
                    color: isSelected ? '#000' : 'var(--habit-text)',
                    border: isSelected
                      ? '1px solid var(--habit-gold, #f59e0b)'
                      : isItemToday
                      ? '1px solid rgba(245,158,11,0.4)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: isSelected || isItemToday ? 900 : 700 }}>
                    {dayNum}
                  </span>
                  {cal > 0 && (
                    <div
                      style={{
                        width: 3.5,
                        height: 3.5,
                        borderRadius: '50%',
                        background: isSelected ? '#000' : dotColor,
                        marginTop: 1,
                      }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
