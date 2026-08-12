import type { InventarioItem } from '../../hooks/useInventarioIngeniero';
import { descripcionItemAsignacion } from '../itemAsignacionLabel';
import { type ExportColumn } from '../exportToExcel';
import { filtrosAplicadosDesc } from './filtros';

/**
 * Export del Inventario por Ingeniero (Excel + PDF vía ExportarButton).
 * `data` = los items de la pestaña visible (temporales o permanentes), igual
 * que la lista en pantalla.
 */
export const INVENTARIO_INGENIERO_EXPORT_COLUMNS: ExportColumn<InventarioItem>[] = [
  { header: 'Código',      width: 14, get: i => i.articuloCodigo || i.minikitCodigo || i.loanerCodigo || i.vehiculoPatente || '' },
  { header: 'Descripción', width: 38, get: i => descripcionItemAsignacion(i) },
  { header: 'Tipo',        width: 12, get: i => i.tipo },
  { header: 'Permanente',  width: 10, get: i => (i.permanente ? 'Sí' : '') },
  { header: 'Cliente',     width: 24, get: i => i.clienteNombre || '' },
  { header: 'Asignación',  width: 12, get: i => i.asignacionNumero },
  { header: 'Cantidad',    width: 9,  get: i => i.cantidad, align: 'right' },
  { header: 'Devuelta',    width: 9,  get: i => i.cantidadDevuelta, align: 'right' },
  { header: 'Consumida',   width: 10, get: i => i.cantidadConsumida, align: 'right' },
  { header: 'En poder',    width: 9,  get: i => i.cantidad - i.cantidadDevuelta - i.cantidadConsumida, align: 'right' },
];

/** Línea "Filtros: …" del export — ingeniero + pestaña visible. */
export function buildInventarioIngenieroFiltrosExport(
  ingenieroNombre: string,
  tab: 'temporales' | 'permanentes',
): string[] {
  return filtrosAplicadosDesc({
    Ingeniero: ingenieroNombre,
    'Pestaña': tab === 'temporales' ? 'Temporales' : 'Permanentes',
  });
}
