// Date + Daily-recurrence helpers shared by the calendar and the task columns.
//
// The recurrence rule MIRRORS backend/api/services/task_service.py::
// is_daily_scheduled_for_date -- keep the two in sync:
//   * repeat_weekdays: bitmask, Monday = bit 0 ... Sunday = bit 6 (default 127)
//   * repeat_until: last day (inclusive)
//   * repeat_interval_weeks: every N-th week, counted from the week (Monday) of
//     repeat_start_date
//
// IMPORTANT: a bare "YYYY-MM-DD" must NEVER go through `new Date(str)` -- that is
// parsed as UTC midnight, so .getDay()/.getDate() read the previous day for every
// user west of UTC (their Monday Daily showed up on Sunday).

/** "YYYY-MM-DD" -> Date at LOCAL midnight (null when malformed). */
export function parseLocalDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date -> "YYYY-MM-DD" in local time. */
export function toDateStr(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Monday-based weekday index of a local Date: Mon = 0 ... Sun = 6. */
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - mondayIndex(d));
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is this Daily scheduled on `dateStr` ("YYYY-MM-DD")?
 * `opts.respectCreation` (calendar history): also hide days before the task
 * existed, so a Daily created today doesn't appear on every past Monday.
 */
export function isDailyScheduledOn(task, dateStr, opts = {}) {
  const date = parseLocalDate(dateStr);
  if (!date) return false;

  const mask = task.repeat_weekdays ?? 127;
  if ((mask & (1 << mondayIndex(date))) === 0) return false;

  if (task.repeat_until && dateStr > task.repeat_until.substring(0, 10)) return false;

  if (opts.respectCreation && task.created_at) {
    const created = toDateStr(new Date(task.created_at));
    if (dateStr < created) return false;
  }

  const interval = task.repeat_interval_weeks || 1;
  if (interval > 1) {
    const anchor =
      parseLocalDate(task.repeat_start_date) ||
      (task.created_at ? parseLocalDate(toDateStr(new Date(task.created_at))) : null);
    if (anchor) {
      const weeks = Math.round((mondayOf(date) - mondayOf(anchor)) / (7 * DAY_MS));
      if (weeks < 0 || weeks % interval !== 0) return false;
    }
  }
  return true;
}

/** Whole calendar days a due date is from today (negative = overdue), local time. */
export function daysUntil(dateStr, today = new Date()) {
  const due = parseLocalDate(dateStr);
  if (!due) return null;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - t0) / DAY_MS);
}
