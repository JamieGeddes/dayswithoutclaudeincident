/**
 * Backfill the historical longest-streak record from the Statuspage history pages.
 *
 * Each `https://status.claude.com/history?page=N` is server-rendered HTML with all
 * incidents embedded as JSON in a React component's `data-react-props` attribute.
 * Pages 1–6 cover the requirement (December 2024 → present). See the plan at
 * /Users/Jamie/.claude/plans/the-longest-streak-is-polymorphic-tarjan.md.
 *
 * Usage:
 *   npm run backfill -- --dry-run
 *   npm run backfill -- --pages 6
 *   npm run backfill -- --asof 2026-05-12
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeCalendarState } from "../src/calendar.js";
import { computeLongestGap, formatUtcDate } from "../src/streak.js";
import type { CalendarState, Incident, SiteState, StreakRecord } from "../src/types.js";

const HISTORY_URL = "https://status.claude.com/history";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const KV_BINDING = "SITE_KV";
const KV_KEY = "site-state";
const CALENDAR_KV_KEY = "calendar-state";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface RawIncident {
  code: string;
  name: string;
  message: string;
  impact: "none" | "minor" | "major" | "critical" | string;
  timestamp: string;
}

interface RawMonth {
  name?: string;
  display_date?: string;
  year?: number;
  incidents?: RawIncident[];
}

interface ReactProps {
  months?: RawMonth[];
}

interface ParsedIncident {
  code: string;
  name: string;
  impact: string;
  pubDate: Date;
  monthLabel: string;
  page: number;
  link: string;
}

interface CliArgs {
  pages: number;
  dryRun: boolean;
  asof: Date;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    pages: 6,
    dryRun: false,
    asof: new Date(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--pages") args.pages = Number(argv[++i]);
    else if (a === "--asof") args.asof = new Date(`${argv[++i]}T00:00:00Z`);
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!Number.isInteger(args.pages) || args.pages < 1 || args.pages > 20) {
    throw new Error(`--pages must be 1..20, got ${args.pages}`);
  }
  if (Number.isNaN(args.asof.getTime())) {
    throw new Error("--asof must be YYYY-MM-DD");
  }
  return args;
}

async function fetchHistoryPage(page: number): Promise<string> {
  const url = `${HISTORY_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`History page ${page} fetch failed: ${res.status}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractReactProps(html: string): ReactProps {
  const m = html.match(
    /data-react-class="HistoryIndex"\s+data-react-props="([^"]+)"/,
  );
  if (!m) throw new Error("HistoryIndex react-props not found in HTML");
  return JSON.parse(decodeEntities(m[1])) as ReactProps;
}

function monthIndex(label: string): number {
  const idx = MONTH_NAMES.indexOf(label);
  if (idx < 0) throw new Error(`Unknown month label: ${label}`);
  return idx;
}

function parseDayFromTimestamp(timestamp: string): number {
  // Example: "May <var data-var='date'>9</var>, <var data-var='time'>23:33</var> ..."
  const m = timestamp.match(/data-var=['"]date['"]>(\d{1,2})</);
  if (!m) throw new Error(`Day not found in timestamp: ${timestamp}`);
  return Number(m[1]);
}

function parseIncidentsFromProps(props: ReactProps, page: number): ParsedIncident[] {
  const out: ParsedIncident[] = [];
  for (const month of props.months ?? []) {
    const monthName = month.name ?? month.display_date;
    const year = month.year;
    if (!monthName || typeof year !== "number") continue;
    const monthIdx = monthIndex(monthName);
    for (const inc of month.incidents ?? []) {
      const day = parseDayFromTimestamp(inc.timestamp);
      const pubDate = new Date(Date.UTC(year, monthIdx, day));
      if (Number.isNaN(pubDate.getTime())) {
        throw new Error(`Bad date for incident ${inc.code}`);
      }
      // Sanity: the parsed date's UTC month must match the bucket.
      if (pubDate.getUTCFullYear() !== year || pubDate.getUTCMonth() !== monthIdx) {
        throw new Error(
          `Incident ${inc.code} date ${formatUtcDate(pubDate)} outside ${monthName} ${year}`,
        );
      }
      out.push({
        code: inc.code,
        name: inc.name,
        impact: inc.impact,
        pubDate,
        monthLabel: `${monthName} ${year}`,
        page,
        link: `https://status.claude.com/incidents/${inc.code}`,
      });
    }
  }
  return out;
}

function dedupeByCode(incidents: ParsedIncident[]): ParsedIncident[] {
  const seen = new Map<string, ParsedIncident>();
  for (const inc of incidents) {
    if (!seen.has(inc.code)) seen.set(inc.code, inc);
  }
  return Array.from(seen.values());
}

function readKvState(): SiteState | null {
  try {
    const out = execFileSync(
      "npx",
      ["wrangler", "kv", "key", "get", `--binding=${KV_BINDING}`, "--remote", KV_KEY],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
    const trimmed = out.trim();
    if (!trimmed) return null;
    return JSON.parse(trimmed) as SiteState;
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (msg.includes("not found") || msg.includes("does not exist")) return null;
    throw err;
  }
}

function writeKvState(state: SiteState): void {
  const tmpPath = `/tmp/site-state-${Date.now()}.json`;
  writeFileSync(tmpPath, JSON.stringify(state));
  execFileSync(
    "npx",
    [
      "wrangler", "kv", "key", "put",
      `--binding=${KV_BINDING}`, "--remote",
      KV_KEY, `--path=${tmpPath}`,
    ],
    { stdio: "inherit" },
  );
}

function readKvCalendarState(): CalendarState | null {
  try {
    const out = execFileSync(
      "npx",
      ["wrangler", "kv", "key", "get", `--binding=${KV_BINDING}`, "--remote", CALENDAR_KV_KEY],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
    const trimmed = out.trim();
    if (!trimmed) return null;
    return JSON.parse(trimmed) as CalendarState;
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (msg.includes("not found") || msg.includes("does not exist")) return null;
    throw err;
  }
}

function writeKvCalendarState(state: CalendarState): void {
  const tmpPath = `/tmp/calendar-state-${Date.now()}.json`;
  writeFileSync(tmpPath, JSON.stringify(state));
  execFileSync(
    "npx",
    [
      "wrangler", "kv", "key", "put",
      `--binding=${KV_BINDING}`, "--remote",
      CALENDAR_KV_KEY, `--path=${tmpPath}`,
    ],
    { stdio: "inherit" },
  );
}

function maxStreak(a: StreakRecord | null, b: StreakRecord | null): StreakRecord | null {
  if (!a) return b;
  if (!b) return a;
  return a.days >= b.days ? a : b;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[backfill] pages=${args.pages} asof=${formatUtcDate(args.asof)} dryRun=${args.dryRun}`,
  );

  const all: ParsedIncident[] = [];
  for (let page = 1; page <= args.pages; page++) {
    const html = await fetchHistoryPage(page);
    const props = extractReactProps(html);
    const items = parseIncidentsFromProps(props, page);
    console.log(`[backfill] page ${page}: ${items.length} incidents`);
    all.push(...items);
  }

  const deduped = dedupeByCode(all);
  const realOutages = deduped.filter((i) => i.impact !== "none");
  console.log(
    `[backfill] total=${all.length} unique=${deduped.length} realOutages=${realOutages.length}`,
  );

  realOutages.sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());
  const earliest = realOutages[0];
  const latest = realOutages[realOutages.length - 1];
  console.log(
    `[backfill] range: ${earliest ? formatUtcDate(earliest.pubDate) : "-"} → ` +
      `${latest ? formatUtcDate(latest.pubDate) : "-"}`,
  );

  // Calendar state: seed per-day incident data, merging history-preservingly
  // with whatever the hourly cron may already have written.
  const calendarIncidents: Incident[] = realOutages.map((i) => ({
    title: i.name,
    link: i.link,
    pubDate: i.pubDate,
  }));
  const existingCalendar = readKvCalendarState();
  const mergedCalendar = mergeCalendarState(existingCalendar, calendarIncidents, new Date());
  const calendarDayCount = Object.keys(mergedCalendar.days).length;
  console.log(
    `[backfill] calendar: ${calendarDayCount} incident days, first=${mergedCalendar.firstDate} ` +
      `(existing KV: ${existingCalendar ? "present" : "none"})`,
  );

  const computed = computeLongestGap(
    realOutages.map((i) => i.pubDate),
    args.asof,
  );
  if (!computed) {
    console.error("[backfill] no incidents — refusing to write");
    process.exit(2);
  }
  console.log(
    `[backfill] computed longest: ${computed.days} days, ${computed.startDate} → ${computed.endDate}`,
  );

  if (computed.days >= 100) {
    console.error(
      "[backfill] computed streak >= 100 days; this suggests missing data. Refusing to write.",
    );
    process.exit(3);
  }

  const existing = readKvState();
  console.log(
    `[backfill] existing KV state: ${existing ? "present" : "none"}` +
      (existing?.historicalLongestStreak
        ? ` (historical = ${existing.historicalLongestStreak.days} days)`
        : ""),
  );

  const merged: SiteState = existing
    ? {
        ...existing,
        historicalLongestStreak: maxStreak(existing.historicalLongestStreak, computed),
      }
    : {
        lastIncident: latest
          ? {
              pubDate: latest.pubDate.toISOString(),
              concurrent: [
                {
                  pubDate: latest.pubDate.toISOString(),
                  title: latest.name,
                  link: latest.link,
                },
              ],
            }
          : { pubDate: args.asof.toISOString(), concurrent: [] },
        historicalLongestStreak: computed,
        lastUpdatedAt: new Date().toISOString(),
      };

  const reportDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "analysis");
  mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportDir, `backfill-${stamp}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        args: { ...args, asof: formatUtcDate(args.asof) },
        counts: {
          rawTotal: all.length,
          uniqueByCode: deduped.length,
          realOutages: realOutages.length,
        },
        range: {
          earliest: earliest ? formatUtcDate(earliest.pubDate) : null,
          latest: latest ? formatUtcDate(latest.pubDate) : null,
        },
        computedStreak: computed,
        existingStreak: existing?.historicalLongestStreak ?? null,
        mergedStreak: merged.historicalLongestStreak,
        calendarDayCount,
        incidents: realOutages.map((i) => ({
          code: i.code,
          name: i.name,
          impact: i.impact,
          pubDate: formatUtcDate(i.pubDate),
          month: i.monthLabel,
          page: i.page,
          link: i.link,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`[backfill] audit report: ${reportPath}`);

  if (args.dryRun) {
    console.log("[backfill] DRY RUN — KV not updated.");
    console.log("[backfill] merged site-state would be:");
    console.log(JSON.stringify(merged, null, 2));
    console.log(`[backfill] merged calendar-state would cover ${calendarDayCount} days.`);
    return;
  }

  writeKvCalendarState(mergedCalendar);
  console.log("[backfill] calendar-state KV updated.");

  if (
    existing &&
    existing.historicalLongestStreak &&
    merged.historicalLongestStreak &&
    existing.historicalLongestStreak.days === merged.historicalLongestStreak.days &&
    existing.historicalLongestStreak.startDate === merged.historicalLongestStreak.startDate &&
    existing.historicalLongestStreak.endDate === merged.historicalLongestStreak.endDate
  ) {
    console.log("[backfill] site-state unchanged — existing record already covers the new one.");
    return;
  }

  writeKvState(merged);
  console.log("[backfill] site-state KV updated.");
}

main().catch((err) => {
  console.error("[backfill] FAILED:", err);
  process.exit(1);
});
