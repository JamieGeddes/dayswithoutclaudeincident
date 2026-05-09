import { describe, expect, it } from "vitest";
import { renderHtml, type RenderArgs } from "../src/render.js";
import type { Incident } from "../src/types.js";

const lastIncident: Incident = {
  title: "Elevated errors on Claude Opus 4.7",
  link: "https://status.claude.com/incidents/abc123",
  pubDate: new Date("2026-05-04T14:33:46Z"),
};

const baseArgs: RenderArgs = {
  daysSince: 3,
  longestStreakDays: 14,
  longestStreakStart: "2026-04-01",
  longestStreakEnd: "2026-04-15",
  latestIncidents: [lastIncident],
  generatedAt: new Date("2026-05-06T20:07:00Z"),
};

describe("renderHtml", () => {
  it("uses 'Days' (plural) for counts other than 1 and renders the integer in flip-cards", () => {
    const html = renderHtml(baseArgs);
    expect(html).toContain('class="card">3</div>');
    expect(html).toContain("Days without a Claude incident");
    expect(html).not.toContain("Day without");
  });

  it("uses 'Day' (singular) when daysSince is 1", () => {
    const html = renderHtml({ ...baseArgs, daysSince: 1, longestStreakDays: 1 });
    expect(html).toContain('class="card">1</div>');
    expect(html).toContain("Day without a Claude incident");
    expect(html).toContain("<strong>1 day</strong>");
  });

  it("renders one flip-card per digit for multi-digit counts", () => {
    const html = renderHtml({ ...baseArgs, daysSince: 421 });
    const cards = html.match(/<div class="card">/g) ?? [];
    expect(cards.length).toBe(3);
    expect(html).toContain('class="card">4</div><div class="card">2</div><div class="card">1</div>');
  });

  it("escapes HTML in the incident title and link", () => {
    const html = renderHtml({
      ...baseArgs,
      daysSince: 0,
      longestStreakDays: 0,
      latestIncidents: [
        {
          title: "<script>alert(1)</script>",
          link: "https://x?a=1&b=2",
          pubDate: new Date("2026-05-06T00:00:00Z"),
        },
      ],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("https://x?a=1&amp;b=2");
  });

  it("includes the disclaimer and a link to the incident", () => {
    const html = renderHtml({ ...baseArgs, daysSince: 7, longestStreakDays: 7 });
    expect(html.toLowerCase()).toContain("not affiliated with anthropic");
    expect(html).toContain(`href="${lastIncident.link}"`);
  });

  it("bolds the days count and shows the streak date range in brackets", () => {
    const html = renderHtml(baseArgs);
    expect(html).toContain("<strong>14 days</strong> (2026-04-01 to 2026-04-15)");
  });

  it("uses singular label with shared date and a one-item list for a single incident", () => {
    const html = renderHtml({
      ...baseArgs,
      daysSince: 0,
      generatedAt: new Date("2026-05-04T15:00:00Z"),
    });
    expect(html).toContain("<dt>Last incident (2026-05-04)</dt>");
    expect(html).not.toContain("Last incidents");
    const items = html.match(/<li>/g) ?? [];
    expect(items.length).toBe(1);
  });

  it("pluralises label, shows the shared date once, and renders one <li> per concurrent incident", () => {
    const html = renderHtml({
      ...baseArgs,
      daysSince: 0,
      longestStreakDays: 9,
      longestStreakStart: "2026-04-01",
      longestStreakEnd: "2026-04-10",
      latestIncidents: [
        {
          title: "Elevated errors on Claude Opus",
          link: "https://status.claude.com/incidents/aaa",
          pubDate: new Date("2026-05-08T18:00:00Z"),
        },
        {
          title: "Console latency",
          link: "https://status.claude.com/incidents/bbb",
          pubDate: new Date("2026-05-08T12:00:00Z"),
        },
        {
          title: "API 5xx spike",
          link: "https://status.claude.com/incidents/ccc",
          pubDate: new Date("2026-05-08T03:30:00Z"),
        },
      ],
      generatedAt: new Date("2026-05-08T19:00:00Z"),
    });
    expect(html).toContain("<dt>Last incidents (2026-05-08)</dt>");
    const items = html.match(/<li>/g) ?? [];
    expect(items.length).toBe(3);
    expect(html).not.toMatch(/<li>[^<]*2026-05-08/);
    expect(html).toContain('href="https://status.claude.com/incidents/aaa"');
    expect(html).toContain('href="https://status.claude.com/incidents/bbb"');
    expect(html).toContain('href="https://status.claude.com/incidents/ccc"');
  });

  it("minifies the output: no whitespace between tags and no CSS comments", () => {
    const html = renderHtml(baseArgs);
    expect(html).not.toMatch(/>\s+</);
    expect(html).not.toContain("/*");
  });

  it("renders a stable snapshot for fixed input", () => {
    const html = renderHtml(baseArgs);
    expect(html).toMatchSnapshot();
  });
});
