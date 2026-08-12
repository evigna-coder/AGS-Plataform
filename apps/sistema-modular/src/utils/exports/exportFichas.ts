import type { FichaPropiedad, EstadoFicha, DerivacionProveedor } from '@ags/shared';
import { ESTADO_FICHA_LABELS } from '@ags/shared';
import { fmtDateShort, type ExportColumn } from '../exportToExcel';

/**
 * Export de Fichas Propiedad del Cliente (Excel + PDF vía ExportarButton) +
 * helpers de estado visible compartidos con FichasList.
 */

/** Modelo + serie del primer item — mismo criterio que las columnas de la lista. */
function equipoSerie(f: FichaPropiedad): string {
  const it = f.items?.[0];
  if (!it) return '';
  const modelo = it.articuloCodigo || it.articuloDescripcion || it.descripcionLibre || '';
  const extra = f.items.length > 1 ? ` (+${f.items.length - 1})` : '';
  return (it.serie ? `${modelo} · ${it.serie}` : modelo) + extra;
}

/** Derivaciones a proveedor ACTIVAS (no recibidas) de todos los items. */
export function derivacionesActivasDeFicha(f: FichaPropiedad): DerivacionProveedor[] {
  return (f.items ?? []).flatMap(i => (i.derivaciones ?? []).filter(d => d.estado !== 'recibido'));
}

/**
 * Estado que MUESTRA el listado (2026-08-12): si la ficha tiene ALGO derivado
 * a proveedor —no importa qué—, se ve "Derivado a proveedor" aunque el estado
 * guardado sea otro (ej. esperando_repuesto por una derivación de parte). El
 * estado real NO se toca: sigue en `f.estado` para el ciclo de importación.
 */
export function estadoVisibleDeFicha(f: FichaPropiedad): EstadoFicha {
  return derivacionesActivasDeFicha(f).length > 0 ? 'derivado_proveedor' : f.estado;
}

/** Proveedor(es) de las derivaciones activas: "ELS" o "ELS (+1)". */
export function proveedorDerivadoLabel(f: FichaPropiedad): string {
  const nombres = [...new Set(derivacionesActivasDeFicha(f).map(d => d.proveedorNombre).filter(Boolean))];
  if (nombres.length === 0) return '';
  return nombres.length === 1 ? nombres[0] : `${nombres[0]} (+${nombres.length - 1})`;
}

export const FICHAS_EXPORT_COLUMNS: ExportColumn<FichaPropiedad>[] = [
  { header: 'Número',         width: 11, get: f => f.numero },
  { header: 'Cliente',        width: 28, get: f => f.clienteNombre + (f.establecimientoNombre ? ` (${f.establecimientoNombre})` : '') },
  { header: 'Equipo / Serie', width: 32, get: f => equipoSerie(f) },
  { header: 'Estado',         width: 16, get: f => ESTADO_FICHA_LABELS[estadoVisibleDeFicha(f)] || f.estado },
  { header: 'Proveedor',      width: 22, get: f => proveedorDerivadoLabel(f) },
  { header: 'Items',          width: 7,  get: f => f.items?.length ?? 0, align: 'center' },
  { header: 'Últ. actividad', width: 12, get: f => fmtDateShort(f.updatedAt || f.fechaIngreso) },
];
