import type { SiteState } from "./types.js";

export async function loadState(kv: KVNamespace, key: string): Promise<SiteState | null> {
  return await kv.get<SiteState>(key, "json");
}

export async function saveState(kv: KVNamespace, key: string, state: SiteState): Promise<void> {
  await kv.put(key, JSON.stringify(state));
}
