import {
  formatGeneratedAt,
  renderCaption,
  renderCards,
  renderCardsAriaLabel,
  renderIncidentList,
  renderIncidentsLabel,
  renderLongestStreak,
  renderMetaDescription,
  renderTitle,
} from "./render.js";
import { fetchIncidents, selectConcurrent, STATUS_RSS_URL } from "./rss.js";
import { loadState, saveState } from "./state.js";
import { computeView, updateState } from "./streak.js";
import type { SiteState } from "./types.js";

export interface Env {
  ASSETS: Fetcher;
  SITE_KV: KVNamespace;
  RSS_URL: string;
  SITE_STATE_KEY: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const rssUrl = env.RSS_URL || STATUS_RSS_URL;

    const incidents = await fetchIncidents(rssUrl);
    const concurrent = selectConcurrent(incidents);
    if (concurrent.length === 0) {
      console.warn("RSS feed returned no incidents; skipping state update.");
      return;
    }

    const prev = await loadState(env.SITE_KV, env.SITE_STATE_KEY);
    const now = new Date();
    const newState = updateState(prev, concurrent, now);
    await saveState(env.SITE_KV, env.SITE_STATE_KEY, newState);

    console.log(
      JSON.stringify({
        latestIncidentPubDate: newState.lastIncident.pubDate,
        concurrentCount: newState.lastIncident.concurrent.length,
        historicalLongestStreakDays: newState.historicalLongestStreak?.days ?? null,
      }),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return env.ASSETS.fetch(request);
    }

    const state = await loadState(env.SITE_KV, env.SITE_STATE_KEY);
    if (!state) {
      return new Response("Site state not ready yet — the hourly generator hasn't run.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
      });
    }

    const now = new Date();
    const lastChecked = new Date(state.lastUpdatedAt);
    const shellResponse = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
    const rewritten = rewriteShell(shellResponse, state, now, lastChecked);

    return new Response(rewritten.body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": `public, max-age=300, s-maxage=${secondsUntilNextUtcHour(now)}`,
      },
    });
  },
};

function rewriteShell(shell: Response, state: SiteState, now: Date, lastChecked: Date): Response {
  const view = computeView(state, now);
  const incidents = state.lastIncident.concurrent;
  const title = renderTitle(view.daysSince);
  const description = renderMetaDescription(view.daysSince);

  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', {
      element(el) {
        el.setAttribute("content", description);
      },
    })
    .on('meta[property="og:title"], meta[name="twitter:title"]', {
      element(el) {
        el.setAttribute("content", title);
      },
    })
    .on('[data-dwci="cards"]', {
      element(el) {
        el.setAttribute("aria-label", renderCardsAriaLabel(view.daysSince));
        el.setInnerContent(renderCards(view.daysSince), { html: true });
      },
    })
    .on('[data-dwci="caption"]', {
      element(el) {
        el.setInnerContent(renderCaption(view.daysSince));
      },
    })
    .on('[data-dwci="longest"]', {
      element(el) {
        el.setInnerContent(renderLongestStreak(view.longestStreak), { html: true });
      },
    })
    .on('[data-dwci="incidents-label"]', {
      element(el) {
        el.setInnerContent(renderIncidentsLabel(incidents));
      },
    })
    .on('[data-dwci="incidents"]', {
      element(el) {
        el.setInnerContent(renderIncidentList(incidents), { html: true });
      },
    })
    .on('[data-dwci="generated"]', {
      element(el) {
        el.setInnerContent(formatGeneratedAt(lastChecked));
      },
    })
    .transform(shell);
}

function secondsUntilNextUtcHour(now: Date): number {
  const nextHour = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((nextHour - now.getTime()) / 1000));
}
