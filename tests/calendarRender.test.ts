import { describe, expect, it } from "vitest";
import type { CalendarGrid, CalendarMonth } from "../src/calendar.js";
import {
  renderCalendarGrid,
  renderCalendarMetaDescription,
  renderCalendarMonth,
  renderCalendarSummary,
  renderYearNav,
} from "../src/calendarRender.js";

const month = (overrides: Partial<CalendarMonth> = {}): CalendarMonth => ({
  year: 2026,
  month: 0,
  name: "January",
  label: "January 2026",
  leadingBlanks: 3,
  cells: [
    { date: "2026-01-01", count: 0, incidents: [] },
    {
      date: "2026-01-02",
      count: 1,
      incidents: [{ pubDate: "2026-01-02T10:00:00Z", title: "Elevated errors", link: "https://x" }],
    },
    {
      date: "2026-01-03",
      count: 2,
      incidents: [
        { pubDate: "2026-01-03T10:00:00Z", title: "a", link: "https://a" },
        { pubDate: "2026-01-03T12:00:00Z", title: "b", link: "https://b" },
      ],
    },
  ],
  ...overrides,
});

const grid = (overrides: Partial<CalendarGrid> = {}): CalendarGrid => ({
  year: 2026,
  months: [month()],
  incidentDayCount: 2,
  availableYears: [2025, 2026],
  ...overrides,
});

describe("renderCalendarMonth", () => {
  it("renders the bare month name and a pad cell per weekday offset", () => {
    const html = renderCalendarMonth(month());
    expect(html).toContain(">January</h2>");
    expect(html.match(/cal-pad/g) ?? []).toHaveLength(3);
  });

  it("renders one cell per day", () => {
    const html = renderCalendarMonth(month());
    expect(html.match(/class="cal-cell/g) ?? []).toHaveLength(3);
  });

  it("marks incident days and leaves quiet days as plain cells", () => {
    const html = renderCalendarMonth(month());
    expect(html.match(/cal-cell--incident/g) ?? []).toHaveLength(2);
    expect(html.match(/class="cal-cell"/g) ?? []).toHaveLength(1);
  });

  it("emits no day-number text — the grid reads as a heatmap", () => {
    const html = renderCalendarMonth(month());
    expect(html).not.toMatch(/>\d+</);
  });

  it("links a single-incident day straight to that incident", () => {
    const html = renderCalendarMonth(month());
    expect(html).toContain('href="https://x"');
  });

  it("links a multi-incident day to the status history page", () => {
    const html = renderCalendarMonth(month());
    expect(html).toContain('href="https://status.claude.com/history"');
  });

  it("uses singular/plural nouns in the accessible label", () => {
    const html = renderCalendarMonth(month());
    expect(html).toContain("1 incident on 2026-01-02");
    expect(html).toContain("2 incidents on 2026-01-03");
  });

  it("escapes HTML in the month name", () => {
    const html = renderCalendarMonth(month({ name: "<script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in incident links", () => {
    const html = renderCalendarMonth(
      month({
        cells: [
          {
            date: "2026-01-04",
            count: 1,
            incidents: [{ pubDate: "2026-01-04T10:00:00Z", title: "x", link: "https://x?a=1&b=2" }],
          },
        ],
      }),
    );
    expect(html).toContain("https://x?a=1&amp;b=2");
  });
});

describe("renderCalendarGrid", () => {
  it("renders one section per month", () => {
    const html = renderCalendarGrid(
      grid({ months: [month(), month({ name: "February", label: "February 2026" })] }),
    );
    expect(html.match(/cal-month"/g) ?? []).toHaveLength(2);
  });
});

describe("renderCalendarSummary", () => {
  it("pluralises the incident-day count", () => {
    expect(renderCalendarSummary(grid({ incidentDayCount: 2 }))).toContain("2</strong> incident days");
    expect(renderCalendarSummary(grid({ incidentDayCount: 1 }))).toContain("1</strong> incident day");
  });
});

describe("renderCalendarMetaDescription", () => {
  it("mentions the year and count", () => {
    const desc = renderCalendarMetaDescription(grid({ year: 2026, incidentDayCount: 2 }));
    expect(desc).toContain("2026");
    expect(desc).toContain("2 days");
  });
});

describe("renderYearNav", () => {
  it("renders a link per year and marks the active one", () => {
    const html = renderYearNav(grid({ year: 2026, availableYears: [2025, 2026] }));
    expect(html).toContain('href="/calendar?year=2025"');
    expect(html).toContain("cal-year--active");
    expect(html).not.toContain('href="/calendar?year=2026"');
  });

  it("renders nothing when only one year of data exists", () => {
    expect(renderYearNav(grid({ availableYears: [2026] }))).toBe("");
  });
});
