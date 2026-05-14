import { describe, expect, it } from "vitest";
import {
  buildCalendarGrid,
  incidentsToCalendarDays,
  mergeCalendarState,
} from "../src/calendar.js";
import type { CalendarState, Incident } from "../src/types.js";

const incident = (iso: string, suffix = "a"): Incident => ({
  title: `Incident ${suffix}`,
  link: `https://status.claude.com/incidents/${suffix}`,
  pubDate: new Date(iso),
});

describe("incidentsToCalendarDays", () => {
  it("groups incidents by UTC calendar day", () => {
    const days = incidentsToCalendarDays([
      incident("2026-05-08T18:00:00Z", "a"),
      incident("2026-05-08T03:00:00Z", "b"),
      incident("2026-05-10T12:00:00Z", "c"),
    ]);
    expect(Object.keys(days).sort()).toEqual(["2026-05-08", "2026-05-10"]);
    expect(days["2026-05-08"]!.count).toBe(2);
    expect(days["2026-05-10"]!.count).toBe(1);
  });

  it("dedupes by link within a day", () => {
    const days = incidentsToCalendarDays([
      incident("2026-05-08T18:00:00Z", "a"),
      incident("2026-05-08T03:00:00Z", "a"),
    ]);
    expect(days["2026-05-08"]!.count).toBe(1);
    expect(days["2026-05-08"]!.incidents).toHaveLength(1);
  });

  it("buckets by UTC day even across hour boundaries", () => {
    const days = incidentsToCalendarDays([incident("2026-05-08T23:59:59Z", "late")]);
    expect(Object.keys(days)).toEqual(["2026-05-08"]);
  });

  it("returns an empty map for no incidents", () => {
    expect(incidentsToCalendarDays([])).toEqual({});
  });
});

describe("mergeCalendarState", () => {
  const now = new Date("2026-05-14T12:00:00Z");

  it("first run: builds state from incidents and sets firstDate", () => {
    const state = mergeCalendarState(
      null,
      [incident("2026-05-10T12:00:00Z", "a"), incident("2026-05-08T12:00:00Z", "b")],
      now,
    );
    expect(state.firstDate).toBe("2026-05-08");
    expect(Object.keys(state.days).sort()).toEqual(["2026-05-08", "2026-05-10"]);
    expect(state.lastUpdatedAt).toBe(now.toISOString());
  });

  it("preserves existing days not present in the new batch", () => {
    const prev = mergeCalendarState(null, [incident("2026-01-02T12:00:00Z", "old")], now);
    const merged = mergeCalendarState(prev, [incident("2026-05-08T12:00:00Z", "new")], now);
    expect(Object.keys(merged.days).sort()).toEqual(["2026-01-02", "2026-05-08"]);
    expect(merged.firstDate).toBe("2026-01-02");
  });

  it("unions incidents into an existing day without duplicating by link", () => {
    const prev = mergeCalendarState(null, [incident("2026-05-08T03:00:00Z", "a")], now);
    const merged = mergeCalendarState(
      prev,
      [incident("2026-05-08T18:00:00Z", "b"), incident("2026-05-08T20:00:00Z", "a")],
      now,
    );
    expect(merged.days["2026-05-08"]!.count).toBe(2);
    expect(merged.days["2026-05-08"]!.incidents.map((i) => i.link).sort()).toEqual([
      "https://status.claude.com/incidents/a",
      "https://status.claude.com/incidents/b",
    ]);
  });

  it("does not mutate the previous state", () => {
    const prev = mergeCalendarState(null, [incident("2026-05-08T03:00:00Z", "a")], now);
    mergeCalendarState(prev, [incident("2026-05-08T18:00:00Z", "b")], now);
    expect(prev.days["2026-05-08"]!.count).toBe(1);
  });

  it("falls back to now for firstDate when there are no incidents at all", () => {
    const state = mergeCalendarState(null, [], now);
    expect(state.firstDate).toBe("2026-05-14");
    expect(state.days).toEqual({});
  });
});

describe("buildCalendarGrid", () => {
  const state: CalendarState = {
    days: {
      "2025-03-04": {
        date: "2025-03-04",
        count: 1,
        incidents: [{ pubDate: "2025-03-04T10:00:00Z", title: "x", link: "https://x" }],
      },
      "2026-01-15": {
        date: "2026-01-15",
        count: 2,
        incidents: [
          { pubDate: "2026-01-15T10:00:00Z", title: "y", link: "https://y" },
          { pubDate: "2026-01-15T12:00:00Z", title: "z", link: "https://z" },
        ],
      },
    },
    firstDate: "2025-03-04",
    lastUpdatedAt: "2026-05-14T00:00:00Z",
  };

  it("defaults to the current UTC year and stops at the current month", () => {
    const grid = buildCalendarGrid(state, new Date("2026-05-14T12:00:00Z"));
    expect(grid.year).toBe(2026);
    expect(grid.months.map((m) => m.month)).toEqual([0, 1, 2, 3, 4]);
    expect(grid.months.map((m) => m.name)).toEqual([
      "January",
      "February",
      "March",
      "April",
      "May",
    ]);
  });

  it("starts a past year at the first-incident month", () => {
    const grid = buildCalendarGrid(state, new Date("2026-05-14T12:00:00Z"), 2025);
    expect(grid.months[0]!.month).toBe(2);
    expect(grid.months[grid.months.length - 1]!.month).toBe(11);
  });

  it("flags incident days and counts them for the year", () => {
    const grid = buildCalendarGrid(state, new Date("2026-05-14T12:00:00Z"), 2026);
    expect(grid.incidentDayCount).toBe(1);
    const jan = grid.months[0]!;
    const day15 = jan.cells.find((c) => c.date === "2026-01-15")!;
    expect(day15.count).toBe(2);
    const day14 = jan.cells.find((c) => c.date === "2026-01-14")!;
    expect(day14.count).toBe(0);
  });

  it("computes Monday-first leading blanks for the first day of a month", () => {
    // 1 Jan 2026 is a Thursday -> Mon,Tue,Wed blank = 3.
    const grid = buildCalendarGrid(state, new Date("2026-05-14T12:00:00Z"), 2026);
    expect(grid.months[0]!.leadingBlanks).toBe(3);
  });

  it("produces one cell per calendar day in the month", () => {
    const grid = buildCalendarGrid(state, new Date("2026-05-14T12:00:00Z"), 2026);
    expect(grid.months[0]!.cells).toHaveLength(31); // January
    expect(grid.months[1]!.cells).toHaveLength(28); // February 2026
  });

  it("lists every year from the first incident to now", () => {
    const grid = buildCalendarGrid(state, new Date("2026-05-14T12:00:00Z"));
    expect(grid.availableYears).toEqual([2025, 2026]);
  });

  it("handles empty history without throwing", () => {
    const empty: CalendarState = {
      days: {},
      firstDate: "2026-05-14",
      lastUpdatedAt: "2026-05-14T00:00:00Z",
    };
    const grid = buildCalendarGrid(empty, new Date("2026-05-14T12:00:00Z"));
    expect(grid.incidentDayCount).toBe(0);
    expect(grid.availableYears).toEqual([2026]);
    expect(grid.months[0]!.month).toBe(4); // starts at May (first-incident month == now)
  });
});
