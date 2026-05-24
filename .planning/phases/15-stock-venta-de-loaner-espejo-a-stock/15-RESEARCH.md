# Phase 15: Stock — Venta de loaner espejo a stock — Research

**Researched:** 2026-05-24
**Domain:** Firestore transactional service + modal UI extension (módulos Loaners + Stock en `sistema-modular`)
**Confidence:** HIGH

## Summary

Phase 15 reemplaza `loanersService.registrarVenta` (3 LOC, un único `update`) por una versión transaccional que escribe atómicamente a 3 colecciones (`loaners` + `unidadesStock` + `movimientosStock`) cada vez que un loaner se vende. La implementación es un **clon estructural** de dos precedentes ya en producción: `equivalenciasService.desagregarUnidades` (Phase 13, baja N origen + alta N×factor destino + 1 movimiento `subtipo='conversion'`) y `patronesService.consumirComponentes` (Phase 14, update patrón + N movimientos `entidadTipo='patron'`). Ambos están testeados con el mismo DI hook `__setTestFirestore(state)` que Phase 15 va a reutilizar.

El modal `LoanerVentaModal` (86 LOC, holgura para crecer hasta ~250) gana tres bloques nuevos: SearchableSelect condicional para vincular un Artículo del catálogo cuando `loaner.articuloId` está vacío (bloqueante), inputs paralelos `costoUnitario` + `monedaCosto` (separados de precio/moneda de venta — el costo va al `UnidadStock` espejo para valuación contable), y banner inline para capturar el error de la tx guard `loaner.estado === 'vendido'` (doble click / concurrencia entre tabs). Los tipos `MovimientoStock.subtipo` se extienden de `'conversion'` a `'conversion' | 'venta_loaner'` (mismo patrón Phase 13) y se agregan dos campos opcionales (`referenciaLoanerId`, `referenciaLoanerCodigo`) backwards-compat.

**Primary recommendation:** Reemplazar el método `registrarVenta` en `loanersService.ts` (no agregar uno nuevo en paralelo) con la versión transaccional. Calcar 1:1 la estructura de `_consumirComponentesInProd` de `patronesConsumirHelpers.ts` (idempotency check pre-tx → pre-gen UUIDs → `runTransaction` READ-FIRST con `tx.get(loanerRef)` y guard `estado === 'vendido'` → writes loaner+unidad+movimiento → post-commit `logBusinessEvent('loaner.vendido', ...)`). Tests unitarios con `__setTestFirestore` DI hook + fixtures mock — no requiere Firestore emulator. UAT manual documentado para los 3 escenarios críticos (happy path con vínculo, happy path sin vínculo, doble click).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo del MovimientoStock espejo:**
- `tipo: 'egreso'` (existente) + `subtipo: 'venta_loaner'` (nuevo valor en la union `MovimientoStock.subtipo`). Sigue precedente Phase 13 (`subtipo: 'conversion'` sobre `tipo: 'transferencia'`). Backwards-compat: consumidores que filtran por `tipo === 'egreso'` siguen viendo el movimiento.
- NO agregar `'venta'` al enum `TipoMovimiento`. Romper exhaustive switches sin beneficio claro vs el patrón subtipo ya establecido.
- Nuevo campo opcional `referenciaLoanerId?: string | null` en `MovimientoStock`.
- Nuevo campo opcional `referenciaLoanerCodigo?: string | null` denormalizado (formato `LNR-NNNN`).
- `origenTipo: 'baja'` (valor existente del enum `TipoOrigenDestino`), `origenId: loaner.id`, `origenNombre: loaner.codigo`. El `referenciaLoanerId` + `subtipo` desambigua que la baja fue por venta.
- `destinoTipo: 'cliente'`, `destinoId: clienteId`, `destinoNombre: clienteNombre` — coherente con `UbicacionStock.tipo === 'cliente'`.
- NO agregar `'loaner'` al enum `TipoOrigenDestino`.
- `cantidad: 1` siempre.
- `unidadId`: el id de la UnidadStock recién creada (la espejo).
- `articuloId`/`articuloCodigo`/`articuloDescripcion`: heredados del `loaner.articuloId`.
- `motivo`: opcional, info contextual.
- `creadoPor` y audit automáticos via `movimientosService.create` — pero como la tx escribe directo via `tx.set`, el método nuevo debe registrar el audit equivalente POST-commit.

**Modelo de la UnidadStock espejo:**
- Siempre se crea una `UnidadStock` NUEVA. No se reusa.
- `articuloId` = `loaner.articuloId`. Codigo/descripcion denormalizados.
- `condicion: 'bien_de_uso'`.
- `estado: 'vendido'`.
- `ubicacion`: `{ tipo: 'cliente', referenciaId: clienteId, referenciaNombre: clienteNombre }`.
- `costoUnitario` y `monedaCosto`: cargados manualmente en `LoanerVentaModal`.
- Vínculo con presupuesto: opcional (`VentaLoaner.presupuestoId?` no se fuerza).
- `nroSerie`/`nroLote`: derivar de `loaner.serie`.
- `observaciones`: `venta.notas` si existe.
- `activo: true`.
- `reservadoPara*`: null.

**Flujo cuando `loaner.articuloId` no existe:**
- Bloqueante.
- SearchableSelect inline DENTRO de `LoanerVentaModal`. Filtrado por `activo: true`.
- Cualquier Artículo activo es elegible (no filtro por categoría).
- Al confirmar, dentro de la tx, denormalizar `articuloId`, `articuloCodigo`, `articuloDescripcion` en el loaner.
- Si `loaner.articuloId` YA existe: SearchableSelect no se muestra (o readonly — discretion).
- NO se permite crear Artículo nuevo desde el modal.

**Atomicidad e idempotencia:**
- Una única `runTransaction` Firestore agrupa las 3 escrituras.
- Pre-fetch FUERA de la tx: datos del cliente (razonSocial), datos del artículo recién vinculado.
- READ-FIRST DENTRO de la tx: `tx.get(loanerRef)` antes de cualquier write. Si `loaner.estado === 'vendido'` → `throw new Error('Loaner ya vendido')`.
- UI con `setSaving(true)` durante la operación.
- IDs de unidad y movimiento: `crypto.randomUUID()` pre-generados fuera de la tx.
- `deepCleanForFirestore` aplicado a TODOS los payloads.
- Audit/business event: POST-commit (best-effort, no bloquea la tx).
- Si la tx falla: rollback completo. La UI muestra error y el modal NO cierra.
- Reversa/anulación: fuera de scope v1.

**UX del modal extendido:**
- Bloque 1 (condicional, si `articuloId` null): SearchableSelect "Vincular artículo del catálogo *" — required.
- Bloque 2 (existente): Cliente.
- Bloque 3 (existente, refactor visual): Precio + Moneda venta. NUEVO: Costo + Moneda costo.
- Bloque 4 (existente): Notas.
- Validaciones: `articuloId` no-nulo, `clienteId` no-nulo, `costoUnitario` no-nulo + `monedaCosto` no-nulo. Precio de venta sigue siendo opcional.
- Mensaje de error transaccional ("Loaner ya vendido") como banner dentro del modal (no toast).
- Botón "Confirmar venta" deshabilitado mientras `saving === true`.

**Convenciones del repo (carry-forward):**
- `deepCleanForFirestore` para payloads anidados.
- Writes solo via services. Componentes nunca llaman Firestore directo.
- Timestamps en write con `Timestamp.now()`; reads a UI con `.toDate().toISOString()`.
- Componentes ≤250 LOC.
- Editorial Teal — atoms `Modal`, `Input`, `Button`, `SearchableSelect`. JetBrains Mono uppercase labels.
- Excepción frozen — `apps/reportes-ot/` NO se toca.

