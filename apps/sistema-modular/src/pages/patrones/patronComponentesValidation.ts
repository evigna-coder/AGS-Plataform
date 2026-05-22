/**
 * Phase 14 BOM-04 — pure validator for Patron.componentes before save.
 *
 * Extracted from PatronEditorPage.tsx to keep the page under the 250-LOC budget
 * spirit of components.md. Returns the error message to alert(), or null if OK.
 *
 * Guards (RESEARCH pitfalls 1 + 3):
 *  - Pitfall 3 (spillover): duplicate codigoComponente within the same patron
 *  - Filas con descripcion pero sin codigo (validation hint, not a hard guard)
 *
 * Note: the rename guard (UI lock when lockedCodigos.has(codigo)) lives in the
 * sub-component PatronComponentesEditor; the defense-in-depth service guard lives
 * in patronesService.update (Task 3 del plan 14-04).
 */
import type { ComponentePatron } from '@ags/shared';

export function validatePatronComponentes(
  componentes: ComponentePatron[],
): string | null {
  const codigos = componentes.map(c => c.codigoComponente.trim());
  const duplicates = codigos.filter((v, i, a) => v && a.indexOf(v) !== i);
  if (duplicates.length > 0) {
    return `Códigos de componente duplicados: ${[...new Set(duplicates)].join(', ')}. Cada código debe ser único dentro del patrón.`;
  }
  if (componentes.some(c => !c.codigoComponente.trim() && c.descripcion.trim())) {
    return 'Hay filas con descripción pero sin código. Completá el código o eliminá la fila.';
  }
  return null;
}
