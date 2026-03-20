/**
 * Deep-clean para Firestore:
 * 1. Elimina valores undefined (JSON round-trip)
 * 2. Elimina keys vacíos "" de objetos — Firestore no acepta field names vacíos
 */
export function deepCleanForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepCleanForFirestore);
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '') continue;
    if (value === undefined) continue;
    cleaned[key] = deepCleanForFirestore(value);
  }
  return cleaned;
}