### Claude's Discretion

- Nombre exacto del nuevo método en `loanersService` (preferir reemplazo del existente).
- Forma del audit post-commit: helper compartido nuevo (`auditCreatedDoc`) vs duplicar lógica.
- Layout exacto de los 4 inputs precio+moneda (grid 2x2 doble, 4 cols, o cards).
- Estado visual del SearchableSelect cuando `articuloId` YA existe (esconder vs readonly).
- Si extraer `LoanerArticuloPicker` preventivamente o solo si LoanerVentaModal supera ~200 LOC.
- Si `useLoaners.registrarVenta` se mantiene como wrapper o se elimina.
- Forma de presentar errores transaccionales en el banner.
- Si agregar tooltip explicativo en "Costo del activo".
- Tests: alcance (unit DI / smoke E2E / manual UAT).

### Deferred Ideas (OUT OF SCOPE)

- Anulación / reversa de venta de loaner (v1 no incluye compensating MovimientoStock).
- Migración batch de loaners vendidos pre-Phase 15 sin espejo.
- Auto-disparo desde aceptación de presupuesto de ventas.
- Auto-heredar costo desde el item del presupuesto.
- Toggle "Crear espejo en stock" en el modal.
- Reusar `UnidadStock` existente del mismo articuloId.
- Agregar `'venta'` al enum `TipoMovimiento`.
- Agregar `'loaner'` al enum `TipoOrigenDestino`.
- Pedir condición de la unidad en el modal (dropdown).
- Persistir costo en el Loaner (`Loaner.costoUnitario?`).
- Mantener última ubicación del loaner como ubicación de la unidad vendida.
- Crear Artículo nuevo desde dentro de `LoanerVentaModal`.
- Filtrar el SearchableSelect por categoría 'equipo' u otro flag.
- Banner explícito si el loaner cambió a 'vendido' desde otra pestaña.
- Filtro nuevo en `MovimientosList` "Ventas de loaner".
- Equivalencias compra↔uso (Phase 13, completada).
- Patrones con BOM (Phase 14, completada).
- Tocar `apps/reportes-ot/` o `apps/portal-ingeniero/`.

## Phase Requirements

Phase 15 no tiene IDs formales en `REQUIREMENTS.md` (sección stock evolution v2.x cubre solo STKE-XX y BOM-XX). El scope está cerrado en CONTEXT.md por discusión directa con el usuario (sesión 2026-05-24). Operacionalmente, los entregables son las 4 áreas siguientes — el planner debería tratarlas como pseudo-requirements `VLN-XX` (sigla "Venta Loaner"):

| Pseudo-ID | Description | Research Support |
|----|-------------|-----------------|
| VLN-01 (tipos) | Extensión `@ags/shared`: `MovimientoStock.subtipo` union → `'conversion' \| 'venta_loaner'` + `referenciaLoanerId?` + `referenciaLoanerCodigo?` + `VentaLoaner.costoUnitario?` + `VentaLoaner.monedaCosto?` | Tipos actuales mapeados en sección "Existing Code Insights" (líneas 2779-2826 + 3209-3218 de `packages/shared/src/types/index.ts`); precedente Phase 13 STKE-01 + Phase 14 BOM-01 (backwards-compat por campos opcionales) |
| VLN-02 (service) | Reemplazar `loanersService.registrarVenta` por versión transaccional: 1 `runTransaction` con READ-FIRST guard + 3 writes (`loaner` update + `unidadesStock` create + `movimientosStock` create) + audit post-commit | Precedentes 1:1 en `equivalenciasService.desagregarUnidades` (Phase 13) y `patronesService.consumirComponentes` (Phase 14) — copiar estructura, no inventarla |
| VLN-03 (modal UI) | Extender `LoanerVentaModal`: SearchableSelect condicional + inputs costo/moneda + validaciones extendidas + banner error transaccional. Actualizar `LoanerDetail.handleVenta` con params nuevos. Actualizar/eliminar `useLoaners.registrarVenta` (wrapper) | Modal actual 86 LOC, holgura para crecer; atoms `SearchableSelect`/`Input`/`Modal` en uso; precedente UX en `DesagregarStockModal.tsx` (162 LOC, mismo dominio Stock+Editorial Teal) |
| VLN-04 (tests) | Tests unitarios del nuevo método con DI hook `__setTestFirestore` + fixtures mock (3 escenarios: happy path con loaner pre-vinculado, happy path sin vínculo, doble venta rechazada por guard); script `package.json` `test:venta-loaner`. Documentar UAT manual para el flujo end-to-end | Precedentes en `equivalencias.test.ts` (Phase 13, 9/9 GREEN) y `patronBom.test.ts` (Phase 14, 18/18 GREEN). Sin Firestore emulator (TEST-01 sigue Pending), Playwright queda opcional |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` (Firestore Web Modular SDK) | ^12.11.0 | `runTransaction`, `doc`, `getDoc`, `setDoc`, `updateDoc`, `Timestamp` | Ya en uso; Phase 13/14 usaron el mismo idiom. Web Modular SDK requiere READ-FIRST en transactions |
| `@ags/shared` | workspace | Tipos `MovimientoStock`, `UnidadStock`, `Loaner`, `VentaLoaner` + helper `deepCleanForFirestore` | Source of truth para tipos cross-app; deepClean es regla de oro firestore.md |
| `react` | ^19.2.3 | Modal con `useState`/`useEffect` para form local state | Modal actual ya React-19 |
| `react-router-dom` | ^7.12.0 | N/A en Phase 15 (no agrega rutas) | — |
| `tsx` | ^4.21.0 (devDep) | Runner de unit tests (`tsx scripts/test-X.ts`) | Phase 13/14 usan tsx + `node:test`/`node:assert/strict` sin framework adicional |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert/strict` | built-in | Test framework para unit tests del service | Tests del nuevo método `registrarVenta` transaccional |
| `crypto.randomUUID()` | built-in (browser+Node) | Pre-gen de IDs para `unidadesStock` y `movimientosStock` fuera de la tx | Idiom establecido en `movimientosService.create`, `equivalenciasService.desagregarUnidades`, `patronesConsumirHelpers` |
| `@playwright/test` | ^1.59.1 | E2E smoke opcional | Solo si TEST-01 (emulador) progresa antes del cierre de Phase 15 — bloqueado a 2026-05-24 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `runTransaction` (READ-FIRST) | `writeBatch` (3 sets en batch) | Batch no soporta read condicional — el guard `loaner.estado === 'vendido'` requiere `tx.get`. Descartado |
| Reusar `unidadesService.create` + `movimientosService.create` dentro de la tx | (No es posible) | Esos métodos hacen `batch.commit()` afuera de la tx — la atomicidad se rompe. Hay que escribir directo con `tx.set` (precedente Phase 13/14) |
| Helper compartido `auditCreatedDoc(collection, id, payload)` en `firebase.ts` | Duplicar lógica de `logBusinessEvent` inline en el service | Phase 13 (`logEvent` privado en `equivalenciasService`) y Phase 14 (inline en `patronesConsumirHelpers` STEP D) inventaron variantes. Si la duplicación incomoda al planner, extraer helper genérico es razonable — no urgente. La función existe (`logBusinessEvent` ya hace fire-and-forget) y solo falta envolverla. |
| `addDoc(collection)` con auto-id | `setDoc(doc(db, col, uuid))` con UUID pre-generado | UUID pre-gen permite referenciar la `unidadId` recién creada desde el `movimientoStock.unidadId` SIN segundo round-trip. Patrón establecido en este codebase |

