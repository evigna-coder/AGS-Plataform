/** Simple in-memory cache with TTL for Firestore read optimization. */

const cache = new Map<string, { data: any; timestamp: number }>();
const TTL = 2 * 60 * 1000; // 2 minutos

/**
 * Cross-tab: el cache vive en memoria de cada pestaña, así que invalidar en una
 * NO limpiaba las otras (editabas un cliente/categoría/artículo en la pestaña A y
 * la pestaña B seguía sirviendo el valor viejo hasta que expiraba el TTL). Un
 * BroadcastChannel propaga la invalidación a todas las pestañas del mismo origen:
 * cualquier write invalida el cache en TODAS, y la próxima lectura (al re-montar
 * una pantalla o navegar) trae datos frescos. Fallback null si el runtime no lo
 * soporta (no rompe nada; vuelve al comportamiento anterior solo en ese caso).
 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ags-service-cache') : null;

function deleteByPrefix(prefix: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

// Invalidación recibida de otra pestaña: borrar local SIN re-emitir (evita loop).
channel?.addEventListener('message', (e: MessageEvent) => {
  const key = (e.data as { key?: unknown } | null)?.key;
  if (typeof key === 'string') deleteByPrefix(key);
});

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
  // Borra por prefijo en esta pestaña y avisa a las demás para que hagan lo mismo.
  deleteByPrefix(key);
  channel?.postMessage({ key });
}
