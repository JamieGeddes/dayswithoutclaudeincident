import { buildCalendarGrid, mergeCalendarState } from "./calendar.js";
import type { CalendarGrid } from "./calendar.js";
import {
  renderCalendarGrid,
  renderCalendarHeading,
  renderCalendarMetaDescription,
  renderCalendarSummary,
  renderCalendarTitle,
  renderYearNav,
} from "./calendarRender.js";
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
import { loadCalendarState, loadState, saveCalendarState, saveState } from "./state.js";
import { computeView, updateState } from "./streak.js";
import type { SiteState } from "./types.js";

export interface Env {
  ASSETS: Fetcher;
  SITE_KV: KVNamespace;
  RSS_URL: string;
  SITE_STATE_KEY: string;
  CALENDAR_STATE_KEY: string;
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

    const now = new Date();

    const prev = await loadState(env.SITE_KV, env.SITE_STATE_KEY);
    const newState = updateState(prev, concurrent, now);
    await saveState(env.SITE_KV, env.SITE_STATE_KEY, newState);

    const prevCalendar = await loadCalendarState(env.SITE_KV, env.CALENDAR_STATE_KEY);
    const newCalendar = mergeCalendarState(prevCalendar, incidents, now);
    await saveCalendarState(env.SITE_KV, env.CALENDAR_STATE_KEY, newCalendar);

    console.log(
      JSON.stringify({
        latestIncidentPubDate: newState.lastIncident.pubDate,
        concurrentCount: newState.lastIncident.concurrent.length,
        historicalLongestStreakDays: newState.historicalLongestStreak?.days ?? null,
        calendarIncidentDays: Object.keys(newCalendar.days).length,
      }),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (path === "/" || path === "/index.html") {
      return renderMainPage(request, env);
    }
    if (path === "/calendar" || path === "/calendar.html") {
      return renderCalendarPage(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

async function renderMainPage(request: Request, env: Env): Promise<Response> {
  const state = await loadState(env.SITE_KV, env.SITE_STATE_KEY);
  if (!state) {
    return new Response("Site state not ready yet — the hourly generator hasn't run.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
    });
  }

  const now = new Date();
  const shellResponse = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
  const rewritten = rewriteShell(shellResponse, state, now);

  return new Response(rewritten.body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${secondsUntilNextUtcMidnight(now)}`,
    },
  });
}

async function renderCalendarPage(request: Request, env: Env, url: URL): Promise<Response> {
  const state = await loadCalendarState(env.SITE_KV, env.CALENDAR_STATE_KEY);
  if (!state) {
    return new Response("Calendar state not ready yet — the hourly generator hasn't run.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
    });
  }

  const now = new Date();
  const year = parseYearParam(url.searchParams.get("year"), state.firstDate, now);
  const grid = buildCalendarGrid(state, now, year);
  const shellResponse = await env.ASSETS.fetch(
    new Request(new URL("/calendar.html", request.url)),
  );
  const rewritten = rewriteCalendarShell(shellResponse, grid, now);

  return new Response(rewritten.body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=60, s-maxage=${secondsUntilNextUtcMidnight(now)}`,
    },
  });
}

function parseYearParam(
  raw: string | null,
  firstDate: string,
  now: Date,
): number | undefined {
  if (!raw) return undefined;
  const year = Number(raw);
  if (!Number.isInteger(year)) return undefined;
  const firstYear = Number(firstDate.slice(0, 4));
  if (year < firstYear || year > now.getUTCFullYear()) return undefined;
  return year;
}

function rewriteShell(shell: Response, state: SiteState, now: Date): Response {
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
        el.setInnerContent(formatGeneratedAt(now));
      },
    })
    .transform(shell);
}

function rewriteCalendarShell(shell: Response, grid: CalendarGrid, now: Date): Response {
  const title = renderCalendarTitle(grid.year);
  const description = renderCalendarMetaDescription(grid);

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
    .on('[data-dwci="calendar-heading"]', {
      element(el) {
        el.setInnerContent(renderCalendarHeading(grid.year));
      },
    })
    .on('[data-dwci="calendar-summary"]', {
      element(el) {
        el.setInnerContent(renderCalendarSummary(grid), { html: true });
      },
    })
    .on('[data-dwci="calendar-years"]', {
      element(el) {
        el.setInnerContent(renderYearNav(grid), { html: true });
      },
    })
    .on('[data-dwci="calendar-grid"]', {
      element(el) {
        el.setInnerContent(renderCalendarGrid(grid), { html: true });
      },
    })
    .on('[data-dwci="generated"]', {
      element(el) {
        el.setInnerContent(formatGeneratedAt(now));
      },
    })
    .transform(shell);
}

function secondsUntilNextUtcMidnight(now: Date): number {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((nextMidnight - now.getTime()) / 1000));
}