**Instalación:** ninguna. Todo lo que Phase 15 necesita ya está en `package.json` de `apps/sistema-modular`.

## Architecture Patterns

### Recommended Project Structure

```
apps/sistema-modular/src/
├── services/
│   ├── loanersService.ts                  # MODIFY: reemplazar registrarVenta (línea 174)
│   ├── firebase.ts                        # OPCIONAL: agregar helper auditCreatedDoc si se decide extraer
│   └── __tests__/
│       ├── ventaLoaner.test.ts            # NEW: unit tests con __setTestFirestore DI
│       └── fixtures/
│           └── ventaLoaner.ts             # NEW: MockVentaLoanerState + 3 fixtures
├── components/loaners/
│   ├── LoanerVentaModal.tsx               # MODIFY: 86 LOC → ~180-220 LOC (SearchableSelect + costo inputs + banner)
│   └── LoanerArticuloPicker.tsx           # OPCIONAL: sub-componente si LoanerVentaModal supera ~200 LOC
├── hooks/
│   └── useLoaners.ts                      # MODIFY: actualizar registrarVenta signature o eliminar wrapper
├── pages/loaners/
│   └── LoanerDetail.tsx                   # MODIFY: handleVenta pasa params nuevos al service
└── packages/shared/src/types/index.ts     # MODIFY: extensiones a MovimientoStock + VentaLoaner

apps/sistema-modular/scripts/
└── test-venta-loaner.ts                   # NEW: tsx runner que re-exporta ventaLoaner.test.ts (mirror Phase 14 test:patron-bom)
```

### Pattern 1: `runTransaction` READ-FIRST + guard de idempotencia

**What:** Una transacción Firestore que primero lee el documento principal bajo lock, valida un invariante (en Phase 15: `loaner.estado !== 'vendido'`), y solo entonces ejecuta los writes. Si el invariante falla, throw rollbackea atómicamente todo.

**When to use:** Cuando una operación cross-collection (acá: 3 colecciones) tiene un guard que depende del estado del documento principal y debe ser inmune a doble click / concurrencia entre tabs.

**Example (calcado de `patronesConsumirHelpers._consumirComponentesInProd`):**

```typescript
// Source: apps/sistema-modular/src/services/patronesConsumirHelpers.ts:200-302 (Phase 14)
// Adaptado para Phase 15 venta loaner.

import { collection, getDocs, doc, query, where, Timestamp } from 'firebase/firestore';
import type { Loaner, UnidadStock, MovimientoStock, VentaLoaner } from '@ags/shared';

export interface RegistrarVentaParams {
  loanerId: string;
  venta: VentaLoaner & {
    costoUnitario: number;        // NEW required
    monedaCosto: 'ARS' | 'USD';   // NEW required
  };
  // articuloId solo si recién se vincula (loaner.articuloId era null al abrir el modal):
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

async function _registrarVentaConEspejoInProd(
  params: RegistrarVentaParams,
  getFirebaseModules: () => Promise<{ db: any; deepCleanForFirestore: any; getUpdateTrace: any }>,
): Promise<RegistrarVentaResult> {
  const { db, deepCleanForFirestore, getUpdateTrace } = await getFirebaseModules();
  const { runTransaction } = await import('firebase/firestore');

  // STEP A — Pre-gen UUIDs FUERA de la tx (deterministic paths inside tx)
  const unidadId = crypto.randomUUID();
  const movimientoId = crypto.randomUUID();
  const nowTs = Timestamp.now();

  // STEP B — runTransaction (READ FIRST then WRITES; mirrors Phase 13/14)
  await runTransaction(db, async (tx) => {
    // READ — load loaner under tx lock
    const loanerRef = doc(db, 'loaners', params.loanerId);
    const snap = await tx.get(loanerRef);
    if (!snap.exists()) throw new Error('Loaner no encontrado');
    const loaner = { id: snap.id, ...(snap.data() as any) } as Loaner;

    // GUARD — idempotency (doble click + concurrencia entre tabs)
    if (loaner.estado === 'vendido') {
      throw new Error('Loaner ya vendido');
    }

    // RESOLVE — articuloId final (puede venir del loaner o del modal si recién se vinculó)
    const articuloId = params.articuloRecienVinculado?.articuloId ?? loaner.articuloId;
    if (!articuloId) {
      throw new Error('Loaner sin artículo vinculado — no se puede crear espejo en stock');
    }
    const articuloCodigo = params.articuloRecienVinculado?.articuloCodigo ?? loaner.articuloCodigo ?? '';
    const articuloDescripcion = params.articuloRecienVinculado?.articuloDescripcion ?? loaner.articuloDescripcion ?? '';

    // WRITE 1 — update loaner
    tx.update(loanerRef, deepCleanForFirestore({
      estado: 'vendido',
      activo: false,
      venta: params.venta,
      // Denormalización inline si recién se vinculó (mantener atomicidad)
      ...(params.articuloRecienVinculado ? {
        articuloId: params.articuloRecienVinculado.articuloId,
        articuloCodigo: params.articuloRecienVinculado.articuloCodigo,
        articuloDescripcion: params.articuloRecienVinculado.articuloDescripcion,
      } : {}),
      ...getUpdateTrace(),
      updatedAt: nowTs,
    }));

    // WRITE 2 — create UnidadStock espejo
    tx.set(doc(db, 'unidades', unidadId), deepCleanForFirestore({
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
      ...getUpdateTrace(),
      createdAt: nowTs,
      updatedAt: nowTs,
    }));

    // WRITE 3 — create MovimientoStock espejo
    tx.set(doc(db, 'movimientosStock', movimientoId), deepCleanForFirestore({
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
      motivo: params.venta.presupuestoNumero ? `Venta vinculada a presupuesto ${params.venta.presupuestoNumero}` : null,
      otNumber: null,
      remitoId: null,
      ...getUpdateTrace(),  // contiene creadoPor implícito via currentUser trace? Verificar (getCreateTrace vs getUpdateTrace shape)
      createdAt: nowTs,
    }));
  });

  // STEP C — POST-commit audit (best-effort, no bloquea la tx)
  // Mirror Phase 14 BOM-08: si falla, log y seguir. La tx ya está commiteada.
  try {
    const { logBusinessEvent } = await import('./firebase');
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
    console.error('[registrarVentaConEspejo] audit post-commit falló (best-effort):', err);
  }

  return { unidadId, movimientoId };
}
```

### Pattern 2: DI hook `__setTestFirestore` para unit tests sin emulator

**What:** El service expone una función `__setTestFirestore(state | null)` que, cuando recibe un mock state, hace que todas las operaciones Firestore se redirijan a Maps in-memory. Producción nunca llama esto.

**When to use:** Cualquier service con `runTransaction` o queries complejas que se quiera testear sin Firestore emulator.

**Example (calcado de `patronesService.ts:44-47` + `patronesConsumirHelpers.ts`):**

