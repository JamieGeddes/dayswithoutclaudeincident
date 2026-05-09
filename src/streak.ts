import type { Incident, State, StoredIncident } from "./types.js";

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

export interface UpdateResult {
  daysSince: number;
  longestStreakDays: number;
  longestStreakStart: string;
  longestStreakEnd: string;
  newState: State;
}

interface StreakWindow {
  days: number;
  start: string;
  end: string;
}

export function updateState(prev: State | null, concurrent: Incident[], now: Date): UpdateResult {
  const latest = concurrent[0];
  if (!latest) throw new Error("updateState requires at least one incident");

  const daysSince = daysSinceUtc(latest.pubDate, now);
  const latestIso = formatUtcDate(latest.pubDate);
  const todayIso = formatUtcDate(now);
  const ongoing: StreakWindow = { days: daysSince, start: latestIso, end: todayIso };

  let longest: StreakWindow;
  if (prev === null) {
    longest = ongoing;
  } else {
    const prevPubDate = new Date(prev.latestIncidents[0]?.pubDate ?? 0);
    const prevWindow: StreakWindow = {
      days: prev.longestStreakDays,
      start: prev.longestStreakStart,
      end: prev.longestStreakEnd,
    };
    if (latest.pubDate.getTime() > prevPubDate.getTime()) {
      const ended: StreakWindow = {
        days: daysSinceUtc(prevPubDate, latest.pubDate),
        start: formatUtcDate(prevPubDate),
        end: latestIso,
      };
      longest = pickLongest([prevWindow, ended, ongoing]);
    } else {
      longest = pickLongest([prevWindow, ongoing]);
    }
  }

  const newState: State = {
    latestIncidents: concurrent.map(toStored),
    longestStreakDays: longest.days,
    longestStreakStart: longest.start,
    longestStreakEnd: longest.end,
    lastUpdatedAt: now.toISOString(),
  };

  return {
    daysSince,
    longestStreakDays: longest.days,
    longestStreakStart: longest.start,
    longestStreakEnd: longest.end,
    newState,
  };
}

function pickLongest(windows: StreakWindow[]): StreakWindow {
  return windows.reduce((a, b) => (b.days > a.days ? b : a));
}

function toStored(incident: Incident): StoredIncident {
  return {
    pubDate: incident.pubDate.toISOString(),
    title: incident.title,
    link: incident.link,
  };
}
