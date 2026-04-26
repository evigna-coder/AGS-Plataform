# Phase 12: Esquema Facturación Porcentual + Anticipos — Research

**Researched:** 2026-04-26
**Domain:** Presupuestos / Facturación — multi-cuota porcentual con hitos disparadores y MIXTA per-moneda
**Confidence:** HIGH (LOCKED CONTEXT — research is implementation-shape, not exploratory)

## Summary

Phase 12 extends the existing Tier-1 facturación flow (`PresupuestoFacturacionSection` + `presupuestosService.generarAvisoFacturacion`) with an **opt-in, per-presupuesto cuota schema** that supports anticipos, pre-embarque, and any milestone-driven N-cuota split. The design is **fully locked** by CONTEXT.md (sourced from PRD 2026-04-25): the hito enum, estado enum, `PresupuestoCuotaFacturacion` shape, MIXTA per-moneda model, 1:1 cuota↔solicitud relationship, and legacy preservation (`esquemaFacturacion = null|[]` keeps Tier-1 untouched) are not negotiable.

What this research adds: the **current code shape** of every touchpoint, exact line numbers, integration points the planner needs to wire, and the **Validation Architecture** mapping each of the 8 phase requirements to specific test commands the planner can convert into Wave 0 RED specs.

**Primary recommendation:** Plan in 6 waves following the PRD's Fases 1–6 (types → editor UI → facturación section refactor → sync wiring → E2E manual → Playwright sub-suites 11.51/11.52). Wave 0 lands the test scaffolding (unit tests for `recomputeCuotaEstados` + Playwright RED specs) so every later wave fails-then-passes one assertion at a time.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Conceptual model
- **"Adelantada" y "porcentual" son la misma feature.** No se modela `esAnticipo` separado. Anticipo = cuota con hito anterior a OT cerrada.
- **El esquema vive en el presupuesto.** Se define al armarlo, queda fijo (read-only) al pasar a `aceptado`.
- **Cuota ↔ Solicitud es 1:1.** `SolicitudFacturacion.cuotaId` apunta a la cuota; cuota tiene `solicitudFacturacionId`.
- **El hito no auto-genera** la solicitud — solo la "habilita". El admin sigue tirando manualmente "Generar solicitud".
- **Modo legacy intocado.** `esquemaFacturacion = null` o `[]` → flujo Tier-1 actual (1 solicitud al final, sin breaking changes).
- **Sin gate al aceptar**: pptos sin esquema caen al modo Tier-1 legacy. Esquema es opcional (incluso para `ventas`).
- **Aplica a TODO `tipo`** excepto `contrato`. `per_incident`, `ventas`, etc. todos pueden tener anticipos.

#### Hitos posibles (cerrados)
Valores enum `CuotaFacturacionHito`:
- `ppto_aceptado` → ppto.estado in ('aceptado', 'en_ejecucion').
- `oc_recibida` → `ppto.ordenesCompraIds?.length > 0`.
- `pre_embarque` → `ppto.preEmbarque === true` (toggle manual del admin).
- `todas_ots_cerradas` → todas las work-unit OTs en `CIERRE_ADMINISTRATIVO` o `FINALIZADO`. **Reemplaza** al "OT cierre admin" individual del Tier-1.
- `manual` → siempre habilitada (sin precondición).

#### Estados de cuota (cerrados)
Valores enum `CuotaFacturacionEstado`: `pendiente | habilitada | solicitada | facturada | cobrada`.

Reglas (función pura `recomputeCuotaEstados(ppto, ots, solicitudes)`):
- Si `cuota.solicitudFacturacionId != null` → mirror del estado de la solicitud (pendiente/enviada→solicitada, facturada→facturada, cobrada→cobrada, anulada→habilitada limpiando `solicitudFacturacionId`).
- Si no → evaluar hito y mapear a `pendiente | habilitada`.

#### MIXTA con % por moneda separado (cerrado)
- `porcentajePorMoneda: Partial<Record<'ARS'|'USD'|'EUR', number>>`.
- Cada cuota declara % independiente por moneda. Una cuota puede tener `{ARS: 30}` (no factura USD), `{USD: 70}` (no factura ARS), o `{ARS: 30, USD: 50}` (mixta).
- **Validación por moneda separada**: por cada moneda activa del ppto, la suma de %s a lo largo de las cuotas debe ser exactamente 100. ARS y USD se evalúan por separado.
- Mono-moneda: la UI colapsa a un solo input `%` (la moneda activa del ppto); la lógica es la misma con un solo bucket.
- **Tipos**: `MonedaCuota = 'ARS' | 'USD' | 'EUR'`. MIXTA NO se almacena por cuota — las cuotas siempre usan monedas individuales aunque `ppto.moneda === 'MIXTA'`.

#### Modelo de datos (locked)

```typescript
export type CuotaFacturacionHito =
  | 'ppto_aceptado' | 'oc_recibida' | 'pre_embarque' | 'todas_ots_cerradas' | 'manual';

export type CuotaFacturacionEstado =
  | 'pendiente' | 'habilitada' | 'solicitada' | 'facturada' | 'cobrada';

export type MonedaCuota = 'ARS' | 'USD' | 'EUR';

export interface PresupuestoCuotaFacturacion {
  id: string;
  numero: number;
  porcentajePorMoneda: Partial<Record<MonedaCuota, number>>;
  descripcion: string;
  hito: CuotaFacturacionHito;
  estado: CuotaFacturacionEstado;
  solicitudFacturacionId?: string | null;
  montoFacturadoPorMoneda?: Partial<Record<MonedaCuota, number>> | null;
}
```

`Presupuesto`:
- `esquemaFacturacion?: PresupuestoCuotaFacturacion[] | null` (null/[] = modo legacy Tier-1).
- `preEmbarque?: boolean` (toggle manual).

`SolicitudFacturacion`:
- `cuotaId?: string | null` (null = solicitud libre Tier-1 legacy).
- `porcentajeCoberturaPorMoneda?: Partial<Record<'ARS'|'USD'|'EUR', number>> | null`.

#### UI / Service / Validation locked details

(See CONTEXT.md `<decisions>` block for the full list — verbatim. Includes: `EsquemaFacturacionSection.tsx` ≤250 líneas, two-sub-section refactor of `PresupuestoFacturacionSection`, mini-modal mit N inputs per moneda activa, quick-templates "100% al cierre" / "30/70 anticipo+entrega" / "70/30 pre-embarque", validation table Σ%=100 per moneda + lock al `aceptado` + no-edit-cuota-facturada + server-side `habilitada` check, `generarAvisoFacturacion` extension `{ cuotaId?, montoPorMoneda? }`, persistencia via `cleanFirestoreData/deepCleanForFirestore`, lectura defensiva `?? []`.)

