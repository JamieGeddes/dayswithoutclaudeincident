import type { CalendarState, SiteState } from "./types.js";

export async function loadState(kv: KVNamespace, key: string): Promise<SiteState | null> {
  return await kv.get<SiteState>(key, "json");
}

export async function saveState(kv: KVNamespace, key: string, state: SiteState): Promise<void> {
  await kv.put(key, JSON.stringify(state));
}

export async function loadCalendarState(
  kv: KVNamespace,
  key: string,
): Promise<CalendarState | null> {
  return await kv.get<CalendarState>(key, "json");
}

export async function saveCalendarState(
  kv: KVNamespace,
  key: string,
  state: CalendarState,
): Promise<void> {
  await kv.put(key, JSON.stringify(state));
}
