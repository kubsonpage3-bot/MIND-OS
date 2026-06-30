import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import CalendarSyncPanel from "@/components/mindos/CalendarSyncPanel";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_PX = 64; // px per hour
const MIN_EVENT_MINS = 15;

const CATEGORY_COLORS = {
  Math: "#3b82f6", Physics: "#3b82f6", Coding: "#3b82f6",
  English: "#00cc88", Reading: "#22c55e", Philosophy: "#22c55e",
  Exercise: "#ef4444", Sleep: "#f59e0b", Nutrition: "#f59e0b",
  Social: "#a855f7", Mindfulness: "#9944ff",
};

function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minsToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function snapTo15(m) { return Math.round(m / 15) * 15; }

const EVENT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#06b6d4", "#f97316"];

// ── EVENT BLOCK ────────────────────────────────────────────────────────────
function EventBlock({ event, colDate, handlers }) {
  const startMins = timeToMins(event.startTime);
  const endMins = timeToMins(event.endTime);
  const top = (startMins / 60) * HOUR_PX;
  const height = Math.max(16, ((endMins - startMins) / 60) * HOUR_PX);
  const { onDragStart, onResizeStart, openEdit, deleteEvent } = handlers;
  const isTask = event.isTask;

  return (
    <div
      onMouseDown={(e) => { if (!isTask && e.button === 0) onDragStart(e, event, colDate); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (!isTask) openEdit(event); }}
      className={`absolute left-0.5 right-0.5 rounded-lg overflow-hidden select-none group z-10 ${isTask ? 'cursor-default' : 'cursor-grab'}`}
      style={{
        top, height,
        backgroundColor: event.color + "22",
        borderLeft: `3px solid ${event.color}`,
        boxShadow: `0 0 8px ${event.color}33`,
      }}
    >
      <div className="px-1.5 py-1 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1">
            {isTask && <span className="text-[8px]">✓</span>}
            <div className={`text-[10px] font-bold leading-tight truncate ${isTask ? 'text-foreground' : 'text-foreground'}`}>{event.title}</div>
          </div>
          {height > 28 && (
            <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
              {event.startTime}–{event.endTime}
            </div>
          )}
        </div>
      </div>
      {!isTask && (
        <>
          <div
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, event); }}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-8 h-0.5 rounded-full bg-foreground/30" />
          </div>
          <button
            onMouseDown={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </>
      )}
    </div>
  );
}

// ── DAY COLUMN ─────────────────────────────────────────────────────────────
function DayColumn({ dateStr, colDate, getDayEvents, handlers }) {
  const dayEvents = getDayEvents(dateStr);
  const { onGridClick } = handlers;

  return (
    <div
      className="relative"
      style={{ height: HOUR_PX * 24 }}
      onClick={(e) => onGridClick(e, dateStr)}
    >
      {HOURS.map(h => (
        <div key={h} className="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style={{ top: h * HOUR_PX }} />
      ))}
      {HOURS.map(h => (
        <div key={`h${h}`} className="absolute left-0 right-0 border-t border-border/10 pointer-events-none" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
      ))}
      {dayEvents.map(ev => (
        <EventBlock key={ev.id} event={ev} colDate={colDate} handlers={handlers} />
      ))}
    </div>
  );
}

