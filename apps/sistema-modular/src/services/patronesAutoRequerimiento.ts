/**
 * Phase 14 BOM-08 — auto-creación de RequerimientoCompra cuando un componente
 * de patrón cae bajo stockMinimo después de un consumo.
 *
 * Precedente: FLOW-03 (presupuestosService.ts:939-985) auto-req from acceptance
 * + Regla G (Phase 8 _cancelarRequerimientosCondicionales) idempotency check.
 *
 * Contrato:
 *   - Best-effort, POST-commit (invocado por consumirComponentes después del tx).
 *     Una falla NO bloquea el descuento de componentes ya commiteado.
 *   - Idempotente: si ya existe un REQ abierto (no comprado/cancelado) para
 *     (patronId, loteId, codigoComponente), NO crea uno nuevo.
 *   - Skip silencioso si `adminConfigFlujos.usuarioRequerimientosPatronId === null`
 *     (responsable no configurado — admin debe ir a /admin/config-flujos, UI en 14-06).
 *
 * Dispatch: cuando `options.__testState` está presente, usa el MockPatronBomState
 * in-memory (tests unitarios). Sin él, hace los Firestore reads/writes reales
 * via lazy imports (mirrors Phase 13 equivalenciasService + patronesService).
 */
import type { Patron } from '@ags/shared';
import { computeSaldoComponente } from '@ags/shared/utils/patronBom';
import type { MockPatronBomState } from '../__tests__/fixtures/patronBom';

export interface AutoCrearReqOptions {
  /** Inyectado por tests unitarios. Coincide con MockPatronBomState (fixtures/patronBom). */
  __testState?: MockPatronBomState;
}

/**
 * Para cada patron en `patronIds`, escanea sus lotes×componentes y crea
 * 1 RequerimientoCompra (origen='patron_minimo') por cada componente con
 * `saldo <= stockMinimo` que NO tenga ya un REQ abierto.
 *
 * Retorna los ids de los RequerimientoCompra creados (o `[]` si skip por
 * config / idempotency / sin BOM).
 */
export async function autoCrearRequerimientosPatron(
  patronIds: string[],
  options?: AutoCrearReqOptions,
): Promise<string[]> {
  if (options?.__testState) return _autoCrearInTest(patronIds, options.__testState);
  return _autoCrearInProd(patronIds);
}

// ── Test path (in-memory MockPatronBomState) ─────────────────────────────────

function _autoCrearInTest(
  patronIds: string[],
  state: MockPatronBomState,
): string[] {
  const asignadoA = state.adminConfigFlujos?.usuarioRequerimientosPatronId;
  if (!asignadoA) return [];

  // Pre-cargar requerimientos abiertos con origen 'patron_minimo' (set local mutable
  // para que dos componentes consecutivos del mismo lote no dupliquen REQ).
  const reqsAbiertos = [...state.requerimientos.values()].filter(
    (r: any) =>
      r.origen === 'patron_minimo' &&
      r.estado !== 'comprado' &&
      r.estado !== 'cancelado',
  );

  const creados: string[] = [];
  for (const patronId of patronIds) {
    const patron = state.patrones.get(patronId) as Patron | undefined;
    if (!patron || !patron.componentes || patron.componentes.length === 0) continue;
    for (const lote of patron.lotes ?? []) {
      for (const comp of patron.componentes) {
        const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
        const minimo = comp.stockMinimo ?? 0;
        if (saldo > minimo) continue;
        // Idempotency: skip si ya hay REQ abierto para esta triplet
        const yaHay = reqsAbiertos.some(
          (r: any) =>
            r.patronId === patronId &&
            r.loteId === lote.lote &&
            r.codigoComponente === comp.codigoComponente,
        );
        if (yaHay) continue;
        const id = crypto.randomUUID();
        const nuevo = {
          id,
          numero: `REQ-MOCK-${state.requerimientos.size + 1}`,
          origen: 'patron_minimo',
          patronId,
          loteId: lote.lote,
          codigoComponente: comp.codigoComponente,
          estado: 'pendiente',
          solicitadoPor: asignadoA,
          urgencia: 'media',
          articuloCodigo: patron.codigoArticulo,
          articuloDescripcion: `${comp.descripcion} (componente de ${patron.descripcion}) — lote ${lote.lote}`,
          cantidad: 1,
          unidadMedida: comp.unidadMedida,
          motivo: `Componente ${comp.codigoComponente} bajo mínimo (saldo=${saldo}, mínimo=${minimo}) — lote ${lote.lote}`,
        };
        state.requerimientos.set(id, nuevo);
        reqsAbiertos.push(nuevo); // dedupe same-batch (dos componentes del mismo lote)
        creados.push(id);
      }
    }
  }
  return creados;
}

