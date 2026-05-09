import type { ScheduledHandler } from "aws-lambda";
import { fetchIncidents, selectConcurrent, STATUS_RSS_URL } from "./rss.js";
import { renderHtml } from "./render.js";
import { loadState, putHtml, saveState } from "./state.js";
import { updateState } from "./streak.js";

export const handler: ScheduledHandler = async () => {
  const bucket = requireEnv("BUCKET_NAME");
  const stateKey = process.env.STATE_KEY ?? "state/state.json";
  const indexKey = process.env.INDEX_KEY ?? "index.html";
  const rssUrl = process.env.RSS_URL ?? STATUS_RSS_URL;

  const incidents = await fetchIncidents(rssUrl);
  const concurrent = selectConcurrent(incidents);
  if (concurrent.length === 0) {
    console.warn("RSS feed returned no incidents; skipping site update.");
    return;
  }

  const prev = await loadState(bucket, stateKey);
  const now = new Date();
  const { daysSince, longestStreakDays, newState } = updateState(prev, concurrent, now);
  const html = renderHtml({ daysSince, longestStreakDays, latestIncidents: concurrent, generatedAt: now });

  await Promise.all([saveState(bucket, stateKey, newState), putHtml(bucket, indexKey, html)]);

  console.log(
    JSON.stringify({
      daysSince,
      longestStreakDays,
      concurrentCount: concurrent.length,
      latestIncidentPubDate: concurrent[0]!.pubDate.toISOString(),
    }),
  );
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
