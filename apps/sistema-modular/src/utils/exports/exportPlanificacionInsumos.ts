import type { ExportColumn } from '../exportToExcel';
import { fmtCantidad, labelMes, type FilaPlan } from '../planificacionInsumos';

/** Una fila por artículo; las columnas de mes se generan según el horizonte. */
export function buildPlanificacionInsumosColumns(meses: string[]): ExportColumn<FilaPlan>[] {
  const fijas: ExportColumn<FilaPlan>[] = [
    { header: 'Código', width: 16, get: f => f.codigo },
    { header: 'Descripción', width: 40, get: f => f.descripcion },
    { header: 'Grupo', width: 12, get: f => f.grupo ?? '' },
    { header: 'Stock hoy', width: 10, get: f => f.stockInicial, align: 'right' },
    { header: 'Mínimo', width: 8, get: f => f.stockMinimo, align: 'right' },
  ];
  const porMes: ExportColumn<FilaPlan>[] = meses.flatMap((mes, i) => [
    { header: `Demanda ${labelMes(mes)}`, width: 12, get: f => fmtCantidad(f.meses[i]?.demanda ?? 0), align: 'right' as const },
    { header: `Ingresos ${labelMes(mes)}`, width: 12, get: f => fmtCantidad(f.meses[i]?.ingresos ?? 0), align: 'right' as const },
    { header: `Stock fin ${labelMes(mes)}`, width: 12, get: f => fmtCantidad(f.meses[i]?.stockFin ?? 0), align: 'right' as const },
  ]);
  return [
    ...fijas, ...porMes,
    { header: 'Comprar', width: 10, get: f => f.comprar, align: 'right' },
    { header: 'Viene en kit', width: 26, get: f => f.kits.map(k => `${k.kitCodigo} ×${k.cantidadPorKit}${f.comprar > 0 ? ` → ${k.comprarKits} kit(s)` : ''}`).join(' · ') },
    { header: 'Quiebre', width: 10, get: f => f.mesQuiebre ? labelMes(f.mesQuiebre) : '' },
  ];
}

export function buildPlanificacionInsumosFiltros(f: { horizonte: string; grupo: string; texto: string }): string[] {
  const out = [`Horizonte: ${f.horizonte} meses`];
  if (f.grupo) out.push(`Grupo: ${f.grupo}`);
  if (f.texto) out.push(`Búsqueda: ${f.texto}`);
  return out;
}
