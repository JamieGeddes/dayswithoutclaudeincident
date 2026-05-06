import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { State } from "./types.js";

const s3 = new S3Client({});

export async function loadState(bucket: string, key: string): Promise<State | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await res.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body) as State;
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

function isNotFoundError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}
