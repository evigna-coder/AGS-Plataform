import type { TableCatalogEntry } from '@ags/shared';

/**
 * Cobertura de modelos / servicios dentro de un proyecto de la Biblioteca de Tablas.
 *
 * Semántica que hay que respetar (es la de reportes-ot): una tabla con la lista
 * VACÍA aplica a todos los modelos (o servicios). Por eso esas tablas no cuentan
 * para la discrepancia y el panel no las toca, salvo que ninguna tabla tenga lista.
 */
export type CoverageField = 'modelos' | 'tipoServicio';

export interface CoverageRow {
  value: string;
  /** Tablas (con lista) que incluyen el valor. */
  coveredBy: TableCatalogEntry[];
  /** Tablas (con lista) que NO lo incluyen. */
  missingIn: TableCatalogEntry[];
  status: 'full' | 'partial' | 'none';
  /** false = el valor está en las tablas pero no en el catálogo (categorías / tipos de servicio). */
  inCatalog: boolean;
}

export interface CoverageSummary {
  rows: CoverageRow[];
  /** Tablas que tienen lista propia (las que se comparan y se escriben). */
  withList: TableCatalogEntry[];
  /** Tablas con lista vacía: aplican a todo. */
  appliesToAll: TableCatalogEntry[];
  partialCount: number;
}

const norm = (s: string) => s.toLowerCase().trim();
const listOf = (t: TableCatalogEntry, field: CoverageField): string[] =>
  Array.isArray(t[field]) ? (t[field] as string[]).filter(v => typeof v === 'string' && v.trim()) : [];

/** Tablas que cuentan para la cobertura: todo menos lo archivado. */
export const activeTables = (tables: TableCatalogEntry[]) => tables.filter(t => t.status !== 'archived');

export function computeCoverage(tables: TableCatalogEntry[], field: CoverageField, catalog: string[]): CoverageSummary {
  const live = activeTables(tables);
  const withList = live.filter(t => listOf(t, field).length > 0);
  const appliesToAll = live.filter(t => listOf(t, field).length === 0);

  // Universo = catálogo + lo que aparezca en las tablas (aunque no esté en el catálogo).
  const universe = new Map<string, { value: string; inCatalog: boolean }>();
  for (const v of catalog) if (!universe.has(norm(v))) universe.set(norm(v), { value: v, inCatalog: true });
  for (const t of withList) for (const v of listOf(t, field)) {
    if (!universe.has(norm(v))) universe.set(norm(v), { value: v, inCatalog: false });
  }

  const rows: CoverageRow[] = [...universe.values()].map(({ value, inCatalog }) => {
    const k = norm(value);
    const coveredBy = withList.filter(t => listOf(t, field).some(v => norm(v) === k));
    const missingIn = withList.filter(t => !coveredBy.includes(t));
    const status: CoverageRow['status'] =
      coveredBy.length === 0 ? 'none' : missingIn.length === 0 ? 'full' : 'partial';
    return { value, coveredBy, missingIn, status, inCatalog };
  });
  return { rows, withList, appliesToAll, partialCount: rows.filter(r => r.status === 'partial').length };
}

/** Clave de comparación de un valor (misma regla que reportes-ot: sin mayúsculas ni espacios en los bordes). */
export const coverageKey = norm;

/**
 * Escrituras para dejar cada valor como se pidió: on = en todas las tablas, !on = en ninguna.
 * `desired` va indexado por `coverageKey(valor)` y guarda la grafía a escribir.
 * Si ninguna tabla tiene lista, se aplica a todas (pasan a quedar restringidas).
 */
