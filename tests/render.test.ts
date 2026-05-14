import { describe, expect, it } from "vitest";
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
} from "../src/render.js";
import type { StoredIncident } from "../src/types.js";

describe("renderCards", () => {
  it("renders one flip-card per digit", () => {
    expect(renderCards(3)).toBe('<div class="card">3</div>');
    expect(renderCards(421)).toBe(
      '<div class="card">4</div><div class="card">2</div><div class="card">1</div>',
    );
    expect(renderCards(0)).toBe('<div class="card">0</div>');
  });
});

describe("renderCardsAriaLabel", () => {
  it("uses singular 'day' when count is 1", () => {
    expect(renderCardsAriaLabel(1)).toBe("1 day");
  });

  it("uses plural 'days' otherwise", () => {
    expect(renderCardsAriaLabel(0)).toBe("0 days");
    expect(renderCardsAriaLabel(42)).toBe("42 days");
  });
});

describe("renderCaption", () => {
  it("uses singular form for 1", () => {
    expect(renderCaption(1)).toBe("Day without a Claude incident");
  });

  it("uses plural form for other counts", () => {
    expect(renderCaption(0)).toBe("Days without a Claude incident");
    expect(renderCaption(99)).toBe("Days without a Claude incident");
  });
});

describe("renderTitle", () => {
  it("matches the count and pluralisation", () => {
    expect(renderTitle(1)).toBe("1 day without a Claude incident");
    expect(renderTitle(3)).toBe("3 days without a Claude incident");
  });
});

describe("renderMetaDescription", () => {
  it("matches the count and pluralisation and mentions the status page", () => {
    expect(renderMetaDescription(1)).toContain("1 day");
    expect(renderMetaDescription(7)).toContain("7 days");
    expect(renderMetaDescription(7)).toContain("Anthropic Claude status page");
  });
});

describe("renderLongestStreak", () => {
  it("renders the count and date range with strong tag", () => {
    expect(renderLongestStreak({ days: 14, startDate: "2026-04-01", endDate: "2026-04-15" })).toBe(
      "<strong>14 days</strong> (2026-04-01 to 2026-04-15)",
    );
  });

  it("uses singular 'day' when the streak is 1", () => {
    expect(renderLongestStreak({ days: 1, startDate: "2026-04-01", endDate: "2026-04-02" })).toBe(
      "<strong>1 day</strong> (2026-04-01 to 2026-04-02)",
    );
  });

  it("escapes HTML in date strings", () => {
    expect(renderLongestStreak({ days: 1, startDate: "<x>", endDate: "&y" })).toContain("&lt;x&gt;");
    expect(renderLongestStreak({ days: 1, startDate: "<x>", endDate: "&y" })).toContain("&amp;y");
  });
});

describe("renderIncidentsLabel", () => {
  it("uses singular noun and the incident date for one incident", () => {
    const incidents: StoredIncident[] = [
      { pubDate: "2026-05-04T14:33:46.000Z", title: "x", link: "https://x" },
    ];
    expect(renderIncidentsLabel(incidents)).toBe("Last incident (2026-05-04)");
  });

  it("uses plural noun and the shared date for multiple same-day incidents", () => {
    const incidents: StoredIncident[] = [
      { pubDate: "2026-05-08T18:00:00.000Z", title: "a", link: "https://a" },
      { pubDate: "2026-05-08T03:30:00.000Z", title: "b", link: "https://b" },
    ];
    expect(renderIncidentsLabel(incidents)).toBe("Last incidents (2026-05-08)");
  });

  it("throws when called with no incidents", () => {
    expect(() => renderIncidentsLabel([])).toThrow();
  });
});

describe("renderIncidentList", () => {
  it("renders one <li> per incident with an escaped link and title", () => {
    const incidents: StoredIncident[] = [
      { pubDate: "2026-05-04T14:33:46.000Z", title: "Elevated errors", link: "https://x" },
      { pubDate: "2026-05-04T10:00:00.000Z", title: "Other", link: "https://y" },
    ];
    const html = renderIncidentList(incidents);
    const items = html.match(/<li>/g) ?? [];
    expect(items.length).toBe(2);
    expect(html).toContain('href="https://x"');
    expect(html).toContain("Elevated errors");
    expect(html).toContain("rel=\"noopener noreferrer\"");
  });

  it("appends the UTC time to each item when there is more than one incident", () => {
    const incidents: StoredIncident[] = [
      { pubDate: "2026-05-04T14:33:46.000Z", title: "Elevated errors", link: "https://x" },
      { pubDate: "2026-05-04T10:00:00.000Z", title: "Other", link: "https://y" },
    ];
    const html = renderIncidentList(incidents);
    expect(html).toContain('<span class="incident-time">(14:33 UTC)</span>');
    expect(html).toContain('<span class="incident-time">(10:00 UTC)</span>');
  });

  it("omits the time for a single incident", () => {
    const incidents: StoredIncident[] = [
      { pubDate: "2026-05-04T14:33:46.000Z", title: "Elevated errors", link: "https://x" },
    ];
    const html = renderIncidentList(incidents);
    expect(html).not.toContain("incident-time");
  });

  it("escapes HTML in title and link", () => {
    const incidents: StoredIncident[] = [
      {
        pubDate: "2026-05-04T14:33:46.000Z",
        title: "<script>alert(1)</script>",
        link: "https://x?a=1&b=2",
      },
    ];
    const html = renderIncidentList(incidents);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("https://x?a=1&amp;b=2");
  });
});

describe("formatGeneratedAt", () => {
  it("formats as YYYY-MM-DD HH:MM UTC", () => {
    expect(formatGeneratedAt(new Date("2026-05-06T20:07:00Z"))).toBe("2026-05-06 20:07 UTC");
    expect(formatGeneratedAt(new Date("2026-01-02T00:00:00Z"))).toBe("2026-01-02 00:00 UTC");
  });
});
