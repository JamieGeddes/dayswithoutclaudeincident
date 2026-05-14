import type { Incident, SiteState, StoredIncident, StreakRecord } from "./types.js";

const MS_PER_DAY = 86_400_000;

export function daysSinceUtc(from: Date, now: Date = new Date()): number {
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((nowDay - fromDay) / MS_PER_DAY));
}

export function formatUtcDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function formatUtcTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function updateState(prev: SiteState | null, concurrent: Incident[], now: Date): SiteState {
  const latest = concurrent[0];
  if (!latest) throw new Error("updateState requires at least one incident");

  const newLastIncident = {
    pubDate: latest.pubDate.toISOString(),
    concurrent: concurrent.map(toStored),
  };

  let historicalLongestStreak: StreakRecord | null = prev?.historicalLongestStreak ?? null;

  if (prev) {
    const prevPubDate = new Date(prev.lastIncident.pubDate);
    if (latest.pubDate.getTime() > prevPubDate.getTime()) {
      const ended: StreakRecord = {
        days: daysSinceUtc(prevPubDate, latest.pubDate),
        startDate: formatUtcDate(prevPubDate),
        endDate: formatUtcDate(latest.pubDate),
      };
      if (historicalLongestStreak === null || ended.days > historicalLongestStreak.days) {
        historicalLongestStreak = ended;
      }
    }
  }

  return {
    lastIncident: newLastIncident,
    historicalLongestStreak,
    lastUpdatedAt: now.toISOString(),
  };
}

export interface ViewModel {
  daysSince: number;
  longestStreak: StreakRecord;
}

export function computeLongestGap(
  incidentDates: Date[],
  asOf: Date,
): StreakRecord | null {
  if (incidentDates.length === 0) return null;

  const utcMidnights = incidentDates.map((d) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  );
  const unique = Array.from(new Set(utcMidnights.map((d) => d.getTime())))
    .sort((a, b) => a - b)
    .map((t) => new Date(t));

  let best: StreakRecord | null = null;
  for (let i = 1; i < unique.length; i++) {
    const prev = unique[i - 1]!;
    const next = unique[i]!;
    const days = daysSinceUtc(prev, next);
    if (best === null || days > best.days) {
      best = {
        days,
        startDate: formatUtcDate(prev),
        endDate: formatUtcDate(next),
      };
    }
  }

  const lastIncident = unique[unique.length - 1]!;
  const openDays = daysSinceUtc(lastIncident, asOf);
  if (best === null || openDays > best.days) {
    best = {
      days: openDays,
      startDate: formatUtcDate(lastIncident),
      endDate: formatUtcDate(asOf),
    };
  }

  return best;
}

export function computeView(state: SiteState, now: Date): ViewModel {
  const lastPubDate = new Date(state.lastIncident.pubDate);
  const daysSince = daysSinceUtc(lastPubDate, now);
  const activeStreak: StreakRecord = {
    days: daysSince,
    startDate: formatUtcDate(lastPubDate),
    endDate: formatUtcDate(now),
  };
  const historical = state.historicalLongestStreak;
  const longestStreak =
    historical && historical.days >= activeStreak.days ? historical : activeStreak;
  return { daysSince, longestStreak };
}

function toStored(incident: Incident): StoredIncident {
  return {
    pubDate: incident.pubDate.toISOString(),
    title: incident.title,
    link: incident.link,
  };
}