export function planCoverageUpdates(
  tables: TableCatalogEntry[], field: CoverageField, desired: Map<string, { value: string; on: boolean }>,
): { id: string; values: string[] }[] {
  const live = activeTables(tables);
  const withList = live.filter(t => listOf(t, field).length > 0);
  const targets = withList.length > 0 ? withList : live;
  const updates: { id: string; values: string[] }[] = [];
  for (const t of targets) {
    const current = listOf(t, field);
    let next = current.filter(v => desired.get(norm(v))?.on !== false);
    for (const [k, d] of desired) {
      if (!d.on || next.some(v => norm(v) === k)) continue;
      next = [...next, d.value];
    }
    // Una tabla que tenía lista NUNCA queda vacía (revisión 2026-10-01): en
    // reportes-ot lista vacía = "aplica a todos", así que quitarle su único
    // modelo la ofrecería en cualquier equipo. Esa tabla se deja como estaba.
    if (current.length > 0 && next.length === 0) continue;
    if (next.length !== current.length || next.some((v, i) => v !== current[i])) updates.push({ id: t.id, values: next });
  }
  return updates;
}

/** Valores que el proyecto "espera": los que cubren todas sus tablas con lista. */
export function fullyCovered(summary: CoverageSummary): string[] {
  return summary.rows.filter(r => r.status === 'full').map(r => r.value);
}

/** Diferencia de una tabla contra la referencia del proyecto (para el aviso en la lista y el editor). */
export function tableDiff(table: TableCatalogEntry, field: CoverageField, reference: string[]) {
  const own = listOf(table, field);
  if (own.length === 0 || reference.length === 0) return { faltan: [] as string[], sobran: [] as string[] };
  const ref = new Set(reference.map(norm));
  const mine = new Set(own.map(norm));
  return {
    faltan: reference.filter(v => !mine.has(norm(v))),
    sobran: own.filter(v => !ref.has(norm(v))),
  };
}

/**
 * Referencia del proyecto para un campo: lo guardado en el proyecto si existe;
 * si no, los valores presentes en la mayoría de las tablas con lista.
 */
export function referenceFor(tables: TableCatalogEntry[], field: CoverageField, projectValues?: string[] | null): string[] {
  if (projectValues && projectValues.length) return projectValues;
  const withList = activeTables(tables).filter(t => listOf(t, field).length > 0);
  if (withList.length === 0) return [];
  const count = new Map<string, { value: string; n: number }>();
  for (const t of withList) for (const v of listOf(t, field)) {
    const c = count.get(norm(v)) ?? { value: v, n: 0 };
    c.n++; count.set(norm(v), c);
  }
  return [...count.values()].filter(c => c.n * 2 > withList.length).map(c => c.value);
}

export type RoleGroup = 'encabezado' | 'ensayos' | 'cierre';
export const ROLE_LABELS: Record<RoleGroup, string> = {
  encabezado: 'Encabezado', ensayos: 'Ensayos', cierre: 'Cierre',
};

/** Agrupa por rol en el protocolo según la posición de los ensayos (tablas ya ordenadas por `orden`). */
export function groupByRole(sorted: TableCatalogEntry[]): { group: RoleGroup; tables: TableCatalogEntry[] }[] {
  const isEnsayo = (t: TableCatalogEntry) => t.tableType === 'validation' || t.tableType === 'checklist' || t.tableType === 'instruments';
  const first = sorted.findIndex(isEnsayo);
  if (first < 0) return [{ group: 'encabezado', tables: sorted }];
  let last = first;
  sorted.forEach((t, i) => { if (isEnsayo(t)) last = i; });
  return ([
    { group: 'encabezado', tables: sorted.slice(0, first) },
    { group: 'ensayos', tables: sorted.slice(first, last + 1) },
    { group: 'cierre', tables: sorted.slice(last + 1) },
  ] as { group: RoleGroup; tables: TableCatalogEntry[] }[]).filter(g => g.tables.length > 0);
}

/** Nombre para mostrar de una tabla: las de texto suelen no tener título. */
export function tableLabel(t: TableCatalogEntry): string {
  if (t.name?.trim()) return t.name.trim();
  const tipo: Record<string, string> = { text: 'texto', cover: 'carátula', signatures: 'firmas' };
  return `#${t.orden || '—'} (${tipo[t.tableType] ?? t.tableType} sin título)`;
}

/** Resolución sugerida de una discrepancia: lo que tiene la mayoría de las tablas. */
export const majorityOn = (row: CoverageRow): boolean => row.coveredBy.length * 2 >= row.coveredBy.length + row.missingIn.length;

