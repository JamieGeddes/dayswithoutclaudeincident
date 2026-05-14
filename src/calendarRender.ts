import type { CalendarCell, CalendarGrid, CalendarMonth } from "./calendar.js";
import { escapeHtml } from "./render.js";

const STATUS_HISTORY_URL = "https://status.claude.com/history";

export function renderCalendarHeading(year: number): string {
  return `Claude incidents · ${year}`;
}

export function renderCalendarTitle(year: number): string {
  return `Claude incident calendar — ${year}`;
}

export function renderCalendarMetaDescription(grid: CalendarGrid): string {
  const noun = grid.incidentDayCount === 1 ? "day" : "days";
  return (
    `An unofficial calendar of Claude status incidents in ${grid.year}: ` +
    `${grid.incidentDayCount} ${noun} with at least one incident.`
  );
}

export function renderCalendarSummary(grid: CalendarGrid): string {
  const noun = grid.incidentDayCount === 1 ? "day" : "days";
  return `<strong>${grid.incidentDayCount}</strong> incident ${noun} in ${grid.year}`;
}

export function renderYearNav(grid: CalendarGrid): string {
  if (grid.availableYears.length <= 1) return "";
  return grid.availableYears
    .map((year) => {
      if (year === grid.year) {
        return `<span class="cal-year cal-year--active" aria-current="page">${year}</span>`;
      }
      return `<a class="cal-year" href="/calendar?year=${year}">${year}</a>`;
    })
    .join("");
}

export function renderCalendarGrid(grid: CalendarGrid): string {
  return grid.months.map(renderCalendarMonth).join("");
}

export function renderCalendarMonth(month: CalendarMonth): string {
  const pads = '<span class="cal-pad" aria-hidden="true"></span>'.repeat(month.leadingBlanks);
  const cells = month.cells.map(renderCell).join("");
  return (
    `<section class="cal-month">` +
    `<h2 class="cal-month-name">${escapeHtml(month.name)}</h2>` +
    `<div class="cal-days">${pads}${cells}</div>` +
    `</section>`
  );
}

/**
 * A day is a faint cell when quiet, or a dark linked cell when it had an
 * incident — no day numbers, so the whole year reads as a heatmap at a glance.
 */
function renderCell(cell: CalendarCell): string {
  if (cell.count === 0) {
    return '<span class="cal-cell" aria-hidden="true"></span>';
  }

  const noun = cell.count === 1 ? "incident" : "incidents";
  const label = `${cell.count} ${noun} on ${cell.date}`;
  const single = cell.count === 1 ? cell.incidents[0] : undefined;
  const href = single ? single.link : STATUS_HISTORY_URL;

  return (
    `<a class="cal-cell cal-cell--incident" href="${escapeHtml(href)}" ` +
    `target="_blank" rel="noopener noreferrer" ` +
    `aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"></a>`
  );
}
