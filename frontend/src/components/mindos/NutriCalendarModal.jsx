import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_CALENDAR_KEY } from '@/constants/queryKeys';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getMonthDetails(year, month) {
  // month is 1-indexed
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  // Monday is index 0 in RU
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  return { daysInMonth, startDayOfWeek };
}

export default function NutriCalendarModal({ selectedDate, onSelectDate, onClose, goalCalories = 2000 }) {
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: calendarData = [] } = useQuery({
    queryKey: NUTRITION_CALENDAR_KEY(monthKey),
    queryFn: () => djangoApi.nutrition.getCalendar(monthKey),
    staleTime: 30_000,
  });

  const calMap = {};
  calendarData.forEach((d) => {
    calMap[d.date] = d;
  });

  const { daysInMonth, startDayOfWeek } = getMonthDetails(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const monthLabel = currentDate.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-sm overflow-hidden"
        style={{
          background: 'var(--habit-panel)',
          border: '1px solid var(--habit-border)',
          borderRadius: 20,
          padding: 20,
          color: 'var(--habit-text)',
          fontFamily: "'Nunito', sans-serif",
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
        initial={{ scale: 0.94, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} style={{ color: 'var(--habit-gold, #f59e0b)' }} />
            <span style={{ fontWeight: 800, fontSize: 16, textTransform: 'capitalize' }}>
              {monthLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
              style={{ background: 'var(--habit-border)' }}
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity ml-1"
              style={{ background: 'var(--habit-border)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--habit-dim, #888)',
                padding: '4px 0',
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before month start */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-12" />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const entry = calMap[dateStr];
            const isSelected = dateStr === selectedDate;
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const calories = entry?.calories || 0;

            let dotColor = 'transparent';
            if (calories > 0) {
              const ratio = calories / goalCalories;
              if (ratio >= 0.85 && ratio <= 1.15) {
                dotColor = 'var(--habit-green, #10b981)'; // Met goal
              } else if (ratio > 1.15) {
                dotColor = 'var(--habit-red, #ef4444)'; // Over
              } else {
                dotColor = 'var(--habit-gold, #f59e0b)'; // In progress / under
              }
            }

            return (
              <motion.button
                key={dateStr}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  onSelectDate(dateStr);
                  onClose();
                }}
                className="h-12 rounded-xl flex flex-col items-center justify-between p-1 transition-all"
                style={{
                  background: isSelected
                    ? 'var(--habit-gold, #f59e0b)'
                    : isToday
                    ? 'rgba(245,158,11,0.12)'
                    : 'var(--habit-border)',
                  color: isSelected ? '#000' : 'var(--habit-text)',
                  border: isSelected
                    ? '1px solid var(--habit-gold, #f59e0b)'
                    : isToday
                    ? '1px solid rgba(245,158,11,0.4)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isSelected || isToday ? 900 : 700 }}>
                  {dayNum}
                </span>

                {calories > 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: dotColor,
                        boxShadow: `0 0 4px ${dotColor}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        opacity: isSelected ? 0.9 : 0.6,
                        lineHeight: 1,
                      }}
                    >
                      {Math.round(calories)}
                    </span>
                  </div>
                ) : (
                  <div style={{ height: 10 }} />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--habit-border)] text-[10px] font-bold text-[var(--habit-dim)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--habit-green,#10b981)]" />
            <span>Норма (±15%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--habit-gold,#f59e0b)]" />
            <span>Недобор</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--habit-red,#ef4444)]" />
            <span>Перебор</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
