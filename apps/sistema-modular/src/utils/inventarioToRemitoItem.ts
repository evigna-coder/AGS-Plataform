import type { RemitoItem, TipoRemitoItem } from '@ags/shared';
import type { InventarioItem } from '../hooks/useInventarioIngeniero';

/**
 * Convierte un InventarioItem (del inventario de ingeniero) a RemitoItem.
 * Mapea los campos según el tipo de entidad y usa `?? null` para Firestore safety.
 */
export function inventarioToRemitoItem(
  item: InventarioItem,
  tipoRemitoItem: TipoRemitoItem = 'entrega',
): RemitoItem {
  const cantidadNeta = item.cantidad - item.cantidadDevuelta - item.cantidadConsumida;

  return {
    id: crypto.randomUUID(),
    unidadId: item.unidadId ?? '',
    articuloId: item.articuloId ?? '',
    articuloCodigo: item.articuloCodigo ?? '',
    articuloDescripcion: item.articuloDescripcion ?? '',
    cantidad: cantidadNeta > 0 ? cantidadNeta : 1,
    tipoItem: tipoRemitoItem,
    devuelto: false,
    fechaDevolucion: null,
    // Multi-tipo
    minikitId: item.minikitId ?? null,
    minikitCodigo: item.minikitCodigo ?? null,
    instrumentoId: item.instrumentoId ?? null,
    instrumentoCodigo: item.instrumentoId ?? null,
    instrumentoDescripcion: item.instrumentoNombre ?? null,
    dispositivoId: item.dispositivoId ?? null,
    dispositivoCodigo: item.dispositivoId ?? null,
    dispositivoDescripcion: item.dispositivoDescripcion ?? null,
    vehiculoId: item.vehiculoId ?? null,
    vehiculoCodigo: item.vehiculoPatente ?? null,
    vehiculoDescripcion: null,
    loanerId: item.loanerId ?? null,
    loanerCodigo: item.loanerCodigo ?? null,
    loanerDescripcion: null,
    tipoEntidad: item.tipo ?? null,
    asignacionId: item.asignacionId ?? null,
    asignacionItemId: item.id ?? null,
  };
}

/** Resuelve código para display según tipoEntidad del RemitoItem */
export function getRemitoItemCodigo(item: RemitoItem): string {
  if (item.tipoEntidad === 'instrumento') return item.instrumentoCodigo || '';
  if (item.tipoEntidad === 'dispositivo') return item.dispositivoCodigo || '';
  if (item.tipoEntidad === 'vehiculo') return item.vehiculoCodigo || '';
  if (item.tipoEntidad === 'minikit') return item.minikitCodigo || '';
  if (item.tipoEntidad === 'loaner') return item.loanerCodigo || '';
  return item.articuloCodigo || '';
}

/** Resuelve descripción para display según tipoEntidad del RemitoItem */
export function getRemitoItemDescripcion(item: RemitoItem): string {
  if (item.tipoEntidad === 'instrumento') return item.instrumentoDescripcion || '';
  if (item.tipoEntidad === 'dispositivo') return item.dispositivoDescripcion || '';
  if (item.tipoEntidad === 'vehiculo') return item.vehiculoDescripcion || '';
  if (item.tipoEntidad === 'minikit') return item.minikitCodigo || '';
  if (item.tipoEntidad === 'loaner') return item.loanerDescripcion || item.loanerCodigo || '';
  return item.articuloDescripcion || '';
}

const TIPO_ENTIDAD_LABELS: Record<string, string> = {
  articulo: 'Artículo',
  minikit: 'Minikit',
  loaner: 'Loaner',
  instrumento: 'Instrumento',
  dispositivo: 'Dispositivo',
  vehiculo: 'Vehículo',
};

export function getTipoEntidadLabel(tipo: string): string {
  return TIPO_ENTIDAD_LABELS[tipo] || tipo;
}