### Claude's Discretion
- Wiring específico del Vite/React component tree (cómo se importa `EsquemaFacturacionSection` desde `EditPresupuestoModal` — sigue patrón existente del proyecto).
- Naming exacto de botones internos no listados (mientras respete la familia de copy: "Generar solicitud", "Esperando hito", etc.).
- Ubicación exacta del setting `presupuesto.finalizarConSoloFacturado` (config global vs feature flag vs columna por ppto) — elegir lo más simple, default `true`.
- Implementación interna del helper `recomputeCuotaEstados` (functional vs reduce vs etc.) mientras sea pura y tenga tests.
- Patrón de mini-modal: reusar `Modal` atom existente o crear uno colocado.
- UUID generation para `cuota.id` (crypto.randomUUID en cliente vs nano-id) — preferir `crypto.randomUUID` si está disponible.

### Deferred Ideas (OUT OF SCOPE)
- **Fase 7 (UX polish, opcional)** del plan-of-record:
  - Badge "Facturado X% / Pendiente Y%" en lista de presupuestos.
  - Filtro nuevo en `PresupuestosList`: "con cuotas pendientes".
  - Sección en `ClienteDetail`: deuda total estimada por ppto pendiente.
- **F3 (open question)**: campo opcional `montoOverridePorPorcentaje` en `SolicitudFacturacion` para auditoría del override — probable yes, decidir al llegar a fase de override.
- **F7 (open question)**: dashboards/reportes admin contable — priorizar después de E2E.
- Cuotas en contratos anuales (`tipo='contrato'`) — modelo `PresupuestoCuota` propio, fuera de alcance.
- Migración/backfill de pptos legacy — no se hace, modo Tier-1 sigue funcionando.
- Integración fiscal/AFIP — fuera de alcance.
- Cobranza efectiva — módulo `facturacion` separado.
</user_constraints>

<phase_requirements>
## Phase Requirements

The roadmap names BILL-01..BILL-08 but does not enumerate them separately — they map 1:1 to the 8 success criteria in the ROADMAP Phase 12 section. The mapping below is canonical for this phase.

| ID | Description | Research Support |
|----|-------------|------------------|
| **BILL-01** | Definir esquema de N cuotas con % y hito en ppto borrador; UI valida Σ=100 por moneda activa antes de save. | "Standard Stack" (existing Modal/Button atoms, `useEsquemaFacturacion` hook pattern). "Architecture Patterns: Editor Section". "Common Pitfalls: undefined in Firestore writes". `Presupuesto.estado` borrador gate already enforced via existing `usePresupuestoEdit` save flow (see line 261 of `usePresupuestoEdit.ts`). |
| **BILL-02** | Hito cumplido → cuotas correspondientes pasan a `habilitada` automáticamente; UI muestra "Generar solicitud". | "Standard Stack: pure helper" + "Sync points (4)". `recomputeCuotaEstados(ppto, ots, solicitudes)` in `apps/sistema-modular/src/utils/cuotasFacturacion.ts`. Wired in 4 sync points — see *Architecture Patterns: Sync Wiring*. |
| **BILL-03** | Generar solicitud para cuota crea `solicitudFacturacion` 1:1 (con `cuotaId` back-ref), saca OTs incluidas de `otsListasParaFacturar`, actualiza estado de cuota — same `runTransaction` que el Tier-1 actual. | Service refactor: `generarAvisoFacturacion(presId, otNumbers, { cuotaId?, montoPorMoneda?, observaciones?, monto? })`. Línea 1310-1312 (current blocking guard) **se relaja para cuotaId path** — when `cuotaId` is present, OTs no longer need to be in `otsListasParaFacturar`. Server-side guard added: cuota MUST be `habilitada`. |
| **BILL-04** | MIXTA — cuotas pueden tener % independientes por moneda; validación por moneda separada. | "Architecture Patterns: validación per-moneda". `porcentajePorMoneda: Partial<Record<MonedaCuota, number>>` + reduce-by-moneda validator. Reuse existing `totalsByCurrency` pattern from `EditPresupuestoModal.tsx:110-118` for default amounts in mini-modal. |
| **BILL-05** | Pptos sin esquema definido (`esquemaFacturacion` null o `[]`) siguen flujo Tier-1 actual sin breaking changes. | Service-side: `if (!cuotaId && !pres.esquemaFacturacion?.length)` → exact current code path. Sub-section B of refactored `PresupuestoFacturacionSection` preserves existing UX. Backward-compat assertion in Validation Architecture below. |
| **BILL-06** | `trySyncFinalizacion` finaliza ppto solo cuando todas cuotas en `facturada`/`cobrada` Y todas OTs `FINALIZADO`. | "Architecture Patterns: trySyncFinalizacion extended". Current implementation at `presupuestosService.ts:1229-1278` — adds branch for ppto with esquema. Default `finalizarConSoloFacturado: true` allows `facturada` as terminal. |
| **BILL-07** | Toggle manual `preEmbarque` en header del ppto habilita cuota con hito `pre_embarque`. | "Architecture Patterns: header toggle". New `Presupuesto.preEmbarque?: boolean`, recompute on toggle, audit posta entry (pattern at `presupuestosService.ts:625, 1186, 1496`). |
| **BILL-08** | Tests Playwright cubren 30/70 anticipo, 70/30 pre-embarque, 100% al cierre — sin warnings ni huérfanos en `solicitudesFacturacion`. | "Validation Architecture: 11.51 / 11.52 sub-suites". New helper `getPresupuestoEsquema` in `e2e/helpers/firestore-assert.ts`. Existing helpers `getPresupuesto` (line 173), `getSolicitudesFacturacionByPresupuesto` (line 214) already in place. |
</phase_requirements>

## Standard Stack

### Core (already present in monorepo — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | UI components for `EsquemaFacturacionSection`, refactored `PresupuestoFacturacionSection`, mini-modal | Project standard; CLAUDE.md mandates ≤250 lines per `.tsx` |
| TypeScript | ~5.8.2 | Discriminated unions for `CuotaFacturacionHito`/`Estado`, `Partial<Record<MonedaCuota, number>>` | Project standard |
| firebase | 12.11.0 | `runTransaction`, `Timestamp.now()`, `setDoc`/`updateDoc`, FieldValue.delete | Project standard |
| @ags/shared | workspace | New types live in `packages/shared/src/types/index.ts` | Shared contract between apps |
| @playwright/test | 1.59.1 | Sub-suites 11.51 / 11.52 in `e2e/circuits/11-full-business-cycle.spec.ts` | Already used for circuits 01-14 |
| tsx | 4.21.0 | Run unit tests for `recomputeCuotaEstados` (existing pattern from `stockAmplio.test.ts`) | No Jest/Vitest; node:assert via tsx |
| node:assert/strict | builtin | Unit-test assertions inside `__tests__/cuotasFacturacion.test.ts` | Existing pattern (`stockAmplio.test.ts:13`) |

