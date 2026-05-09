import { fetchIncidents, selectConcurrent, STATUS_RSS_URL } from "./rss.js";
import { renderHtml } from "./render.js";
import { loadState, putHtml, saveState } from "./state.js";
import { updateState } from "./streak.js";

export interface Env {
  SITE_BUCKET: R2Bucket;
  RSS_URL: string;
  STATE_KEY: string;
  INDEX_KEY: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const rssUrl = env.RSS_URL || STATUS_RSS_URL;

    const incidents = await fetchIncidents(rssUrl);
    const concurrent = selectConcurrent(incidents);
    if (concurrent.length === 0) {
      console.warn("RSS feed returned no incidents; skipping site update.");
      return;
    }

    const prev = await loadState(env.SITE_BUCKET, env.STATE_KEY);
    const now = new Date();
    const { daysSince, longestStreakDays, newState } = updateState(prev, concurrent, now);
    const html = renderHtml({ daysSince, longestStreakDays, latestIncidents: concurrent, generatedAt: now });

    await Promise.all([
      saveState(env.SITE_BUCKET, env.STATE_KEY, newState),
      putHtml(env.SITE_BUCKET, env.INDEX_KEY, html),
    ]);

    console.log(
      JSON.stringify({
        daysSince,
        longestStreakDays,
        concurrentCount: concurrent.length,
        latestIncidentPubDate: concurrent[0]!.pubDate.toISOString(),
      }),
    );
  },
};