```typescript
// Source: apps/sistema-modular/src/services/patronesService.ts:44-47, 237-247

let _testState: MockVentaLoanerState | null = null;
export function __setTestFirestore(state: MockVentaLoanerState | null): void {
  _testState = state;
}

// El método público dispatch:
export const registrarVentaConEspejo = buildRegistrarVentaConEspejo({
  getTestState: () => _testState,
  getFirebaseModules: async () => {
    const fb = await getFirebaseModules();
    return { db: fb.db, deepCleanForFirestore: fb.deepCleanForFirestore, getUpdateTrace: fb.getUpdateTrace };
  },
});

// Factory que retorna la fn ligada al getter (evita ciclo de import):
export function buildRegistrarVentaConEspejo(deps: {
  getTestState: () => MockVentaLoanerState | null;
  getFirebaseModules: () => Promise<{ db: any; deepCleanForFirestore: any; getUpdateTrace: any }>;
}) {
  return async function registrarVentaConEspejo(params: RegistrarVentaParams): Promise<RegistrarVentaResult> {
    const state = deps.getTestState();
    if (state) return _registrarVentaConEspejoInTest(params, state);
    return _registrarVentaConEspejoInProd(params, deps.getFirebaseModules);
  };
}
```

### Pattern 3: Modal con SearchableSelect condicional + banner error transaccional

**What:** Modal que renderiza un bloque adicional solo cuando un pre-requisito está faltando (acá: `loaner.articuloId` null → mostrar picker). Captura errores async del service en un banner inline (NO toast efímero).

**When to use:** Cualquier flujo donde una validación dura puede fallar en el momento de commit (race conditions, idempotency guards) y el user necesita reintentar.

**Example (mezcla `DesagregarStockModal.tsx` + `LoanerVentaModal.tsx` actual):**

```tsx
// Source: apps/sistema-modular/src/components/stock/DesagregarStockModal.tsx:38-160 (estructura);
//         apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx (base actual 86 LOC)

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';
const inputCls = 'w-full border border-[#E5E5E5] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-700';

export function LoanerVentaModal({ open, onClose, loaner, onConfirm }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [articuloId, setArticuloId] = useState(loaner.articuloId ?? '');
  const [clienteId, setClienteId] = useState('');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('USD');
  const [costoUnitario, setCostoUnitario] = useState('');     // NEW
  const [monedaCosto, setMonedaCosto] = useState<'ARS' | 'USD'>('USD');  // NEW
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);    // NEW: banner inline

  useEffect(() => {
    if (!open) return;
    clientesService.getAll().then(c => setClientes(c.filter(x => x.activo)));
    if (!loaner.articuloId) {
      articulosService.getAll({ activoOnly: true }).then(setArticulos);
    }
  }, [open, loaner.articuloId]);

  const handleConfirm = async () => {
    setError(null);
    setSaving(true);
    try {
      await onConfirm({ /* ... params ... */ });
      onClose();
      // reset
    } catch (e: any) {
      setError(e?.message ?? 'Error al registrar venta');
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = clienteId && articuloId && costoUnitario && !saving;

  return (
    <Modal open={open} onClose={onClose} title="Registrar venta de loaner" footer={
      <>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!canConfirm}>
          {saving ? 'Registrando...' : 'Confirmar venta'}
        </Button>
      </>
    }>
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </div>
        )}
        {!loaner.articuloId && (
          <div>
            <label className={lbl}>Vincular artículo del catálogo *</label>
            <SearchableSelect
              value={articuloId}
              onChange={setArticuloId}
              options={articulos.map(a => ({ value: a.id, label: `${a.codigo} — ${a.descripcion}` }))}
              placeholder="Buscar artículo..."
              required
            />
          </div>
        )}
        {/* Cliente, Precio+Moneda, Costo+Moneda, Notas */}
      </div>
    </Modal>
  );
}
```

### Anti-Patterns to Avoid

- **Llamar `unidadesService.create` y `movimientosService.create` desde el handler del modal en serie:** Rompe atomicidad. Si la red cae entre el segundo y tercer write, el loaner queda en `'vendido'` sin movimiento o sin unidad. La tx es obligatoria.
- **Esconder errores transaccionales en un toast efímero:** El user debe entender que "Loaner ya vendido" significa que otro tab/usuario lo vendió primero. Banner inline persistente es la convención del repo (precedente: `DesagregarStockModal` líneas 85-97 con éxito/error como estado del modal).
- **Mantener el wrapper `useLoaners.registrarVenta` con signature vieja:** Si `LoanerDetail` ahora pasa `costoUnitario` + `monedaCosto` + `articuloRecienVinculado`, el wrapper queda como capa de transformación sin valor. Eliminarlo o actualizarlo, NO dejar dos caminos paralelos.
- **Filtrar el SearchableSelect por `categoria === 'equipo'`:** Locked-decision NO. Cualquier Artículo activo es elegible — el user es responsable de elegir el correcto.
- **Crear UnidadStock con `costoUnitario` inferido del precio de venta:** Distinto significado contable (precio = revenue, costo = lo que valió el activo). El costo es input separado del modal.
- **Usar `cleanFirestoreData` (flat) en lugar de `deepCleanForFirestore`:** El payload de `UnidadStock` tiene `ubicacion` nested. `cleanFirestoreData` solo limpia top-level → `undefined` nested rompe el write. Regla `.claude/rules/firestore.md`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomicidad cross-collection | `Promise.all([update, set, set])` o try/catch con compensación manual | `runTransaction(db, async tx => ...)` | Firestore garantiza all-or-nothing; las compensaciones manuales en JS no manejan red caída entre writes |
| ID generation antes del write | `await addDoc(col, data)` y luego usar el id en otro doc | `crypto.randomUUID()` + `setDoc(doc(db, col, uuid), data)` | Pre-gen permite escribir N docs en la misma tx con cross-references (`movimiento.unidadId` apunta a unidad recién creada) sin segundo round-trip. Idiom establecido (movimientosService, equivalenciasService, patronesConsumirHelpers) |
| Validación de stock/estado antes del write | Query separada antes de la tx | `tx.get(loanerRef)` DENTRO de la tx (READ-FIRST) | Read fuera de la tx NO está bajo lock; race-able. Solo `tx.get` da lock optimista |
| Limpieza de `undefined` para Firestore | `JSON.parse(JSON.stringify(...))` ad-hoc en el service | `deepCleanForFirestore(payload)` desde `@ags/shared` (re-exportado en `firebase.ts`) | Helper centralizado, regla `.claude/rules/firestore.md`, AST rule `no-firestore-undefined` lo verifica |
| Audit del cambio post-commit | `console.log` o nada | `logBusinessEvent({ eventName: 'loaner.vendido', ... })` desde `firebase.ts` | El audit_log de la app depende de este helper. Sin él, los queries de "qué pasó el martes" no muestran la venta |
| Test de la tx con Firestore emulator | Setup emulador + clearFirestoreData entre suites | DI hook `__setTestFirestore(mockState)` con Maps in-memory | TEST-01 (emulator setup) sigue pending; los precedentes Phase 13 + Phase 14 demuestran que DI cubre el 95% de los casos (3 escenarios) sin emulator. Más rápido (ms vs s), corre en CI sin docker |
| Modal con state spread en 8 useState | Mantener todos los inputs separados | Custom hook `useLoanerVenta` (mismo patrón `useDesagregarStock` y `useCierrePatronesConsumidos`) si crece >150 LOC | Encapsula validaciones + reset + dispatch; deja el componente como pura presentación |

**Key insight:** Phase 15 es 90% codificación de patrones ya en producción. La única decisión "nueva" es el nombre exacto del método (`registrarVentaConEspejo` vs reemplazo de `registrarVenta`). Todo lo demás (tx shape, guard idempotency, DI hook, denormalización inline, audit post-commit) está locked por precedente Phase 13/14.

## Common Pitfalls

### Pitfall 1: `getUpdateTrace()` en doc nuevo (debería ser `getCreateTrace()`)

