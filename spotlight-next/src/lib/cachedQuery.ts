// ===============================================================
// src/lib/cachedQuery.ts
//
// Speed: category / subcategory lists almost never change, yet every page
// and form asked the database for them again on every visit -- and the
// database is far away (each trip costs about a third of a second from
// Nigeria). This remembers a successful answer on the device for 10
// minutes (in memory and in localStorage), so repeat visits are instant.
//
// Only successful, non-empty answers are kept. If anything goes wrong
// (storage blocked, bad saved data) it quietly falls back to asking the
// database, exactly as before. Use for rarely-changing lists only.
// ===============================================================

const TTL_MS = 10 * 60 * 1000;
const PREFIX = "spotlight-ref:";

type Entry = { t: number; v: unknown };
const memory = new Map<string, Entry>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cachedQuery(key: string, run: () => PromiseLike<any>, ttlMs: number = TTL_MS): Promise<any> {
  const now = Date.now();

  const inMemory = memory.get(key);
  if (inMemory && now - inMemory.t < ttlMs) return { data: inMemory.v, error: null };

  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREFIX + key) : null;
    if (raw) {
      const saved = JSON.parse(raw) as Entry;
      if (saved && typeof saved.t === "number" && now - saved.t < ttlMs && saved.v != null) {
        memory.set(key, saved);
        return { data: saved.v, error: null };
      }
    }
  } catch { /* ignore: fall through to the database */ }

  const result = await run();
  if (result && !result.error && result.data != null && !(Array.isArray(result.data) && result.data.length === 0)) {
    const entry: Entry = { t: now, v: result.data };
    memory.set(key, entry);
    try { window.localStorage.setItem(PREFIX + key, JSON.stringify(entry)); } catch { /* ignore */ }
  }
  return result;
}
