import { describe, expect, it } from "vitest";
import { daysSinceUtc, updateState } from "../src/streak.js";
import type { Incident, State } from "../src/types.js";

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

const incident = (iso: string, suffix = ""): Incident => ({
  title: `Incident ${suffix}`,
  link: `https://status.claude.com/incidents/${suffix}`,
  pubDate: new Date(iso),
});

describe("updateState", () => {
  it("first run: longestStreakDays seeds from current daysSince", () => {
    const latest = incident("2026-05-01T12:00:00Z", "a");
    const now = new Date("2026-05-06T12:00:00Z");
    const r = updateState(null, latest, now);
    expect(r.daysSince).toBe(5);
    expect(r.longestStreakDays).toBe(5);
    expect(r.newState.lastIncident.link).toBe(latest.link);
    expect(r.newState.lastIncident.pubDate).toBe("2026-05-01T12:00:00.000Z");
  });

  it("same incident as last run: longest grows monotonically with current streak", () => {
    const prev: State = {
      lastIncident: { pubDate: "2026-05-01T12:00:00.000Z", title: "x", link: "https://x" },
      longestStreakDays: 3,
      lastUpdatedAt: "2026-05-04T00:00:00.000Z",
    };
    const latest = incident("2026-05-01T12:00:00Z", "a");
    const now = new Date("2026-05-08T12:00:00Z");
    const r = updateState(prev, latest, now);
    expect(r.daysSince).toBe(7);
    expect(r.longestStreakDays).toBe(7);
  });

  it("same incident: longest does not regress when current streak is shorter", () => {
    const prev: State = {
      lastIncident: { pubDate: "2026-05-01T12:00:00.000Z", title: "x", link: "https://x" },
      longestStreakDays: 42,
      lastUpdatedAt: "2026-05-04T00:00:00.000Z",
    };
    const latest = incident("2026-05-01T12:00:00Z", "a");
    const now = new Date("2026-05-08T12:00:00Z");
    const r = updateState(prev, latest, now);
    expect(r.daysSince).toBe(7);
    expect(r.longestStreakDays).toBe(42);
  });

  it("new incident: longest is max(prev, ended streak, current daysSince)", () => {
    const prev: State = {
      lastIncident: { pubDate: "2026-04-01T00:00:00.000Z", title: "old", link: "https://old" },
      longestStreakDays: 10,
      lastUpdatedAt: "2026-04-29T00:00:00.000Z",
    };
    const latest = incident("2026-05-01T00:00:00Z", "new");
    const now = new Date("2026-05-04T00:00:00Z");
    const r = updateState(prev, latest, now);
    expect(r.daysSince).toBe(3);
    expect(r.longestStreakDays).toBe(30);
  });
});
