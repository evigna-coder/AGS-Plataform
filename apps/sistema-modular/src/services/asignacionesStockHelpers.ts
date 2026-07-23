/**
 * Efectos de stock del circuito de asignaciones a ingenieros (auditoría pre go-live,
 * bloqueantes B1/B2/B3): consumo en campo, devolución y transferencia deben mutar
 * `unidades` y dejar su MovimientoStock, igual que el resto del circuito.
 *
 * Vive separado de `asignacionesService` para mantener el servicio enfocado en el
 * documento de asignación. Importa `stockService` en forma estática — no hay ciclo:
 * stockService solo depende de './firebase' y '@ags/shared' (el ciclo que obliga al
 * import dinámico en asignacionesService es con el barrel `firebaseService`, que acá
 * no se toca).
 */
import { doc, Timestamp } from 'firebase/firestore';
import {
  db, docRef, runTransaction, deepCleanForFirestore, getCreateTrace, getUpdateTrace,
} from './firebase';
import { getCurrentUser } from './currentUser';
import { posicionesStockService, movimientosService } from './stockService';
import type { EstadoUnidad, PosicionStock, TipoMovimiento, TipoOrigenDestino } from '@ags/shared';

/** Nombre legible del usuario actual para `creadoPor` de MovimientoStock. */
export function nombreUsuarioActual(): string {
  return getCurrentUser()?.displayName ?? 'sistema';
}

/**
 * Posición REAL adonde vuelven las unidades devueltas por ingenieros (B2).
 *
 * Criterio: no existe "posición original" confiable — la asignación rápida pisa
 * `ubicacion` al asignar sin guardar la anterior (`ubicacionAnterior` solo lo setea
 * el flujo de reservas). Se usa entonces una posición singleton de recepción de
 * devoluciones con código well-known 'DEVOLUCIONES', mismo patrón que
 * `getOrCreateReservasPosition` ('RESERVAS'). Operaciones re-estantea después
 * moviendo la unidad desde ahí; mientras tanto la unidad cuelga de una posición
 * que sí existe en `posicionesStock` (nada de referenciaId vacío).
 */
export async function getOrCreateDevolucionesPosition(): Promise<PosicionStock> {
  const all = await posicionesStockService.getAll(false); // include inactive
  const existing = all.find(p => p.codigo === 'DEVOLUCIONES');
  if (existing) return existing;
  // Idempotente por lookup de código — seguro de correr en paralelo/repetido.
  const id = await posicionesStockService.create({
    codigo: 'DEVOLUCIONES',
    nombre: 'Devoluciones',
    descripcion: 'Recepción de devoluciones de asignaciones a ingenieros — pendiente de re-estanteo',
    tipo: 'deposito',
    parentId: null,
    activo: true,
  });
  const created = await posicionesStockService.getById(id);
  if (!created) throw new Error('No se pudo crear la posición DEVOLUCIONES');
  return created;
}

/**
 * Consume `cantidad` de una unidad ASIGNADA a un ingeniero (B1). Espejo de
 * `stockService.deducirUnidadDisponible`, pero desde estado 'asignado':
 * - cantidad >= cantidad del doc → estado 'consumido' (sale del ATP).
 * - cantidad < cantidad del doc (lote) → decrementa `cantidad`; el resto del lote
 *   sigue 'asignado' en poder del ingeniero (que es donde está físicamente).
 * Crea el MovimientoStock 'consumo' (ingeniero → consumo_ot) en la misma transacción.
 */
export async function consumirUnidadAsignada(params: {
  unidadId: string;
  cantidad: number;
  otNumber?: string | null;
  ingenieroId: string;
  ingenieroNombre: string;
  motivo?: string | null;
}): Promise<void> {
  const now = Timestamp.now();
  const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
  const unidadRef = docRef('unidades', params.unidadId);
  const creadoPor = nombreUsuarioActual();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(unidadRef);
    if (!snap.exists()) throw new Error(`Unidad ${params.unidadId} no encontrada`);
    const data = snap.data();
    if (data.estado !== 'asignado') {
      throw new Error(`Unidad no consumible — estado '${data.estado}' (esperaba 'asignado')`);
    }
    const qtyActual = data.cantidad ?? 1;
    const total = params.cantidad >= qtyActual;
    tx.update(unidadRef, deepCleanForFirestore(total
      ? { estado: 'consumido' as EstadoUnidad, ...getUpdateTrace(), updatedAt: now }
      : { cantidad: qtyActual - params.cantidad, ...getUpdateTrace(), updatedAt: now }));

    tx.set(movRef, deepCleanForFirestore({
      tipo: 'consumo' as TipoMovimiento,
      unidadId: params.unidadId,
      articuloId: data.articuloId ?? '',
      articuloCodigo: data.articuloCodigo ?? '',
      articuloDescripcion: data.articuloDescripcion ?? '',
      cantidad: total ? qtyActual : params.cantidad,
      nroSerie: data.nroSerie ?? null, nroLote: data.nroLote ?? null,
      origenTipo: 'ingeniero' as TipoOrigenDestino,
      origenId: params.ingenieroId,
      origenNombre: params.ingenieroNombre,
      destinoTipo: 'consumo_ot' as TipoOrigenDestino,
      destinoId: params.otNumber ?? '',
      destinoNombre: params.otNumber ? `OT ${params.otNumber}` : 'Consumo en campo',
      otNumber: params.otNumber ?? null,
      remitoId: null,
      motivo: params.motivo ?? 'Consumo en campo (asignación a ingeniero)',
      creadoPor,
      ...getCreateTrace(),
      createdAt: now,
    }));
  });
}