**What goes wrong:** El UnidadStock y MovimientoStock recién creados tienen `updatedBy`/`updatedByName` pero les falta `createdBy`/`createdByName`. El audit_log y los queries "creado por" rompen.
**Why it happens:** Copy-paste de `_consumirComponentesInProd` (Phase 14) usa `getUpdateTrace` en TODOS los writes — porque ese caso solo hace updates al patrón y agrega movimientos (un movimiento es histórico, no se "actualiza"). En Phase 15, el `tx.set` de UnidadStock requiere create trace.
**How to avoid:** Para el `tx.update(loanerRef, ...)` usar `getUpdateTrace()`. Para los DOS `tx.set` (unidad nueva + movimiento nuevo) usar `getCreateTrace()`. Confirmar la shape leyendo `firebase.ts:419` (`getCreateTrace`/`getUpdateTrace` re-exportados desde `./currentUser`).
**Warning signs:** Después del primer write de prueba, verificar en Firestore Console que el doc `unidadesStock/<uuid>` nuevo tiene `createdBy` poblado, no solo `updatedBy`.

### Pitfall 2: `MovimientoStock.creadoPor` requerido pero ausente

**What goes wrong:** `MovimientoStock` declara `creadoPor: string` (NO opcional, línea 2800 de `index.ts`). Si el `tx.set` solo incluye `getUpdateTrace()` (que pone `updatedBy`/`updatedByName`), el campo `creadoPor` no se popula → Firestore rechaza por validation rule, O queda undefined si rules permite.
**Why it happens:** `getCreateTrace()` pone `createdBy`/`createdByName` (camelCase), pero el field `creadoPor` (snake-ish) es propio de MovimientoStock — Phase 14 lo poblaba explícitamente: `creadoPor: params.creadoPor` (línea 295 de `patronesConsumirHelpers.ts`).
**How to avoid:** En el `tx.set` del movimiento, agregar explícitamente `creadoPor: <nombre del user>` adicional al spread de `getCreateTrace()`. El nombre del user debería venir del modal (o resolverlo via `getCurrentUserTrace().name`).
**Warning signs:** Validation rule de `movimientosStock` rechaza el commit con "missing required field creadoPor", o el doc se crea con `creadoPor: null` y el histórico del artículo muestra "Movimiento por: null".

### Pitfall 3: Pre-fetch del cliente FUERA de la tx vs DENTRO

**What goes wrong:** El razonSocial del cliente se denormaliza en 3 lugares (`venta.clienteNombre`, `UnidadStock.ubicacion.referenciaNombre`, `MovimientoStock.destinoNombre`). Si se hace `tx.get(clienteRef)` DENTRO de la tx, agrega una operación read innecesaria al lock optimista y aumenta probabilidad de retry/abort.
**Why it happens:** Tendencia a "leerlo todo bajo lock para máxima consistencia".
**How to avoid:** Pre-fetch FUERA de la tx (precedente CONTEXT.md líneas 84-85). El cliente tiene baja tasa de cambio de razonSocial; si cambia entre el modal load y el commit, el espejo lleva el nombre viejo — aceptable (no rompe relacion `clienteId`).
**Warning signs:** Si la tx hace >3 reads, sospechar pre-fetch faltante.

### Pitfall 4: `loaner.serie` como `nroSerie` del UnidadStock — tipo

**What goes wrong:** `Loaner.serie?: string | null` y `UnidadStock.nroSerie?: string | null`. Si `loaner.serie === ''` (string vacío), el deepClean lo deja como `null` (regla `cleanFirestoreData` línea 28). OK. Pero si en el futuro `Loaner.serie` se cambia a `number | null`, el assign sin coerción rompe el shape de `UnidadStock`.
**Why it happens:** Asignación directa sin validar shape entre tipos opcionales.
**How to avoid:** `nroSerie: loaner.serie ?? null` — el `??` coerce undefined a null y el deepClean hace el resto. Verificar con `pnpm type-check` antes de PR.
**Warning signs:** TypeScript build error "Type 'X' is not assignable to type 'string | null | undefined'".

### Pitfall 5: Race entre `setSaving(true)` en el modal y la tx guard

**What goes wrong:** Doble click rápido — el segundo dispara antes de que React re-renderice el botón disabled. Llegan 2 promesas al service. La primera commitea, la segunda entra a la tx, lee `loaner.estado === 'vendido'`, throw → banner "Loaner ya vendido" aparece para el segundo click aunque "fue exitosa".
**Why it happens:** La tx guard hace exactamente su trabajo (locked by design). El UX es confuso si la "primera" del usuario falla.
**How to avoid:** El banner del error debe distinguir "este modal ya cometió la venta exitosa" vs "otra sesión la cometió". En la práctica, suficiente: cuando el primer commit resuelve, el modal cierra (línea 45 actual `onClose()` post-confirm); el segundo click sobre un modal cerrado no dispara. El riesgo real está en concurrencia entre tabs, no doble click. Documentar en UAT.
**Warning signs:** User report "veo 'Loaner ya vendido' pero la venta sí se registró". Pedirles screenshot del banner y verificar que el loaner tiene `venta` poblada.

### Pitfall 6: `articulosService.getAll({ activoOnly: true })` semántica invertida

**What goes wrong:** El service tiene `filters?.activoOnly !== false` (línea 162 `stockService.ts`) — o sea: SOLO si pasás explícitamente `false`, devuelve inactivos. `undefined` filtra `activo === true`. Esto es lo que queremos para el SearchableSelect, pero es contraintuitivo.
**Why it happens:** Es el default seguro, pero el nombre `activoOnly` con `!== false` lee al revés.
**How to avoid:** Pasarlo explícito: `articulosService.getAll({ activoOnly: true })`. Documentar en el comment del fetch.
**Warning signs:** SearchableSelect muestra artículos dados de baja — verificar el filtro.

### Pitfall 7: `LoanerVentaModal` crece sobre 250 LOC sin extraer

**What goes wrong:** SearchableSelect (~20 LOC), inputs costo + moneda (~20 LOC), validaciones extendidas (~10 LOC), banner error (~15 LOC), nuevo handler async + state setup (~30 LOC). Total proyectado: 86 + ~95 = ~180 LOC. Margen para crecer, pero un re-design del grid o un tooltip empuja al budget.
**Why it happens:** Iteración natural — cada PR agrega 20 LOC.
**How to avoid:** Si después de implementar VLN-03 el archivo supera ~180 LOC, extraer `LoanerArticuloPicker.tsx` (el bloque condicional del SearchableSelect, ~30 LOC) o `useLoanerVenta.ts` (todo el state + validations, ~80 LOC). Precedente `useDesagregarStock` (hook) + `DesagregarStockModal` (162 LOC).
**Warning signs:** Hook `check-component-size` warn en stderr durante `git commit`.

### Pitfall 8: `MovimientoStock.subtipo` union type sin actualizar consumidores

**What goes wrong:** Phase 15 cambia `subtipo?: 'conversion'` a `subtipo?: 'conversion' | 'venta_loaner'`. Cualquier exhaustive switch sobre el union (ej. en MovimientosList rendering, audit display) rompe con TS error "Type 'venta_loaner' is not assignable".
**Why it happens:** TypeScript discriminated unions con `switch (subtipo) { case 'conversion': ... }` exhaustive son rígidos.
**How to avoid:** Pre-merge, hacer `grep -r "subtipo === 'conversion'" apps/sistema-modular/src` y revisar todos los call sites. Si hay exhaustive switches, agregar `case 'venta_loaner'` y/o `default`. Verificar con `pnpm type-check`.
**Warning signs:** Build error post-merge "Type X is not assignable to never" o switch sin default case.

