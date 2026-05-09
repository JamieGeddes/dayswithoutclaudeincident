import { describe, expect, it } from "vitest";
import { renderHtml } from "../src/render.js";
import type { Incident } from "../src/types.js";

const lastIncident: Incident = {
  title: "Elevated errors on Claude Opus 4.7",
  link: "https://status.claude.com/incidents/abc123",
  pubDate: new Date("2026-05-04T14:33:46Z"),
};

describe("renderHtml", () => {
  it("uses 'Days' (plural) for counts other than 1 and renders the integer in flip-cards", () => {
    const html = renderHtml({
      daysSince: 3,
      longestStreakDays: 14,
      lastIncident,
      generatedAt: new Date("2026-05-06T20:07:00Z"),
    });
    expect(html).toContain('class="card">3</div>');
    expect(html).toContain("Days without a Claude incident");
    expect(html).not.toContain("Day without");
  });

  it("uses 'Day' (singular) when daysSince is 1", () => {
    const html = renderHtml({
      daysSince: 1,
      longestStreakDays: 1,
      lastIncident,
      generatedAt: new Date("2026-05-06T20:07:00Z"),
    });
    expect(html).toContain('class="card">1</div>');
    expect(html).toContain("Day without a Claude incident");
    expect(html).toContain("1 day"); // singular for longest streak too
  });

  it("renders one flip-card per digit for multi-digit counts", () => {
    const html = renderHtml({
      daysSince: 421,
      longestStreakDays: 14,
      lastIncident,
      generatedAt: new Date("2026-05-08T12:00:00Z"),
    });
    const cards = html.match(/<div class="card">/g) ?? [];
    expect(cards.length).toBe(3);
    expect(html).toContain('class="card">4</div><div class="card">2</div><div class="card">1</div>');
  });

  it("escapes HTML in the incident title and link", () => {
    const html = renderHtml({
      daysSince: 0,
      longestStreakDays: 0,
      lastIncident: {
        title: "<script>alert(1)</script>",
        link: "https://x?a=1&b=2",
        pubDate: new Date("2026-05-06T00:00:00Z"),
      },
      generatedAt: new Date("2026-05-06T00:00:00Z"),
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("https://x?a=1&amp;b=2");
  });

  it("includes the disclaimer and a link to the incident", () => {
    const html = renderHtml({
      daysSince: 7,
      longestStreakDays: 7,
      lastIncident,
      generatedAt: new Date("2026-05-11T12:00:00Z"),
    });
    expect(html.toLowerCase()).toContain("not affiliated with anthropic");
    expect(html).toContain(`href="${lastIncident.link}"`);
  });

  it("minifies the output: no whitespace between tags and no CSS comments", () => {
    const html = renderHtml({
      daysSince: 3,
      longestStreakDays: 14,
      lastIncident,
      generatedAt: new Date("2026-05-06T20:07:00Z"),
    });
    expect(html).not.toMatch(/>\s+</);
    expect(html).not.toContain("/*");
  });

  it("renders a stable snapshot for fixed input", () => {
    const html = renderHtml({
      daysSince: 3,
      longestStreakDays: 14,
      lastIncident,
      generatedAt: new Date("2026-05-06T20:07:00Z"),
    });
    expect(html).toMatchSnapshot();
  });
});