// ── Production path (Firestore reads + writes) ───────────────────────────────
//
// Lazy imports inside the function body para evitar:
//   (a) ciclos de carga (patronesService -> patronesConsumirHelpers -> aquí -> patronesService)
//   (b) crash de tsx test runner si este módulo se importa en contexto de testing
//       (./firebase usa import.meta.env.VITE_*, no disponible bajo tsx).

async function _autoCrearInProd(patronIds: string[]): Promise<string[]> {
  const { adminConfigService } = await import('./adminConfigService');
  const { patronesService } = await import('./patronesService');
  const { requerimientosService } = await import('./importacionesService');

  const config = await adminConfigService.getWithDefaults();
  const asignadoA = config.usuarioRequerimientosPatronId;
  if (!asignadoA) {
    console.warn(
      '[autoCrearRequerimientosPatron] usuarioRequerimientosPatronId no configurado — skip silencioso',
    );
    return [];
  }

  // 1 query: traer todos los REQ abiertos con origen patron_minimo
  const reqsAbiertosAll = await requerimientosService.getAll({ origen: 'patron_minimo' });
  const reqsAbiertos: any[] = reqsAbiertosAll.filter(
    (r: any) => r.estado !== 'comprado' && r.estado !== 'cancelado',
  );

  const creados: string[] = [];
  for (const patronId of patronIds) {
    const patron = await patronesService.getById(patronId);
    if (!patron || !patron.componentes || patron.componentes.length === 0) continue;
    for (const lote of patron.lotes ?? []) {
      for (const comp of patron.componentes) {
        const saldo = computeSaldoComponente(patron, lote, comp.codigoComponente);
        const minimo = comp.stockMinimo ?? 0;
        if (saldo > minimo) continue;
        const yaHay = reqsAbiertos.some(
          (r: any) =>
            r.patronId === patronId &&
            r.loteId === lote.lote &&
            r.codigoComponente === comp.codigoComponente,
        );
        if (yaHay) continue;
        const reqId = await requerimientosService.create({
          articuloId: null,
          articuloCodigo: patron.codigoArticulo,
          articuloDescripcion: `${comp.descripcion} (componente de ${patron.descripcion}) — lote ${lote.lote}`,
          cantidad: 1,
          unidadMedida: comp.unidadMedida,
          motivo: `Componente ${comp.codigoComponente} bajo mínimo (saldo=${saldo}, mínimo=${minimo}) — lote ${lote.lote}`,
          origen: 'patron_minimo',
          origenRef: patronId,
          estado: 'pendiente',
          solicitadoPor: asignadoA,
          fechaSolicitud: new Date().toISOString(),
          urgencia: 'media',
          patronId,
          loteId: lote.lote,
          codigoComponente: comp.codigoComponente,
        } as any);
        creados.push(reqId);
        // Trackear in-memory para dedupe same-batch (dos componentes del mismo lote
        // o dos patrones que comparten algo no es realista, pero blindamos por las dudas)
        reqsAbiertos.push({
          patronId,
          loteId: lote.lote,
          codigoComponente: comp.codigoComponente,
        });
      }
    }
  }
  return creados;
}