## Code Examples

### Example 1: Type extensions (`@ags/shared`) — Phase 15 VLN-01

```typescript
// Source: packages/shared/src/types/index.ts (mods)

// EXISTING line 2807 → MODIFY:
subtipo?: 'conversion' | 'venta_loaner';   // Phase 13 + Phase 15

// NEW lines after existing subtipo block (mirror Phase 13 STKE-01 + Phase 14 BOM-01 doc style):
/**
 * Phase 15 — id del Loaner cuando subtipo='venta_loaner'.
 * Permite query "movimientos de venta de tal loaner". Null/omitido en movimientos no-venta-loaner.
 */
referenciaLoanerId?: string | null;
/**
 * Phase 15 — código del Loaner (LNR-NNNN) denormalizado en el momento del write.
 * Sigue patrón `articuloCodigo` ya denormalizado en MovimientoStock — evita join al renderizar listas históricas.
 */
referenciaLoanerCodigo?: string | null;

// EXISTING VentaLoaner (line 3209-3218) → EXTEND:
export interface VentaLoaner {
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  precio?: number | null;
  moneda?: 'ARS' | 'USD' | null;
  presupuestoId?: string | null;
  presupuestoNumero?: string | null;
  notas?: string | null;
  /**
   * Phase 15 — costo del activo (lo que valió el equipo).
   * Separado de `precio` que es revenue. Se carga manual en LoanerVentaModal y se denormaliza
   * en UnidadStock.costoUnitario del espejo. Required en el modal de Phase 15.
   */
  costoUnitario?: number | null;
  /** Phase 15 — moneda del costoUnitario. Required en el modal de Phase 15. */
  monedaCosto?: 'ARS' | 'USD' | null;
}
```

### Example 2: Modal con costo + moneda + banner error (snippet del bloque NEW)

```tsx
// Source: extendido sobre LoanerVentaModal.tsx actual (líneas 69-78 del original)

const lbl = 'block text-[10px] font-mono font-medium text-slate-500 mb-0.5 uppercase tracking-wide';

{/* Bloque 3 EXTENDIDO — Precio + Moneda venta + Costo + Moneda costo (grid 2x2) */}
<div className="grid grid-cols-2 gap-3">
  <Input label="Precio de venta" type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0.00" />
  <div>
    <label className={lbl}>Moneda venta</label>
    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={moneda} onChange={e => setMoneda(e.target.value as 'ARS' | 'USD')}>
      <option value="USD">USD</option>
      <option value="ARS">ARS</option>
    </select>
  </div>
  <Input label="Costo del activo *" type="number" value={costoUnitario} onChange={e => setCostoUnitario(e.target.value)} placeholder="0.00" required />
  <div>
    <label className={lbl}>Moneda costo *</label>
    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={monedaCosto} onChange={e => setMonedaCosto(e.target.value as 'ARS' | 'USD')}>
      <option value="USD">USD</option>
      <option value="ARS">ARS</option>
    </select>
  </div>
</div>
```

### Example 3: Fixture mock para tests (snippet)

