import { doc, getDoc, getDocs, collection, query, where, runTransaction, Timestamp } from 'firebase/firestore';
import type { MovimientoStock, StockSelection, UnidadStock, EstadoUnidad, PatronLote, TipoOrigenDestino, CierreAdministrativo } from '@ags/shared';
import { db, docRef, deepCleanForFirestore, getCreateTrace, getUpdateTrace, getCurrentUserTrace, logAudit, logBusinessEvent } from './firebase';
import { todasDeducidas } from '../utils/cierreStockLineas';

/**
 * Reversión POR LÍNEA de un consumo del cierre de OT (fase 2 de la reapertura,
 * 2026-09-10 — ver .claude/plans/reapertura-ot.md §4.4).
 *
 * `movimientosStock` es create-only por reglas: nunca se borra un asiento. La
 * reversión es un CONTRA-ASIENTO `devolucion` con `subtipo:'reversion_cierre'`
 * y `revierteMovimientoId`, más la restitución de la unidad (o del lote de
 * patrón) al estado en que estaba: reservada si sigue reservada para un
 * presupuesto, asignada si está en poder de un ingeniero, disponible si no.
 * Remito y asignación de origen se destraban para que la línea vuelva a poder
 * consumirse. Lo que NO se revierte: las líneas de OTROS remitos del ingeniero
 * que el consumo marcó (no dejan rastro rastreable); se avisa.
 */

function estadoRestituido(u: Pick<UnidadStock, 'ubicacion' | 'reservadoParaPresupuestoId'>): EstadoUnidad {
  if (u.reservadoParaPresupuestoId) return 'reservado';
  if (u.ubicacion?.tipo === 'ingeniero') return 'asignado';
  return 'disponible';
}

async function yaRevertido(movId: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'movimientosStock'), where('revierteMovimientoId', '==', movId)));
  return !snap.empty;
}

/** Contra-asiento + restitución de una unidad / lote. Devuelve el id del contra-asiento o null si no aplicaba. */
async function revertirMovimiento(mov: MovimientoStock & { patronId?: string | null; lote?: string | null }, otNumber: string, actorNombre: string): Promise<string | null> {
  if (await yaRevertido(mov.id)) return null;
  const now = Timestamp.now();
  const contraRef = doc(db, 'movimientosStock', crypto.randomUUID());
  const base = {
    tipo: 'devolucion' as const,
    subtipo: 'reversion_cierre' as const,
    revierteMovimientoId: mov.id,
    unidadId: mov.unidadId ?? '',
    articuloId: mov.articuloId ?? '',
    articuloCodigo: mov.articuloCodigo ?? '',
    articuloDescripcion: mov.articuloDescripcion ?? '',
    cantidad: mov.cantidad,
    nroSerie: mov.nroSerie ?? null,
    nroLote: mov.nroLote ?? null,
    // Espejo del consumo: sale de la OT y vuelve a donde estaba.
    origenTipo: 'consumo_ot' as TipoOrigenDestino,
    origenId: otNumber,
    origenNombre: `OT ${otNumber}`,
    destinoTipo: mov.origenTipo,
    destinoId: mov.origenId,
    destinoNombre: mov.origenNombre,
    otNumber,
    remitoId: mov.remitoId ?? null,
    motivo: `Reversión de consumo del cierre de OT ${otNumber} (asiento ${mov.id.slice(0, 8)})`,
    creadoPor: actorNombre,
    ...getCreateTrace(),
    createdAt: now,
  };

  await runTransaction(db, async tx => {
    if (mov.unidadId) {
      const uRef = docRef('unidades', mov.unidadId);
      const uSnap = await tx.get(uRef);
      if (!uSnap.exists()) throw new Error(`La unidad ${mov.unidadId} ya no existe: revertir a mano desde Stock`);
      const u = uSnap.data() as UnidadStock;
      // Consumo TOTAL dejó la unidad 'consumido' con su cantidad intacta: vuelve
      // al estado que le corresponde. Consumo PARCIAL de un lote solo la
      // decrementó: se le suma lo que salió.
      const patch = u.estado === 'consumido'
        ? { estado: estadoRestituido(u) }
        : { cantidad: (u.cantidad ?? 1) + mov.cantidad };
      tx.update(uRef, deepCleanForFirestore({ ...patch, ...getUpdateTrace(), updatedAt: now.toDate().toISOString() }));
    } else if (mov.patronId && mov.lote) {
      const pRef = docRef('patrones', mov.patronId);
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error(`El patrón ${mov.patronId} ya no existe`);
      const lotes = ((pSnap.data() as { lotes?: PatronLote[] }).lotes ?? []).map(l =>
        l.lote === mov.lote && typeof l.cantidad === 'number' ? { ...l, cantidad: (l.cantidad ?? 0) + mov.cantidad } : l);
      tx.update(pRef, deepCleanForFirestore({ lotes, ...getUpdateTrace(), updatedAt: now }));
    }
    tx.set(contraRef, deepCleanForFirestore({ ...base, patronId: mov.patronId ?? null, lote: mov.lote ?? null }));
  });
  if (mov.unidadId) logAudit({ action: 'update', collection: 'unidades_stock', documentId: mov.unidadId });
  return contraRef.id;
}

