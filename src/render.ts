import { formatUtcDate, formatUtcTime } from "./streak.js";
import type { StoredIncident, StreakRecord } from "./types.js";

export function renderCards(daysSince: number): string {
  return String(daysSince)
    .split("")
    .map((d) => `<div class="card">${d}</div>`)
    .join("");
}

export function renderCardsAriaLabel(daysSince: number): string {
  return `${daysSince} ${dayWord(daysSince).toLowerCase()}`;
}

export function renderCaption(daysSince: number): string {
  return `${dayWord(daysSince)} without a Claude incident`;
}

export function renderTitle(daysSince: number): string {
  return `${daysSince} ${dayWord(daysSince).toLowerCase()} without a Claude incident`;
}

export function renderMetaDescription(daysSince: number): string {
  const word = dayWord(daysSince).toLowerCase();
  return `${daysSince} ${word} without an incident on the Anthropic Claude status page. Unofficial.`;
}

export function renderLongestStreak(streak: StreakRecord): string {
  const word = streak.days === 1 ? "day" : "days";
  return `<strong>${streak.days} ${word}</strong> (${escapeHtml(streak.startDate)} to ${escapeHtml(streak.endDate)})`;
}

export function renderIncidentsLabel(incidents: StoredIncident[]): string {
  if (incidents.length === 0) throw new Error("renderIncidentsLabel requires at least one incident");
  const noun = incidents.length === 1 ? "Last incident" : "Last incidents";
  const sharedDate = formatUtcDate(new Date(incidents[0]!.pubDate));
  return `${noun} (${sharedDate})`;
}

export function renderIncidentList(incidents: StoredIncident[]): string {
  const showTime = incidents.length > 1;
  return incidents
    .map((i) => {
      const link = `<a href="${escapeHtml(i.link)}" rel="noopener noreferrer">${escapeHtml(i.title)}</a>`;
      if (!showTime) return `<li>${link}</li>`;
      const time = formatUtcTime(new Date(i.pubDate));
      return `<li>${link} <span class="incident-time">(${time})</span></li>`;
    })
    .join("");
}

export function formatGeneratedAt(d: Date): string {
  return `${formatUtcDate(d)} ${formatUtcTime(d)}`;
}

function dayWord(n: number): string {
  return n === 1 ? "Day" : "Days";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