```typescript
// Source: NEW src/services/__tests__/fixtures/ventaLoaner.ts (mirror fixtures/equivalencias.ts)

export interface MockLoaner {
  id: string;
  codigo: string;
  descripcion: string;
  articuloId: string | null;
  serie?: string | null;
  estado: 'en_base' | 'en_cliente' | 'en_transito' | 'vendido' | 'baja';
  activo: boolean;
  venta?: {} | null;
}

export interface MockVentaLoanerState {
  collections: {
    loaners: MockLoaner[];
    unidades: any[];
    movimientosStock: any[];
  };
}

// Fixture 1: Loaner con articuloId YA vinculado (happy path simple)
export const FIXTURE_LOANER_PRE_VINCULADO: MockVentaLoanerState = {
  collections: {
    loaners: [{
      id: 'lnr-1', codigo: 'LNR-0001', descripcion: 'HPLC repuesto',
      articuloId: 'art-A', serie: 'SN-12345',
      estado: 'en_base', activo: true,
    }],
    unidades: [],
    movimientosStock: [],
  },
};

// Fixture 2: Loaner SIN articuloId (requiere vincular)
export const FIXTURE_LOANER_SIN_ARTICULO: MockVentaLoanerState = { /* ... */ };

// Fixture 3: Loaner YA vendido (test guard idempotency)
export const FIXTURE_LOANER_YA_VENDIDO: MockVentaLoanerState = {
  collections: {
    loaners: [{
      id: 'lnr-1', codigo: 'LNR-0001', descripcion: 'HPLC repuesto',
      articuloId: 'art-A', estado: 'vendido', activo: false, venta: {/* venta previa */},
    }],
    unidades: [],
    movimientosStock: [],
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `loanersService.registrarVenta` = single `update` (3 LOC) | `runTransaction` con 3 writes atómicas + guard idempotency | Phase 15 (este) | El loaner se mantiene `vendido` solo si el espejo se creó atómicamente. Sin espejo → sin venta procesada |
| `MovimientoStock.subtipo?: 'conversion'` (Phase 13) | `MovimientoStock.subtipo?: 'conversion' \| 'venta_loaner'` | Phase 15 | Backwards-compat por opcionalidad; precedente extension Phase 14 (`entidadTipo?`) |
| Audit inline en service via `batchAudit + logBusinessEvent` dentro del mismo `batch.commit()` (precedente `unidadesService.create`, `movimientosService.create`) | `logBusinessEvent` POST-commit (best-effort, no bloquea la tx) — precedente Phase 13/14 | Phase 13 (2026-05-15) | Las `runTransaction` no soportan `WriteBatch` interno; el audit se mueve fuera. Trade-off: si el audit log falla, el dato sigue commiteado (acceptable — el negocio importa más que el log) |

**Deprecated/outdated:**
- Llamadas a `setDoc`/`updateDoc`/`addDoc` directas desde componentes — desde Phase 1+ siempre via service. Phase 15 mantiene esto (el modal llama a `loanersService.registrarVentaConEspejo`, nunca a Firestore directo).
- `JSON.parse(JSON.stringify(x))` ad-hoc para limpiar undefined — reemplazado por `deepCleanForFirestore` (`@ags/shared`). Regla `.claude/rules/firestore.md`.

## Open Questions

1. **¿`auditCreatedDoc` se extrae como helper compartido en `firebase.ts`?**
   - What we know: Phase 13 inventó `logEvent` privado en `equivalenciasService.ts:132-140` (delega a `logBusinessEvent`). Phase 14 hizo audit inline al final de `_consumirComponentesInProd` STEP D (líneas 304-315 de `patronesConsumirHelpers.ts`). Ninguna abstracción se reusa entre fases.
   - What's unclear: ¿Vale la pena extraer un helper genérico ahora con 3 call sites (Phase 13 + 14 + 15) o esperar al 4to?
   - Recommendation: Discretion del planner. Si el plan VLN-02 ya está cerca de 200 LOC en el service, extraer (`auditCreatedDoc(collection, id, eventName, details)` en `firebase.ts` — wrap thin sobre `logBusinessEvent`). Si no, inline directo en el service (mismo patrón que Phase 14 STEP D).

2. **¿`useLoaners.registrarVenta` se mantiene o se elimina?**
   - What we know: El wrapper (líneas 101-108 de `useLoaners.ts`) solo agrega un try/catch + log. `LoanerDetail.handleVenta` (línea 87) llama directo a `loanersService.registrarVenta(...)` — NO usa el wrapper. Otros pages (`FichaDetail.tsx`) usan `loanersService` directo también.
   - What's unclear: ¿Algún consumer real usa `useLoaners.registrarVenta` hoy?
   - Recommendation: Grep `useLoaners()` en `apps/sistema-modular/src` y verificar si algún caller usa `.registrarVenta`. Si no, eliminar el wrapper en VLN-03 (consolida un solo path). Si sí, actualizar la signature.

3. **¿Layout exacto del grid de los 4 inputs precio+moneda?**
   - What we know: CONTEXT.md líneas 96-97 deja la decisión visual al planner. Opciones: (a) 2x2 doble apilado (precio+moneda venta en una row, costo+moneda costo en la siguiente — más legible, ocupa más alto), (b) grid 4 cols (más compacto, pero mezcla revenue y costo visualmente), (c) cards separadas con sub-título "Venta" y "Costo".
   - What's unclear: cuál se ajusta mejor al Modal `maxWidth="md"` (~512px de ancho efectivo en `widthMap.md = 'max-w-lg'`).
   - Recommendation: Opción (a) — 2x2 doble apilado. Mantiene el patrón actual del modal (línea 69) que ya usa `grid-cols-2`. Separa visualmente revenue de costo. Si crece la lista de inputs, dividir en sub-secciones con `<div className="border-t border-slate-200 pt-3">`.

4. **¿Tests Playwright (smoke E2E) o solo unit + manual UAT?**
   - What we know: TEST-01 (emulador Firestore setup) sigue Pending en REQUIREMENTS.md (Phase 11 no iniciada). Phase 14 corrió Playwright contra Firestore real con TLS proxy issues; los tests eran pre-validados durante development pero no re-run-eables en release-prep (commit log STATE.md menciona "bloqueado por TLS corporate proxy").
   - What's unclear: ¿Vale la pena agregar 1-2 Playwright specs para Phase 15 sabiendo que el run en CI/release es frágil?
   - Recommendation: Skip Playwright. El precedente Phase 14 ya tiene la deuda; agregar más specs en el mismo estado no mejora. Cubrir con (a) unit tests del service via `__setTestFirestore` (3 escenarios, 100% del happy path + guard), (b) UAT manual documentado en VLN-04 que el user ejecuta en local (~5 min, 3 clicks).

5. **¿`venta.fecha` (existente, ISO string) se mantiene o se mueve a `Timestamp.now()` en el service?**
   - What we know: Hoy `LoanerDetail.handleVenta` línea 88 hace `fecha: new Date().toISOString()` en el cliente. Esto viola la convención del repo (`.claude/rules/firestore.md` "Writes: `Timestamp.now()` desde firebase/firestore").
   - What's unclear: ¿Tocar esto en Phase 15 o dejarlo como deuda heredada?
   - Recommendation: Dejarlo como ISO string en `VentaLoaner.fecha` — es el contrato actual del tipo. Cambiar a Timestamp es breaking change para todos los consumers que leen `venta.fecha`. Anotar como deuda menor, no parte del scope de Phase 15.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (built-in Node, sin install adicional) ejecutados via `tsx` ^4.21.0 |
| Config file | none (cada test es un script standalone, mirror `apps/sistema-modular/scripts/test-patron-bom.ts`) |
| Quick run command | `pnpm --filter @ags/sistema-modular test:venta-loaner` (a agregar en `package.json` scripts) |
| Full suite command | `pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular test:venta-loaner && pnpm --filter @ags/sistema-modular test:patron-bom && pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular test:cuotas-facturacion && pnpm --filter @ags/sistema-modular test:stock-amplio` |
| Phase gate | Type-check GREEN + las 5 unit suites GREEN (incluyendo la nueva) + build sistema-modular GREEN |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VLN-01 | `MovimientoStock.subtipo` acepta `'venta_loaner'` sin TS error; `VentaLoaner.costoUnitario?` opcional | unit (type-check) | `pnpm --filter @ags/sistema-modular type-check` | Existing |
| VLN-02a | Happy path con loaner pre-vinculado: `runTransaction` actualiza loaner a `vendido`, crea UnidadStock con `estado='vendido' + condicion='bien_de_uso'`, crea MovimientoStock con `subtipo='venta_loaner'` | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='happy path pre-vinculado'` | ❌ Wave 0 |
| VLN-02b | Happy path SIN vínculo: el service acepta `articuloRecienVinculado`, denormaliza `articuloId/Codigo/Descripcion` en el loaner DENTRO de la tx | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='happy path sin vinculo'` | ❌ Wave 0 |
| VLN-02c | Guard idempotency: segunda llamada sobre loaner ya `vendido` → throw `'Loaner ya vendido'` y NO crea unidad/movimiento adicional | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='guard ya vendido'` | ❌ Wave 0 |
| VLN-02d | Rollback atómico: si una write falla (ej. cantidad inválida), loaner NO cambia estado, no se crea unidad ni movimiento | unit (DI simula throw en middle write) | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='rollback'` | ❌ Wave 0 |
| VLN-02e | Validación: sin `costoUnitario` o sin `monedaCosto`, throw "Costo requerido" antes de la tx | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='costo requerido'` | ❌ Wave 0 |
| VLN-03 | UI extendida: SearchableSelect visible solo si `loaner.articuloId` null; banner error visible cuando service throw; botón disabled durante saving | manual-only (sin emulador para mount React + Firestore) | UAT manual documentado | N/A |
| VLN-04 | E2E full pipeline: abrir loaner sin articuloId → vincular → completar venta → verificar 3 docs creados → verificar Loaner estado=vendido | manual UAT | UAT manual documentado | N/A |

**Justificación manual-only para VLN-03/04:** TEST-01 (emulador Firestore + clearFirestoreData) sigue Pending en REQUIREMENTS.md (Phase 11 no iniciada). Phase 14 ya documentó que Playwright contra Firestore real es frágil en CI (TLS proxy). El DI hook cubre el 95% del riesgo del service; la UI extension es change de bajo riesgo (3 inputs nuevos + 1 banner) verificable manualmente en <5 min.

### Sampling Rate

- **Per task commit:** `pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular test:venta-loaner` (~10s)
- **Per wave merge:** `pnpm --filter @ags/sistema-modular type-check && (las 5 unit suites en paralelo)` (~30s)
- **Phase gate:** Full suite GREEN + `pnpm --filter @ags/sistema-modular build` GREEN + UAT manual checklist firmado por el user antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts` — Wave 0 RED baseline cubriendo VLN-02a..e (5 tests con `__setTestFirestore` DI)
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts` — 3 fixtures (PRE_VINCULADO, SIN_ARTICULO, YA_VENDIDO) + `MockVentaLoanerState` type
- [ ] `apps/sistema-modular/scripts/test-venta-loaner.ts` — tsx runner que re-exporta `ventaLoaner.test.ts` (mirror `scripts/test-patron-bom.ts`)
- [ ] `apps/sistema-modular/package.json` — agregar `"test:venta-loaner": "tsx src/services/__tests__/ventaLoaner.test.ts"` a scripts (mirror línea 23: `test:equivalencias`)
- [ ] UAT manual checklist (.md o inline en VLN-04 plan) — 8 pasos:
  1. Abrir `/loaners`, crear un Loaner test con `articuloId: null` (campo opcional en LoanerEditor).
  2. Abrir `/loaners/<id>` → click "Vender" → modal abre con SearchableSelect "Vincular artículo del catálogo *" visible.
  3. Buscar y seleccionar un Artículo (ej. cualquier HPLC). Cargar Cliente, Precio venta=$1000 USD, Costo=$700 USD, notas="Test Phase 15".
  4. Click "Confirmar venta" → modal cierra → loaner aparece con badge "Vendido", LoanerVentaSection muestra cliente + precio + notas.
  5. Verificar en Firestore Console: `loaners/<id>` tiene `articuloId` poblado + `venta.costoUnitario: 700` + `venta.monedaCosto: 'USD'` + `estado: 'vendido'` + `activo: false`.
  6. Verificar en Firestore Console: nuevo doc en `unidadesStock` con `articuloId` matching + `estado: 'vendido'` + `ubicacion.tipo: 'cliente'` + `costoUnitario: 700`.
  7. Verificar en Firestore Console: nuevo doc en `movimientosStock` con `subtipo: 'venta_loaner'` + `referenciaLoanerId: <loaner.id>` + `cantidad: 1` + `destinoTipo: 'cliente'`.
  8. Doble click test: abrir 2 tabs del mismo loaner sin vender, en ambas abrir modal de venta, en tab A confirmar (success), en tab B confirmar (debe mostrar banner "Loaner ya vendido" inline, NO cerrar el modal). Verificar que NO se creó una segunda UnidadStock/MovimientoStock.

