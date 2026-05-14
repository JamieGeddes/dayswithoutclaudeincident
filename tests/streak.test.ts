import { describe, expect, it } from "vitest";
import {
  computeView,
  daysSinceUtc,
  formatUtcDate,
  formatUtcTime,
  updateState,
} from "../src/streak.js";
import type { Incident, SiteState } from "../src/types.js";

describe("daysSinceUtc", () => {
  it("returns 0 for the same UTC calendar day even across hours", () => {
    const from = new Date("2026-05-06T01:00:00Z");
    const now = new Date("2026-05-06T23:59:59Z");
    expect(daysSinceUtc(from, now)).toBe(0);
  });

  it("returns 1 once the UTC date crosses midnight, regardless of clock time", () => {
    const from = new Date("2026-05-06T23:59:00Z");
    const now = new Date("2026-05-07T00:01:00Z");
    expect(daysSinceUtc(from, now)).toBe(1);
  });

  it("counts whole UTC calendar-day gaps", () => {
    const from = new Date("2026-05-01T12:00:00Z");
    const now = new Date("2026-05-08T03:00:00Z");
    expect(daysSinceUtc(from, now)).toBe(7);
  });

  it("never goes negative if 'from' is in the future", () => {
    const from = new Date("2026-05-08T00:00:00Z");
    const now = new Date("2026-05-06T00:00:00Z");
    expect(daysSinceUtc(from, now)).toBe(0);
  });
});

describe("formatUtcDate", () => {
  it("formats as YYYY-MM-DD in UTC", () => {
    expect(formatUtcDate(new Date("2026-05-08T23:59:00Z"))).toBe("2026-05-08");
    expect(formatUtcDate(new Date("2026-01-02T00:00:00Z"))).toBe("2026-01-02");
  });
});

describe("formatUtcTime", () => {
  it("formats as zero-padded HH:MM UTC", () => {
    expect(formatUtcTime(new Date("2026-05-06T20:07:00Z"))).toBe("20:07 UTC");
    expect(formatUtcTime(new Date("2026-05-06T00:00:00Z"))).toBe("00:00 UTC");
    expect(formatUtcTime(new Date("2026-05-06T09:05:59Z"))).toBe("09:05 UTC");
  });
});

const incident = (iso: string, suffix = ""): Incident => ({
  title: `Incident ${suffix}`,
  link: `https://status.claude.com/incidents/${suffix}`,
  pubDate: new Date(iso),
});

