/**
 * Búsqueda multi-término (misma semántica que sistema-modular): "mant 7890"
 * matchea un registro cuyo texto combinado contiene "mant" Y "7890", sin
 * importar el orden ni en qué campo cae cada término. Substring case-insensitive.
 */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return terms.every(t => hay.includes(t));
}