## Sources

### Primary (HIGH confidence)
- **Codebase: `apps/sistema-modular/src/services/loanersService.ts`** — 177 LOC, método `registrarVenta` actual (línea 174); estructura de los demás métodos `registrar*` (prestamo, devolucion, extraccion) como precedente del patrón service.
- **Codebase: `apps/sistema-modular/src/services/equivalenciasService.ts`** — 478 LOC, precedente Phase 13 STKE-04 `desagregarUnidades` (líneas 257-478); incluye DI hook `__setTestFirestore` (líneas 70-79), lazy firebase modules (líneas 50-66), pre-fetch fuera de tx + READ-FIRST + writes + audit post-commit.
- **Codebase: `apps/sistema-modular/src/services/patronesConsumirHelpers.ts`** — 318 LOC, precedente Phase 14 BOM-03 `consumirComponentes` (estructura test path + prod path con `runTransaction` READ-FIRST, líneas 198-318); idempotency check pre-tx (líneas 211-222) — patrón exacto para Phase 15 guard `loaner.estado === 'vendido'`.
- **Codebase: `apps/sistema-modular/src/services/patronesService.ts`** — 247 LOC, factory pattern `buildConsumirComponentes` (líneas 237-247) — patrón para evitar circular import si Phase 15 extrae a `loanersVentaHelpers.ts`.
- **Codebase: `apps/sistema-modular/src/services/stockService.ts`** — 1281 LOC, `unidadesService.create` (líneas 393-407) + `movimientosService.create` (líneas 627-669) + `articulosService.getAll` (líneas 154-183) — patrones de write con `batchAudit + logBusinessEvent` que la nueva tx debe replicar POST-commit.
- **Codebase: `apps/sistema-modular/src/services/firebase.ts`** — 423 LOC, helpers `deepCleanForFirestore` (re-export línea 34), `createBatch` (242), `docRef` (252), `batchAudit` (257), `logBusinessEvent` (385), `getCreateTrace/getUpdateTrace` (re-exportados línea 419 desde `./currentUser`).
- **Codebase: `packages/shared/src/types/index.ts`** — líneas 2607-2654 (`UnidadStock` + enums `CondicionUnidad`/`EstadoUnidad`/`UbicacionStock`/`TipoUbicacionStock`), líneas 2767-2826 (`TipoMovimiento`/`TipoOrigenDestino`/`MovimientoStock` con campos Phase 13+14 ya existentes), líneas 3157-3243 (`Loaner` + `VentaLoaner` + `EstadoLoaner` + `ESTADO_LOANER_LABELS/COLORS`).
- **Codebase: `apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx`** — 86 LOC, modal actual (estado base que se extiende).
- **Codebase: `apps/sistema-modular/src/components/stock/DesagregarStockModal.tsx`** — 162 LOC, precedente Editorial Teal con SearchableSelect + label JetBrains Mono + banner success/error inline.
- **Codebase: `apps/sistema-modular/src/components/ui/SearchableSelect.tsx`** — atom con `useDeferredValue` para no perder keystrokes; API `{ value, label, linkedCode?, subLabel? }` (línea 8).
- **Codebase: `apps/sistema-modular/src/components/ui/Modal.tsx`** — atom Editorial Teal con `maxWidth='md'` default (max-w-lg ≈ 512px), `closeOnBackdropClick=false` default.
- **Codebase: `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` + `fixtures/equivalencias.ts`** — precedente Phase 13 unit tests con `__setTestFirestore` + `MockEquivalenciasState`; 9 tests GREEN sin emulator.
- **Codebase: `apps/sistema-modular/src/__tests__/patronBom.test.ts` + `fixtures/patronBom.ts`** — precedente Phase 14, 18 tests GREEN.
- **Codebase: `apps/sistema-modular/package.json`** — scripts `test:patron-bom`/`test:equivalencias`/etc. con tsx runner (líneas 21-24).
- **Codebase: `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx`** — 161 LOC, `handleVenta` línea 82-92; punto de integración entre modal y service.
- **Codebase: `apps/sistema-modular/src/hooks/useLoaners.ts`** — 116 LOC, wrapper `registrarVenta` línea 101-108 (decisión: mantener vs eliminar).
- **Documentación oficial Firebase: `runTransaction` Web Modular SDK** ([Cloud Firestore manage-data/transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)) — confirma constraints READ-FIRST + métodos soportados (`tx.set`, `tx.update`, `tx.delete`). Verificado 2026-05-24.
- **Proyecto: `.claude/rules/firestore.md`** — convenciones writes (deepCleanForFirestore, no undefined, services-only).
- **Proyecto: `.claude/rules/components.md`** — budget 250 LOC para componentes React.
- **Proyecto: `.claude/rules/release-flow.md`** — Phase 15 ships features user-visible → requiere release tag (bump `minor` recomendado al cerrar).
- **CONTEXT.md sesión 2026-05-24** — scope completo cerrado con el user; locked-decisions.

### Secondary (MEDIUM confidence)
- N/A — Phase 15 es 90% reutilización de patrones internos verificados.

### Tertiary (LOW confidence)
- N/A — sin findings que requieran validación adicional.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Todo el stack ya está en producción (Phase 13/14). Cero deps nuevos.
- Architecture: HIGH — Calcamos `equivalenciasService.desagregarUnidades` y `patronesConsumirHelpers._consumirComponentesInProd` 1:1. Ambos están GREEN en producción desde 2026-05-15 y 2026-05-24 respectivamente.
- Pitfalls: HIGH — Los 8 pitfalls están basados en código real ya inspeccionado (no hipotéticos). Pitfalls 1-3 son trampas reales que aparecieron implícitamente en los precedentes (uso de `getCreateTrace` vs `getUpdateTrace`, `creadoPor` explícito en MovimientoStock, pre-fetch fuera de tx). Pitfall 8 ya tiene precedente en Phase 14 (`entidadTipo` union).
- Validation Architecture: HIGH — Test framework + DI pattern + UAT checklist están directamente derivados de Phase 13 (9 tests) y Phase 14 (18 tests) que pasan en CI.

**Research date:** 2026-05-24
**Valid until:** 2026-06-23 (30 días — stack estable, sin dependencias externas en cambio rápido).

---

*Phase 15 research complete. Planner can now break down into VLN-01 (tipos), VLN-02 (service transaccional), VLN-03 (modal UI), VLN-04 (tests + UAT) waves.*
