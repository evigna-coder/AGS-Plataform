# Phase 9: Stock ATP Extendido - Research

**Researched:** 2026-04-21
**Domain:** Firebase Firestore transactions + Cloud Functions v2 triggers + React real-time stock planning UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `atpHelpers.ts:TODO(STKP-01)` marks the exact replacement point for `computeStockAmplio()`
- Cloud Functions only for `updateResumenStock` + `onOTCerrada` — `mailQueue` consumer deferred post-v2.0
- Cache DISABLED in all stock views (Pitfall 3-C from STATE.md) — always fresh data
- `runTransaction` patterns from Phase 8 apply: reads before writes, no `arrayUnion` inside tx, no nested tx
- `functions/` workspace + `helloPing` scaffold already live (Phase 5 PREC-03); deploy via `firebase deploy --only functions`
- **"comprometido"** semantics: reservas de presupuestos `aceptado` + requerimientos condicionales (`condicional: true`, not `cancelado`/`comprado`/`en_compra`) + OCs internas abiertas (states: `borrador | pendiente_aprobacion | aprobada | enviada_proveedor | confirmada | en_transito | recibida_parcial`)
- `computeStockAmplio(articuloId)` is a pure function — no `soloTraccionables` branching, ATP neto computed by consumer as `disponible + enTransito - reservado - comprometido`
- Bug fix in `presupuestosService.ts:252-258` (double counting) includes inline unit test + E2E regression
- New page `/stock/planificacion` (not extension of `ArticulosList`) — separate route in `TabContentManager.tsx`
- Filters via `useUrlFilters` (hard rule) — text, marca, proveedor, checkbox "solo con comprometido > 0"
- `onSnapshot` on artículo doc for live `resumenStock` field — zero cache
- Backfill fallback: if `articulo.resumenStock` missing → client-side `computeStockAmplio()` call with spinner
- Region: `southamerica-east1`, Node 20 (matches `helloPing` scaffold)
- `TabContentManager.tsx` (not `App.tsx`) is where new routes are registered
- RBAC: `/stock/planificacion` accessible by `admin` + `admin_soporte` (following existing stock route pattern)

### Claude's Discretion

- Exact field naming inside `resumenStock.breakdown.*` (list vs map keyed-by-id)
- Visual of "Ver breakdown" drawer (tabs vs accordion vs flat list)
- How ATP < 0 is shown visually (red badge, red number, warning icon)
- Whether client-side fallback for `computeStockAmplio()` shows a spinner (recommended: yes)
- Exact toast copy for "se creó requerimiento desde planificación"
- Exact field structure for `onOTCerrada` idempotency key

### Deferred Ideas (OUT OF SCOPE)

- `mailQueue` consumer Cloud Function — post-v2.0
- CI/CD for Cloud Functions — post-v2.0
- Stock min/max auto-reorder rules — separate phase
- Multi-warehouse / advanced positions — separate phase
- Refactor `presupuestosService.ts` 1388 LOC — post-v2.0
- `onPresupuestoAceptado` server-side trigger — post-v2.0
- Semaphore by stock minimum (green/yellow/red) — requires `stockMinimo` on all articles
- Filter by family/category in planning view — requires category model
- "Stock pressure" analytic column — post-v2.0
- Footer totals in planning view — post-v2.0 if budget

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STKP-01 | Pure function `computeStockAmplio(articuloId)` calculating ATP: `disponible + tránsito + OCs abiertas - reservado - comprometido` | Codebase audit confirms exact collections to query: `unidades` (by articuloId+estado), `requerimientos_compra` (condicional:true + open states), `ordenes_compra` (pre-received states). Bug fix in `presupuestosService.ts:252-258` (double counting `qtyDisponible - qtyReservado + qtyEnTransito`) is confirmed and scoped. |
| STKP-02 | Cloud Function `updateResumenStock` — denormalizes `resumenStock` in artículo doc on any unit/reserva/OC change | `functions/src/index.ts` scaffold is ready. Import pattern must shift from `firebase-functions/v2/https` to `firebase-functions/v2/firestore`. `firebase-admin` already in dependencies. Write target: `articulos/{articuloId}.resumenStock`. |
| STKP-03 | Convert critical stock mutations (reservas, movimientos, requerimientos) to `runTransaction` for atomicity | `reservasService.reservar()` currently uses `createBatch()` — safe for single-user but not race-condition-proof. `runTransaction` pattern already proven in `presupuestosService.aceptarConRequerimientos`. Rules: reads-first, no arrayUnion, no nested tx. |
| STKP-04 | Disable 2-min cache in stock views (planning list, reserva modal) | Cache lives in `serviceCache.ts`. Planning view uses `onSnapshot` on `articulos` collection (no cache path). Reserva modal — verify it doesn't call a cached service. Decision: planning page reads directly from Firestore via `onSnapshot`, bypassing `serviceCache.ts`. |
| STKP-05 | Review and fix bug in `presupuestosService.ts:252-258` (formula `disponible - reservado + enTransito` potential double counting) | Bug confirmed at lines 252-258. Formula is `qtyDisponible - qtyReservado + qtyEnTransito` — this double-counts because unidades already counted as `en_transito` estado in the base query. Fix: separate the `enTransito` count from `enTransitoMap` (OC items only), don't subtract `reservado` (it's a different estado in the unidades model). |

