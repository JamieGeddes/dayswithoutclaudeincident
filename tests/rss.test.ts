import { describe, expect, it } from "vitest";
import { parseIncidents, selectConcurrent } from "../src/rss.js";
import type { Incident } from "../src/types.js";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Claude Status - Incident History</title>
    <link>https://status.claude.com</link>
    <item>
      <title>Elevated errors across multiple models</title>
      <description>html stripped here</description>
      <pubDate>Wed, 06 May 2026 16:51:13 +0000</pubDate>
      <link>https://status.claude.com/incidents/437swp24nrf4</link>
      <guid>https://status.claude.com/incidents/437swp24nrf4</guid>
    </item>
    <item>
      <title>Elevated errors on Claude Opus 4.5 and Sonnet 4.5</title>
      <description>html stripped here</description>
      <pubDate>Mon, 04 May 2026 14:45:58 +0000</pubDate>
      <link>https://status.claude.com/incidents/77j6yv8kc0vn</link>
      <guid>https://status.claude.com/incidents/77j6yv8kc0vn</guid>
    </item>
    <item>
      <title><![CDATA[Elevated errors on Claude Haiku 4.5]]></title>
      <description>html stripped here</description>
      <pubDate>Thu, 30 Apr 2026 14:01:41 +0000</pubDate>
      <link>https://status.claude.com/incidents/dv9r688vqt8s</link>
      <guid>https://status.claude.com/incidents/dv9r688vqt8s</guid>
    </item>
  </channel>
</rss>`;

describe("parseIncidents", () => {
  it("extracts each item's title, link, and pubDate", () => {
    const incidents = parseIncidents(FIXTURE);
    expect(incidents).toHaveLength(3);
    const first = incidents[0]!;
    expect(first.title).toBe("Elevated errors across multiple models");
    expect(first.link).toBe("https://status.claude.com/incidents/437swp24nrf4");
    expect(first.pubDate.toISOString()).toBe("2026-05-06T16:51:13.000Z");
  });

  it("returns incidents sorted descending by pubDate", () => {
    const incidents = parseIncidents(FIXTURE);
    const dates = incidents.map((i) => i.pubDate.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("decodes CDATA-wrapped titles", () => {
    const incidents = parseIncidents(FIXTURE);
    expect(incidents[2]!.title).toBe("Elevated errors on Claude Haiku 4.5");
  });

  it("ignores items missing a pubDate", () => {
    const broken = `<rss><channel>
      <item><title>good</title><link>https://x</link><pubDate>Wed, 06 May 2026 16:51:13 +0000</pubDate></item>
      <item><title>bad</title><link>https://y</link></item>
    </channel></rss>`;
    expect(parseIncidents(broken)).toHaveLength(1);
  });
});

const inc = (iso: string, suffix: string): Incident => ({
  title: `Incident ${suffix}`,
  link: `https://status.claude.com/incidents/${suffix}`,
  pubDate: new Date(iso),
});

describe("selectConcurrent", () => {
  it("returns [] for an empty list", () => {
    expect(selectConcurrent([])).toEqual([]);
  });

  it("returns all incidents that share the most-recent UTC date", () => {
    const incidents = [
      inc("2026-05-08T18:00:00Z", "a"),
      inc("2026-05-08T12:00:00Z", "b"),
      inc("2026-05-08T03:30:00Z", "c"),
      inc("2026-05-04T14:00:00Z", "older"),
    ];
    const result = selectConcurrent(incidents);
    expect(result.map((i) => i.link)).toEqual([
      "https://status.claude.com/incidents/a",
      "https://status.claude.com/incidents/b",
      "https://status.claude.com/incidents/c",
    ]);
  });

  it("returns just the latest when no others share its UTC date", () => {
    const incidents = [
      inc("2026-05-08T01:00:00Z", "latest"),
      inc("2026-05-07T23:00:00Z", "yesterday"),
    ];
    expect(selectConcurrent(incidents)).toHaveLength(1);
    expect(selectConcurrent(incidents)[0]!.link).toBe("https://status.claude.com/incidents/latest");
  });

  it("respects the UTC midnight boundary", () => {
    const incidents = [
      inc("2026-05-08T00:01:00Z", "after-midnight"),
      inc("2026-05-07T23:59:00Z", "before-midnight"),
    ];
    const result = selectConcurrent(incidents);
    expect(result).toHaveLength(1);
    expect(result[0]!.link).toBe("https://status.claude.com/incidents/after-midnight");
  });
});