/**
 * Devuelve a stock una unidad en poder de un ingeniero (B2): estado 'disponible',
 * ubicación en una posición REAL y MovimientoStock 'devolucion' (ingeniero →
 * posición), todo en una transacción.
 *
 * Tolerante con el estado actual: si la unidad no figura 'asignado' (dato legacy de
 * transferencias viejas que la dejaban 'disponible' colgada del ingeniero, B3), igual
 * se re-ubica — el objetivo es que no quede colgada del ingeniero.
 */
export async function devolverUnidadAsignada(params: {
  unidadId: string;
  /** Cantidad físicamente devuelta en este acto; si es 0 se usa la cantidad del doc para el asiento. */
  cantidad: number;
  ingenieroId: string;
  ingenieroNombre: string;
  posicion: { id: string; nombre: string };
  motivo?: string | null;
}): Promise<void> {
  const now = Timestamp.now();
  const movRef = doc(db, 'movimientosStock', crypto.randomUUID());
  const unidadRef = docRef('unidades', params.unidadId);
  const creadoPor = nombreUsuarioActual();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(unidadRef);
    if (!snap.exists()) throw new Error(`Unidad ${params.unidadId} no encontrada`);
    const data = snap.data();
    const cantMovimiento = params.cantidad > 0 ? params.cantidad : (data.cantidad ?? 1);

    tx.update(unidadRef, deepCleanForFirestore({
      estado: 'disponible' as EstadoUnidad,
      ubicacion: { tipo: 'posicion', referenciaId: params.posicion.id, referenciaNombre: params.posicion.nombre },
      ...getUpdateTrace(),
      updatedAt: now,
    }));

    tx.set(movRef, deepCleanForFirestore({
      tipo: 'devolucion' as TipoMovimiento,
      unidadId: params.unidadId,
      articuloId: data.articuloId ?? '',
      articuloCodigo: data.articuloCodigo ?? '',
      articuloDescripcion: data.articuloDescripcion ?? '',
      cantidad: cantMovimiento,
      nroSerie: data.nroSerie ?? null, nroLote: data.nroLote ?? null,
      origenTipo: 'ingeniero' as TipoOrigenDestino,
      origenId: params.ingenieroId,
      origenNombre: params.ingenieroNombre,
      destinoTipo: 'posicion' as TipoOrigenDestino,
      destinoId: params.posicion.id,
      destinoNombre: params.posicion.nombre,
      otNumber: null,
      remitoId: null,
      motivo: params.motivo ?? 'Devolución de asignación a ingeniero',
      creadoPor,
      ...getCreateTrace(),
      createdAt: now,
    }));
  });
}

/**
 * Asiento de MovimientoStock para items de asignación SIN unidad puntual
 * (items por cantidad con solo `articuloId`) o para devoluciones parciales donde el
 * doc de unidad no cambia. Origen siempre el ingeniero; destino según tipo.
 */
export async function registrarMovimientoAsignacion(params: {
  tipo: 'consumo' | 'devolucion';
  unidadId?: string | null;
  articuloId?: string | null;
  articuloCodigo?: string | null;
  articuloDescripcion?: string | null;
  cantidad: number;
  ingenieroId: string;
  ingenieroNombre: string;
  otNumber?: string | null;
  /** Requerido para 'devolucion' (posición real de recepción). Ignorado en 'consumo'. */
  destinoPosicion?: { id: string; nombre: string } | null;
  motivo?: string | null;
}): Promise<void> {
  const destino: { tipo: TipoOrigenDestino; id: string; nombre: string } =
    params.tipo === 'consumo'
      ? {
          tipo: 'consumo_ot',
          id: params.otNumber ?? '',
          nombre: params.otNumber ? `OT ${params.otNumber}` : 'Consumo en campo',
        }
      : {
          tipo: 'posicion',
          id: params.destinoPosicion?.id ?? '',
          nombre: params.destinoPosicion?.nombre ?? 'Stock',
        };

  await movimientosService.create({
    tipo: params.tipo,
    unidadId: params.unidadId ?? '',
    articuloId: params.articuloId ?? '',
    articuloCodigo: params.articuloCodigo ?? '',
    articuloDescripcion: params.articuloDescripcion ?? '',
    cantidad: params.cantidad,
    origenTipo: 'ingeniero',
    origenId: params.ingenieroId,
    origenNombre: params.ingenieroNombre,
    destinoTipo: destino.tipo,
    destinoId: destino.id,
    destinoNombre: destino.nombre,
    remitoId: null,
    otNumber: params.otNumber ?? null,
    motivo: params.motivo ?? null,
    creadoPor: nombreUsuarioActual(),
  });
}
