/**
 * Arma el array de strings legibles para la línea "Filtros: …" de los exports.
 * Cada página pasa un objeto { Label: valor } con los valores YA resueltos a
 * texto (nombre de cliente, label de estado, etc.); acá solo se filtran los
 * vacíos/default y se formatea:
 *   - '' / null / undefined / false → se omite (filtro no aplicado)
 *   - true → queda el label solo ("Solo facturables")
 *   - resto → "Label: valor"
 */
export function filtrosAplicadosDesc(
  pares: Record<string, string | number | boolean | null | undefined>,
): string[] {
  return Object.entries(pares)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
    .map(([label, v]) => (v === true ? label : `${label}: ${v}`));
}