export default function CalendarPanel() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week");
  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem("calendar_events") || "[]"); } catch { return []; }
  });
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];
  
  const CATEGORY_COLORS = {
    Math: "#3b82f6", Physics: "#3b82f6", Coding: "#3b82f6",
    English: "#00cc88", Reading: "#22c55e", Philosophy: "#22c55e",
    Exercise: "#ef4444", Sleep: "#f59e0b", Nutrition: "#f59e0b",
    Social: "#a855f7", Mindfulness: "#9944ff",
  };

  // Load tasks from localStorage and convert daily tasks with showInCalendar to events
  useEffect(() => {
    try {
      const loaded = JSON.parse(localStorage.getItem("mindos_tasks") || "[]");
      setTasks(loaded);
    } catch {}
  }, []);

  // Convert daily tasks with showInCalendar to calendar events
  const taskEvents = tasks
    .filter(t => t.type === "daily" && t.showInCalendar && t.scheduledTime)
    .map(t => {
      const [hours, mins] = t.scheduledTime.split(":").map(Number);
      const endMins = (hours * 60 + mins) + 60; // 1 hour duration
      const endHours = Math.floor(endMins / 60);
      const endMinsRem = endMins % 60;
      return {
        id: `task-${t.id}`,
        title: t.name,
        description: t.notes || "",
        date: t.date || new Date().toISOString().split("T")[0],
        startTime: t.scheduledTime,
        endTime: `${String(endHours).padStart(2, "0")}:${String(endMinsRem).padStart(2, "0")}`,
        color: CATEGORY_COLORS[t.category] || "#3b82f6",
        isTask: true,
        taskId: t.id,
      };
    });
  const [editingEvent, setEditingEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: "", description: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00", endTime: "10:00", color: "#3b82f6",
  });

  // Drag state
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const gridRef = useRef(null);
  const scrollRef = useRef(null); // scrollable container

  const save = (evs) => {
    setEvents(evs);
    localStorage.setItem("calendar_events", JSON.stringify(evs));
  };

  const addOrUpdateEvent = () => {
    if (!newEvent.title) return;
    if (editingEvent) {
      save(events.map(e => e.id === editingEvent ? { ...e, ...newEvent } : e));
      setEditingEvent(null);
    } else {
      save([...events, { ...newEvent, id: Date.now() }]);
    }
    setShowForm(false);
    setNewEvent({ title: "", description: "", date: new Date().toISOString().split("T")[0], startTime: "09:00", endTime: "10:00", color: "#3b82f6" });
  };

  const deleteEvent = (id) => save(events.filter(e => e.id !== id));

  const openEdit = (event) => {
    setNewEvent({ title: event.title, description: event.description || "", date: event.date, startTime: event.startTime, endTime: event.endTime, color: event.color });
    setEditingEvent(event.id);
    setShowForm(true);
  };

  const goToPrev = () => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goToNext = () => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + 1);
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
    // Regular events
    const regularEvents = events.filter(e => e.date === dateStr && !e.isTask);
    // Daily tasks with showInCalendar - show on all dates (recurring)
    const dailyTaskEvents = tasks
      .filter(t => t.type === "daily" && t.showInCalendar && t.scheduledTime)
      .map(t => ({
        id: `task-${t.id}-${dateStr}`,
        title: t.name,
        description: t.notes || "",
        date: dateStr,
        startTime: t.scheduledTime,
        endTime: minsToTime(timeToMins(t.scheduledTime) + 60),
        color: CATEGORY_COLORS[t.category] || "#3b82f6",
        isTask: true,
        taskId: t.id,
      }));
    return [...regularEvents, ...dailyTaskEvents].sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // ── DRAG: move event ──────────────────────────────────────────────────────
  const onDragStart = useCallback((e, event, colDate) => {
    e.stopPropagation();
    e.preventDefault();
    const startMins = timeToMins(event.startTime);
    const endMins = timeToMins(event.endTime);
    const duration = endMins - startMins;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    dragRef.current = { eventId: event.id, duration, offsetMins: (offsetY / HOUR_PX) * 60, currentDate: colDate };

    const onMove = (mv) => {
      if (!dragRef.current || !gridRef.current) return;
      const { eventId, duration, offsetMins, currentDate } = dragRef.current;
      const gridRect = gridRef.current.getBoundingClientRect();
      const scrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;
      let rawMins = ((mv.clientY - gridRect.top + scrollTop) / HOUR_PX) * 60 - offsetMins;
      let newStart = snapTo15(Math.max(0, Math.min(23 * 60, rawMins)));
      let newEnd = newStart + duration;
      if (newEnd > 24 * 60) { newEnd = 24 * 60; newStart = newEnd - duration; }

      // Detect column (for week view) by checking x position
      let newDate = currentDate;
      if (gridRef.current) {
        const cols = gridRef.current.querySelectorAll("[data-day-col]");
        cols.forEach(col => {
          const cr = col.getBoundingClientRect();
          if (mv.clientX >= cr.left && mv.clientX < cr.right) {
            newDate = col.getAttribute("data-day-col");
          }
        });
      }
      dragRef.current.currentDate = newDate;

      setEvents(prev => prev.map(ev => ev.id === eventId
        ? { ...ev, date: newDate, startTime: minsToTime(newStart), endTime: minsToTime(newEnd) }
        : ev
      ));
    };

    const onUp = () => {
      if (dragRef.current) {
        setEvents(prev => { localStorage.setItem("calendar_events", JSON.stringify(prev)); return prev; });
      }
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // ── RESIZE: bottom handle ─────────────────────────────────────────────────
  const onResizeStart = useCallback((e, event) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { eventId: event.id, startMins: timeToMins(event.startTime) };

    const onMove = (mv) => {
      if (!resizeRef.current || !gridRef.current) return;
      const { eventId, startMins } = resizeRef.current;
      const gridRect = gridRef.current.getBoundingClientRect();
      const scrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;
      let rawEndMins = ((mv.clientY - gridRect.top + scrollTop) / HOUR_PX) * 60;
      let newEnd = snapTo15(Math.max(startMins + MIN_EVENT_MINS, Math.min(24 * 60, rawEndMins)));
      setEvents(prev => prev.map(ev => ev.id === eventId
        ? { ...ev, endTime: minsToTime(newEnd) }
        : ev
      ));
    };

    const onUp = () => {
      setEvents(prev => { localStorage.setItem("calendar_events", JSON.stringify(prev)); return prev; });
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // ── CLICK ON GRID to create event ────────────────────────────────────────
  const onGridClick = useCallback((e, dateStr) => {
    if (dragRef.current || resizeRef.current) return;
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawMins = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const snapped = snapTo15(Math.max(0, rawMins));
    setNewEvent(prev => ({ ...prev, date: dateStr, startTime: minsToTime(snapped), endTime: minsToTime(snapped + 60) }));
    setEditingEvent(null);
    setShowForm(true);
  }, []);

  const handlers = { onDragStart, onResizeStart, openEdit, deleteEvent, onGridClick };

  const weekDays = getWeekDays(currentDate);
  const currentDateStr = currentDate.toISOString().split("T")[0];

  return (
    <div className="space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={goToPrev} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-sm font-bold min-w-[160px] text-center">
            {view === "day"
              ? currentDate.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
              : `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
            }
          </span>
          <button onClick={goToNext} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-[10px] font-mono border border-border rounded hover:bg-accent transition-colors text-muted-foreground">
            TODAY
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowSyncPanel(!showSyncPanel)}
            variant="outline"
            size="sm"
            className="text-xs font-mono"
          >
            <RefreshCw className="w-3 h-3" />
            Sync Tasks
          </Button>
          <div className="flex gap-1 border border-border rounded-lg p-1">
            {["day", "week"].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >{v === "day" ? "DAY" : "WEEK"}</button>
            ))}
          </div>
          <button
            onClick={() => { setEditingEvent(null); setNewEvent({ title: "", description: "", date: currentDateStr, startTime: "09:00", endTime: "10:00", color: "#3b82f6" }); setShowForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Event
          </button>
        </div>
      </div>

      {/* Calendar Sync Panel */}
      {showSyncPanel && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <CalendarSyncPanel tasks={tasks} />
        </motion.div>
      )}

      <p className="text-[10px] font-mono text-muted-foreground/40 text-center">Drag events · Double-click to edit · Drag bottom edge to resize</p>

      {/* Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-y-auto" style={{ maxHeight: "70vh" }} ref={scrollRef}>
          {view === "day" && (
            <div className="flex relative">
              {/* Hour labels */}
              <div className="w-14 shrink-0 relative" style={{ height: HOUR_PX * 24 }}>
                {HOURS.map(h => (
                  <div key={h} className="absolute text-[9px] font-mono text-muted-foreground/50 text-right pr-2 w-full" style={{ top: h * HOUR_PX - 6 }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              <div className="flex-1 relative" ref={gridRef}>
                <DayColumn dateStr={currentDateStr} colDate={currentDateStr} getDayEvents={getDayEvents} handlers={handlers} />
              </div>
            </div>
          )}

          {view === "week" && (
            <div>
              {/* Day headers */}
              <div className="grid sticky top-0 z-20 bg-card border-b border-border" style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}>
                <div />
                {weekDays.map((day, i) => {
                  const ds = day.toISOString().split("T")[0];
                  const isToday = ds === todayStr;
                  return (
                    <div key={i} className="text-center py-2 border-l border-border/30">
                      <div className="text-[10px] font-mono text-muted-foreground">{DAYS_EN[i]}</div>
                      <div className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Week grid */}
              <div className="grid relative" style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }} ref={gridRef}>
                {/* Hour labels */}
                <div className="relative" style={{ height: HOUR_PX * 24 }}>
                  {HOURS.map(h => (
                    <div key={h} className="absolute text-[9px] font-mono text-muted-foreground/50 text-right pr-2 w-full" style={{ top: h * HOUR_PX - 6 }}>
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {/* Day columns */}
                {weekDays.map((day, i) => {
                  const ds = day.toISOString().split("T")[0];
                  return (
                    <div key={i} className="border-l border-border/30" data-day-col={ds}>
                      <DayColumn dateStr={ds} colDate={ds} getDayEvents={getDayEvents} handlers={handlers} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono font-bold text-sm">{editingEvent ? "EDIT EVENT" : "NEW EVENT"}</h3>
                <button onClick={() => { setShowForm(false); setEditingEvent(null); }}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              <Input placeholder="Title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} className="font-mono" autoFocus />
              <Textarea placeholder="Description (optional)" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} className="h-16 text-xs font-mono" />

              <Input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block">START</label>
                  <Input type="time" value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground mb-1 block">END</label>
                  <Input type="time" value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {EVENT_COLORS.map(c => (
                  <button key={c} onClick={() => setNewEvent({ ...newEvent, color: c })}
                    className={`w-7 h-7 rounded-full transition-all ${newEvent.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={addOrUpdateEvent} className="flex-1 font-mono" disabled={!newEvent.title}>
                  {editingEvent ? "SAVE" : "CREATE"}
                </Button>
                {editingEvent && (
                  <Button variant="destructive" onClick={() => { deleteEvent(editingEvent); setShowForm(false); setEditingEvent(null); }} className="font-mono">
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