### Supporting (already in services/firebase.ts)
| Helper | Purpose | When to Use |
|--------|---------|-------------|
| `cleanFirestoreData(obj)` | Strips top-level undefined | Flat partial updates |
| `deepCleanForFirestore(obj)` | Recursive strip via JSON round-trip | Any payload with nested objects/arrays — **mandatory** for `esquemaFacturacion` cuota array, `porcentajePorMoneda`, `montoFacturadoPorMoneda`, `porcentajeCoberturaPorMoneda` |
| `getCreateTrace()` / `getUpdateTrace()` | Audit fields (createdBy/updatedBy) | All writes |
| `runTransaction(db, async tx => ...)` | Reads-before-writes invariant | `generarAvisoFacturacion` extension and any cross-doc write |
| `crypto.randomUUID()` | UUID for `cuota.id` | Available in browser (Vite) and Electron renderer (Chromium 128+). Existing fallback at `presupuestosService.ts:1343-1345`: `(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ${Date.now()}-${Math.random().toString(36).slice(2)}` — **reuse this exact fallback pattern** |
| `MONEDA_SIMBOLO` | Currency symbol map | Display in mini-modal labels |

### Alternatives Considered (already locked by CONTEXT — listed for completeness)
| Instead of | Could Use | Why locked path was chosen |
|------------|-----------|------|
| `porcentajePorMoneda` per-moneda | Single `porcentaje: number` global | MIXTA edge cases (cuota only-USD, cuota only-ARS) impossible without per-moneda |
| `cuotaId` 1:1 | `cuotaIds: string[]` many-to-many | Simpler audit + simpler UI state machine |
| Cloud Function for `recomputeCuotaEstados` | client-side same-tx recompute | Avoids race conditions per CONTEXT (4 sync points all client-side) |
| Separate `esAnticipo` flag | hito enum encompasses all | "Adelantada y porcentual son la misma feature" |

**No new packages to install** — phase reuses entire existing stack.

## Architecture Patterns

### Recommended Project Structure
```
packages/shared/src/types/index.ts                                  # +CuotaFacturacionHito/Estado/Moneda + PresupuestoCuotaFacturacion + Presupuesto.{esquemaFacturacion,preEmbarque} + SolicitudFacturacion.{cuotaId,porcentajeCoberturaPorMoneda}

apps/sistema-modular/src/
├── utils/
│   └── cuotasFacturacion.ts                                        # NEW — pure helper recomputeCuotaEstados + validators + defaults
├── services/
│   ├── __tests__/
│   │   └── cuotasFacturacion.test.ts                               # NEW — node:assert via tsx; pattern from stockAmplio.test.ts
│   ├── presupuestosService.ts                                      # MOD — generarAvisoFacturacion extension + trySyncFinalizacion branch + recompute call sites
│   ├── otService.ts                                                # MOD — recompute call after cerrarAdministrativamente
│   └── facturacionService.ts                                       # MOD — recompute call after marcarFacturada/registrarCobro
├── components/presupuestos/
│   ├── EsquemaFacturacionSection.tsx                               # NEW (≤250 lines)
│   ├── EsquemaCuotaRow.tsx                                         # NEW if EsquemaFacturacionSection grows past 250
│   ├── QuickTemplateButtons.tsx                                    # NEW if needed for splitting
│   ├── PresupuestoFacturacionSection.tsx                           # REFACTOR — split into two sub-sections
│   ├── CuotasDelEsquemaSection.tsx                                 # NEW (sub-section A — visible if esquemaFacturacion?.length > 0)
│   ├── OtsSinAsociarSection.tsx                                    # NEW (sub-section B — Tier-1 legacy preserved)
│   ├── GenerarSolicitudCuotaModal.tsx                              # NEW — N inputs (one per moneda activa)
│   └── EditPresupuestoModal.tsx                                    # MOD — wire EsquemaFacturacionSection (mit isMixta/totalsByCurrency props) + preEmbarque toggle in header
├── hooks/
│   ├── useEsquemaFacturacion.ts                                    # NEW (optional — extract if EsquemaFacturacionSection grows past budget)
│   └── usePresupuestoEdit.ts                                       # MOD — extend form shape with esquemaFacturacion + preEmbarque

apps/sistema-modular/e2e/
├── helpers/firestore-assert.ts                                     # MOD — add getPresupuestoEsquema helper
└── circuits/11-full-business-cycle.spec.ts                         # MOD — add tests 11.51 (30/70) and 11.52 (70/30 pre-embarque)
```

### Pattern 1: Pure helper `recomputeCuotaEstados` (Wave 1)
**What:** Function that takes `(ppto, ots, solicitudes)` and returns the recomputed `esquemaFacturacion[]`. No I/O, no Firestore, no React. Always called inside the same `update(presId, { esquemaFacturacion: recomputed })` to keep state atomic.

**When to use:** Every sync point listed in *Sync Wiring* below.

**Reference shape (from CONTEXT):**
```typescript
// Source: locked from CONTEXT.md decisions block
export function recomputeCuotaEstados(
  ppto: Pick<Presupuesto, 'estado' | 'ordenesCompraIds' | 'preEmbarque' | 'esquemaFacturacion'>,
  ots: Array<Pick<WorkOrder, 'otNumber' | 'estadoAdmin' | 'budgets'>>,
  solicitudes: Array<Pick<SolicitudFacturacion, 'id' | 'cuotaId' | 'estado'>>,
): PresupuestoCuotaFacturacion[] {
  const cuotas = ppto.esquemaFacturacion ?? [];
  if (cuotas.length === 0) return [];

  const allOTsCerradas = ots.length > 0 && ots.every(o =>
    o.estadoAdmin === 'CIERRE_ADMINISTRATIVO' || o.estadoAdmin === 'FINALIZADO'
  );

  return cuotas.map(c => {
    // Branch 1: cuota linked to a solicitud → mirror solicitud estado
    if (c.solicitudFacturacionId) {
      const sol = solicitudes.find(s => s.id === c.solicitudFacturacionId);
      if (!sol) return c; // dangling — leave as-is, surfaced via warning
      switch (sol.estado) {
        case 'cobrada':  return { ...c, estado: 'cobrada' };
        case 'facturada':return { ...c, estado: 'facturada' };
        case 'pendiente':
        case 'enviada':  return { ...c, estado: 'solicitada' };
        case 'anulada':  return { ...c, estado: 'habilitada', solicitudFacturacionId: null };
      }
    }
    // Branch 2: evaluate hito
    const habilitada = (() => {
      switch (c.hito) {
        case 'manual':              return true;
        case 'ppto_aceptado':       return ['aceptado', 'en_ejecucion'].includes(ppto.estado as string);
        case 'oc_recibida':         return (ppto.ordenesCompraIds?.length ?? 0) > 0;
        case 'pre_embarque':        return ppto.preEmbarque === true;
        case 'todas_ots_cerradas':  return allOTsCerradas;
      }
    })();
    return { ...c, estado: habilitada ? 'habilitada' : 'pendiente' };
  });
}
```

### Pattern 2: Sync Wiring (Wave 4)
**What:** Call `recomputeCuotaEstados` then write the new `esquemaFacturacion[]` in the **same `update`** of the ppto. Never split across triggers (race condition risk per CONTEXT).

