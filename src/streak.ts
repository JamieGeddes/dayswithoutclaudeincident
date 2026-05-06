import type { Incident, State } from "./types.js";

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

export function updateState(prev: State | null, latest: Incident, now: Date): UpdateResult {
  const daysSince = daysSinceUtc(latest.pubDate, now);

  let longestStreakDays: number;
  if (prev === null) {
    longestStreakDays = daysSince;
  } else {
    const prevPubDate = new Date(prev.lastIncident.pubDate);
    const isNewIncident = latest.pubDate.getTime() > prevPubDate.getTime();
    if (isNewIncident) {
      const endedStreak = daysSinceUtc(prevPubDate, latest.pubDate);
      longestStreakDays = Math.max(prev.longestStreakDays, endedStreak, daysSince);
    } else {
      longestStreakDays = Math.max(prev.longestStreakDays, daysSince);
    }
  }

  const newState: State = {
    lastIncident: {
      pubDate: latest.pubDate.toISOString(),
      title: latest.title,
      link: latest.link,
    },
    longestStreakDays,
    lastUpdatedAt: now.toISOString(),
  };

  return { daysSince, longestStreakDays, newState };
}
