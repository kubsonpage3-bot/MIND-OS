import { useTranslation } from 'react-i18next';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';

/** Extract last 10 completed sessions from sessionsData (DRF paginated or raw array) */
function useRecentSessions(sessionsData) {
  return useMemo(() => {
    const list = sessionsData?.results ?? sessionsData ?? [];
    return list.filter(s => s.completed).slice(0, 10);
  }, [sessionsData]);
}

/** Aggregate heatmap into last 8 calendar weeks (Mon–Sun buckets) */
function useWeeklyBreakdown(heatmapData) {
  return useMemo(() => {
    const weeks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(today);
      // Go back to Monday of the current week first
      const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
      weekStart.setDate(today.getDate() - dayOfWeek - w * 7);

      let total = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const key = day.toISOString().slice(0, 10);
        total += heatmapData?.[key] || 0;
      }

      const labelDate = new Date(weekStart);
      const label = `${labelDate.getDate()} ${labelDate.toLocaleString('en', { month: 'short' })}`;
      weeks.push({ label, total, weekStart: weekStart.toISOString().slice(0, 10) });
    }
    return weeks;
  }, [heatmapData]);
}

/** Find peak focus hour from sessions list */
function usePeakHour(sessionsData) {
  return useMemo(() => {
    const list = sessionsData?.results ?? sessionsData ?? [];
    const hours = new Array(24).fill(0);
    for (const s of list) {
      if (!s.started_at) continue;
      const h = new Date(s.started_at).getHours();
      hours[h]++;
    }
    const max = Math.max(...hours);
    if (max === 0) return null;
    const peakHour = hours.indexOf(max);
    const end = (peakHour + 2) % 24;
    const fmt = h => `${h.toString().padStart(2, '0')}:00`;
    return `${fmt(peakHour)}–${fmt(end)}`;
  }, [sessionsData]);
}

/** Canvas heatmap with month labels and day labels */
function HeatmapCanvas({ heatmapData }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !heatmapData) return;

    const draw = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      const availWidth = container.clientWidth - 20; // 20px for day labels

      const cellSize = 10;
      const cellGap = 3;
      const rows = 7;
      const step = cellSize + cellGap;
      const maxCols = 53;
      const cols = Math.min(maxCols, Math.floor(availWidth / step));

      canvas.width = cols * step + 1;
      canvas.height = rows * step + 16; // +16 for month labels

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const colors = {
        0: 'rgba(255,255,255,0.05)',
        1: '#2d1b4e',
        2: '#6b21a8',
        3: '#9333ea',
        4: '#c084fc',
      };

      // Build cells array (newest = bottom-right)
      const cells = new Array(cols * rows).fill(null).map(() => ({ count: 0, date: '' }));
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const [dateStr, count] of Object.entries(heatmapData)) {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - d) / 86400000);
        if (diffDays < cols * rows) {
          const index = cols * rows - 1 - diffDays;
          if (index >= 0) {
            cells[index] = { count, date: dateStr };
          }
        }
      }

      // Track which month labels we've drawn to avoid duplicates
      const drawnMonths = new Set();

      for (let c = 0; c < cols; c++) {
        // Month label on first cell of each month
        const cellDate = new Date(today);
        cellDate.setDate(today.getDate() - (cols * rows - 1 - c * rows));
        const monthKey = `${cellDate.getFullYear()}-${cellDate.getMonth()}`;
        if (!drawnMonths.has(monthKey)) {
          drawnMonths.add(monthKey);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '8px monospace';
          ctx.fillText(
            cellDate.toLocaleString('en', { month: 'short' }),
            c * step,
            9
          );
        }

        for (let r = 0; r < rows; r++) {
          const x = c * step;
          const y = r * step + 14;
          const index = c * rows + r;
          const val = cells[index]?.count || 0;

          let colorKey = 0;
          if (val > 0) colorKey = 1;
          if (val >= 3) colorKey = 2;
          if (val >= 6) colorKey = 3;
          if (val >= 10) colorKey = 4;

          ctx.fillStyle = colors[colorKey];
          ctx.beginPath();
          ctx.roundRect(x, y, cellSize, cellSize, 2);
          ctx.fill();
        }
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvasRef.current.parentElement);
    window.addEventListener('resize', draw);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [heatmapData]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !heatmapData) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - 14;
    const step = 13;
    const c = Math.floor(x / step);
    const r = Math.floor(y / step);
    const rows = 7;
    const cols = Math.floor(canvasRef.current.width / step);
    if (c < 0 || c >= cols || r < 0 || r >= rows) { setTooltip(null); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = (cols * rows - 1) - (c * rows + r);
    const d = new Date(today);
    d.setDate(today.getDate() - diffDays);
    const dateStr = d.toISOString().slice(0, 10);
    const count = heatmapData[dateStr] || 0;
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, date: dateStr, count });
  };

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute z-10 bg-black/90 border border-white/10 rounded px-2 py-1 text-[9px] font-mono pointer-events-none"
          style={{ left: tooltip.x + 8, top: tooltip.y - 28 }}
        >
          <span className="text-white/70">{tooltip.date}</span>
          <span className="text-purple-400 ml-1">· {tooltip.count} sessions</span>
        </div>
      )}
    </div>
  );
}

