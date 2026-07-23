/**
 * Phase 15 (VLN-02) — venta transaccional de loaner con espejo en stock.
 *
 * Extracted from loanersService.ts to keep that file under the de-facto service
 * budget (precedente Phase 14: `patronesConsumirHelpers.ts` se extrajo de
 * `patronesService.ts` por la misma razón). El único entry point público
 * `registrarVenta` se re-exporta desde `loanersService.ts` para que callers
 * sigan importando desde una ubicación estable.
 *
 * Una sola `runTransaction` atómica escribe 3 docs:
 *   1. UPDATE  loaners/{loanerId}        → estado='vendido', activo=false, venta, (denormaliza artículo si recienVinculado)
 *   2. CREATE  unidades/{unidadId}       → UnidadStock espejo (estado='vendido', ubicacion='cliente')
 *   3. CREATE  movimientosStock/{movId}  → MovimientoStock (subtipo='venta_loaner', referenciaLoanerId)
 *
 * READ-FIRST guard: si loaner ya está vendido → throw 'Loaner ya vendido' y nada se escribe.
 *
 * Pre-tx validation: costoUnitario y monedaCosto son required en runtime; si faltan
 * → throw 'Costo requerido' antes de entrar a la tx.
 *
 * Post-commit audit (best-effort): `logBusinessEvent('loaner.vendido', ...)` —
 * un fallo del audit NO bloquea ni rollbackea la venta.
 *
 * Modelo: calcado 1:1 de `patronesConsumirHelpers._consumirComponentesInProd` (Phase 14,
 * GREEN en producción desde 2026-05-24).
 *
 * Test DI: el factory `buildRegistrarVenta` recibe el `getTestState` desde
 * `loanersService.ts` (que es donde vive el `_testState` module-level + el
 * `__setTestFirestore` setter); cuando hay state, dispatch al path in-memory
 * (`_registrarVentaInTest`) que mutea `state.collections` sin tocar Firestore.
 */

import { doc, Timestamp } from 'firebase/firestore';
import type { Loaner, VentaLoaner } from '@ags/shared';
import type { MockVentaLoanerState } from './__tests__/fixtures/ventaLoaner';

// ── Public types ─────────────────────────────────────────────────────────────

export interface RegistrarVentaParams {
  loanerId: string;
  /**
   * `costoUnitario` y `monedaCosto` quedan opcionales en el tipo `VentaLoaner`
   * (backwards-compat con ventas pre-Phase-15), pero son REQUIRED en runtime
   * dentro de `registrarVenta`: si vienen null/undefined, throw `Costo requerido`
   * antes de entrar a la tx (VLN-02e).
   */
  venta: VentaLoaner & { costoUnitario: number; monedaCosto: 'ARS' | 'USD' };
  /**
   * Optional. Si el loaner no tenía `articuloId` y el usuario lo acaba de
   * vincular en el modal de venta (Wave 3), denormalizamos los 3 campos
   * (articuloId/Codigo/Descripcion) en el loaner DENTRO de la misma tx
   * para que quede atomic con la creación de la unidad+movimiento espejo.
   */
  articuloRecienVinculado?: {
    articuloId: string;
    articuloCodigo: string;
    articuloDescripcion: string;
  } | null;
}

export interface RegistrarVentaResult {
  unidadId: string;
  movimientoId: string;
}

// ── Factory (mirror patronesConsumirHelpers.buildConsumirComponentes) ────────

/**
 * Factory: returns the `registrarVenta` function bound to a getter for the
 * test-state and a lazy firebase modules loader. This indirection avoids the
 * circular import: `loanersService.ts` owns the `_testState` variable and the
 * `getFirebaseModules()` lazy loader; we receive both as dependencies.
 */
export function buildRegistrarVenta(deps: {
  getTestState: () => MockVentaLoanerState | null;
  getFirebaseModules: () => Promise<{
    db: any;
    deepCleanForFirestore: any;
    getCreateTrace: any;
    getUpdateTrace: any;
    logBusinessEvent: any;
  }>;
}): (params: RegistrarVentaParams) => Promise<RegistrarVentaResult> {
  return async function registrarVenta(params) {
    // STEP 0 — Pre-tx validation (VLN-02e). Antes de cualquier IO.
    if (params.venta.costoUnitario == null || params.venta.monedaCosto == null) {
      throw new Error('Costo requerido');
    }

    // Dispatch test vs prod (mirror equivalenciasService.desagregarUnidades).
    const state = deps.getTestState();
    if (state) {
      return _registrarVentaInTest(params, state);
    }
    return _registrarVentaInProd(params, deps.getFirebaseModules);
  };
}

// ── Test path (in-memory MockVentaLoanerState) ───────────────────────────────
// Atomic-simulation strategy: build ALL projected writes first (no mutation),
// then check the rollback hook (`state._throwOnUnidadCreate`), then commit all
// mutations atomically. Mirrors patronesConsumirHelpers._consumirComponentesInTest
// "validate-first, mutate-last" pattern (BOM-03 line 158).