| Sync Point | File / Symbol | Why |
|-----------|----------------|-----|
| 1. ppto save | `presupuestosService.update()` | When user toggles `preEmbarque` or changes `estado` |
| 2. solicitud creation | `presupuestosService.generarAvisoFacturacion()` post-tx (after the existing tx at line 1372) — recompute all cuotas of the ppto with the new solicitud included | Cuota that just got `solicitudFacturacionId` must move to `solicitada` |
| 3. OT cierre admin | `otService.cerrarAdministrativamente()` post-commit (after line 643 — already has `_syncPresupuestoOnFinalize` style hook for trySyncFinalizacion, just add a recompute pass) | `todas_ots_cerradas` evaluator depends on OT state |
| 4. solicitud lifecycle | `facturacionService.marcarFacturada()` (line 141) and `registrarCobro()` (line 111) — currently both call `update()`; add post-update recompute of the linked ppto | Cuota mirrors solicitud estado |

**Concrete pattern (proposed):**
```typescript
// In presupuestosService — new private helper
async _recomputeAndPersistEsquema(presupuestoId: string): Promise<void> {
  const pres = await this.getById(presupuestoId);
  if (!pres?.esquemaFacturacion?.length) return;
  const [ots, solicitudes] = await Promise.all([
    (await import('./otService')).ordenesTrabajoService.getAll().then(all =>
      all.filter(o => (o.budgets || []).includes(pres.numero))
    ),
    (await import('./facturacionService')).facturacionService.getByPresupuesto(presupuestoId),
  ]);
  const recomputed = recomputeCuotaEstados(pres, ots, solicitudes);
  // No-op if nothing changed (avoid write churn + audit noise)
  if (JSON.stringify(recomputed) === JSON.stringify(pres.esquemaFacturacion)) return;
  await this.update(presupuestoId, { esquemaFacturacion: recomputed } as any);
}
```

### Pattern 3: trySyncFinalizacion extended (Wave 4)
**What:** Add a branch after the existing OT-finalized check (`presupuestosService.ts:1255`).

```typescript
// Source: extension to existing logic at presupuestosService.ts:1229-1278
async trySyncFinalizacion(presupuestoId: string): Promise<void> {
  const pres = await this.getById(presupuestoId);
  if (!pres) return;
  if (pres.estado === 'finalizado' || pres.estado === 'anulado') return;

  const allOTs = await ordenesTrabajoService.getAll();
  const otsForPres = allOTs.filter(o => (o.budgets || []).includes(pres.numero));
  // ... existing work-unit OT FINALIZADO check ...
  if (!allOTsFinalized) return;

  // ── NEW: Branch for esquema mode ────────────────────────────────────
  if ((pres.esquemaFacturacion?.length ?? 0) > 0) {
    const finalizarConSoloFacturado = pres.finalizarConSoloFacturado ?? true;
    const terminales: CuotaFacturacionEstado[] = finalizarConSoloFacturado
      ? ['facturada', 'cobrada']
      : ['cobrada'];
    const allCuotasTerminal = pres.esquemaFacturacion!.every(c => terminales.includes(c.estado));
    if (!allCuotasTerminal) return;
    await this.update(presupuestoId, { estado: 'finalizado' } as any);
    return;
  }

  // ── Existing legacy path (unchanged) ─────────────────────────────────
  const pendientesParaFacturar: string[] = pres.otsListasParaFacturar ?? [];
  if (pendientesParaFacturar.length > 0) return;
  const solicitudes = await facturacionService.getByPresupuesto(presupuestoId);
  if (solicitudes.length > 0) {
    if (!solicitudes.every(s => s.estado === 'facturada')) return;
  }
  await this.update(presupuestoId, { estado: 'finalizado' } as any);
}
```

### Pattern 4: `generarAvisoFacturacion` extension (Wave 3)
**What:** Add `cuotaId` and `montoPorMoneda` to extras; relax line 1310-1312 guard for cuotaId path; persist back-ref atomically.

```typescript
// Source: extension to existing function at presupuestosService.ts:1293-1395
async generarAvisoFacturacion(
  presupuestoId: string,
  otNumbers: string[],
  extras?: {
    monto?: number;
    montoPorMoneda?: Partial<Record<MonedaCuota, number>>;  // NEW
    observaciones?: string;
    cuotaId?: string;                                       // NEW
  },
  actor?: { uid: string; name?: string },
): Promise<{ solicitudId: string }> {
  const pres = await this.getById(presupuestoId);
  if (!pres) throw new Error('Presupuesto no encontrado');
  if (pres.estado === 'anulado') throw new Error('No se puede facturar un presupuesto anulado');

  // ── NEW: cuotaId path (anticipo) ─────────────────────────────────────
  let cuota: PresupuestoCuotaFacturacion | undefined;
  if (extras?.cuotaId) {
    cuota = (pres.esquemaFacturacion ?? []).find(c => c.id === extras.cuotaId);
    if (!cuota) throw new Error(`Cuota ${extras.cuotaId} no encontrada`);
    if (cuota.estado !== 'habilitada') {
      throw new Error(`Cuota ${cuota.numero} no está habilitada (estado=${cuota.estado})`);
    }
    // OTs are OPTIONAL when cuotaId is present (anticipo case)
  } else {
    // ── EXISTING: legacy guard (line 1310-1312) — only enforced when cuotaId is absent ──
    if (!otNumbers || otNumbers.length === 0) {
      throw new Error('Debe seleccionar al menos una OT para generar el aviso');
    }
    const otsListas: string[] = pres.otsListasParaFacturar ?? [];
    for (const otNum of otNumbers) {
      if (!otsListas.includes(otNum)) {
        throw new Error(`OT ${otNum} no está lista para facturar en este presupuesto`);
      }
    }
  }

  // ... runTransaction body extended:
  //   - solicitud payload includes cuotaId + porcentajeCoberturaPorMoneda + montoPorMoneda
  //   - if cuota: tx.update pres with esquemaFacturacion patched (cuota.solicitudFacturacionId + montoFacturadoPorMoneda)
  //   - otsListasParaFacturar only mutated when otNumbers were provided
}
```

### Pattern 5: Editor Section Wiring (Wave 2)
- `EsquemaFacturacionSection.tsx` reads `form.esquemaFacturacion`, `form.moneda`, `form.items` (for `totalsByCurrency` calc), and `form.estado` (for read-only lock).
- Setter goes through `setField('esquemaFacturacion', next)` (existing pattern at line 121: `setField('cuotas', cuotas)`).
- Place between `PresupuestoItemsTable` block and the existing `PresupuestoCuotasSection` (which is contrato-specific and should remain visually separate).
- For MIXTA, reuse `totalsByCurrency` (already computed at `EditPresupuestoModal.tsx:110-118`) — pass as prop or recompute inside.
- Quick-templates write the whole `esquemaFacturacion` array; user can then tweak per moneda.