export default function PomodoroHistory() {
  const { t } = useTranslation();
  const { heatmapData, isHeatmapLoading, sessionsData } = usePomodoro();
  const recentSessions = useRecentSessions(sessionsData);
  const weeklyBreakdown = useWeeklyBreakdown(heatmapData);
  const peakHour = usePeakHour(sessionsData);
  const maxWeekly = Math.max(...weeklyBreakdown.map(w => w.total), 1);

  if (isHeatmapLoading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">

      {/* ── Activity Heatmap ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-widest">
            {t('pomodoro.history.heatmap', 'Activity Heatmap')}
          </h3>
          <div className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground/50">
            <span>Less</span>
            {['rgba(255,255,255,0.05)', '#2d1b4e', '#6b21a8', '#9333ea', '#c084fc'].map((bg, i) => (
              <div key={i} className="w-2 h-2 rounded-sm" style={{ background: bg }} />
            ))}
            <span>More</span>
          </div>
        </div>
        {/* Day labels */}
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1 mt-4" style={{ minWidth: 16 }}>
            {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
              <span key={i} className="text-[7px] font-mono text-white/20 leading-none" style={{ height: 13, display: 'flex', alignItems: 'center' }}>
                {d}
              </span>
            ))}
          </div>
          <HeatmapCanvas heatmapData={heatmapData} />
        </div>
      </motion.div>

      {/* ── Weekly Breakdown Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {t('pomodoro.history.weeklyBreakdown', 'Weekly Breakdown')}
          </span>
        </div>
        <div className="space-y-1.5">
          {weeklyBreakdown.map((week, i) => {
            const pct = maxWeekly > 0 ? (week.total / maxWeekly) * 100 : 0;
            const isPeak = week.total === maxWeekly && week.total > 0;
            return (
              <div key={week.weekStart} className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/40 w-14 flex-shrink-0">
                  {week.label}
                </span>
                <div className="flex-1 h-4 bg-white/[0.04] rounded-sm overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-sm"
                    style={{
                      background: isPeak
                        ? 'linear-gradient(90deg, #059669, #34d399)'
                        : 'rgba(34,197,94,0.35)',
                      boxShadow: isPeak ? '0 0 8px rgba(52,211,153,0.4)' : 'none',
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono text-white/40 w-6 text-right flex-shrink-0">
                  {week.total > 0 ? week.total : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Peak Focus Time ── */}
      {peakHour && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-amber-500/20 rounded-xl p-4 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
              {t('pomodoro.history.peakTime', 'Peak Focus Window')}
            </p>
            <p className="text-sm font-mono font-bold text-amber-400">{peakHour}</p>
          </div>
        </motion.div>
      )}

      {/* ── Recent Sessions List ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <h3 className="text-[10px] font-mono font-bold uppercase text-muted-foreground tracking-widest mb-3">
          {t('pomodoro.history.recent', 'Recent Sessions')}
        </h3>
        {recentSessions.length === 0 ? (
          <p className="text-[10px] font-mono text-muted-foreground text-center py-4">
            {t('pomodoro.history.noSessions', 'No completed sessions yet')}
          </p>
        ) : (
          <div className="space-y-1">
            {recentSessions.map((s, i) => {
              const startedAt = s.started_at ? new Date(s.started_at) : null;
              const dateStr = startedAt
                ? startedAt.toLocaleDateString('en', { day: 'numeric', month: 'short' })
                : s.date || '—';
              const timeStr = startedAt
                ? startedAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <motion.div
                  key={s.id || i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                  className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-[10px] font-mono text-white/70">{dateStr}</span>
                    {timeStr && (
                      <span className="text-[9px] font-mono text-white/30">{timeStr}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-purple-400">{s.duration ?? 25} min</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

    </div>
  );
}