async function _registrarVentaInTest(
  params: RegistrarVentaParams,
  state: MockVentaLoanerState,
): Promise<RegistrarVentaResult> {
  const loaner = state.collections.loaners.find(l => l.id === params.loanerId);
  if (!loaner) throw new Error('Loaner no encontrado');

  // GUARD (VLN-02c) — READ-FIRST idempotency check.
  if (loaner.estado === 'vendido') {
    throw new Error('Loaner ya vendido');
  }

  // Resolve articuloId final (recienVinculado wins, else loaner's own).
  const articuloId =
    params.articuloRecienVinculado?.articuloId ?? loaner.articuloId;
  if (!articuloId) {
    throw new Error('Loaner sin artículo vinculado — no se puede crear espejo en stock');
  }
  const articuloCodigo =
    params.articuloRecienVinculado?.articuloCodigo ?? loaner.articuloCodigo ?? '';
  const articuloDescripcion =
    params.articuloRecienVinculado?.articuloDescripcion ?? loaner.articuloDescripcion ?? '';

  const unidadId = crypto.randomUUID();
  const movimientoId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  // Build all projected writes (no mutation yet).
  const loanerPatch: Partial<typeof loaner> = {
    estado: 'vendido',
    activo: false,
    venta: params.venta as unknown as Record<string, unknown>,
    ...(params.articuloRecienVinculado
      ? {
          articuloId: params.articuloRecienVinculado.articuloId,
          articuloCodigo: params.articuloRecienVinculado.articuloCodigo,
          articuloDescripcion: params.articuloRecienVinculado.articuloDescripcion,
        }
      : {}),
  };

  const newUnidad = {
    id: unidadId,
    articuloId,
    articuloCodigo,
    articuloDescripcion,
    nroSerie: loaner.serie ?? null,
    nroLote: null,
    condicion: 'bien_de_uso',
    estado: 'vendido',
    ubicacion: {
      tipo: 'cliente',
      referenciaId: params.venta.clienteId,
      referenciaNombre: params.venta.clienteNombre,
    },
    costoUnitario: params.venta.costoUnitario,
    monedaCosto: params.venta.monedaCosto,
    observaciones: params.venta.notas ?? null,
    reservadoParaPresupuestoId: null,
    reservadoParaPresupuestoNumero: null,
    reservadoParaClienteId: null,
    reservadoParaClienteNombre: null,
    activo: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const newMovimiento = {
    id: movimientoId,
    tipo: 'egreso',
    subtipo: 'venta_loaner',
    unidadId,
    articuloId,
    articuloCodigo,
    articuloDescripcion,
    cantidad: 1,
    origenTipo: 'baja',
    origenId: loaner.id,
    origenNombre: loaner.codigo,
    destinoTipo: 'cliente',
    destinoId: params.venta.clienteId,
    destinoNombre: params.venta.clienteNombre,
    referenciaLoanerId: loaner.id,
    referenciaLoanerCodigo: loaner.codigo,
    motivo: params.venta.presupuestoNumero
      ? `Venta vinculada a presupuesto ${params.venta.presupuestoNumero}`
      : null,
    otNumber: null,
    remitoId: null,
    creadoPor: 'test-user',
    createdAt: nowIso,
  };

  // ── Atomic-simulated rollback hook (VLN-02d) ──
  // Checked AFTER all projections are built but BEFORE any mutation, so a throw
  // here leaves `state` untouched (true rollback semantics for the in-memory path).
  if ((state as any)._throwOnUnidadCreate) {
    throw new Error('mock: unidad create failed');
  }

  // COMMIT — mutate state atomically (all-or-nothing already guaranteed by the
  // throw-before-mutate ordering above).
  Object.assign(loaner, loanerPatch);
  state.collections.unidades.push(newUnidad);
  state.collections.movimientosStock.push(newMovimiento);

  return { unidadId, movimientoId };
}

// ── Production path (real Firestore runTransaction) ──────────────────────────

async function _registrarVentaInProd(
  params: RegistrarVentaParams,
  getFirebaseModules: () => Promise<{
    db: any;
    deepCleanForFirestore: any;
    getCreateTrace: any;
    getUpdateTrace: any;
    logBusinessEvent: any;
  }>,
): Promise<RegistrarVentaResult> {
  const { db, deepCleanForFirestore, getCreateTrace, getUpdateTrace, logBusinessEvent } =
    await getFirebaseModules();
  const { runTransaction } = await import('firebase/firestore');

  // STEP A — Pre-gen IDs and timestamp OUTSIDE the tx (Pitfall: minimize tx scope).
  const unidadId = crypto.randomUUID();
  const movimientoId = crypto.randomUUID();
  const nowTs = Timestamp.now();

  // STEP B — Obtain `creadoPor` once, BEFORE the tx (Pitfall 2: explicit creadoPor
  // required by MovimientoStock; resolving inside the tx would add overhead).
  const userTrace = getCreateTrace();
  const creadoPorNombre = userTrace.createdByName ?? userTrace.createdBy ?? 'desconocido';

  // STEP C — runTransaction (READ FIRST → 3 WRITES).
  await runTransaction(db, async (tx: any) => {
    const loanerRef = doc(db, 'loaners', params.loanerId);
    const snap = await tx.get(loanerRef);
    if (!snap.exists()) throw new Error('Loaner no encontrado');
    const loaner = { id: snap.id, ...(snap.data() as any) } as Loaner;

    // GUARD (VLN-02c) — READ-FIRST under tx lock; safe against double-click / concurrency.
    if (loaner.estado === 'vendido') {
      throw new Error('Loaner ya vendido');
    }

    // Resolve articuloId final (recienVinculado wins; else loaner's own; else throw).
    const articuloId =
      params.articuloRecienVinculado?.articuloId ?? loaner.articuloId;
    if (!articuloId) {
      throw new Error('Loaner sin artículo vinculado — no se puede crear espejo en stock');
    }
    const articuloCodigo =
      params.articuloRecienVinculado?.articuloCodigo ?? loaner.articuloCodigo ?? '';
    const articuloDescripcion =
      params.articuloRecienVinculado?.articuloDescripcion ?? loaner.articuloDescripcion ?? '';

    // WRITE 1 — UPDATE loaner (Pitfall 1: getUpdateTrace porque es update existente).
    tx.update(
      loanerRef,
      deepCleanForFirestore({
        estado: 'vendido',
        activo: false,
        venta: params.venta,
        ...(params.articuloRecienVinculado
          ? {
              articuloId: params.articuloRecienVinculado.articuloId,
              articuloCodigo: params.articuloRecienVinculado.articuloCodigo,
              articuloDescripcion: params.articuloRecienVinculado.articuloDescripcion,
            }
          : {}),
        ...getUpdateTrace(),
        updatedAt: nowTs,
      }),
    );

    // WRITE 2 — CREATE UnidadStock espejo (Pitfall 1: getCreateTrace).
    tx.set(
      doc(db, 'unidades', unidadId),
      deepCleanForFirestore({
        articuloId,
        articuloCodigo,
        articuloDescripcion,
        nroSerie: loaner.serie ?? null,         // Pitfall 4: coerce undefined → null
        nroLote: null,
        condicion: 'bien_de_uso',
        estado: 'vendido',
        ubicacion: {
          tipo: 'cliente',
          referenciaId: params.venta.clienteId,
          referenciaNombre: params.venta.clienteNombre,
        },
        costoUnitario: params.venta.costoUnitario,
        monedaCosto: params.venta.monedaCosto,
        observaciones: params.venta.notas ?? null,
        reservadoParaPresupuestoId: null,
        reservadoParaPresupuestoNumero: null,
        reservadoParaClienteId: null,
        reservadoParaClienteNombre: null,
        activo: true,
        ...getCreateTrace(),
        createdAt: nowTs,
        updatedAt: nowTs,
      }),
    );

    // WRITE 3 — CREATE MovimientoStock espejo (Pitfall 1+2: getCreateTrace + creadoPor explícito).
    tx.set(
      doc(db, 'movimientosStock', movimientoId),
      deepCleanForFirestore({
        tipo: 'egreso',
        subtipo: 'venta_loaner',
        unidadId,
        articuloId,
        articuloCodigo,
        articuloDescripcion,
        cantidad: 1,
        nroSerie: loaner.serie ?? null,        // denormalizado para filtrar el log por serie
        nroLote: null,
        origenTipo: 'baja',
        origenId: loaner.id,
        origenNombre: loaner.codigo,
        destinoTipo: 'cliente',
        destinoId: params.venta.clienteId,
        destinoNombre: params.venta.clienteNombre,
        referenciaLoanerId: loaner.id,
        referenciaLoanerCodigo: loaner.codigo,
        motivo: params.venta.presupuestoNumero
          ? `Venta vinculada a presupuesto ${params.venta.presupuestoNumero}`
          : null,
        otNumber: null,
        remitoId: null,
        creadoPor: creadoPorNombre,            // Pitfall 2: REQUIRED en MovimientoStock
        ...getCreateTrace(),
        createdAt: nowTs,
      }),
    );
  });

  // STEP D — POST-commit audit (best-effort; never blocks the tx).
  try {
    logBusinessEvent({
      eventName: 'loaner.vendido',
      collection: 'loaners',
      documentId: params.loanerId,
      details: {
        unidadId,
        movimientoId,
        clienteId: params.venta.clienteId,
        clienteNombre: params.venta.clienteNombre,
        precio: params.venta.precio ?? null,
        moneda: params.venta.moneda ?? null,
        costoUnitario: params.venta.costoUnitario,
        monedaCosto: params.venta.monedaCosto,
      },
    });
  } catch (err) {
    console.error('[registrarVenta] audit post-commit falló (best-effort):', err);
  }

  return { unidadId, movimientoId };
}
