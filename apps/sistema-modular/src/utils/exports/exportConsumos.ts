import { ORIGEN_CONSUMO_LABELS, type ConsumoRow } from '../../hooks/useConsumos';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';

/**
 * Export de Consumos por equipo (Excel + PDF vía ExportarButton).
 * `establecimiento` se resuelve en la página con el mismo criterio que la
 * columna Cliente (sufijo solo para clientes multi-planta).
 */
export interface ConsumoExportRow {
  consumo: ConsumoRow;
  /** Nombre del establecimiento (solo clientes multi-planta, igual que en la lista). */
  establecimiento: string;
}

export function buildConsumosExportRows(
  rows: ConsumoRow[],
  sufijoEstab: (clienteId?: string | null, establecimientoId?: string | null) => string,
): ConsumoExportRow[] {
  return rows.map(consumo => ({
    consumo,
    // sufijoEstab devuelve " (Nombre)" — para la columna va el nombre pelado.
    establecimiento: sufijoEstab(consumo.clienteId, consumo.establecimientoId)
      .replace(/^\s*\(/, '').replace(/\)$/, ''),
  }));
}

export const CONSUMOS_EXPORT_COLUMNS: ExportColumn<ConsumoExportRow>[] = [
  { header: 'Fecha',           width: 10, get: r => fmtDateShort(r.consumo.fecha) },
  { header: 'OT',              width: 11, get: r => r.consumo.otNumber || '' },
  { header: 'Cliente',         width: 26, get: r => r.consumo.clienteNombre || '' },
  { header: 'Establecimiento', width: 18, get: r => r.establecimiento },
  { header: 'Equipo',          width: 22, get: r => r.consumo.sistemaNombre || '' },
  { header: 'Artículo',        width: 15, get: r => r.consumo.articuloCodigo || '' },
  { header: 'Descripción',     width: 32, get: r => r.consumo.articuloDescripcion || '' },
  { header: 'Cantidad',        width: 9,  get: r => r.consumo.cantidad, align: 'right' },
  { header: 'Origen',          width: 15, get: r => ORIGEN_CONSUMO_LABELS[r.consumo.origen] },
];