</phase_requirements>

---

## Summary

Phase 9 builds three interlocking pieces: (1) a verified pure function `computeStockAmplio()` that correctly aggregates stock position across four buckets using three Firestore collections, (2) a Cloud Function trigger that denormalizes the result into the artículo document for real-time planning reads, and (3) a new dedicated planning view + UI components that consume the live data without any caching layer.

The most critical technical risk is the **double-counting bug** in `presupuestosService.ts:252-258`. The current formula `qtyDisponible - qtyReservado + qtyEnTransito` conflates two separate data sources: `unidades` records with `estado === 'en_transito'` (which already exist in the DB as physical units) and `enTransitoMap` entries derived from pending OC items (which are *not* yet physical units). The fix must treat these as independent and additive, not subtractive/mixed. This needs a unit test before any other work proceeds.

The Cloud Function architecture is straightforward: `onDocumentWritten` on `unidades`, `requerimientos_compra`, and `ordenes_compra` collections triggers a recomputation. The function must be idempotent (safe to run twice) and use `firebase-admin` SDK (not the client SDK). The `functions/` workspace is already bootstrapped with correct Node 20 + region config.

**Primary recommendation:** Implement `computeStockAmplio()` + bug fix + unit test first (09-01), then the Cloud Function (09-02), then the UI surfaces (09-03). This order ensures the core calculation is verified before it's embedded in async infrastructure.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `firebase/firestore` (client SDK) | Already installed | `runTransaction`, `onSnapshot`, collection queries | HIGH — already used throughout |
| `firebase-admin` | `^13.0.0` (in `functions/package.json`) | Cloud Function writes to Firestore | HIGH — in functions deps |
| `firebase-functions` | `^6.0.0` | Cloud Function definitions v2 | HIGH — `helloPing` already uses v2 |
| `react` | 19 | UI components | HIGH |

### Cloud Functions v2 Import Pattern

The existing `helloPing` uses `firebase-functions/v2/https`. The new Firestore triggers require a different import:

```typescript
// For HTTPS (existing):
import * as functions from 'firebase-functions/v2/https';

// For Firestore triggers (new in Phase 9):
import { onDocumentWritten, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
```

`firebase-admin` must be initialized once at module level:

```typescript
import * as admin from 'firebase-admin';

// Safe to call multiple times — getApps() guard
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
```

**Installation:** No new packages needed. All required deps already in `functions/package.json`.

---

## Architecture Patterns

### Recommended File Structure for Phase 9

