import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, RefreshCw } from "lucide-react";
import { useProfileMount } from "@/utils/perf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import CalendarSyncPanel from "@/components/mindos/CalendarSyncPanel";
import CalendarMonthView from "@/components/mindos/CalendarMonthView";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { djangoFetch } from "@/api/djangoClient";
import { toast } from "@/components/ui/use-toast";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import { cn } from "@/lib/utils";
import { rawTasksQueryKey } from "@/constants/queryKeys";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_PX = 64; // px per hour
const MIN_EVENT_MINS = 15;

function getLocalDateStr(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const CATEGORY_COLORS = {
  STEM: "#3b82f6",
  Languages: "#00cc88",
  "Humanities & Arts": "#eab308",
  "Health & Fitness": "#ef4444",
  "Rest & Recovery": "#f97316",
  Mindfulness: "#9944ff",
  "Social & Communication": "#a855f7",
  "Reading & Writing": "#22c55e",
  "Work & Career": "#64748b",
  Other: "#94a3b8",
};

const CATEGORY_ICONS = {
  STEM: "🔮",
  Languages: "📜",
  "Humanities & Arts": "📖",
  "Health & Fitness": "🗡️",
  "Rest & Recovery": "🌿",
  Mindfulness: "🕯️",
  "Social & Communication": "💬",
  "Reading & Writing": "✒️",
  "Work & Career": "🛡️",
  Other: "◆",
};

function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minsToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function snapTo15(m) {
  return Math.round(m / 15) * 15;
}

const EVENT_COLORS = [
  "#3b82f6", // Sapphire / Arcane
  "#10b981", // Emerald / Languages
  "#f59e0b", // Amber / Intellect
  "#ef4444", // Ruby / Combat & Fitness
  "#a855f7", // Amethyst / Void & Mind
  "#ec4899", // Quartz / Creative
  "#06b6d4", // Cyan / Time & Focus
  "#f97316", // Topaz / Vitality
];

const DURATION_PRESETS = [
  { label: "25m", mins: 25 },
  { label: "45m", mins: 45 },
  { label: "1h", mins: 60 },
  { label: "1.5h", mins: 90 },
  { label: "2h", mins: 120 },
];

// ── LIVE TIME LASER INDICATOR ──────────────────────────────────────────────
function LiveTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const top = (currentMins / 60) * HOUR_PX;
  const timeFormatted = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top }}
    >
      <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] ring-2 ring-purple-500 animate-ping" />
      <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-purple-300 shadow-[0_0_8px_#c084fc] ring-1 ring-purple-400 flex items-center justify-center">
        <span className="w-1 h-1 rounded-full bg-white" />
      </div>
      <div className="w-full border-t-2 border-purple-500/90 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
      <div className="absolute right-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/90 border border-purple-500/60 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.4)] flex items-center gap-1">
        <span>◆</span>
        <span>{timeFormatted}</span>
      </div>
    </div>
  );
}

