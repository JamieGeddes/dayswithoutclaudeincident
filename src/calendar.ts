import { formatUtcDate } from "./streak.js";
import type { CalendarDay, CalendarState, Incident, StoredIncident } from "./types.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A single day cell in a rendered month grid. */
export interface CalendarCell {
  date: string;
  count: number;
  incidents: StoredIncident[];
}

/** A month's worth of cells, plus the weekday offset of its first day. */
export interface CalendarMonth {
  year: number;
  month: number;
  /** Month name without the year, e.g. "January". */
  name: string;
  /** Full label including the year, e.g. "January 2026". */
  label: string;
  /** Blank cells before day 1, Monday-first (0..6). */
  leadingBlanks: number;
  cells: CalendarCell[];
}

/** The view model for one year of the calendar page. */
export interface CalendarGrid {
  year: number;
  months: CalendarMonth[];
  incidentDayCount: number;
  availableYears: number[];
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toStored(incident: Incident): StoredIncident {
  return {
    pubDate: incident.pubDate.toISOString(),
    title: incident.title,
    link: incident.link,
  };
}

/**
 * Group incidents into a date-keyed map, deduplicating by link within each
 * UTC calendar day.
 */
export function incidentsToCalendarDays(incidents: Incident[]): Record<string, CalendarDay> {
  const days: Record<string, CalendarDay> = {};
  for (const incident of incidents) {
    const date = formatUtcDate(incident.pubDate);
    let day = days[date];
    if (!day) {
      day = { date, count: 0, incidents: [] };
      days[date] = day;
    }
    if (day.incidents.some((i) => i.link === incident.link)) continue;
    day.incidents.push(toStored(incident));
    day.count = day.incidents.length;
  }
  return days;
}

/**
 * Fold a fresh batch of incidents into the persisted calendar state. Existing
 * days are preserved; incidents are unioned by link so a re-run never drops
 * data. `firstDate` is recomputed from the merged set.
 */
export function mergeCalendarState(
  prev: CalendarState | null,
  incidents: Incident[],
  now: Date,
): CalendarState {
  const days: Record<string, CalendarDay> = {};
  if (prev) {
    for (const [date, day] of Object.entries(prev.days)) {
      days[date] = { date: day.date, count: day.count, incidents: [...day.incidents] };
    }
  }

  for (const [date, incoming] of Object.entries(incidentsToCalendarDays(incidents))) {
    const existing = days[date];
    if (!existing) {
      days[date] = incoming;
      continue;
    }
    for (const incident of incoming.incidents) {
      if (existing.incidents.some((i) => i.link === incident.link)) continue;
      existing.incidents.push(incident);
    }
    existing.count = existing.incidents.length;
  }

  const dateKeys = Object.keys(days).sort();
  const firstDate = dateKeys[0] ?? formatUtcDate(now);

  return {
    days,
    firstDate,
    lastUpdatedAt: now.toISOString(),
  };
}

/**
 * Build the grid view model for a single year. Defaults to the current UTC
 * year. Months before the first known incident, and months after the current
 * one, are omitted to keep the rendered page small.
 */
export function buildCalendarGrid(
  state: CalendarState,
  now: Date,
  year?: number,
): CalendarGrid {
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const firstYear = Number(state.firstDate.slice(0, 4));
  const firstMonth = Number(state.firstDate.slice(5, 7)) - 1;

  const targetYear = year ?? nowYear;
  const startMonth = targetYear === firstYear ? firstMonth : 0;
  const endMonth = targetYear === nowYear ? nowMonth : 11;

  const availableYears: number[] = [];
  for (let y = firstYear; y <= nowYear; y++) availableYears.push(y);

  const months: CalendarMonth[] = [];
  let incidentDayCount = 0;

  for (let m = startMonth; m <= endMonth; m++) {
    const daysInMonth = new Date(Date.UTC(targetYear, m + 1, 0)).getUTCDate();
    const firstWeekday = new Date(Date.UTC(targetYear, m, 1)).getUTCDay();
    const leadingBlanks = (firstWeekday + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${targetYear}-${pad(m + 1)}-${pad(d)}`;
      const day = state.days[date];
      const count = day?.count ?? 0;
      if (count > 0) incidentDayCount++;
      cells.push({ date, count, incidents: day?.incidents ?? [] });
    }

    months.push({
      year: targetYear,
      month: m,
      name: MONTH_NAMES[m]!,
      label: `${MONTH_NAMES[m]} ${targetYear}`,
      leadingBlanks,
      cells,
    });
  }

  return { year: targetYear, months, incidentDayCount, availableYears };
}
