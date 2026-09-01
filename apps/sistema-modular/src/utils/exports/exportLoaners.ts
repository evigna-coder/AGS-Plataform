import type { Loaner } from '@ags/shared';
import { ESTADO_LOANER_LABELS } from '@ags/shared';
import { type ExportColumn, type GrupoExport } from '../exportToExcel';

/**
 * Export de Loaners (Excel + PDF vía ExportarButton).
 * `ubicacion` se resuelve en la página (préstamo activo + sufijo de
 * establecimiento) con el mismo criterio que la columna "Ubicación actual".
 */
export interface LoanerExportRow {
  loaner: Loaner;
  /** Cliente del préstamo activo, "AGS Base" o vacío. */
  ubicacion: string;
}

export function buildLoanerExportRows(
  loaners: Loaner[],
  sufijoEstab: (clienteId?: string | null, establecimientoId?: string | null) => string,
): LoanerExportRow[] {
  return loaners.map(l => {
    const prestamo = l.prestamos.find(p => p.estado === 'activo');
    return {
      loaner: l,
      ubicacion: prestamo
        ? `${prestamo.clienteNombre}${sufijoEstab(prestamo.clienteId, prestamo.establecimientoId)}`
        : l.estado === 'en_base' ? 'AGS Base' : '',
    };
  });
}

/** Orden de las categorías de equipo en el resumen; el resto va alfabético al final. */
const ORDEN_CATEGORIA = ['HPLC', 'GC', 'MSD', 'UV', 'OSMOMETRO', 'GENERAL'];
const SIN_CATEGORIA = 'Sin categoría';
const SIN_TIPO = 'Sin tipo de módulo';

/**
 * Resumen catalogado (2026-09-01): agrupa en dos niveles —categoría de equipo y,
 * dentro, tipo de módulo— con el total de cada uno. Es lo que responde "cuántas
 * bombas de HPLC tengo en base" sin contar a mano sobre el listado plano.
 */
export function buildLoanerGrupos(rows: LoanerExportRow[]): GrupoExport<LoanerExportRow>[] {
  const porCategoria = new Map<string, Map<string, LoanerExportRow[]>>();
  for (const r of rows) {
    const cat = r.loaner.categoriaEquipo?.trim() || SIN_CATEGORIA;
    const tipo = r.loaner.categoriaModuloNombre?.trim() || SIN_TIPO;
    if (!porCategoria.has(cat)) porCategoria.set(cat, new Map());
    const tipos = porCategoria.get(cat)!;
    if (!tipos.has(tipo)) tipos.set(tipo, []);
    tipos.get(tipo)!.push(r);
  }

  // Las categorías conocidas primero y en su orden; después las demás alfabéticas.
  const peso = (c: string) => {
    const i = ORDEN_CATEGORIA.indexOf(c.toUpperCase());
    return i >= 0 ? i : ORDEN_CATEGORIA.length;
  };
  const cats = [...porCategoria.keys()].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b));

  return cats.map(cat => {
    const tipos = porCategoria.get(cat)!;
    const subgrupos = [...tipos.keys()].sort((a, b) => a.localeCompare(b)).map(tipo => {
      const rs = tipos.get(tipo)!;
      // Dentro del tipo, por código de loaner: el orden con el que se los nombra.
      rs.sort((x, y) => x.loaner.codigo.localeCompare(y.loaner.codigo));
      return { titulo: tipo, total: rs.length, rows: rs };
    });
    return { titulo: cat, total: subgrupos.reduce((a, s) => a + s.total, 0), subgrupos };
  });
}

/** Columnas del resumen: sin Categoría ni Tipo, que ya son los subtítulos. */
export const LOANERS_RESUMEN_COLUMNS: ExportColumn<LoanerExportRow>[] = [
  { header: 'Código',           width: 11, get: r => r.loaner.codigo },
  { header: 'Descripción',      width: 34, get: r => r.loaner.descripcion },
  { header: 'Módulo',           width: 16, get: r => r.loaner.moduloCodigo || '' },
  { header: 'Serie',            width: 14, get: r => r.loaner.serie || '' },
  { header: 'Estado',           width: 15, get: r => ESTADO_LOANER_LABELS[r.loaner.estado] || r.loaner.estado },
  { header: 'Ubicación actual', width: 26, get: r => r.ubicacion },
];

export const LOANERS_EXPORT_COLUMNS: ExportColumn<LoanerExportRow>[] = [
  { header: 'Código',           width: 11, get: r => r.loaner.codigo },
  { header: 'Descripción',      width: 30, get: r => r.loaner.descripcion },
  { header: 'Categoría',        width: 12, get: r => r.loaner.categoriaEquipo || '' },
  { header: 'Tipo de módulo',   width: 18, get: r => r.loaner.categoriaModuloNombre || '' },
  { header: 'Módulo',           width: 16, get: r => r.loaner.moduloCodigo || '' },
  { header: 'Serie',            width: 14, get: r => r.loaner.serie || '' },
  { header: 'Estado',           width: 15, get: r => ESTADO_LOANER_LABELS[r.loaner.estado] || r.loaner.estado },
  { header: 'Ubicación actual', width: 26, get: r => r.ubicacion },
];