```
functions/src/
├── index.ts                    # export all functions (add updateResumenStock + onOTCerrada)
├── updateResumenStock.ts       # NEW: onDocumentWritten trigger + core logic
├── onOTCerrada.ts              # NEW: onDocumentUpdated trigger (safety-net)
└── computeStockAmplioAdmin.ts  # NEW: pure compute fn using firebase-admin SDK

apps/sistema-modular/src/
├── services/
│   ├── atpHelpers.ts           # MODIFY: replace TODO(STKP-01) with computeStockAmplio()
│   └── stockAmplioService.ts   # NEW: client-side computeStockAmplio() + subscribe helpers
├── hooks/
│   └── useStockAmplio.ts       # NEW: hook wrapping onSnapshot on articulo.resumenStock
├── components/stock/
│   └── StockAmplioIndicator.tsx # NEW: 4-bucket indicator component (<250 lines)
└── pages/stock/
    ├── PlanificacionStockPage.tsx  # NEW: /stock/planificacion
    └── PlanificacionRow.tsx        # NEW: per-row component with actions
```

### Pattern 1: `computeStockAmplio()` — Client-Side Pure Function

**What:** Queries three collections and aggregates into `StockAmplio`. Returns counts, not unit-level detail (that's breakdown).
**When to use:** Client-side fallback when `articulo.resumenStock` is not yet populated (backfill path).

```typescript
// Source: derived from existing atpHelpers.ts + presupuestosService patterns
export async function computeStockAmplio(articuloId: string): Promise<StockAmplio> {
  // 1. Unidades — count by estado
  const unidades = await unidadesService.getAll({ articuloId, activoOnly: true });
  const disponible = unidades.filter(u => u.estado === 'disponible').length;
  const reservado = unidades.filter(u => u.estado === 'reservado').length;
  // NOTE: 'en_transito' estado on unidades = units physically in transit (already received to OC)
  // This is SEPARATE from OC-pending enTransito below. Do NOT mix.
  const unidadesEnTransito = unidades.filter(u => u.estado === 'en_transito').length;

  // 2. OCs internas abiertas (pre-received) — units NOT yet arrived physically
  const OC_OPEN_STATES = new Set(['borrador', 'pendiente_aprobacion', 'aprobada',
    'enviada_proveedor', 'confirmada', 'en_transito', 'recibida_parcial']);
  const ocs = await ordenesCompraService.getAll();
  const ocsAbiertas = ocs.filter(oc => OC_OPEN_STATES.has(oc.estado));
  let ocEnTransito = 0;
  const ocsBreakdown: Array<{ ocId: string; cantidad: number; numeroOC: string }> = [];
  for (const oc of ocsAbiertas) {
    for (const item of (oc.items || [])) {
      if (item.articuloId !== articuloId) continue;
      const pendiente = Math.max((item.cantidad ?? 0) - (item.cantidadRecibida ?? 0), 0);
      if (pendiente > 0) {
        ocEnTransito += pendiente;
        ocsBreakdown.push({ ocId: oc.id, cantidad: pendiente, numeroOC: oc.numero });
      }
    }
  }
  const enTransito = unidadesEnTransito + ocEnTransito;

  // 3. "Comprometido" = accepted budget reservations + open conditional reqs
  const reqs = await requerimientosService.getAll({ articuloId });
  const COMPROMETIDO_EXCL = new Set(['cancelado', 'comprado', 'en_compra']);
  const condicionales = reqs.filter(r => (r as any).condicional === true
    && !COMPROMETIDO_EXCL.has(r.estado));
  const comprometido = condicionales.reduce((acc, r) => acc + (r.cantidad ?? 1), 0);

  return {
    disponible,
    enTransito,
    reservado,
    comprometido,
    breakdown: {
      reservas: [],          // populated separately if needed
      requerimientosCondicionales: condicionales.map(r => ({
        requerimientoId: r.id, cantidad: r.cantidad ?? 1, presupuestoId: r.presupuestoId ?? '',
      })),
      ocsAbiertas: ocsBreakdown,
    },
  };
}
```

### Pattern 2: `updateResumenStock` Cloud Function Trigger

**What:** `onDocumentWritten` listening to three collections. Extracts `articuloId` from the changed document, calls server-side recompute, writes back to `articulos/{articuloId}`.
**Idempotency:** Recompute from scratch on every call — result is always consistent with current Firestore state.

```typescript
// Source: firebase-functions v2 firestore API
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const REGION = 'southamerica-east1';

// Trigger on unidades collection writes
export const updateResumenStockOnUnidad = onDocumentWritten(
  { document: 'unidades/{unidadId}', region: REGION },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const articuloId = (after ?? before)?.articuloId;
    if (!articuloId) return;
    await recomputeAndWrite(articuloId);
  }
);
```

**Key:** Each collection needs its own trigger export. Three triggers total: `unidades`, `requerimientos_compra`, `ordenes_compra`.

### Pattern 3: `onSnapshot` for Live UI Data

**What:** Subscribe to the artículo document. `resumenStock` field updates when Cloud Function writes. Zero polling.

```typescript
// Source: existing articulosService.subscribeById pattern
export function useStockAmplio(articuloId: string | null) {
  const [stockAmplio, setStockAmplio] = useState<StockAmplio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articuloId) return;
    const unsub = articulosService.subscribeById(articuloId, (articulo) => {
      if (articulo?.resumenStock) {
        setStockAmplio(articulo.resumenStock as StockAmplio);
        setLoading(false);
      } else {
        // Backfill fallback: call computeStockAmplio() client-side
        computeStockAmplio(articuloId).then(result => {
          setStockAmplio(result);
          setLoading(false);
        });
      }
    });
    return unsub;
  }, [articuloId]);

  return { stockAmplio, loading };
}
```

### Pattern 4: `runTransaction` for Atomic Reserva

**What:** Atomically check available units and reserve — prevents over-reservation under concurrent users.
**Rules (established in Phase 8, must be followed):**
- All reads BEFORE writes inside transaction
- No `arrayUnion` inside transaction (use manual array merge)
- No nested transactions

```typescript
// Replaces current reservasService.reservar() batch with runTransaction
await runTransaction(db, async (tx) => {
  const unidadSnap = await tx.get(unidadRef);      // READ FIRST
  const posSnap = await tx.get(posReservasRef);    // READ FIRST
  if (!unidadSnap.exists()) throw new Error('Unidad no encontrada');
  const u = unidadSnap.data();
  if (u.estado !== 'disponible') throw new Error('Unidad no disponible');
  // THEN WRITE
  tx.update(unidadRef, unitPayload);
  tx.set(movRef, movPayload);
});
```

### Pattern 5: Route Registration in `TabContentManager.tsx`

New route follows exact same pattern as existing stock routes (line 127+):

```typescript
// In AppRoutes() function, inside <Routes>:
<Route path="/stock/planificacion"
  element={
    <ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}>
      <PlanificacionStockPage />
    </ProtectedRoute>
  }
/>
```

The component import goes in the top import block alongside existing stock page imports.

### Anti-Patterns to Avoid

- **Mixing `enTransito` sources:** `unidades.estado === 'en_transito'` (physical units already in DB) is DIFFERENT from OC pending items (`enTransitoMap` from Phase 8). The current bug at line 258 confuses these. Keep them additive: `enTransito = unidadesEnTransito + ocPending`.
- **Calling `serviceCache.ts` from planning page:** Planning view must NEVER use `serviceCache.ts`. Use `onSnapshot` directly.
- **`arrayUnion` inside Cloud Function `runTransaction`:** Not valid in server-side admin SDK transaction either. Merge arrays manually.
- **Growing `PlanificacionStockPage.tsx` past 250 lines:** Extract `PlanificacionRow.tsx` + `StockAmplioIndicator.tsx` + `useStockAmplioList` hook from the start.
- **`onDocumentWritten` on `articulos` itself:** This would create a feedback loop (CF writes to artículo → triggers itself). Only trigger on `unidades`, `requerimientos_compra`, `ordenes_compra`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time UI updates | Polling loop or manual refresh | `onSnapshot` (already wired in `articulosService.subscribeById`) | Firestore SDK handles reconnection, offline, ordering |
| Race condition prevention | Optimistic UI lock | `runTransaction` from `firebase/firestore` | SDK handles retry, serialization |
| Filter URL persistence | `useState` for filters | `useUrlFilters` hook (hard rule, existing) | Browser back/forward, shareability |
| Cloud Function admin writes | Client SDK in functions | `firebase-admin` SDK | Client SDK not available in Node functions environment |
| Timestamp handling | `new Date()` | `admin.firestore.Timestamp.now()` (server), `Timestamp.now()` (client) | Consistent with existing conventions |

---

## Common Pitfalls

### Pitfall 1: Double Counting `enTransito` (The Bug at Lines 252-258)

**What goes wrong:** The formula `qtyDisponible - qtyReservado + qtyEnTransito` has two problems:
1. Subtracting `reservado` from `disponible` is wrong — `reservado` is a separate `estado` on unidades, not a deduction from `disponible` count. These are mutually exclusive estados.
2. `qtyEnTransito` from `enTransitoMap` (OC items) is added, but the `unidades.filter(estado === 'en_transito')` count is NOT separately extracted — meaning if units already have `en_transito` estado AND are in OCs, they get counted twice.

**Fix:**
```typescript
// WRONG (current):
const stockProyectado = qtyDisponible - qtyReservado + qtyEnTransito;

// CORRECT:
// disponible, reservado, en_transito are all SEPARATE estados — count independently
const qtyDisponible = unidades.filter(u => u.estado === 'disponible').length;
const qtyReservado = unidades.filter(u => u.estado === 'reservado').length;
const qtyUnidadesEnTransito = unidades.filter(u => u.estado === 'en_transito').length;
// qtyEnTransitoFromOCs = from enTransitoMap (pending OC items not yet in DB as units)
const enTransitoTotal = qtyUnidadesEnTransito + qtyEnTransitoFromOCs;
const atp = qtyDisponible + enTransitoTotal - qtyReservado - comprometido;
```

**Warning signs:** ATP goes negative when both OC items and `en_transito` units exist for the same articuloId.

### Pitfall 2: Cloud Function Feedback Loop

**What goes wrong:** If `updateResumenStock` triggers on `articulos` collection (where it writes), it infinite-loops.
**How to avoid:** Only trigger on `unidades`, `requerimientos_compra`, `ordenes_compra` collections. NEVER on `articulos`.

### Pitfall 3: Missing `articuloId` in Trigger Document

**What goes wrong:** Some writes to `requerimientos_compra` or `ordenes_compra` may not have a clear FK to a single `articuloId` (e.g., OC with multiple items). The trigger fires once per document write, but needs to recompute for ALL affected articuloIds.
**How to avoid:** In the OC trigger handler, extract ALL `articuloId`s from the `items` array (both `before` and `after` data) and call `recomputeAndWrite()` for each unique one.

```typescript
// In OC trigger:
const afterItems = event.data?.after?.data()?.items ?? [];
const beforeItems = event.data?.before?.data()?.items ?? [];
const allItems = [...afterItems, ...beforeItems];
const articuloIds = [...new Set(allItems.map(i => i.articuloId).filter(Boolean))];
await Promise.all(articuloIds.map(id => recomputeAndWrite(id)));
```

### Pitfall 4: Cache Still Active in Reserva Modal

**What goes wrong:** `useReservaStock` hook or the reserva modal may call `unidadesService.getAll()` through a cached wrapper instead of direct Firestore.
**How to avoid:** Audit all callers in the reserva flow. Any path that reads unit availability for the planning/reserva decision must bypass `serviceCache.ts`.

### Pitfall 5: `onDocumentWritten` vs `onDocumentUpdated` — Wrong Trigger for Deletes

**What goes wrong:** Using `onDocumentUpdated` misses document deletions. A deleted reserva reduces `comprometido` but the trigger never fires.
**How to avoid:** Use `onDocumentWritten` (covers create + update + delete) for all three source collections. Check both `event.data.before` and `event.data.after` for `articuloId`.

### Pitfall 6: `StockAmplio` Type Not in `@ags/shared` Yet

**What goes wrong:** `computeStockAmplio()` returns `StockAmplio` but the type doesn't exist yet in `packages/shared/src/types/index.ts`. TypeScript errors will propagate to any consumer.
**How to avoid:** Add `StockAmplio` type to `@ags/shared` in the FIRST task (09-01) before writing implementations. The `Articulo` interface also needs `resumenStock?: StockAmplio | null` added.

---

## Code Examples

### Cloud Function Pattern (firebase-admin + onDocumentWritten)

```typescript
// functions/src/updateResumenStock.ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';

async function recomputeAndWrite(articuloId: string): Promise<void> {
  // 1. Count unidades by estado
  const unidadesSnap = await db.collection('unidades')
    .where('articuloId', '==', articuloId)
    .where('activo', '==', true)
    .get();

  let disponible = 0, reservado = 0, unidadesEnTransito = 0;
  unidadesSnap.forEach(d => {
    const estado = d.data().estado;
    if (estado === 'disponible') disponible++;
    else if (estado === 'reservado') reservado++;
    else if (estado === 'en_transito') unidadesEnTransito++;
  });

  // 2. OCs abiertas — pending items not yet in DB as units
  const OC_OPEN = ['borrador', 'pendiente_aprobacion', 'aprobada',
    'enviada_proveedor', 'confirmada', 'en_transito', 'recibida_parcial'];
  let ocEnTransito = 0;
  for (const estado of OC_OPEN) {
    const ocSnap = await db.collection('ordenes_compra')
      .where('estado', '==', estado).get();
    ocSnap.forEach(d => {
      const items: any[] = d.data().items ?? [];
      items.forEach(item => {
        if (item.articuloId !== articuloId) return;
        const pendiente = Math.max((item.cantidad ?? 0) - (item.cantidadRecibida ?? 0), 0);
        ocEnTransito += pendiente;
      });
    });
  }

  // 3. Requerimientos condicionales (comprometido)
  const EXCL = ['cancelado', 'comprado', 'en_compra'];
  const reqSnap = await db.collection('requerimientos_compra')
    .where('articuloId', '==', articuloId)
    .where('condicional', '==', true)
    .get();
  let comprometido = 0;
  reqSnap.forEach(d => {
    if (!EXCL.includes(d.data().estado)) comprometido += (d.data().cantidad ?? 1);
  });

  const resumenStock = {
    disponible,
    enTransito: unidadesEnTransito + ocEnTransito,
    reservado,
    comprometido,
    updatedAt: admin.firestore.Timestamp.now(),
  };

  await db.doc(`articulos/${articuloId}`).update({ resumenStock });
}

export const updateResumenStockOnUnidad = onDocumentWritten(
  { document: 'unidades/{unidadId}', region: REGION },
  async (event) => {
    const articuloId = (event.data?.after?.data() ?? event.data?.before?.data())?.articuloId;
    if (articuloId) await recomputeAndWrite(articuloId);
  }
);
```

### `StockAmplio` Type Addition to `@ags/shared`

```typescript
// To add to packages/shared/src/types/index.ts

export interface StockAmplioBreakdownEntry {
  id: string;
  cantidad: number;
  referencia?: string | null; // presupuestoId or OC numero
}

export interface StockAmplio {
  disponible: number;
  enTransito: number;
  reservado: number;
  comprometido: number;
  breakdown: {
    reservas: StockAmplioBreakdownEntry[];
    requerimientosCondicionales: StockAmplioBreakdownEntry[];
    ocsAbiertas: StockAmplioBreakdownEntry[];
  };
  updatedAt?: string | null; // ISO string when stored client-side
}

// Articulo interface must add:
// resumenStock?: StockAmplio | null;
```

### `useUrlFilters` Schema for Planning Page

```typescript
// Based on existing FILTER_SCHEMA pattern (RequerimientosList.tsx reference)
const FILTER_SCHEMA = {
  texto:            { type: 'string' as const, default: '' },
  marcaId:          { type: 'string' as const, default: '' },
  proveedorId:      { type: 'string' as const, default: '' },
  soloComprometido: { type: 'string' as const, default: '' }, // 'true' | ''
};
const [filters, setFilter] = useUrlFilters(FILTER_SCHEMA);
```

### Unit Test Pattern for Bug Fix (inline, no framework needed)

```typescript
// In atpHelpers.test.ts or inline spec
// Scenario: articulo has 2 disponible, 1 unidad en_transito (estado), 1 OC item pending 1 unit
// Expected enTransito = 2 (1 unit-estado + 1 OC-pending) — NOT 1
// Expected ATP neto = 2 + 2 - 0 - 0 = 4

// Bug scenario: articulo A has 1 OC pending 1 unit AND 1 unidad with estado='en_transito'
// Old code: enTransitoMap = 1, qtyEnTransito from unidades NOT extracted separately
// Old formula: disponible(2) - reservado(0) + enTransitoMap(1) = 3 → MISSES the unidad-en_transito
// OR: double-counts if the OC item IS the same unit already received into the unidades collection
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `atpHelpers.ts` simple suma (suma todos los estados) | `computeStockAmplio()` with 4 distinct buckets | Phase 9 | Fixes double counting; planners see real vs committed stock |
| `serviceCache.ts` wrapping stock reads (2 min TTL) | `onSnapshot` direct Firestore subscription for planning views | Phase 9 (STKP-04 decision) | Always-fresh data; planning decisions based on real state |
| `createBatch()` for `reservasService.reservar()` | `runTransaction` | Phase 9 (STKP-03) | Prevents over-reservation under concurrent users |
| No denormalized stock summary on `articulos` doc | `resumenStock: StockAmplio` field updated by CF | Phase 9 (STKP-02) | Planning list only needs one collection (`articulos`) — no N+1 reads |

**Deprecated in this phase:**
- `TODO(STKP-01)` comment in `atpHelpers.ts:9` — replaced by actual `computeStockAmplio()` call
- `import * as functions from 'firebase-functions/v2/https'` as the only trigger type — now also uses `firebase-functions/v2/firestore`

---

## Open Questions

1. **`reservasService.reservar()` — does the transaction need to read the RESERVAS posición inside tx?**
   - What we know: Currently `getOrCreateReservasPosition()` is called before `createBatch()` and uses a separate await. That fetch can race.
   - What's unclear: If we move to `runTransaction`, we need `posReservasRef` read inside the tx (adds one more read). Alternatively, the RESERVAS position ID can be fetched once outside the tx (acceptable since it's stable / rarely changes).
   - Recommendation: Fetch RESERVAS posición ID outside the tx (it's effectively a constant once created), pass it in. Avoids an unnecessary tx read.

2. **How many OC states count as "comprometido" vs "enTransito"?**
   - What we know: CONTEXT.md says OCs abiertas pre-recepción count as comprometido AND as enTransito. `EstadoOC` = `borrador | pendiente_aprobacion | aprobada | enviada_proveedor | confirmada | en_transito | recibida_parcial | recibida | cancelada`.
   - What's unclear: Should `recibida_parcial` contribute to BOTH `enTransito` (remaining pending items) and nothing to `comprometido` (since partial receipt means items are arriving)?
   - Recommendation: `recibida_parcial` → pending items still count as `enTransito` (they haven't arrived yet). The received portion already landed in `unidades` as `disponible` or `en_transito` estado.

3. **Firestore multi-collection trigger concurrency: can two OC-item writes for the same articuloId race on `recomputeAndWrite()`?**
   - What we know: Cloud Functions are stateless and concurrent. Two simultaneous writes can trigger two concurrent `recomputeAndWrite()` calls for the same articuloId.
   - What's unclear: Is eventual consistency acceptable here?
   - Recommendation: Yes — the denormalized field is a derived summary, not a financial ledger. Last write wins, both reads are from the same Firestore state at call time. Acceptable for planning purposes. No tx needed in the CF itself.

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false in `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (Phase 8 Wave 0 established, `e2e/` directory) |
| Config file | `playwright.config.ts` (sistema-modular) |
| Quick run command | `pnpm playwright test e2e/stock-atp.spec.ts` |
| Full suite command | `pnpm playwright test` |

Phase 9 also requires inline unit tests (not E2E) for the pure function bug fix. These are TypeScript-only, runnable via `tsx` or a simple `ts-node` script.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STKP-05 | `computeStockAmplio()` does not double count when same artículo has en_transito unidad + open OC item | unit | `node --import tsx apps/sistema-modular/src/services/atpHelpers.test.ts` | ❌ Wave 0 |
| STKP-01 | `computeStockAmplio(articuloId)` returns correct 4 buckets for known fixture | unit | same | ❌ Wave 0 |
| STKP-03 | Concurrent reservation attempts — only one succeeds, other throws | E2E (Firestore assert) | `pnpm playwright test e2e/stock-reserva-concurrent.spec.ts` | ❌ Wave 0 |
| STKP-02 | After unidad write, `articulo.resumenStock` updates (eventual) | E2E smoke | `pnpm playwright test e2e/stock-cf-trigger.spec.ts` | ❌ Wave 0 |
| STKP-04 | Planning page `/stock/planificacion` renders fresh data (no cache) | E2E smoke | `pnpm playwright test e2e/stock-planificacion.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --import tsx apps/sistema-modular/src/services/atpHelpers.test.ts` (unit test, <5s)
- **Per wave merge:** `pnpm playwright test e2e/stock-*.spec.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/sistema-modular/src/services/atpHelpers.test.ts` — covers STKP-01, STKP-05 unit tests with fixture data
- [ ] `e2e/stock-reserva-concurrent.spec.ts` — concurrent reservation scenario (STKP-03)
- [ ] `e2e/stock-cf-trigger.spec.ts` — Cloud Function trigger end-to-end (STKP-02); requires emulator or manual verify
- [ ] `e2e/stock-planificacion.spec.ts` — planning page renders without cache (STKP-04)

---

## Sources

### Primary (HIGH confidence)

- Direct codebase read of `apps/sistema-modular/src/services/atpHelpers.ts` — confirmed TODO(STKP-01) location and current calculation
- Direct codebase read of `apps/sistema-modular/src/services/presupuestosService.ts:252-258` — confirmed bug: `qtyDisponible - qtyReservado + qtyEnTransito` formula
- Direct codebase read of `apps/sistema-modular/src/services/stockService.ts:914-969` — confirmed `reservasService.reservar()` uses `createBatch()` not `runTransaction`
- Direct codebase read of `functions/src/index.ts` — confirmed `firebase-functions/v2/https` pattern + REGION constant
- Direct codebase read of `functions/package.json` — confirmed `firebase-admin: ^13.0.0`, `firebase-functions: ^6.0.0`, Node 20
- Direct codebase read of `packages/shared/src/types/index.ts:966-967` — confirmed `EstadoOC` union type values
- Direct codebase read of `packages/shared/src/types/index.ts:2111-2140` — confirmed `Articulo` interface (no `resumenStock` field yet)
- Direct codebase read of `apps/sistema-modular/src/components/layout/TabContentManager.tsx` — confirmed route registration pattern and existing stock routes
- Direct codebase read of `apps/sistema-modular/src/pages/stock/RequerimientosList.tsx` — confirmed `useUrlFilters` schema pattern
- Direct codebase read of `.planning/phases/09-stock-atp-extendido/09-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- Firebase Functions v2 `onDocumentWritten` / `onDocumentUpdated` API — inferred from `firebase-functions@^6.0.0` + project's existing v2 https import pattern. The v2 firestore module (`firebase-functions/v2/firestore`) exports `onDocumentWritten`, `onDocumentUpdated`, `onDocumentCreated`, `onDocumentDeleted`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new deps needed
- Architecture patterns: HIGH — derived from existing code patterns in codebase, not speculation
- Bug fix: HIGH — root cause confirmed by direct code read; fix logic is sound
- Cloud Function trigger pattern: MEDIUM — derived from v2 https pattern + known firebase-functions v2 API; not verified against live running function
- Pitfalls: HIGH — most derived from existing code evidence (double counting, feedback loop risk)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack — Firebase Functions v2 API is stable)
