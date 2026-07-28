import { articulosService, unidadesService } from '../services/stockService';
import { ordenesCompraService } from '../services/presupuestosService';
import { requerimientosService } from '../services/importacionesService';
import { OC_OPEN_STATES } from '../services/stockAmplioService';
import type { Articulo, OrdenCompra, UnidadStock } from '@ags/shared';

/** Estados de requerimiento que ya no bloquean generar uno nuevo (cerrados). */
const REQ_CERRADOS = new Set(['comprado', 'cancelado', 'completado']);

// Guard de sesión: el sweep corre como máximo una vez cada N minutos por pestaña,
// sin importar cuántas veces se monten Alertas/Requerimientos. Dos PCs abriendo a la
// vez tienen una ventana de carrera chica (mismo trade-off que otros sweeps del
// proyecto, ej. recalificación de loaners); el dedup por artículo la acota.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = 0;

/** Disponible físico por artículo (suma cantidad de unidades 'disponible'). */
export function disponiblePorArticulo(unidades: UnidadStock[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const u of unidades) {
    if (u.estado !== 'disponible') continue;
    map.set(u.articuloId, (map.get(u.articuloId) ?? 0) + (u.cantidad ?? 1));
  }
  return map;
}

/** Pendiente de recibir por artículo en OCs abiertas (cantidad − recibida; incluye borrador). */
export function pendienteOCPorArticulo(ocs: OrdenCompra[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const oc of ocs) {
    if (!OC_OPEN_STATES.has(oc.estado)) continue;
    for (const it of (oc.items ?? [])) {
      if (!it.articuloId) continue;
      const pend = Math.max((it.cantidad ?? 0) - (it.cantidadRecibida ?? 0), 0);
      if (pend > 0) map.set(it.articuloId, (map.get(it.articuloId) ?? 0) + pend);
    }
  }
  return map;
}

/**
 * Sweep automático de stock mínimo → requerimientos (cambio de lógica 2026-07-25:
 * ya no hace falta el botón "Generar"). Para cada artículo activo con stockMinimo>0
 * cuyo stock efectivo (disponible + pendiente en OC) quedó bajo el mínimo y que no
 * tiene un requerimiento abierto, crea uno con origen 'stock_minimo' por el déficit.
 * Corre al montar Alertas de Stock / Requerimientos (throttled por sesión).
 * Devuelve cuántos creó (0 si el guard lo salteó).
 */
export async function sweepStockMinimoRequerimientos(opts?: { force?: boolean }): Promise<number> {
  const now = Date.now();
  if (!opts?.force && now - lastSweep < SWEEP_INTERVAL_MS) return 0;
  lastSweep = now;

  const [articulos, unidades, ocs, reqs] = await Promise.all([
    articulosService.getAll({ activoOnly: true }),
    unidadesService.getAll({ activoOnly: true }),
    ordenesCompraService.getAll(),
    requerimientosService.getAll(),
  ]);

  const dispo = disponiblePorArticulo(unidades);
  const enOC = pendienteOCPorArticulo(ocs);
  const conReqAbierto = new Set(
    reqs.filter(r => !REQ_CERRADOS.has(r.estado) && r.articuloId).map(r => r.articuloId as string),
  );

  let creados = 0;
  for (const art of articulos as Articulo[]) {
    if (art.stockMinimo <= 0) continue;
    if (conReqAbierto.has(art.id)) continue;
    const efectivo = (dispo.get(art.id) ?? 0) + (enOC.get(art.id) ?? 0);
    if (efectivo >= art.stockMinimo) continue;
    try {
      await requerimientosService.create({
        articuloId: art.id,
        articuloCodigo: art.codigo,
        articuloDescripcion: art.descripcion,
        cantidad: art.stockMinimo - efectivo,
        unidadMedida: art.unidadMedida,
        motivo: `Stock bajo mínimo (disp: ${dispo.get(art.id) ?? 0}, en OC: ${enOC.get(art.id) ?? 0}, mín: ${art.stockMinimo})`,
        origen: 'stock_minimo',
        origenRef: art.id,
        estado: 'pendiente',
        proveedorSugeridoId: art.proveedorIds?.[0] ?? null,
        solicitadoPor: 'Automático',
        fechaSolicitud: new Date().toISOString(),
        urgencia: 'media',
      });
      creados++;
    } catch (err) {
      console.error(`[sweepStockMinimo] error creando req para ${art.codigo}:`, err);
    }
  }
  if (creados > 0) console.log(`[sweepStockMinimo] ${creados} requerimiento(s) generados automáticamente`);
  return creados;
}
