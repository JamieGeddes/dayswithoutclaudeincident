import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { State, StoredIncident } from "./types.js";

const s3 = new S3Client({});

export async function loadState(bucket: string, key: string): Promise<State | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await res.Body?.transformToString();
    if (!body) return null;
    return migrate(JSON.parse(body));
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

export async function saveState(bucket: string, key: string, state: State): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(state, null, 2),
      ContentType: "application/json",
    }),
  );
}

export async function putHtml(bucket: string, key: string, html: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: html,
      ContentType: "text/html; charset=utf-8",
      CacheControl: "public, max-age=300",
    }),
  );
}

export function migrate(raw: unknown): State | null {
  if (!isRecord(raw)) return null;
  const longestStreakDays = typeof raw.longestStreakDays === "number" ? raw.longestStreakDays : 0;
  const lastUpdatedAt = typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : new Date(0).toISOString();

  if (Array.isArray(raw.latestIncidents)) {
    const latestIncidents = raw.latestIncidents.filter(isStoredIncident);
    if (latestIncidents.length === 0) return null;
    return { latestIncidents, longestStreakDays, lastUpdatedAt };
  }

  if (isStoredIncident(raw.lastIncident)) {
    return { latestIncidents: [raw.lastIncident], longestStreakDays, lastUpdatedAt };
  }

  return null;
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

function isNotFoundError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}
