import { XMLParser } from "fast-xml-parser";
import type { Incident } from "./types.js";

export const STATUS_RSS_URL = "https://status.claude.com/history.rss";

export async function fetchIncidents(url: string = STATUS_RSS_URL): Promise<Incident[]> {
  const res = await fetch(url, { headers: { "user-agent": "dayswithoutclaudeincident/1.0" } });
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  }
  return parseIncidents(await res.text());
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  cdataPropName: "__cdata",
  isArray: (tag) => tag === "item",
  stopNodes: ["*.description"],
});

interface RawItem {
  title?: string | { __cdata?: string };
  link?: string | { __cdata?: string };
  pubDate?: string | { __cdata?: string };
}

interface RawFeed {
  rss?: { channel?: { item?: RawItem[] } };
}

export function parseIncidents(xml: string): Incident[] {
  const feed = parser.parse(xml) as RawFeed;
  const items = feed.rss?.channel?.item ?? [];

  const incidents: Incident[] = [];
  for (const item of items) {
    const title = textOf(item.title);
    const link = textOf(item.link);
    const pubDateRaw = textOf(item.pubDate);
    if (!title || !link || !pubDateRaw) continue;
    const pubDate = new Date(pubDateRaw);
    if (Number.isNaN(pubDate.getTime())) continue;
    incidents.push({ title, link, pubDate });
  }

  incidents.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return incidents;
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object" && "__cdata" in value) {
    const cdata = (value as { __cdata?: unknown }).__cdata;
    if (typeof cdata === "string") return cdata.trim() || null;
  }
  return null;
}
