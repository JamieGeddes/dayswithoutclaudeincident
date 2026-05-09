import type { Incident, State, StoredIncident } from "./types.js";

const MS_PER_DAY = 86_400_000;

export function daysSinceUtc(from: Date, now: Date = new Date()): number {
  const fromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((nowDay - fromDay) / MS_PER_DAY));
}

export interface UpdateResult {
  daysSince: number;
  longestStreakDays: number;
  newState: State;
}

export function updateState(prev: State | null, concurrent: Incident[], now: Date): UpdateResult {
  const latest = concurrent[0];
  if (!latest) throw new Error("updateState requires at least one incident");

  const daysSince = daysSinceUtc(latest.pubDate, now);

  let longestStreakDays: number;
  if (prev === null) {
    longestStreakDays = daysSince;
  } else {
    const prevPubDate = new Date(prev.latestIncidents[0]?.pubDate ?? 0);
    const isNewIncident = latest.pubDate.getTime() > prevPubDate.getTime();
    if (isNewIncident) {
      const endedStreak = daysSinceUtc(prevPubDate, latest.pubDate);
      longestStreakDays = Math.max(prev.longestStreakDays, endedStreak, daysSince);
    } else {
      longestStreakDays = Math.max(prev.longestStreakDays, daysSince);
    }
  }

  const newState: State = {
    latestIncidents: concurrent.map(toStored),
    longestStreakDays,
    lastUpdatedAt: now.toISOString(),
  };

  return { daysSince, longestStreakDays, newState };
}

function toStored(incident: Incident): StoredIncident {
  return {
    pubDate: incident.pubDate.toISOString(),
    title: incident.title,
    link: incident.link,
  };
}