// ── EVENT BLOCK ────────────────────────────────────────────────────────────
function EventBlock({ event, colDate, handlers }) {
  const startMins = timeToMins(event.startTime);
  const endMins = timeToMins(event.endTime);
  const top = (startMins / 60) * HOUR_PX;
  const height = Math.max(18, ((endMins - startMins) / 60) * HOUR_PX);
  const { onDragStart, onResizeStart, openEdit, deleteEvent } = handlers;
  const isTask = event.isTask;
  const isPending = event._isPending;
  const icon = event.isTask ? (CATEGORY_ICONS[event.category] || "🛡️") : "◆";

  return (
    <div
      onPointerDown={(e) => {
        if (!isTask && !isPending && e.button === 0) onDragStart(e, event, colDate);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isTask && !isPending) openEdit(event);
      }}
      className={cn(
        "absolute left-1 right-1 rounded-md overflow-hidden select-none group z-10 transition-shadow",
        "border-y border-r border-[#2c2842] shadow-[inset_0_0_8px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.5)]",
        isTask
          ? "cursor-default opacity-95"
          : isPending
          ? "cursor-not-allowed opacity-50 animate-pulse"
          : "cursor-grab active:cursor-grabbing hover:shadow-[0_0_14px_rgba(168,85,247,0.35)]"
      )}
      style={{
        top,
        height,
        backgroundColor: "#0d0d16eb",
        borderLeft: `4px solid ${event.color || "#a855f7"}`,
        boxShadow: `inset 0 0 12px ${event.color || "#a855f7"}1a, 0 2px 8px rgba(0,0,0,0.6)`,
        touchAction: isPending ? "auto" : "none",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          background: `linear-gradient(135deg, ${event.color || "#a855f7"} 0%, transparent 80%)`,
        }}
      />

      <div className="relative px-2 py-1 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] leading-none shrink-0">{icon}</span>
            <div
              className={cn(
                "text-[11px] font-mono font-bold leading-tight truncate",
                isTask ? "text-slate-200" : "text-white"
              )}
            >
              {event.title}
            </div>
          </div>
          {height > 30 && (
            <div className="text-[9px] text-muted-foreground/80 font-mono mt-0.5 flex items-center gap-1">
              <span>{event.startTime}</span>
              <span>–</span>
              <span>{event.endTime}</span>
            </div>
          )}
        </div>
      </div>

      {!isTask && !isPending && (
        <>
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(e, event);
            }}
            className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-black/60"
            style={{ touchAction: "none" }}
          >
            <div className="w-6 h-0.5 rounded-full bg-slate-400/70" />
          </div>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              deleteEvent(event.id);
            }}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded bg-black/60 hover:bg-red-900/80 text-muted-foreground hover:text-red-200 border border-border/40"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </>
      )}
    </div>
  );
}

// ── DAY COLUMN ─────────────────────────────────────────────────────────────
function DayColumn({ dateStr, colDate, getDayEvents, handlers, isToday = false }) {
  const dayEvents = getDayEvents(dateStr);
  const { onGridClick } = handlers;

  return (
    <div
      className={cn(
        "relative transition-colors",
        isToday ? "bg-[#141224]/50" : "bg-[#0c0c16]/30 hover:bg-[#111120]/40"
      )}
      style={{ height: HOUR_PX * 24 }}
      onClick={(e) => onGridClick(e, dateStr)}
    >
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-[#232038]/60 pointer-events-none"
          style={{ top: h * HOUR_PX }}
        />
      ))}
      {HOURS.map((h) => (
        <div
          key={`h${h}`}
          className="absolute left-0 right-0 border-t border-[#1c192c]/40 pointer-events-none"
          style={{ top: h * HOUR_PX + HOUR_PX / 2 }}
        />
      ))}

      {dayEvents.map((ev) => (
        <EventBlock key={ev.id} event={ev} colDate={colDate} handlers={handlers} />
      ))}

      {isToday && <LiveTimeIndicator />}
    </div>
  );
}

