/**
 * Búsqueda multi-término (UAT 2026-07-19): "mant 7890" matchea un registro cuyo
 * texto combinado contiene "mant" Y "7890", sin importar el orden ni en qué
 * campo cae cada término. Cada término es substring case-insensitive.
 */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return terms.every(t => hay.includes(t));
}
