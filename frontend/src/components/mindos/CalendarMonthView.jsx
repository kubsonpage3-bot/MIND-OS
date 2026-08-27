import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getLocalDateStr(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CalendarMonthView({
  currentDate,
  getDayEvents,
  onSelectDate,
  categoryFilter = "all",
}) {
  const { t } = useTranslation();
  const todayStr = getLocalDateStr(new Date());

  // Compute month grid (including leading/trailing padding days from previous/next month)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // JavaScript day of week: 0 = Sun, 1 = Mon ... 6 = Sat
  // Convert to Monday = 0 ... Sunday = 6
  let startWeekday = firstDayOfMonth.getDay() - 1;
  if (startWeekday === -1) startWeekday = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Days array for the 5-6 week grid
  const days = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({ date: d, isCurrentMonth: false, dateStr: getLocalDateStr(d) });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    days.push({ date: dateObj, isCurrentMonth: true, dateStr: getLocalDateStr(dateObj) });
  }

  // Next month leading days to complete grid (multiples of 7)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const dateObj = new Date(year, month + 1, d);
    days.push({ date: dateObj, isCurrentMonth: false, dateStr: getLocalDateStr(dateObj) });
  }

  return (
    <div className="rounded-xl border border-[#2a2640] bg-[#0d0d16] overflow-hidden select-none">
      {/* Month Days Header */}
      <div className="grid grid-cols-7 border-b border-[#2a2640] bg-[#121220]">
        {DAYS_SHORT.map((day, idx) => (
          <div
            key={day}
            className={cn(
              "py-2.5 text-center font-mono text-[11px] font-bold tracking-wider",
              idx >= 5 ? "text-amber-500/70" : "text-muted-foreground/70",
              idx > 0 && "border-l border-[#2a2640]/50"
            )}
          >
            {t(`calendar_ui.days_short.${idx}`, day)}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-y divide-[#2a2640]/40">
        {days.map((dayItem, index) => {
          const isToday = dayItem.dateStr === todayStr;
          const allDayEvents = getDayEvents(dayItem.dateStr);

          // Apply category filter if active
          const dayEvents =
            categoryFilter === "all"
              ? allDayEvents
              : allDayEvents.filter((e) => {
                  if (categoryFilter === "tasks" && e.isTask) return true;
                  if (categoryFilter === "custom" && !e.isTask) return true;
                  return e.category === categoryFilter || e.color === categoryFilter;
                });

          const isWeekend = index % 7 >= 5;

          return (
            <div
              key={dayItem.dateStr + index}
              onClick={() => onSelectDate(dayItem.date)}
              className={cn(
                "min-h-[100px] p-1.5 transition-colors cursor-pointer group relative flex flex-col justify-between",
                index % 7 > 0 && "border-l border-[#2a2640]/40",
                !dayItem.isCurrentMonth
                  ? "bg-[#090910]/60 opacity-40 hover:opacity-75"
                  : isWeekend
                  ? "bg-[#10101c]/40 hover:bg-[#161628]"
                  : "bg-[#0d0d16] hover:bg-[#151526]"
              )}
            >
              {/* Day Header Badge */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                    isToday
                      ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(168,85,247,0.5)] ring-1 ring-purple-400"
                      : dayItem.isCurrentMonth
                      ? "text-foreground/90 group-hover:text-primary"
                      : "text-muted-foreground/50"
                  )}
                >
                  {dayItem.date.getDate()}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-mono text-muted-foreground/60 px-1 bg-[#1a1728] rounded border border-[#2a2640]/60">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Mini-Badges (up to 3, then +X more) */}
              <div className="space-y-1 overflow-hidden flex-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded truncate flex items-center gap-1 border-l-2"
                    style={{
                      backgroundColor: (ev.color || "#3b82f6") + "22",
                      borderLeftColor: ev.color || "#3b82f6",
                      color: "#e2e8f0",
                    }}
                  >
                    <span className="text-[9px] font-bold opacity-70 shrink-0">
                      {ev.startTime}
                    </span>
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}

                {dayEvents.length > 3 && (
                  <div className="text-[9px] font-mono text-muted-foreground/80 pl-1">
                    +{dayEvents.length - 3} {t('calendar_ui.more', 'more...')}
                  </div>
                )}
              </div>

              {/* Today subtle border indicator */}
              {isToday && (
                <div className="absolute inset-0 border-2 border-primary/40 rounded pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