### Pattern 6: Mini-modal `GenerarSolicitudCuotaModal` (Wave 3)
- Receives `cuota`, `pres`, `totalsByCurrency`, `otsListasParaFacturar` (optional reference).
- Renders one `<input>` per moneda with `porcentajePorMoneda[m] > 0`. Default value = `(porcentajePorMoneda[m] / 100) * totalsByCurrency[m]`.
- Override warning (yellow) if user types a value !== default — non-blocking.
- "Confirmar" calls `presupuestosService.generarAvisoFacturacion(presId, selectedOtNumbers, { cuotaId, montoPorMoneda, observaciones })`.

### Anti-Patterns to Avoid
- **Don't write `undefined` on optional fields.** Use `null` or omit. Run `pnpm lint:ast` to catch (`no-firestore-undefined` rule). See `.claude/rules/firestore.md`.
- **Don't compute estados in a Cloud Function.** All recompute is client-side, same-tx, per CONTEXT (race-condition mitigation).
- **Don't mutate `cuotaId` to `[]` or rename.** It's `string | null` — null = legacy free-floating Tier-1 solicitud.
- **Don't allow editing the esquema after `aceptado`.** Inputs read-only — same lock pattern as `usePresupuestoEdit` save guard.
- **Don't use `arrayUnion` inside `runTransaction`.** Existing pattern at `otService.ts:632` shows manual merge: `[...current, otNumber]`.
- **Don't break Tier-1 legacy.** Sub-section B of refactored `PresupuestoFacturacionSection` MUST preserve current 2-input UX (monto + observaciones + checkbox de OTs) when `esquemaFacturacion` is null/[].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID for cuota.id | custom random string | `crypto.randomUUID()` with existing fallback at `presupuestosService.ts:1343-1345` | Already in use; works in Vite + Electron |
| Firestore undefined cleanup | manual key filter | `cleanFirestoreData` / `deepCleanForFirestore` (`firebase.ts`) | Centralized; mandated by `.claude/rules/firestore.md` |
| Audit fields | manual `createdBy/updatedBy` | `getCreateTrace()` / `getUpdateTrace()` | Existing helpers honor current user from auth context |
| Currency symbol | string literal `$`/`USD` | `MONEDA_SIMBOLO['ARS']` from `@ags/shared` | Avoids drift; existing |
| Per-moneda totals in MIXTA | recompute manually | `totalsByCurrency` already computed at `EditPresupuestoModal.tsx:110-118` (Object.entries(totalsByCurrency)) | Already in use for footer display |
| Modal frame | new `<div>` overlay | `Modal` atom from `components/ui/Modal.tsx` (Editorial Teal preset) | Project design system |
| Button styling | new variants | `Button` atom (`primary`, `outline`, `ghost`, `secondary`) | Project standard; ≤250 line budget tighter when reusing |
| Currency input | raw `<input type="number">` | Reuse pattern from `PresupuestoFacturacionSection.tsx:136-143` (existing) | Coherent UX |
| `runTransaction` reads-before-writes pattern | ad-hoc | Pattern at `otService.ts:541-642` (READ PHASE / WRITE PHASE explicit comments) | Already enforced by review; copy that comment style |
| Test framework | Jest/Vitest install | `tsx + node:assert/strict` (existing pattern from `stockAmplio.test.ts:13`) | Zero install; runs via `tsx src/services/__tests__/cuotasFacturacion.test.ts` |
| Playwright sub-suite scaffolding | new spec file | Add tests inside `e2e/circuits/11-full-business-cycle.spec.ts` (already serial, fixtures wired) | Pattern established 11.01-11.30 |

**Key insight:** This phase ships zero new dependencies. Every primitive needed already exists in the monorepo — including the test pattern, the modal atom, the Firestore helpers, and the audit pattern. Reuse aggressively.

## Common Pitfalls

### Pitfall 1: Firestore `undefined` on `porcentajePorMoneda` / `montoFacturadoPorMoneda`
**What goes wrong:** `Partial<Record<MonedaCuota, number>>` allows `{ ARS: undefined }` if assigned via spread. Firestore rejects on save with cryptic error.
**Why it happens:** TypeScript narrows `Partial<Record<...>>` to allow undefined values. Spread operator preserves them.
**How to avoid:** Always pass through `deepCleanForFirestore({ esquemaFacturacion: ... })` before write. Hook `check-firestore-undefined` warns; AST rule `no-firestore-undefined` catches structurally.
**Warning signs:** "Cannot use Firestore field 'porcentajePorMoneda.ARS' with value undefined" runtime error.

