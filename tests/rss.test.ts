import { describe, expect, it } from "vitest";
import { parseIncidents } from "../src/rss.js";

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
