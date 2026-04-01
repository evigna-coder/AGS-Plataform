/** Simple in-memory cache with TTL for Firestore read optimization. */

const cache = new Map<string, { data: any; timestamp: number }>();
const TTL = 2 * 60 * 1000; // 2 minutos

/** Get cached data if still valid, or null. */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Store data in cache. */
export function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/** Invalidate a specific cache key (call on create/update/delete). */
export function invalidateCache(key: string): void {
  // Delete all keys that start with the prefix
  for (const k of cache.keys()) {
    if (k.startsWith(key)) cache.delete(k);
  }
}