/** Destraba la línea del remito de origen (consumido → pendiente de nuevo). Best-effort. */
async function destrabarRemito(remitoId: string, remitoItemId: string | null, unidadId: string | null, cantidad: number): Promise<void> {
  const { remitosService } = await import('./firebaseService');
  const remito = await remitosService.getById(remitoId);
  if (!remito) return;
  const items = (remito.items ?? []).map(it => {
    const es = (remitoItemId && it.id === remitoItemId) || (!remitoItemId && unidadId && it.unidadId === unidadId);
    if (!es) return it;
    const consumida = Math.max(0, (it.cantidadConsumida ?? 0) - cantidad);
    return { ...it, cantidadConsumida: consumida, consumido: false, fechaConsumo: null };
  });
  const algunoResuelto = items.some(it => it.devuelto || it.consumido);
  await remitosService.update(remitoId, {
    items,
    estado: algunoResuelto ? 'completado_parcial' : 'confirmado',
    fechaDevolucion: null,
  });
}

/** Devuelve el saldo al ítem de la asignación (y a la línea de su remito de salida). Best-effort. */
async function destrabarAsignacion(asignacionId: string, asignacionItemId: string, cantidad: number): Promise<void> {
  const { asignacionesService } = await import('./firebaseService');
  const asg = await asignacionesService.getById(asignacionId);
  if (!asg) return;
  let unidadId: string | null = null;
  const items = asg.items.map(it => {
    if (it.id !== asignacionItemId) return it;
    unidadId = it.unidadId ?? null;
    const consumida = Math.max(0, it.cantidadConsumida - cantidad);
    return { ...it, cantidadConsumida: consumida, estado: 'asignado' as const, fechaConsumo: null };
  });
  await asignacionesService.update(asignacionId, { items, estado: 'activa' });
  if (asg.remitoId) await destrabarRemito(asg.remitoId, null, unidadId, cantidad).catch(err => console.warn('[reversionCierre] remito de la asignación:', err));
}

export const reversionCierreService = {
  /**
   * Revierte una selección ya descontada y la quita del cierre de la OT, que
   * queda lista para volver a elegir origen. Persiste la OT (selecciones, flag
   * y nota) para que Firestore y el formulario no diverjan.
   */
  async revertirSeleccion(ot: { otNumber: string; cierreAdmin?: CierreAdministrativo }, selection: StockSelection): Promise<{ contraAsientos: string[]; selecciones: StockSelection[]; avisos: string[] }> {
    if (!selection.deducidoAt) throw new Error('Esta línea no está descontada: quitala del selector.');
    const movIds = selection.movimientoIds ?? [];
    if (movIds.length === 0) {
      throw new Error(selection.deducidoLegacy
        ? 'Esta línea se descontó antes del registro por línea: no hay asientos vinculados. Revertila a mano desde Stock (ajuste) y quitala del cierre.'
        : 'Esta línea no tiene asientos vinculados (se cubrió con reservas): quitala del cierre sin revertir.');
    }
    const actor = getCurrentUserTrace();
    const contraAsientos: string[] = [];
    const avisos: string[] = [];
    let cantidadRevertida = 0;
    for (const id of movIds) {
      const snap = await getDoc(doc(db, 'movimientosStock', id));
      if (!snap.exists()) { avisos.push(`Asiento ${id.slice(0, 8)} no encontrado`); continue; }
      const mov = { id: snap.id, ...(snap.data() as Omit<MovimientoStock, 'id'>) } as MovimientoStock & { patronId?: string | null; lote?: string | null };
      const contra = await revertirMovimiento(mov, ot.otNumber, actor?.name ?? 'Sistema');
      if (contra) { contraAsientos.push(contra); cantidadRevertida += mov.cantidad; }
    }
    if (selection.remitoId && selection.remitoItemId) {
      await destrabarRemito(selection.remitoId, selection.remitoItemId, null, cantidadRevertida)
        .catch(err => { console.warn('[reversionCierre] remito:', err); avisos.push('No se pudo destrabar la línea del remito'); });
    }
    if (selection.asignacionId && selection.asignacionItemId) {
      await destrabarAsignacion(selection.asignacionId, selection.asignacionItemId, cantidadRevertida)
        .catch(err => { console.warn('[reversionCierre] asignación:', err); avisos.push('No se pudo destrabar la asignación'); });
      avisos.push('Si otros remitos del ingeniero llevaban la misma pieza, sus líneas quedaron marcadas como consumidas: revisarlas a mano.');
    }

    // La selección sale del cierre; la nota deja el rastro.
    const selecciones = (ot.cierreAdmin?.stockSelections ?? []).filter(s => s !== selection && !(
      s.partId === selection.partId && s.deducidoAt === selection.deducidoAt && s.origenId === selection.origenId && s.unidadStockId === selection.unidadStockId));
    const nota = `[stock] Revertido ${cantidadRevertida} × ${selection.partCodigo} (${selection.origenNombre || selection.origenTipo}) el ${new Date().toLocaleDateString('es-AR')} por ${actor?.name ?? 'Sistema'}.`;
    const { ordenesTrabajoService } = await import('./firebaseService');
    await ordenesTrabajoService.update(ot.otNumber, {
      cierreAdmin: {
        horasConfirmadas: false, partesConfirmadas: false, avisoAdminEnviado: false,
        ...(ot.cierreAdmin ?? {}),
        stockSelections: selecciones,
        stockDeducido: todasDeducidas(selecciones),
        notasCierre: [ot.cierreAdmin?.notasCierre?.trim() || null, nota].filter(Boolean).join('\n'),
      },
    });
    logBusinessEvent({
      eventName: 'ot.consumo_revertido',
      collection: 'ordenes_trabajo',
      documentId: ot.otNumber,
      details: { partCodigo: selection.partCodigo, cantidad: cantidadRevertida, contraAsientos, origen: selection.origenNombre },
      entityLabel: `OT ${ot.otNumber}`,
    });
    return { contraAsientos, selecciones, avisos };
  },
};
