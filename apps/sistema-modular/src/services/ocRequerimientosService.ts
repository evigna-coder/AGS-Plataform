import { Timestamp } from 'firebase/firestore';
import type { OrdenCompra, RequerimientoCompra } from '@ags/shared';
import { cleanFirestoreData, createBatch, batchAudit, docRef, getUpdateTrace } from './firebase';
import { requerimientosService } from './importacionesService';
import { presupuestosService, leadsService } from './firebaseService';
import {
  aplicarSeleccionAItems, candidatosConciliacion, idsSeleccionados, repartirCantidad,
  type GrupoConciliacion, type RepartoRequerimiento, type SeleccionConciliacion,
} from '../utils/conciliarRequerimientosOC';

/**
 * Vínculo OC ↔ requerimientos al ENVIAR la OC (2026-09-10). Ver
 * `utils/conciliarRequerimientosOC.ts` para el porqué y las reglas de match.
 */
export const ocRequerimientosService = {
  /** Requerimientos abiertos (pendiente/aprobado) que podrían corresponder a los ítems de la OC. */
  async candidatos(oc: OrdenCompra): Promise<GrupoConciliacion[]> {
    const [pendientes, aprobados] = await Promise.all([
      requerimientosService.getByEstado('pendiente'),
      requerimientosService.getByEstado('aprobado'),
    ]);
    return candidatosConciliacion(oc, [...pendientes, ...aprobados]);
  },

  /**
   * Estampa los requerimientos elegidos en los ítems de la OC y los pasa a
   * `en_compra` vinculados a ella (mismo estado que deja "Generar OC" desde la
   * planilla). Un solo batch: o queda todo o no queda nada.
   *
   * Si la OC no cubre la cantidad de un requerimiento, éste queda por lo
   * cubierto y nace otro PENDIENTE por el saldo (se crea antes del batch; si
   * el batch falla se borra, para no dejar un saldo huérfano).
   */
  async vincular(oc: OrdenCompra, seleccion: SeleccionConciliacion, reqs: RequerimientoCompra[]): Promise<number> {
    const ids = idsSeleccionados(seleccion);
    if (ids.length === 0) return 0;
    const items = aplicarSeleccionAItems(oc.items ?? [], seleccion);
    const repartos = repartosDeSeleccion(oc, seleccion, reqs);

    const saldosCreados: string[] = [];
    for (const r of repartos) {
      if (r.saldo <= 0) continue;
      saldosCreados.push(await requerimientosService.create(requerimientoSaldo(r, oc)));
    }

    try {
      const batch = createBatch();
      const trace = { ...getUpdateTrace(), updatedAt: Timestamp.now() };

      const ocPatch = cleanFirestoreData({ items, ...trace });
      batch.update(docRef('ordenes_compra', oc.id), ocPatch);
      batchAudit(batch, { action: 'update', collection: 'ordenes_compra', documentId: oc.id, after: ocPatch });

      for (const r of repartos) {
        const notaParcial = `OC ${oc.numero} cubre ${r.cubierta} de ${r.req.cantidad}; el saldo (${r.saldo}) sigue pendiente en otro requerimiento.`;
        const reqPatch = cleanFirestoreData({
          estado: 'en_compra',
          ordenCompraId: oc.id,
          ordenCompraNumero: oc.numero ?? null,
          // Parcial: el requerimiento queda por lo que esta OC cubre.
          ...(r.saldo > 0 ? {
            cantidad: r.cubierta,
            notas: [r.req.notas?.trim() || null, notaParcial].filter(Boolean).join(' | '),
          } : {}),
          ...trace,
        });
        batch.update(docRef('requerimientos_compra', r.req.id), reqPatch);
        batchAudit(batch, { action: 'update', collection: 'requerimientos_compra', documentId: r.req.id, after: reqPatch });
      }
      await batch.commit();
    } catch (err) {
      await Promise.all(saldosCreados.map(id => requerimientosService.delete(id).catch(() => undefined)));
      throw err;
    }

    // Mismo avance de tickets que al generar la OC desde la planilla.
    await advanceTicketsToMateriales(reqs.filter(r => ids.includes(r.id)));
    return ids.length;
  },
};

/** Reparto de la cantidad de cada ítem entre sus requerimientos elegidos, en el orden de selección. */
export function repartosDeSeleccion(oc: OrdenCompra, seleccion: SeleccionConciliacion, reqs: RequerimientoCompra[]): RepartoRequerimiento[] {
  const byId = new Map(reqs.map(r => [r.id, r]));
  return (oc.items ?? []).flatMap(item => {
    const elegidos = (seleccion.get(item.id) ?? []).map(id => byId.get(id)).filter((r): r is RequerimientoCompra => !!r);
    return elegidos.length ? repartirCantidad(item, elegidos) : [];
  });
}

/**
 * Requerimiento nuevo por el saldo que la OC no cubre: mismo artículo, origen y
 * presupuesto que el original, pendiente y sin OC. El desglose consolidado se
 * queda en el original (no se puede partir con criterio).
 */
function requerimientoSaldo(r: RepartoRequerimiento, oc: OrdenCompra): Omit<RequerimientoCompra, 'id' | 'numero' | 'createdAt' | 'updatedAt'> {
  const { req } = r;
  return {
    articuloId: req.articuloId ?? null,
    articuloCodigo: req.articuloCodigo ?? null,
    articuloDescripcion: req.articuloDescripcion,
    cantidad: r.saldo,
    unidadMedida: req.unidadMedida,
    motivo: req.motivo,
    origen: req.origen,
    origenRef: req.origenRef ?? null,
    estado: 'pendiente',
    proveedorSugeridoId: req.proveedorSugeridoId ?? null,
    proveedorSugeridoNombre: req.proveedorSugeridoNombre ?? null,
    solicitadoPor: req.solicitadoPor,
    fechaSolicitud: new Date().toISOString().slice(0, 10),
    urgencia: req.urgencia,
    presupuestoId: req.presupuestoId ?? null,
    presupuestoNumero: req.presupuestoNumero ?? null,
    presupuestoItemId: req.presupuestoItemId ?? null,
    condicional: req.condicional,
    patronId: req.patronId ?? null,
    loteId: req.loteId ?? null,
    codigoComponente: req.codigoComponente ?? null,
    notas: `Saldo de ${req.numero}: ${r.saldo} ${req.unidadMedida} no cubiertas por la OC ${oc.numero}.`,
  };
}

/**
 * Mueve a "Materiales" los tickets de origen de los presupuestos detrás de
 * estos requerimientos. Best-effort. (Vivía en `useGenerarOC`; acá para que
 * lo usen los dos caminos que dejan requerimientos en compra.)
 */
export async function advanceTicketsToMateriales(reqs: RequerimientoCompra[]): Promise<void> {
  try {
    const presupuestoIds = [...new Set(reqs.map(r => r.presupuestoId).filter(Boolean) as string[])];
    if (presupuestoIds.length === 0) return;
    const ticketIds = new Set<string>();
    for (const pid of presupuestoIds) {
      const pres = await presupuestosService.getById(pid).catch(() => null);
      if (pres?.origenTipo === 'lead' && pres.origenId) ticketIds.add(pres.origenId);
    }
    await Promise.all([...ticketIds].map(tid =>
      leadsService.moverAArea(tid, 'materiales').catch(err =>
        console.error(`Error moviendo ticket ${tid} a Materiales:`, err),
      ),
    ));
  } catch (err) {
    console.error('[advanceTicketsToMateriales]', err);
  }
}
