import type { CalificacionProveedor } from '@ags/shared';
import { ORIGEN_CALIFICACION_LABELS } from '@ags/shared';
import type { ExportColumn } from '../exportToExcel';
import { detalleCalificacion } from '../calificaciones';
import { promedioPonderado } from '../../services/calificacionesService';

/**
 * Export de Calificación de Proveedores (Excel + PDF vía ExportarButton).
 * Las pestañas del listado (Pendientes/Calificadas/Omitidas/Todas) muestran
 * columnas distintas; el export usa un set COMÚN que cubre todas: la columna
 * "Ciclo" identifica la etapa y Puntaje/Estado quedan vacíos en pendientes.
 * `fechaRecepcion` es YYYY-MM-DD y se exporta tal cual (igual que la tabla) —
 * pasarla por `new Date()` correría el día en UTC-3.
 */

const CICLO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', calificada: 'Calificada', omitida: 'Omitida',
};

const ESTADO_LABELS: Record<string, string> = {
  aprobado: 'Aprobado', condicional: 'Condicional', no_aprobado: 'No aprobado', sin_datos: 'Sin datos',
};

export const CALIFICACIONES_EXPORT_COLUMNS: ExportColumn<CalificacionProveedor>[] = [
  { header: 'Fecha',       width: 11, get: c => c.fechaRecepcion },
  { header: 'Proveedor',   width: 26, get: c => c.proveedorNombre },
  { header: 'Origen',      width: 16, get: c => ORIGEN_CALIFICACION_LABELS[c.origen ?? 'manual'] },
  { header: 'Detalle',     width: 28, get: c => detalleCalificacion(c) },
  { header: 'Ciclo',       width: 11, get: c => CICLO_LABELS[c.estadoCiclo ?? 'calificada'] },
  { header: 'Puntaje',     width: 9,  get: c => (typeof c.puntajeTotal === 'number' ? c.puntajeTotal : ''), align: 'center' },
  { header: 'Estado',      width: 13, get: c => (c.estado ? (ESTADO_LABELS[c.estado] ?? c.estado) : '') },
  { header: 'Responsable', width: 18, get: c => c.responsable || '' },
];

// ── Informes por proveedor (2026-08-28) ─────────────────────────────────────
// Dos vistas pedidas por dirección: el ranking (promedio ponderado por
// proveedor) y el mismo agrupamiento con el detalle de cada calificación.
// Ambos consumen TODO lo suscripto (no la pestaña activa) y solo consideran
// calificadas para puntaje/promedio — mismo criterio que `promedioPonderado`.

function agruparPorProveedor(items: CalificacionProveedor[]): Map<string, CalificacionProveedor[]> {
  const por = new Map<string, CalificacionProveedor[]>();
  for (const c of items) {
    const arr = por.get(c.proveedorId) ?? [];
    arr.push(c);
    por.set(c.proveedorId, arr);
  }
  return por;
}

export interface ResumenProveedorRow {
  proveedor: string;
  cantidad: number;
  pendientes: number;
  promedio: number | '';
  estado: string;
  ultima: string;
}

/** Una fila por proveedor, ordenado por promedio descendente (ranking). */
export function buildCalificacionesResumen(items: CalificacionProveedor[]): ResumenProveedorRow[] {
  const rows: ResumenProveedorRow[] = [];
  agruparPorProveedor(items).forEach(arr => {
    const p = promedioPonderado(arr);
    const calificadas = arr.filter(c => (c.estadoCiclo ?? 'calificada') === 'calificada');
    rows.push({
      proveedor: arr[0].proveedorNombre,
      cantidad: p.count,
      pendientes: arr.filter(c => (c.estadoCiclo ?? 'calificada') === 'pendiente').length,
      promedio: p.count > 0 ? p.promedio : '',
      estado: ESTADO_LABELS[p.estado] ?? p.estado,
      ultima: calificadas.map(c => c.fechaRecepcion).sort().pop() ?? '',
    });
  });
  return rows.sort((a, b) =>
    (Number(b.promedio) || -1) - (Number(a.promedio) || -1) || a.proveedor.localeCompare(b.proveedor));
}

export const CALIFICACIONES_RESUMEN_COLUMNS: ExportColumn<ResumenProveedorRow>[] = [
  { header: 'Proveedor',      width: 30, get: r => r.proveedor },
  { header: 'Calificaciones', width: 14, get: r => r.cantidad, align: 'center' },
  { header: 'Pendientes',     width: 11, get: r => r.pendientes || '', align: 'center' },
  { header: 'Promedio',       width: 10, get: r => r.promedio, align: 'center' },
  { header: 'Estado',         width: 13, get: r => r.estado },
  { header: 'Última calif.',  width: 12, get: r => r.ultima },
];

export interface DetalleProveedorRow {
  proveedor: string;
  promedio: string;
  fecha: string;
  origen: string;
  detalle: string;
  puntaje: number | '';
  estado: string;
  responsable: string;
}

/**
 * Calificadas agrupadas por proveedor (alfabético; adentro fecha desc).
 * Proveedor y promedio se muestran solo en la primera fila de cada grupo para
 * que la agrupación se lea en la planilla/PDF plano.
 */
export function buildCalificacionesDetalle(items: CalificacionProveedor[]): DetalleProveedorRow[] {
  const rows: DetalleProveedorRow[] = [];
  const grupos = [...agruparPorProveedor(items).values()]
    .sort((a, b) => a[0].proveedorNombre.localeCompare(b[0].proveedorNombre));
  for (const arr of grupos) {
    const p = promedioPonderado(arr);
    const calificadas = arr
      .filter(c => (c.estadoCiclo ?? 'calificada') === 'calificada')
      .sort((a, b) => (b.fechaRecepcion ?? '').localeCompare(a.fechaRecepcion ?? ''));
    calificadas.forEach((c, i) => {
      rows.push({
        proveedor: i === 0 ? c.proveedorNombre : '',
        promedio: i === 0 ? `${p.promedio} (${p.count})` : '',
        fecha: c.fechaRecepcion,
        origen: ORIGEN_CALIFICACION_LABELS[c.origen ?? 'manual'],
        detalle: detalleCalificacion(c),
        puntaje: typeof c.puntajeTotal === 'number' ? c.puntajeTotal : '',
        estado: c.estado ? (ESTADO_LABELS[c.estado] ?? c.estado) : '',
        responsable: c.responsable || '',
      });
    });
  }
  return rows;
}

export const CALIFICACIONES_DETALLE_COLUMNS: ExportColumn<DetalleProveedorRow>[] = [
  { header: 'Proveedor', width: 26, get: r => r.proveedor },
  { header: 'Promedio',  width: 11, get: r => r.promedio, align: 'center' },
  { header: 'Fecha',     width: 11, get: r => r.fecha },
  { header: 'Origen',    width: 14, get: r => r.origen },
  { header: 'Detalle',   width: 28, get: r => r.detalle },
  { header: 'Puntaje',   width: 9,  get: r => r.puntaje, align: 'center' },
  { header: 'Estado',    width: 13, get: r => r.estado },
  { header: 'Resp.',     width: 16, get: r => r.responsable },
];
