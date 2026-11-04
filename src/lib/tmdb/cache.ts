interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 300;
const store = new Map<string, CacheEntry>();

function evictIfNeeded(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

export function readCache<T>(key: string, now = Date.now()): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return undefined;
  }
  // Refresh insertion order so frequently used entries survive eviction.
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function writeCache(key: string, value: unknown, ttlMs: number, now = Date.now()): void {
  if (ttlMs <= 0) return;
  evictIfNeeded(now);
  store.set(key, { value, expiresAt: now + ttlMs });
}

export function clearTmdbCache(): void {
  store.clear();
}

export function tmdbCacheSize(): number {
  return store.size;
}