describe("updateState", () => {
  it("first run: stores the latest incident and leaves historicalLongestStreak null", () => {
    const latest = incident("2026-05-01T12:00:00Z", "a");
    const now = new Date("2026-05-06T12:00:00Z");
    const s = updateState(null, [latest], now);
    expect(s.lastIncident.pubDate).toBe("2026-05-01T12:00:00.000Z");
    expect(s.lastIncident.concurrent).toHaveLength(1);
    expect(s.lastIncident.concurrent[0]!.link).toBe(latest.link);
    expect(s.historicalLongestStreak).toBeNull();
    expect(s.lastUpdatedAt).toBe(now.toISOString());
  });

  it("same incident as last run: historical record is unchanged", () => {
    const prev: SiteState = {
      lastIncident: {
        pubDate: "2026-05-01T12:00:00.000Z",
        concurrent: [{ pubDate: "2026-05-01T12:00:00.000Z", title: "x", link: "https://x" }],
      },
      historicalLongestStreak: { days: 42, startDate: "2024-01-01", endDate: "2024-02-12" },
      lastUpdatedAt: "2026-05-04T00:00:00.000Z",
    };
    const latest = incident("2026-05-01T12:00:00Z", "a");
    const now = new Date("2026-05-08T12:00:00Z");
    const s = updateState(prev, [latest], now);
    expect(s.historicalLongestStreak).toEqual(prev.historicalLongestStreak);
    expect(s.lastIncident.pubDate).toBe("2026-05-01T12:00:00.000Z");
  });

  it("new incident: records the ended streak if it beats the historical max", () => {
    const prev: SiteState = {
      lastIncident: {
        pubDate: "2026-04-01T00:00:00.000Z",
        concurrent: [{ pubDate: "2026-04-01T00:00:00.000Z", title: "old", link: "https://old" }],
      },
      historicalLongestStreak: { days: 10, startDate: "2026-03-15", endDate: "2026-03-25" },
      lastUpdatedAt: "2026-04-29T00:00:00.000Z",
    };
    const latest = incident("2026-05-01T00:00:00Z", "new");
    const now = new Date("2026-05-04T00:00:00Z");
    const s = updateState(prev, [latest], now);
    expect(s.historicalLongestStreak).toEqual({
      days: 30,
      startDate: "2026-04-01",
      endDate: "2026-05-01",
    });
    expect(s.lastIncident.pubDate).toBe("2026-05-01T00:00:00.000Z");
  });

  it("new incident: keeps the prior historical record if the ended streak is shorter", () => {
    const prev: SiteState = {
      lastIncident: {
        pubDate: "2026-04-29T00:00:00.000Z",
        concurrent: [{ pubDate: "2026-04-29T00:00:00.000Z", title: "old", link: "https://old" }],
      },
      historicalLongestStreak: { days: 42, startDate: "2024-01-01", endDate: "2024-02-12" },
      lastUpdatedAt: "2026-04-30T00:00:00.000Z",
    };
    const latest = incident("2026-05-01T00:00:00Z", "new");
    const now = new Date("2026-05-04T00:00:00Z");
    const s = updateState(prev, [latest], now);
    expect(s.historicalLongestStreak).toEqual(prev.historicalLongestStreak);
  });

  it("stores all concurrent incidents preserving order", () => {
    const concurrent = [
      incident("2026-05-08T18:00:00Z", "a"),
      incident("2026-05-08T12:00:00Z", "b"),
      incident("2026-05-08T03:30:00Z", "c"),
    ];
    const now = new Date("2026-05-08T19:00:00Z");
    const s = updateState(null, concurrent, now);
    expect(s.lastIncident.pubDate).toBe("2026-05-08T18:00:00.000Z");
    expect(s.lastIncident.concurrent.map((i) => i.link)).toEqual([
      "https://status.claude.com/incidents/a",
      "https://status.claude.com/incidents/b",
      "https://status.claude.com/incidents/c",
    ]);
  });

  it("throws when called with no incidents", () => {
    expect(() => updateState(null, [], new Date())).toThrow();
  });
});

describe("computeView", () => {
  const baseState: SiteState = {
    lastIncident: {
      pubDate: "2026-05-01T12:00:00.000Z",
      concurrent: [{ pubDate: "2026-05-01T12:00:00.000Z", title: "x", link: "https://x" }],
    },
    historicalLongestStreak: null,
    lastUpdatedAt: "2026-05-01T12:00:00.000Z",
  };

  it("derives daysSince from lastIncident.pubDate vs now", () => {
    const view = computeView(baseState, new Date("2026-05-08T03:00:00Z"));
    expect(view.daysSince).toBe(7);
  });

  it("shows the active streak as longest when no historical record exists", () => {
    const view = computeView(baseState, new Date("2026-05-08T03:00:00Z"));
    expect(view.longestStreak).toEqual({ days: 7, startDate: "2026-05-01", endDate: "2026-05-08" });
  });

  it("shows the historical record when it beats the active streak", () => {
    const state: SiteState = {
      ...baseState,
      historicalLongestStreak: { days: 42, startDate: "2024-01-01", endDate: "2024-02-12" },
    };
    const view = computeView(state, new Date("2026-05-08T03:00:00Z"));
    expect(view.daysSince).toBe(7);
    expect(view.longestStreak.days).toBe(42);
    expect(view.longestStreak.startDate).toBe("2024-01-01");
    expect(view.longestStreak.endDate).toBe("2024-02-12");
  });

  it("shows the active streak when it overtakes the historical record", () => {
    const state: SiteState = {
      ...baseState,
      historicalLongestStreak: { days: 5, startDate: "2025-01-01", endDate: "2025-01-06" },
    };
    const view = computeView(state, new Date("2026-05-08T03:00:00Z"));
    expect(view.daysSince).toBe(7);
    expect(view.longestStreak.days).toBe(7);
    expect(view.longestStreak.startDate).toBe("2026-05-01");
    expect(view.longestStreak.endDate).toBe("2026-05-08");
  });

  it("prefers the historical record on a tie", () => {
    const state: SiteState = {
      ...baseState,
      historicalLongestStreak: { days: 7, startDate: "2025-01-01", endDate: "2025-01-08" },
    };
    const view = computeView(state, new Date("2026-05-08T03:00:00Z"));
    expect(view.longestStreak.startDate).toBe("2025-01-01");
  });
});
