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

/**
 * Lecturas EN VUELO (2026-09-11, fase 2 de performance): dos pantallas que
 * piden el mismo catálogo en el mismo instante (arranque con varias pestañas,
 * página + modal) encontraban la caché vacía las dos y bajaban la colección
 * dos veces. Mientras una lectura está en curso, las siguientes con la misma
 * clave esperan esa promesa en lugar de repetir la consulta.
 */
const enVuelo = new Map<string, Promise<any>>();

/** Lee de caché; si no hay pero ya hay una lectura en curso, la comparte; si no, corre `cargar`. */
export function conCache<T>(key: string, cargar: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return Promise.resolve(cached);
  const pendiente = enVuelo.get(key) as Promise<T> | undefined;
  if (pendiente) return pendiente;
  const p = cargar().then(data => { setCache(key, data); return data; }).finally(() => { enVuelo.delete(key); });
  enVuelo.set(key, p);
  return p;
}

/** Invalidate a specific cache key (call on create/update/delete). */
export function invalidateCache(key: string): void {
  // Borra por prefijo en esta pestaña y avisa a las demás para que hagan lo mismo.
  deleteByPrefix(key);
  channel?.postMessage({ key });
}