### Pitfall 2: Same-tx vs separate-tx race on `recomputeCuotaEstados`
**What goes wrong:** If recompute is called *after* the `generarAvisoFacturacion` tx commits as a separate `update()`, two concurrent users could observe a torn state (cuota linked to solicitud that doesn't exist yet, or vice versa).
**Why it happens:** Firestore eventual consistency — getById may not see the just-committed solicitud.
**How to avoid:** Inside `generarAvisoFacturacion`, **patch the cuota in the same tx** (write `esquemaFacturacion` with the new `solicitudFacturacionId` directly in the existing `tx.update(pRef, ...)` write, not as a post-commit step). For sync points 3 and 4 (otService and facturacionService), accept the eventual-consistency window — recompute is idempotent.
**Warning signs:** Cuota stays in `habilitada` after solicitud created; reload fixes it.

### Pitfall 3: `crypto.randomUUID` undefined in some Electron renderer contexts
**What goes wrong:** In old Electron renderer or in test environments, `crypto.randomUUID` may not exist.
**Why it happens:** Older Chromium runtime; node:crypto vs Web Crypto disambiguation.
**How to avoid:** Use the exact fallback already in `presupuestosService.ts:1343-1345`: `(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ${Date.now()}-${Math.random().toString(36).slice(2)}`.
**Warning signs:** `TypeError: crypto.randomUUID is not a function` on cuota creation.

### Pitfall 4: Validation of Σ%=100 with floating-point
**What goes wrong:** `30.1 + 70 = 100.1` but `30 + 70.0001 + ... = 100.0000001` is not strictly 100.
**Why it happens:** IEEE 754. Users may type `33.33 + 33.33 + 33.34 = 100.00` but JS shows `99.99999999...`.
**How to avoid:** Round to 2 decimals (or 4) in validator: `Math.round(sum * 100) / 100 === 100`. Document the precision in error message: "Cuotas en ARS suman 99.99%, deben sumar 100.00%."
**Warning signs:** User cannot save despite percentages obviously summing to 100.

### Pitfall 5: Anulada → habilitada regeneration not triggering
**What goes wrong:** When admin anula a solicitud (estado='anulada'), the cuota should return to `habilitada` so a new solicitud can be generated. If the recompute is not called on `facturacionService.update()` (which is the path that sets estado='anulada'), the cuota stays as `solicitada` orphaned.
**Why it happens:** `facturacionService.update` is the generic write — the recompute hook is only on `marcarFacturada` / `registrarCobro` per the PRD.
**How to avoid:** Add the recompute hook also to `facturacionService.update()` — or specifically to a new `marcarAnulada()` method. Test explicitly (see Validation Architecture).
**Warning signs:** "Generar solicitud" button stays disabled after anulando the previous solicitud.

### Pitfall 6: Backward-compat break — empty `esquemaFacturacion: []` vs `null`
**What goes wrong:** Code path `if (pres.esquemaFacturacion)` is truthy for `[]` but falsy for `null`. Inconsistent guards lead to half-Tier-1, half-new flow.
**Why it happens:** TypeScript's `?: T[] | null` allows both representations.
**How to avoid:** Standardize on `(pres.esquemaFacturacion?.length ?? 0) > 0` everywhere. Lint with grep on review. Document in helper file header.
**Warning signs:** New tests pass; existing 11.13b (Tier-1) breaks because `[]` triggers new path.

### Pitfall 7: MIXTA cuota with all monedas zero
**What goes wrong:** Cuota with `porcentajePorMoneda: {}` — saved by mistake; Σ=0 in every moneda but UI doesn't catch.
**Why it happens:** Validator sums per moneda; if no moneda has any %, validator considers each moneda valid (0+0+...=0 ≠ 100, but user only sees error in monedas they care about).
**How to avoid:** Add cross-cuota guard: `Object.values(porcentajePorMoneda).some(v => (v ?? 0) > 0)` else "Cuota X no factura ninguna moneda — agregá un porcentaje o eliminala".
**Warning signs:** User saves; Σ check passes; but cuota does nothing functionally.

### Pitfall 8: `otsListasParaFacturar` mutated when admin selects OTs as reference for an anticipo
**What goes wrong:** UI lets admin pick OTs from `otsListasParaFacturar` "as reference for concepto" in the mini-modal. If `generarAvisoFacturacion` then removes them from the array (existing line 1367), the OT is gone but the cuota was an anticipo — those OTs should still be available for sub-section B (legacy/saldo).
**Why it happens:** Current code unconditionally removes selected OTs.
**How to avoid:** Only remove from `otsListasParaFacturar` when `cuotaId` is absent (legacy path). When `cuotaId` is present, OTs are reference-only and the array is untouched.
**Warning signs:** After anticipo, the same OT no longer appears for the saldo cuota's mini-modal.

## Code Examples

### Example: Validation per moneda (Wave 1 helper)
```typescript
// Source: spec from CONTEXT.md decisions (validation table)
export type EsquemaValidationError = { moneda: MonedaCuota; sum: number; expected: 100 };

export function validateEsquemaSum(
  esquema: PresupuestoCuotaFacturacion[],
  monedasActivas: MonedaCuota[],
): EsquemaValidationError[] {
  return monedasActivas.flatMap(m => {
    const sum = esquema.reduce((acc, c) => acc + (c.porcentajePorMoneda[m] ?? 0), 0);
    const rounded = Math.round(sum * 100) / 100;
    return rounded === 100 ? [] : [{ moneda: m, sum: rounded, expected: 100 as const }];
  });
}
```

### Example: Quick-template "30/70 anticipo+entrega" (Wave 2)
```typescript
// Source: spec from CONTEXT.md decisions (Quick-templates section)
export function buildTemplate30_70(monedasActivas: MonedaCuota[]): PresupuestoCuotaFacturacion[] {
  const mkPorc = (val: number) =>
    Object.fromEntries(monedasActivas.map(m => [m, val])) as Partial<Record<MonedaCuota, number>>;
  const newId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return [
    {
      id: newId(), numero: 1,
      porcentajePorMoneda: mkPorc(30),
      descripcion: 'Anticipo 30%',
      hito: 'ppto_aceptado',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    },
    {
      id: newId(), numero: 2,
      porcentajePorMoneda: mkPorc(70),
      descripcion: 'Saldo contra entrega',
      hito: 'todas_ots_cerradas',
      estado: 'pendiente',
      solicitudFacturacionId: null,
      montoFacturadoPorMoneda: null,
    },
  ];
}
```

### Example: Existing `runTransaction` reads-before-writes (reference pattern)
```typescript
// Source: apps/sistema-modular/src/services/otService.ts:541-642 (cerrarAdministrativamente)
const txResult = await runTransaction(db, async (tx) => {
  // ═══════════════ READ PHASE ═══════════════
  const otRef = doc(db, 'reportes', otNumber);
  const otSnap = await tx.get(otRef);
  if (!otSnap.exists()) throw new Error(...);
  const pptoSnaps = new Map<string, { ref; current: string[] }>();
  for (const pid of presupuestoIds) {
    const pRef = doc(db, 'presupuestos', pid);
    const pSnap = await tx.get(pRef);
    pptoSnaps.set(pid, { ref: pRef, current: pSnap.data()?.otsListasParaFacturar ?? [] });
  }
  // ═══════════════ WRITE PHASE ═══════════════
  tx.update(otRef, deepCleanForFirestore({ ... }));
  for (const [pid, { ref, current }] of pptoSnaps) {
    tx.update(ref, deepCleanForFirestore({ otsListasParaFacturar: [...current, otNumber] }));
  }
  return { ... };
});
```

### Example: Existing audit posta (reference for preEmbarque toggle)
```typescript
// Source: apps/sistema-modular/src/services/presupuestosService.ts:1186-1201 (postaOC pattern)
const postaPreEmbarque: Posta = {
  fecha: new Date().toISOString(),
  usuarioId: actor?.uid ?? null,
  usuarioNombre: actor?.name ?? null,
  accion: ppto.preEmbarque ? 'pre_embarque_marcada' : 'pre_embarque_desmarcada',
  detalle: `Toggle pre-embarque: ${ppto.preEmbarque ? 'sí' : 'no'}`,
};
// Persist into Lead.postas[] (existing pattern); for ppto-level we'd need to confirm
// whether Presupuesto has a postas[] field — verify in types/index.ts before implementing.
```

**Note:** the existing posta logs in `presupuestosService.ts` write to the **linked Lead's** posta array (line 1064, 1119, 1201, 1507, 1586), not to a Presupuesto.postas array. CONTEXT calls for "Audit trace en `PostaPresupuesto`" — clarify in planning whether to (a) add a new `postas[]` field on `Presupuesto`, or (b) write to the linked ticket's `postas[]`. Recommendation: option (b) is consistent with existing patterns; option (a) is a deferred field.

## State of the Art

| Old Approach (Tier-1, current) | Current Approach (Phase 12) | When Changed | Impact |
|--------------------------------|------------------------------|--------------|--------|
| 1 solicitud al final del ciclo | N solicitudes 1:1 con cuotas del esquema | This phase | Anticipos posibles; pre-embarque posible |
| `otsListasParaFacturar` is the only signal | + `esquemaFacturacion[]` with hito-driven `habilitada` | This phase | Hito habilita; admin sigue tirando "Generar" |
| MIXTA con cuotas `PresupuestoCuota` (contrato only) | MIXTA con `porcentajePorMoneda` per cuota (everywhere except contrato) | This phase | per_incident/ventas/partes/mixto MIXTA con anticipo |
| `trySyncFinalizacion` checks OTs + solicitudes facturadas | + branch checks `esquemaFacturacion` cuotas terminales | This phase | Finalización correcta tanto en legacy como new |
| Line 1310-1312 blocks generación sin OT en lista | Same block ONLY for legacy path; cuotaId path bypasses | This phase | Anticipo posible antes de OT cerrada |

**Deprecated/outdated nothing.** Tier-1 path is preserved untouched. `PresupuestoCuota` (contrato model, line 1130 of types/index.ts) is **not** the same as `PresupuestoCuotaFacturacion` — naming distinction is intentional to avoid confusion. Both coexist.

## Open Questions

1. **Ubicación del flag `finalizarConSoloFacturado`**
   - What we know: CONTEXT marks default `true`; setting per-ppto vs config global vs feature flag is Claude's discretion.
   - What's unclear: where exactly to persist it.
   - Recommendation: Add as optional field on `Presupuesto` (`finalizarConSoloFacturado?: boolean`, default `true` when reading). Simplest; no migration; admin can override per ppto if business case arises. Add UI exposure deferred (not in success criteria).

2. **PostaPresupuesto target for preEmbarque audit**
   - What we know: CONTEXT requires audit trace; existing posta pattern writes to linked Lead.
   - What's unclear: does CONTEXT mean "write into the linked ticket's postas[]" or "add a new postas[] on Presupuesto"?
   - Recommendation: Write to the linked ticket's postas[] (existing pattern). Document in plan; if user later wants ppto-level postas, deferrable.

3. **Mini-modal MIXTA with cuota that touches only one moneda**
   - What we know: Cuota with `{USD: 50}` shows 1 input.
   - What's unclear: should we still expose the other moneda inputs as 0/disabled, or hide entirely?
   - Recommendation: Hide entirely — minimizes confusion. Document in component header.

4. **`presupuesto.finalizarConSoloFacturado: false` interaction with cuota anulada**
   - What we know: If `cobrada` required and one cuota's solicitud is anulada → cuota goes back to `habilitada` (per Pitfall 5).
   - What's unclear: with strict mode, ppto stays non-final until *new* solicitud reaches `cobrada`. Acceptable?
   - Recommendation: Yes — that's the whole point of strict mode. Document in helper.

5. **What estado is the solicitud created in for cuotaId path?**
   - What we know: existing path sets `estado: 'pendiente'` (line 1355).
   - What's unclear: with cuota in `habilitada`, the solicitud should also be `pendiente` initially. Confirmed.
   - Recommendation: Reuse line 1355 as-is. No change.

## Validation Architecture

> **Phase 12 includes Wave 0 RED scaffolding.** `nyquist_validation` not explicitly disabled in `.planning/config.json` (file present but minimal — `workflow.research: true`). Treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Unit framework | `tsx` + `node:assert/strict` (zero-install pattern from `apps/sistema-modular/src/services/__tests__/stockAmplio.test.ts`) |
| Unit config file | none — runs directly via `pnpm --filter sistema-modular test:cuotas-facturacion` script (to be added in `package.json`) |
| Unit quick run | `pnpm --filter sistema-modular exec tsx src/services/__tests__/cuotasFacturacion.test.ts` |
| E2E framework | `@playwright/test` 1.59.1 |
| E2E config | `apps/sistema-modular/playwright.config.ts` (already wired to chromium project) |
| E2E quick run | `pnpm --filter sistema-modular e2e -- --grep "11.5"` (runs only new sub-suites) |
| Full suite | `pnpm --filter sistema-modular e2e` |
| Type-check (no script — manual) | `pnpm type-check` (workspace-level) + per-app: `pnpm --filter sistema-modular exec tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| **BILL-01** | Editor — Σ%=100 per moneda blocks save when violated | Unit (validateEsquemaSum) | `pnpm --filter sistema-modular exec tsx src/services/__tests__/cuotasFacturacion.test.ts --filter validateEsquemaSum` | ❌ Wave 0 |
| **BILL-01** | Editor — read-only when ppto.estado !== 'borrador' | E2E | `e2e -- --grep "11.51.*esquema-locked-on-aceptado"` | ❌ Wave 0 |
| **BILL-02** | recomputeCuotaEstados — hito ppto_aceptado → habilitada | Unit | `tsx ... --filter recomputeCuotaEstados.ppto_aceptado` | ❌ Wave 0 |
| **BILL-02** | recomputeCuotaEstados — hito todas_ots_cerradas → habilitada | Unit | `tsx ... --filter recomputeCuotaEstados.todas_ots_cerradas` | ❌ Wave 0 |
| **BILL-02** | recomputeCuotaEstados — hito pre_embarque → habilitada | Unit | `tsx ... --filter recomputeCuotaEstados.pre_embarque` | ❌ Wave 0 |
| **BILL-02** | recomputeCuotaEstados — anulada → habilitada (regen) | Unit | `tsx ... --filter recomputeCuotaEstados.anulada_regen` | ❌ Wave 0 |
| **BILL-02** | recomputeCuotaEstados — solicitud cobrada → cobrada | Unit | `tsx ... --filter recomputeCuotaEstados.cobrada` | ❌ Wave 0 |
| **BILL-02** | recomputeCuotaEstados — MIXTA solo-USD / solo-ARS / mixed | Unit | `tsx ... --filter recomputeCuotaEstados.MIXTA` | ❌ Wave 0 |
| **BILL-03** | generarAvisoFacturacion(cuotaId) — relaxed OT guard, persists `cuotaId` + `solicitudFacturacionId` in same tx | E2E | `e2e -- --grep "11.51.*generar-anticipo-sin-ot"` | ❌ Wave 0 |
| **BILL-03** | generarAvisoFacturacion(cuotaId) — server-side guard rejects when cuota.estado !== 'habilitada' | Unit/integration | `tsx ... --filter generarAviso.guard_no_habilitada` (mocked tx) | ❌ Wave 0 |
| **BILL-04** | MIXTA — Σ% per moneda independent (ARS=100 ≠ USD=100 evaluated separately) | Unit | `tsx ... --filter validateEsquemaSum.MIXTA_independent` | ❌ Wave 0 |
| **BILL-04** | MIXTA — generar solicitud con N inputs por moneda | E2E | `e2e -- --grep "11.51.*MIXTA-mini-modal"` | ❌ Wave 0 |
| **BILL-05** | Backward-compat — esquemaFacturacion=null → Tier-1 path (sub-section B visible, sub-section A hidden) | E2E | `e2e -- --grep "11.13b"` (existing — must continue passing) | ✅ exists |
| **BILL-05** | Backward-compat — esquemaFacturacion=[] → Tier-1 path | Unit | `tsx ... --filter recomputeCuotaEstados.empty_array_legacy` | ❌ Wave 0 |
| **BILL-06** | trySyncFinalizacion — esquema mode finalizes only when all cuotas terminal AND OTs FINALIZADO | E2E | `e2e -- --grep "11.51.*finaliza-tras-ultima-cuota"` | ❌ Wave 0 |
| **BILL-06** | trySyncFinalizacion — legacy mode unchanged | E2E | existing 11.15 + 11.16 (must continue passing) | ✅ exists |
| **BILL-06** | trySyncFinalizacion — finalizarConSoloFacturado=false blocks finalizacion until cobrada | Unit | `tsx ... --filter trySyncFinalizacion.strict_cobrada` | ❌ Wave 0 |
| **BILL-07** | preEmbarque toggle — flips ppto.preEmbarque + recomputes cuota → habilitada | E2E | `e2e -- --grep "11.52.*pre-embarque-toggle"` | ❌ Wave 0 |
| **BILL-07** | preEmbarque toggle — visible only when esquema has cuota with hito='pre_embarque' | E2E | `e2e -- --grep "11.52.*toggle-visibility"` | ❌ Wave 0 |
| **BILL-08** | 30/70 happy path — accept ppto, generar cuota 1 anticipo, marcar facturada, cerrar OT, generar cuota 2, marcar facturada, ppto finaliza | E2E | `e2e -- --grep "11.51"` | ❌ Wave 0 |
| **BILL-08** | 70/30 pre-embarque happy path — accept, toggle pre_embarque, generar cuota 1 (70%), marcar facturada, cerrar OT, generar cuota 2 (30%), marcar facturada, ppto finaliza | E2E | `e2e -- --grep "11.52"` | ❌ Wave 0 |
| **BILL-08** | No console warnings, no orphan solicitudesFacturacion, ppto finalizes correctly | E2E (asserts inside 11.51/11.52) | `e2e -- --grep "11.5"` (assertion: page.on('console') captures + getSolicitudesFacturacionByPresupuesto(pres.id).length === N) | ❌ Wave 0 |
| **BILL-08** | 100% al cierre (single-cuota equivalence to Tier-1) | E2E | `e2e -- --grep "11.50.*100-al-cierre"` (optional sub-suite — equivalence test) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter sistema-modular exec tsx src/services/__tests__/cuotasFacturacion.test.ts` (≤ 5 s; run after every helper edit)
- **Per wave merge:** `pnpm --filter sistema-modular e2e -- --grep "11.5"` (≤ 90 s for sub-suites 11.51 + 11.52)
- **Phase gate:** `pnpm --filter sistema-modular e2e` full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/sistema-modular/src/services/__tests__/cuotasFacturacion.test.ts` — covers BILL-01 (validator), BILL-02 (all hito branches), BILL-04 (MIXTA), BILL-05 (legacy empty), BILL-06 (trySyncFinalizacion strict mode)
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/cuotasFacturacion.ts` — fixture data for unit tests (mirrors `stockAmplio.ts` pattern)
- [ ] `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — add `getPresupuestoEsquema(presId)` helper
- [ ] `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` — add tests 11.50 (100% al cierre equivalence, optional), 11.51 (30/70), 11.52 (70/30 pre-embarque). Use `test.fixme(true, 'Wave N — lands esquemaFacturacion')` until corresponding wave passes.
- [ ] `apps/sistema-modular/package.json` script — add `test:cuotas-facturacion` mirroring existing `test:stock-amplio`
- [ ] No framework install needed (tsx + node:assert + Playwright already present)

## Sources

### Primary (HIGH confidence)
- `c:\Users\Evigna\Desktop\Ags plataform\.planning\phases\12-esquema-facturacion-porcentual-anticipos\12-CONTEXT.md` — locked decisions
- `c:\Users\Evigna\Desktop\Ags plataform\.claude\plans\facturacion-anticipos-y-porcentajes.md` — PRD source
- `c:\Users\Evigna\Desktop\Ags plataform\.planning\ROADMAP.md` — Phase 12 success criteria (lines 199-211)
- `c:\Users\Evigna\Desktop\Ags plataform\.planning\REQUIREMENTS.md` — v2.0 framework (BILL-* derived from ROADMAP)
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\components\presupuestos\PresupuestoFacturacionSection.tsx` — full file (184 lines, current Tier-1 UI)
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\services\presupuestosService.ts:1213-1395` — `trySyncFinalizacion` + `generarAvisoFacturacion` (current implementations)
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\services\otService.ts:442-460, 469-655` — `_syncPresupuestoOnFinalize` + `cerrarAdministrativamente`
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\services\facturacionService.ts:111-165` — `marcarFacturada`, `registrarCobro`, `update` + post-commit `trySyncFinalizacion` hook
- `c:\Users\Evigna\Desktop\Ags plataform\packages\shared\src\types\index.ts:762, 1130-1234, 1287-1348` — `MonedaPresupuesto`, `PresupuestoCuota`, `Presupuesto`, `SolicitudFacturacion*`
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\components\presupuestos\EditPresupuestoModal.tsx:107-118, 354-367` — `totalsByCurrency`, `PresupuestoFacturacionSection` wiring
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\src\services\__tests__\stockAmplio.test.ts` — unit-test pattern reference
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\e2e\helpers\firestore-assert.ts:173-240` — existing helpers (`getPresupuesto`, `getSolicitudesFacturacionByPresupuesto`, etc.)
- `c:\Users\Evigna\Desktop\Ags plataform\apps\sistema-modular\e2e\circuits\11-full-business-cycle.spec.ts:70-741` — existing 11.* test structure
- `c:\Users\Evigna\Desktop\Ags plataform\.claude\rules\firestore.md` — `cleanFirestoreData` / `deepCleanForFirestore` mandate
- `c:\Users\Evigna\Desktop\Ags plataform\.claude\rules\components.md` — ≤250 line component budget
- `c:\Users\Evigna\Desktop\Ags plataform\.claude\skills\ags-system-guide\SKILL.md` — domain map and canonical-source pointers

### Secondary (MEDIUM confidence)
- None needed — all decisions are locked from CONTEXT and the touchpoint code is in-repo (no external API research required).

### Tertiary (LOW confidence)
- None — no claims rest on external/unverified sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency already in monorepo; nothing new to install
- Architecture: HIGH — patterns verified against existing code at exact line numbers
- Pitfalls: HIGH — 6 of 8 pitfalls already encountered in this codebase (Firestore undefined, runTransaction races, crypto.randomUUID fallback, floating-point sums, backward-compat empty-vs-null, posta logging target). Pitfalls 5 and 7 are MIXTA-specific edge cases inferred from CONTEXT
- User constraints: HIGH (LOCKED) — copied verbatim from CONTEXT.md per orchestrator policy
- Validation Architecture: HIGH — every test command runs against existing infrastructure; no new framework

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days for stable; CONTEXT decisions are locked, code shape may shift if Phase 11 lands new test scaffolding before Phase 12 starts — re-grep `presupuestosService.ts:1310` and `e2e/helpers/firestore-assert.ts` if so)
