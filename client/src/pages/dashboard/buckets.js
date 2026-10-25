import { formatIstDayLabel, getIstDayRange, istDateKey, istDayRangeFromKey, parseDueDate } from "../../utils/date";

/** Sort choices of the "Completed archive" (value is what the <select> stores). */
export const COMPLETED_SORTS = [
  { value: "date-desc", label: "Date (newest)" },
  { value: "date-asc", label: "Date (oldest)" },
  { value: "title-asc", label: "Name (A-Z)" },
  { value: "title-desc", label: "Name (Z-A)" },
];

const dueMs = (task) => {
  const due = parseDueDate(task.due_date);
  return due ? due.getTime() : null;
};

/**
 * Splits reminders into the dashboard's groups. `range` is the IST calendar day ({ start, end } in ms),
 * the same definition of "today" the server uses when it sends reminders.
 */
export function bucketTasks(tasks, range) {
  const missed = [];
  const today = [];
  const upcoming = [];
  const completed = [];
  let doneToday = 0;

  for (const task of tasks) {
    const due = dueMs(task);
    if (task.status === "completed") {
      completed.push(task);
      if (due !== null && due >= range.start && due <= range.end) doneToday += 1;
    } else if (due === null) {
      upcoming.push(task);
    } else if (due < range.start) {
      missed.push(task);
    } else if (due <= range.end) {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }
  return { missed, today, upcoming: sortByDue(upcoming), completed, doneToday };
}

const titleOf = (task) => (task.title || "").toLowerCase();

/** Oldest due time first. Reminders with no date go last; equal times fall back to the title so the order is stable. */
export function sortByDue(tasks) {
  return [...tasks].sort((a, b) => {
    const x = dueMs(a);
    const y = dueMs(b);
    if (x === null && y === null) return titleOf(a).localeCompare(titleOf(b));
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y || titleOf(a).localeCompare(titleOf(b));
  });
}

/**
 * "Upcoming" as one group per IST calendar day, nearest day first, so tomorrow's reminders come first, then the day
 * after, and so on: [{ key: "2026-10-25", label: "Tomorrow", tasks: [...] }, ...]. Undated reminders form a final
 * "No date" group. Input order is irrelevant; each group is sorted by time.
 */
export function groupByIstDay(tasks, nowMs = Date.now()) {
  const byDay = new Map();
  const undated = [];
  for (const task of sortByDue(tasks)) {
    const due = dueMs(task);
    if (due === null) {
      undated.push(task);
      continue;
    }
    const key = istDateKey(due);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(task);
  }
  const groups = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, list]) => ({ key, label: formatIstDayLabel(key, nowMs), tasks: list }));
  if (undated.length) groups.push({ key: "no-date", label: "No date", tasks: undated });
  return groups;
}

/**
 * Every reminder due on one IST calendar day ("YYYY-MM-DD", what the date picker returns): pending ones first, in
 * time order, then the ones already completed. An invalid key matches nothing.
 */
export function filterByIstDate(tasks, dateKey) {
  const range = istDayRangeFromKey(dateKey);
  if (!range) return [];
  const onDay = tasks.filter((task) => {
    const due = dueMs(task);
    return due !== null && due >= range.start && due <= range.end;
  });
  const pending = sortByDue(onDay.filter((task) => task.status !== "completed"));
  const done = sortByDue(onDay.filter((task) => task.status === "completed"));
  return [...pending, ...done];
}

/** Today's range, re-exported so callers that bucket and group share one definition of "today". */
export const todayRange = getIstDayRange;

export function sortCompleted(completed, mode) {
  const title = (task) => (task.title || "").toLowerCase();
  const date = (task) => dueMs(task) ?? 0;
  return [...completed].sort((a, b) => {
    switch (mode) {
      case "title-asc":
        return title(a).localeCompare(title(b));
      case "title-desc":
        return title(b).localeCompare(title(a));
      case "date-asc":
        return date(a) - date(b);
      case "date-desc":
      default:
        return date(b) - date(a);
    }
  });
}

/** Greeting for an IST hour (0-23). */
export function greetingForHour(hour) {
  if (hour < 6) return "Late night grind";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** 0-100: how much of today's list is done. */
export function progressPercent(done, remaining) {
  const total = done + remaining;
  return total ? Math.round((done / total) * 100) : 0;
}