export default function CalendarPanel() {
  useProfileMount("CalendarPanel");
  const queryClient = useQueryClient();
  const { profile: djangoProfile } = useDjangoAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week");
  const [events, setEvents] = useState([]);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const todayStr = getLocalDateStr(new Date());

  const { data: tasks = [] } = useQuery({
    queryKey: rawTasksQueryKey("calendar"),
    queryFn: () =>
      djangoFetch("/tasks/").then((data) => {
        return Array.isArray(data) ? data : data?.results || [];
      }),
    enabled: !!djangoProfile,
  });

  const { data: apiEvents = [] } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () =>
      djangoFetch("/calendar/events/").then((data) => {
        return Array.isArray(data) ? data : data?.results || [];
      }),
    enabled: !!djangoProfile,
  });

  useEffect(() => {
    setEvents(
      apiEvents.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        startTime: (e.start_time || "").substring(0, 5),
        endTime: (e.end_time || "").substring(0, 5),
        color: e.color,
      }))
    );
  }, [apiEvents]);

  const createEventMut = useMutation({
    mutationFn: (ev) =>
      djangoFetch("/calendar/events/", {
        method: "POST",
        body: JSON.stringify({
          title: ev.title,
          description: ev.description,
          date: ev.date,
          start_time: ev.startTime,
          end_time: ev.endTime,
          color: ev.color,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    onError: (err, variables) => {
      setEvents((prev) => prev.filter((e) => e.id !== variables.id));
      toast({
        variant: "destructive",
        title: "Error saving event",
        description: "Failed to save event to server, please try again.",
      });
    },
  });

  const updateEventMut = useMutation({
    mutationFn: (ev) =>
      djangoFetch(`/calendar/events/${ev.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          title: ev.title,
          description: ev.description,
          date: ev.date,
          start_time: ev.startTime,
          end_time: ev.endTime,
          color: ev.color,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  });

  const deleteEventMut = useMutation({
    mutationFn: (id) => djangoFetch(`/calendar/events/${id}/`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  });

  const [editingEvent, setEditingEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: getLocalDateStr(new Date()),
    startTime: "09:00",
    endTime: "10:00",
    color: "#a855f7",
  });

  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const gridRef = useRef(null);
  const scrollRef = useRef(null);

  const scrollToNow = useCallback(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const top = (currentMins / 60) * HOUR_PX;
      scrollRef.current.scrollTo({
        top: Math.max(0, top - 120),
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    if (view !== "month") {
      const t = setTimeout(scrollToNow, 150);
      return () => clearTimeout(t);
    }
  }, [view, scrollToNow]);

  const addOrUpdateEvent = () => {
    if (!newEvent.title) return;
    if (editingEvent) {
      const updatedEv = {
        ...events.find((e) => e.id === editingEvent),
        ...newEvent,
      };
      setEvents(events.map((e) => (e.id === editingEvent ? updatedEv : e)));
      updateEventMut.mutate(updatedEv);
      setEditingEvent(null);
    } else {
      const tempId = Date.now();
      const createdEv = { ...newEvent, id: tempId, _isPending: true };
      setEvents([...events, createdEv]);
      createEventMut.mutate(createdEv);
    }
    setShowForm(false);
    setNewEvent({
      title: "",
      description: "",
      date: getLocalDateStr(new Date()),
      startTime: "09:00",
      endTime: "10:00",
      color: "#a855f7",
    });
  };

  const deleteEvent = (id) => {
    setEvents(events.filter((e) => e.id !== id));
    deleteEventMut.mutate(id);
  };

  const openEdit = (event) => {
    setNewEvent({
      title: event.title,
      description: event.description || "",
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color || "#a855f7",
    });
    setEditingEvent(event.id);
    setShowForm(true);
  };

  const goToPrev = () => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() - 1);
    else if (view === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const goToNext = () => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + 1);
    else if (view === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const getWeekDays = (date) => {
    const day = date.getDay() || 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - day + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const getDayEvents = (dateStr) => {
    const regularEvents = events.filter((e) => e.date === dateStr && !e.isTask);

    const dateObj = new Date(dateStr);
    const jsDay = dateObj.getDay();
    const pythonWeekday = jsDay === 0 ? 6 : jsDay - 1;
    const weekdayFlag = 1 << pythonWeekday;

    const dailyTaskEvents = tasks
      .filter((t) => {
        if (t.task_type !== "daily" || !t.show_in_calendar || !t.scheduled_time) {
          return false;
        }
        const repeatWeekdays =
          t.repeat_weekdays !== undefined && t.repeat_weekdays !== null
            ? t.repeat_weekdays
            : 127;
        return (repeatWeekdays & weekdayFlag) > 0;
      })
      .map((t) => {
        let endTimeStr;
        if (t.scheduled_end_time) {
          endTimeStr = t.scheduled_end_time.substring(0, 5);
        } else {
          endTimeStr = minsToTime(
            timeToMins(t.scheduled_time.substring(0, 5)) +
              Math.round((t.default_hours || 1) * 60)
          );
        }
        return {
          id: `task-${t.id}-${dateStr}`,
          title: t.title,
          description: t.notes || "",
          date: dateStr,
          startTime: t.scheduled_time.substring(0, 5),
          endTime: endTimeStr,
          color: CATEGORY_COLORS[t.category] || "#3b82f6",
          category: t.category,
          isTask: true,
          taskId: t.id,
        };
      });

    const allEvents = [...regularEvents, ...dailyTaskEvents].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    if (categoryFilter === "all") return allEvents;
    if (categoryFilter === "tasks") return allEvents.filter((e) => e.isTask);
    if (categoryFilter === "custom") return allEvents.filter((e) => !e.isTask);
    return allEvents.filter((e) => e.category === categoryFilter);
  };

  const onDragStart = useCallback((e, event, colDate) => {
    e.stopPropagation();
    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    const startMins = timeToMins(event.startTime);
    const endMins = timeToMins(event.endTime);
    const duration = endMins - startMins;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    dragRef.current = {
      eventId: event.id,
      duration,
      offsetMins: (offsetY / HOUR_PX) * 60,
      currentDate: colDate,
    };

    const onMove = (mv) => {
      if (!dragRef.current || !gridRef.current) return;
      const { eventId, duration, offsetMins, currentDate } = dragRef.current;
      const gridRect = gridRef.current.getBoundingClientRect();
      let rawMins = ((mv.clientY - gridRect.top) / HOUR_PX) * 60 - offsetMins;
      let newStart = snapTo15(Math.max(0, Math.min(23 * 60, rawMins)));
      let newEnd = newStart + duration;
      if (newEnd > 24 * 60) {
        newEnd = 24 * 60;
        newStart = newEnd - duration;
      }

      if (scrollRef.current) {
        const sr = scrollRef.current.getBoundingClientRect();
        const ZONE = 64;
        const SPEED = 10;
        if (mv.clientY < sr.top + ZONE) {
          scrollRef.current.scrollTop -= SPEED;
        } else if (mv.clientY > sr.bottom - ZONE) {
          scrollRef.current.scrollTop += SPEED;
        }
      }

      let newDate = currentDate;
      if (gridRef.current) {
        const cols = gridRef.current.querySelectorAll("[data-day-col]");
        cols.forEach((col) => {
          const cr = col.getBoundingClientRect();
          if (mv.clientX >= cr.left && mv.clientX < cr.right) {
            newDate = col.getAttribute("data-day-col");
          }
        });
      }
      dragRef.current.currentDate = newDate;

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                date: newDate,
                startTime: minsToTime(newStart),
                endTime: minsToTime(newEnd),
              }
            : ev
        )
      );
    };

    const onUp = () => {
      if (dragRef.current) {
        const evId = dragRef.current.eventId;
        setEvents((prev) => {
          const ev = prev.find((e) => e.id === evId);
          if (ev && String(ev.id).indexOf("task") === -1) updateEventMut.mutate(ev);
          return prev;
        });
      }
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [updateEventMut]);

  const onResizeStart = useCallback((e, event) => {
    e.stopPropagation();
    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const offsetY = e.clientY - rect.bottom;
    resizeRef.current = {
      eventId: event.id,
      startMins: timeToMins(event.startTime),
      offsetY,
    };

    const onMove = (mv) => {
      if (!resizeRef.current || !gridRef.current) return;
      const { eventId, startMins, offsetY } = resizeRef.current;
      const gridRect = gridRef.current.getBoundingClientRect();
      let rawEndMins = ((mv.clientY - offsetY - gridRect.top) / HOUR_PX) * 60;
      let newEnd = snapTo15(
        Math.max(startMins + MIN_EVENT_MINS, Math.min(24 * 60, rawEndMins))
      );

      if (scrollRef.current) {
        const sr = scrollRef.current.getBoundingClientRect();
        const ZONE = 64;
        const SPEED = 10;
        if (mv.clientY < sr.top + ZONE) {
          scrollRef.current.scrollTop -= SPEED;
        } else if (mv.clientY > sr.bottom - ZONE) {
          scrollRef.current.scrollTop += SPEED;
        }
      }

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, endTime: minsToTime(newEnd) } : ev
        )
      );
    };

    const onUp = () => {
      if (resizeRef.current) {
        const evId = resizeRef.current.eventId;
        setEvents((prev) => {
          const ev = prev.find((e) => e.id === evId);
          if (ev && String(ev.id).indexOf("task") === -1) updateEventMut.mutate(ev);
          return prev;
        });
      }
      resizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [updateEventMut]);

  const onGridClick = useCallback((e, dateStr) => {
    if (dragRef.current || resizeRef.current) return;
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawMins = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const snapped = snapTo15(Math.max(0, rawMins));
    setNewEvent((prev) => ({
      ...prev,
      date: dateStr,
      startTime: minsToTime(snapped),
      endTime: minsToTime(snapped + 60),
    }));
    setEditingEvent(null);
    setShowForm(true);
  }, []);

  const handlers = {
    onDragStart,
    onResizeStart,
    openEdit,
    deleteEvent,
    onGridClick,
  };

  const weekDays = getWeekDays(currentDate);
  const currentDateStr = getLocalDateStr(currentDate);

  const applyPresetDuration = (mins) => {
    const startM = timeToMins(newEvent.startTime);
    const endM = Math.min(24 * 60, startM + mins);
    setNewEvent((prev) => ({ ...prev, endTime: minsToTime(endM) }));
  };

  return (
    <div className="space-y-3.5 select-none font-mono">
      {/* ── TOP CONTROL BAR ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-[#0f0e1a] p-3 rounded-xl border border-[#2a2640] shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a2640] bg-[#161426] hover:bg-[#201d36] text-slate-300 hover:text-white transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs md:text-sm font-bold min-w-[170px] text-center text-slate-100 tracking-wide">
            {view === "day"
              ? currentDate.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : view === "month"
              ? currentDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${currentDate.toLocaleDateString(
                  "en-US",
                  { month: "long", year: "numeric" }
                )}`}
          </span>

          <button
            onClick={goToNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a2640] bg-[#161426] hover:bg-[#201d36] text-slate-300 hover:text-white transition-colors shadow-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setCurrentDate(new Date());
              scrollToNow();
            }}
            className="px-2.5 py-1 text-[10px] font-mono font-bold border border-[#3b3558] bg-[#1a172c] hover:bg-[#25213e] text-purple-300 hover:text-purple-100 rounded-md transition-colors shadow-sm"
          >
            TODAY
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border border-[#2a2640] bg-[#141224] rounded-lg p-1">
            {["all", "tasks", "custom"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-mono rounded font-medium transition-colors",
                  categoryFilter === cat
                    ? "bg-[#2c264d] text-purple-200 border border-purple-500/40"
                    : "text-muted-foreground hover:text-slate-200"
                )}
              >
                {cat === "all" ? "All" : cat === "tasks" ? "Dailies" : "Custom"}
              </button>
            ))}
          </div>

          <Button
            onClick={() => setShowSyncPanel(!showSyncPanel)}
            variant="outline"
            size="sm"
            className="text-xs font-mono border-[#2a2640] bg-[#161426] hover:bg-[#221f38] text-slate-300"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Sync Tasks
          </Button>

          <div className="flex gap-1 border border-[#2a2640] bg-[#141224] rounded-lg p-1">
            {["day", "week", "month"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-xs font-mono font-bold rounded transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                    : "text-muted-foreground hover:text-slate-200 hover:bg-[#201d36]"
                )}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setEditingEvent(null);
              setNewEvent({
                title: "",
                description: "",
                date: currentDateStr,
                startTime: "09:00",
                endTime: "10:00",
                color: "#a855f7",
              });
              setShowForm(true);
            }}
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-mono font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Event
          </button>
        </div>
      </div>

      {showSyncPanel && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <CalendarSyncPanel tasks={tasks} />
        </motion.div>
      )}

      {view !== "month" && (
        <p className="text-[10px] font-mono text-muted-foreground/60 text-center">
          Drag events to reschedule · Double-click to edit · Drag bottom edge to resize
        </p>
      )}

      {view === "month" ? (
        <CalendarMonthView
          currentDate={currentDate}
          getDayEvents={getDayEvents}
          onSelectDate={(selectedDate) => {
            setCurrentDate(selectedDate);
            setView("day");
          }}
          categoryFilter={categoryFilter}
        />
      ) : (
        <div className="rounded-xl border border-[#2a2640] bg-[#0c0c16] overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "70vh" }}
            ref={scrollRef}
          >
            {view === "day" && (
              <div className="flex relative">
                <div
                  className="w-14 shrink-0 relative bg-[#0e0d1a] border-r border-[#232038]"
                  style={{ height: HOUR_PX * 24 }}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute text-[10px] font-mono font-bold text-muted-foreground/60 text-right pr-2 w-full"
                      style={{ top: h * HOUR_PX - 7 }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative" ref={gridRef}>
                  <DayColumn
                    dateStr={currentDateStr}
                    colDate={currentDateStr}
                    getDayEvents={getDayEvents}
                    handlers={handlers}
                    isToday={currentDateStr === todayStr}
                  />
                </div>
              </div>
            )}

            {view === "week" && (
              <div>
                <div
                  className="grid sticky top-0 z-20 bg-[#121022] border-b border-[#2a2640] shadow-sm"
                  style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}
                >
                  <div className="border-r border-[#2a2640]/50" />
                  {weekDays.map((day, i) => {
                    const ds = getLocalDateStr(day);
                    const isToday = ds === todayStr;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "text-center py-2 border-l border-[#2a2640]/50 transition-colors",
                          isToday ? "bg-purple-950/30" : ""
                        )}
                      >
                        <div
                          className={cn(
                            "text-[10px] font-mono uppercase font-bold",
                            isToday ? "text-purple-300" : "text-muted-foreground/70"
                          )}
                        >
                          {DAYS_EN[i]}
                        </div>
                        <div
                          className={cn(
                            "text-xs font-mono font-bold mx-auto w-6 h-6 flex items-center justify-center rounded-lg mt-0.5",
                            isToday
                              ? "bg-primary text-primary-foreground shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                              : "text-slate-200"
                          )}
                        >
                          {day.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="grid relative"
                  style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}
                  ref={gridRef}
                >
                  <div
                    className="relative bg-[#0e0d1a] border-r border-[#232038]"
                    style={{ height: HOUR_PX * 24 }}
                  >
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute text-[10px] font-mono font-bold text-muted-foreground/60 text-right pr-2 w-full"
                        style={{ top: h * HOUR_PX - 7 }}
                      >
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {weekDays.map((day, i) => {
                    const ds = getLocalDateStr(day);
                    return (
                      <div
                        key={i}
                        className="border-l border-[#232038]/60 relative"
                        data-day-col={ds}
                      >
                        <DayColumn
                          dateStr={ds}
                          colDate={ds}
                          getDayEvents={getDayEvents}
                          handlers={handlers}
                          isToday={ds === todayStr}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EVENT FORM MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#121124] border-2 border-[#362f54] shadow-[0_0_25px_rgba(0,0,0,0.8),inset_0_0_15px_rgba(168,85,247,0.08)] rounded-xl p-6 max-w-md w-full space-y-4 font-mono text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-[#2a2640] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-primary text-sm">◆</span>
                  <h3 className="font-mono font-bold text-sm text-white tracking-wide">
                    {editingEvent ? "EDIT EVENT" : "NEW EVENT"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingEvent(null);
                  }}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  EVENT TITLE
                </label>
                <Input
                  placeholder="e.g. Mathematics Deep Work"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  className="font-mono bg-[#18162e] border-[#2f294a] text-white focus:ring-primary"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  DESCRIPTION (OPTIONAL)
                </label>
                <Textarea
                  placeholder="Notes, goals or topics..."
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  className="h-16 text-xs font-mono bg-[#18162e] border-[#2f294a] text-white focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  DATE
                </label>
                <Input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, date: e.target.value })
                  }
                  className="bg-[#18162e] border-[#2f294a] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block">
                    START TIME
                  </label>
                  <Input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, startTime: e.target.value })
                    }
                    className="bg-[#18162e] border-[#2f294a] text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block">
                    END TIME
                  </label>
                  <Input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, endTime: e.target.value })
                    }
                    className="bg-[#18162e] border-[#2f294a] text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block">
                  QUICK DURATION
                </label>
                <div className="flex gap-1.5">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPresetDuration(p.mins)}
                      className="px-2 py-1 text-[10px] font-mono font-bold bg-[#1d1a36] hover:bg-[#28234a] border border-[#372f58] rounded text-purple-200 hover:text-white transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  COLOR ACCENT
                </label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, color: c })}
                      className={cn(
                        "w-6 h-6 rounded-md transition-all border",
                        newEvent.color === c
                          ? "ring-2 ring-white scale-110 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                          : "border-transparent hover:scale-105 opacity-80 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#2a2640]">
                <Button
                  onClick={addOrUpdateEvent}
                  className="flex-1 font-mono font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                  disabled={!newEvent.title}
                >
                  {editingEvent ? "SAVE CHANGES" : "CREATE EVENT"}
                </Button>
                {editingEvent && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      deleteEvent(editingEvent);
                      setShowForm(false);
                      setEditingEvent(null);
                    }}
                    className="font-mono"
                  >
                    DELETE
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
