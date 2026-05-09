import { formatUtcDate } from "./streak.js";
import type { State, StoredIncident } from "./types.js";

export async function loadState(bucket: R2Bucket, key: string): Promise<State | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const body = await obj.text();
  if (!body) return null;
  return migrate(JSON.parse(body));
}

export async function saveState(bucket: R2Bucket, key: string, state: State): Promise<void> {
  await bucket.put(key, JSON.stringify(state, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function putHtml(bucket: R2Bucket, key: string, html: string): Promise<void> {
  await bucket.put(key, html, {
    httpMetadata: {
      contentType: "text/html; charset=utf-8",
      cacheControl: "public, max-age=300",
    },
  });
}

export function migrate(raw: unknown): State | null {
  if (!isRecord(raw)) return null;
  const longestStreakDays = typeof raw.longestStreakDays === "number" ? raw.longestStreakDays : 0;
  const lastUpdatedAt = typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : new Date(0).toISOString();

  const latestIncidents = Array.isArray(raw.latestIncidents)
    ? raw.latestIncidents.filter(isStoredIncident)
    : isStoredIncident(raw.lastIncident)
      ? [raw.lastIncident]
      : [];
  if (latestIncidents.length === 0) return null;

  const placeholder = formatUtcDate(new Date(latestIncidents[0]!.pubDate));
  const longestStreakStart = typeof raw.longestStreakStart === "string" ? raw.longestStreakStart : placeholder;
  const longestStreakEnd = typeof raw.longestStreakEnd === "string" ? raw.longestStreakEnd : placeholder;

  return { latestIncidents, longestStreakDays, longestStreakStart, longestStreakEnd, lastUpdatedAt };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStoredIncident(v: unknown): v is StoredIncident {
  return (
    isRecord(v) &&
    typeof v.pubDate === "string" &&
    typeof v.title === "string" &&
    typeof v.link === "string"
  );
}
