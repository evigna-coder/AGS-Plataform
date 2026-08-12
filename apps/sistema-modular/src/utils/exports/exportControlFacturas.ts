import type { Factura } from '@ags/shared';
import { FACTURA_ESTADO_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export de Control de Facturas (Excel + PDF vía ExportarButton).
 * "Días" y "Último comentario" replican las columnas derivadas de la lista.
 */

/** Antigüedad en días desde la carga (createdAt) hasta hoy — igual que la lista. */
function diasDesdeCarga(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86400000)) : null;
}

function ultimoComentario(f: Factura): string {
  const ultimo = f.comentarios.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
  return ultimo ? `${ultimo.autor}: ${ultimo.texto}` : '';
}

export const CONTROL_FACTURAS_EXPORT_COLUMNS: ExportColumn<Factura>[] = [
  { header: 'Nº',                width: 12, get: f => f.numero ?? '' },
  { header: 'Fecha carga',       width: 11, get: f => fmtDateShort(f.createdAt) },
  { header: 'Días',              width: 7,  get: f => diasDesdeCarga(f.createdAt), align: 'right' },
  { header: 'Proveedor',         width: 30, get: f => f.proveedorNombre },
  { header: 'Estado',            width: 12, get: f => FACTURA_ESTADO_LABELS[f.estado] || f.estado },
  { header: 'Último comentario', width: 40, get: f => ultimoComentario(f) },
];

/** Línea "Filtros: …" del export — refleja los filtros activos de ControlFacturasList. */
export function buildControlFacturasFiltros(
  f: { estado: string; proveedor: string; desde: string; hasta: string },
): string[] {
  return filtrosAplicadosDesc({
    Estado: f.estado ? (FACTURA_ESTADO_LABELS[f.estado as keyof typeof FACTURA_ESTADO_LABELS] ?? f.estado) : '',
    Proveedor: f.proveedor,
    Desde: f.desde,
    Hasta: f.hasta,
  });
}
