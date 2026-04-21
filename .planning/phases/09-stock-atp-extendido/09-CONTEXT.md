# Phase 9: Stock ATP Extendido - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Vista de planificación de stock con cálculo ATP amplio (disponible + tránsito + reservado + comprometido), siempre fresco, atómico y denormalizado server-side. Cierra el gap de Phase 8 donde `atpHelpers.ts:TODO(STKP-01)` usa suma simple; acá se reemplaza por `computeStockAmplio()` pure function + Cloud Function `updateResumenStock` + trigger safety-net `onOTCerrada`.

Fuera de scope:
- `mailQueue` consumer Cloud Function — **diferido post-v2.0**; retry manual desde `/admin/acciones-pendientes` (Phase 8) alcanza
- Stock min/max reglas de reorden automático — no pertenece a este phase
- Multi-warehouse (posiciones avanzadas) — no pertenece a este phase
- Refactor de `presupuestosService.ts` 1388-LOC repeat offender — flagged para post-v2.0

</domain>

<decisions>
## Implementation Decisions

### Prior decisions carrying forward

- **`atpHelpers.ts:TODO(STKP-01)`** marca el punto exacto donde `computeStockAmplio()` reemplaza la suma simple usada en Phase 8 FLOW-03.
- **Client-side triggers para pipeline comercial**; Cloud Functions **solo para** `updateResumenStock` + `onOTCerrada` (safety-net) en este phase. `mailQueue` consumer queda diferido.
- **Cache en stock views desactivada** (pitfall 3-C del STATE.md) — coherente con success criterion #1 del ROADMAP.
- **`runTransaction` patterns establecidos en Phase 8** (reads before writes, no `arrayUnion` dentro de tx, no tx anidados) — se reusan en mutaciones críticas de stock.
- **`functions/` workspace + `helloPing` scaffold** ya listo (Phase 5 PREC-03). Deploy via `firebase deploy --only functions` manual.
- **`service account` de Cloud Function** para cualquier envío/write server-side — consistente con `reportes-ot/functions/src/mailer.ts` pattern.

### "Comprometido" semantics (nuevo concepto — core del phase)

**`comprometido`** = unidades de stock que ya están "reservadas virtualmente" por compromisos abiertos. Suma de:

1. **Reservas de presupuestos en estado `aceptado`** (los que el cliente ya confirmó) — queried desde `reservasPosition` o equivalente
2. **Requerimientos condicionales** (`condicional: true` creados en Phase 8 FLOW-03) — mientras no estén `cancelado` / `comprado` / `en_compra`
3. **OCs internas abiertas** (hacia proveedores, estados pre-recepción — `borrador | pendiente_aprobacion | aprobada | enviada_proveedor`)

Excluye:
- Reservas de presupuestos en `borrador` / `enviado` / `anulado` (no son compromisos firmes)
- Requerimientos cancelados
- OCs recibidas (ya son `disponible` o `enTransito`)

### `computeStockAmplio(articuloId)` — pure function

**Return shape:**
```ts
interface StockAmplio {
  disponible: number;
  enTransito: number;
  reservado: number;      // reservas operativas sin ppto
  comprometido: number;   // suma (reservas ppto aceptado + req condicionales + OCs abiertas)
  // Breakdown detallado por bucket de origen
  breakdown: {
    reservas: Array<{ reservaId: string; cantidad: number; presupuestoId?: string }>;
    requerimientosCondicionales: Array<{ requerimientoId: string; cantidad: number; presupuestoId: string }>;
    ocsAbiertas: Array<{ ocId: string; cantidad: number; numeroOC: string }>;
  };
}
```

- Sin flag `soloTraccionables` ni branching por tipo de artículo — **tratamiento uniforme**. La lógica de negocio (qué mostrar/ocultar por tipo) queda en el consumer.
- ATP neto se calcula en consumer como `disponible + enTransito - reservado - comprometido` — NO pre-computado en el return (evita ambigüedad sobre qué resta vs qué suma).

### Bug fix `presupuestosService:252-258` (doble conteo)

- **Test unitario inline** que expone el bug (fixtures con reserva + OC abierta del mismo artículo → verifica que no se cuentan dos veces).
- **Test E2E regression** usando la infra de Wave 0 de Phase 8: crea presupuesto → reserva → valida ATP via Firestore assert.
- Fix en el mismo plan, no en uno separado.

### UI surfaces del `StockAmplioIndicator`

**4 consumers (todos en v2.0):**

1. **Vista de planificación dedicada** (`/stock/planificacion`) — primary consumer del requirement del ROADMAP
2. **`ArticulosList`** — agregar columna "ATP" (suma neta) con tooltip mostrando breakdown en hover
3. **Reserva modal** (al reservar desde presupuesto) — muestra "podés reservar hasta X" (ATP neto)
4. **`AddItemModal` del presupuesto** — ATP inline del artículo seleccionado; cierra el loop con FLOW-03 de Phase 8 (misma detección automática de "requiere importación")

**Visual (vista de planificación):** tabla con 4 columnas numéricas (Disp | Tráns | Reserv | Comprom) + ATP calculado + acciones. Data-heavy, optimizada para planners.

**Freshness:** `onSnapshot` del doc del artículo vía Firestore — cualquier cambio en `resumenStock` (mantenido por Cloud Function) se refleja live. Cero cache.

**Backfill strategy:** fallback client-side. Si `articulo.resumenStock` NO existe, el consumer llama `computeStockAmplio()` client-side (más lento pero correcto). Permite migración gradual — cada artículo se backfillea cuando tiene su primera mutación (que dispara `updateResumenStock`).

### Vista de planificación `/stock/planificacion`

- **Página nueva** (no extensión de `ArticulosList`) — separación limpia de casos de uso. `ArticulosList` sigue siendo CRUD general.
- **Ruta registrada** en `TabContentManager.tsx` + entrada en sidebar bajo "Stock"
- **Filtros vía `useUrlFilters`:** texto libre, marca, proveedor, checkbox "solo con comprometido > 0"
- **Columnas (orden fijo):** Código | Descripción | Marca | Disp | Tráns | Reserv | Comprom | ATP | Acciones
- **Acciones inline por fila:**
  - "Crear requerimiento" — prominente cuando ATP < 0; abre editor con artículo prefilleado
  - "Ver breakdown" — abre drawer con detalle por bucket (qué reservas, qué requerimientos, qué OCs abiertas)

### Cloud Functions de Phase 9

**Scope: 2 functions**

1. **`updateResumenStock`** — `onDocumentWritten` trigger sobre unidades de stock / reservas / OCs internas. Al mutar cualquiera de esos docs, recomputa `resumenStock: StockAmplio` del artículo padre y lo denormaliza en el doc del artículo. Idempotente.

2. **`onOTCerrada` (safety-net)** — `onDocumentUpdated` trigger sobre `/ot/{otId}`. Cuando `estadoAdmin` cambia a `CIERRE_ADMINISTRATIVO`:
   - Verifica que el ticket interno al área `administracion` exista (si el client-side de Phase 8 falló por offline/error, el trigger lo crea)
   - Enqueue redundante a `mailQueue` (idempotente — usa `otId + estadoAdminFecha` como clave para detectar duplicados)
   - **NO envía mail directo** — eso sigue esperando al consumer de `mailQueue` que queda diferido post-v2.0
   - Idempotente: correr dos veces no rompe nada

### Deploy strategy

- `firebase deploy --only functions` manual via CLI
- Desde repo root, respetando el setup de Phase 5 PREC-03
- NO CI/CD en este phase (scope creep)

### Claude's Discretion

- Nombre exacto de campos en `resumenStock.breakdown.*` (lista vs mapa keyed-by-id)
- Visual del drawer de "Ver breakdown" (tabs vs accordion vs lista plana)
- Cómo el consumer muestra "ATP < 0" visualmente (badge rojo, number rojo, ícono warning)
- Si el fallback client-side de `computeStockAmplio()` debe mostrar un spinner (probablemente sí — es lento)
- Exact copy del toast "se creó requerimiento desde planificación"
- Qué campos exactos tiene el doc idempotency-key de `onOTCerrada` (ej. `${otId}:${estadoAdminFecha}` vs hash)

</decisions>

<specifics>
## Specific Ideas

- El concepto "comprometido" es nuevo — importante documentar en UI (tooltip explicando qué cuenta vs qué no) para que los planners entiendan por qué un artículo tiene ATP bajo aunque el `disponible` esté bien.
- La vista de planificación se vuelve la "torre de control" del equipo Comex — de ahí decide qué importar, qué acelerar, qué cancelar.
- `StockAmplioIndicator` en `AddItemModal` del presupuesto cierra el loop con Phase 8 FLOW-03 — el vendedor ve en tiempo real que su ítem necesita importación ANTES de agregar la línea, no solo post-acceptance.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apps/sistema-modular/src/services/atpHelpers.ts`** — creado en Phase 8 con `TODO(STKP-01)` marcando el punto de refactor exacto
- **`runTransaction` pattern** — ya usado en `presupuestosService.cargarOC` / `aceptarConRequerimientos` + `otService.cerrarAdministrativamente` (Phase 8); reusar
- **`reservasService.ts`** — Phase 1; base para la reserva transaccional que se atomiza en STKP-03
- **`unidadesService.ts` / `ordenesCompraService.ts`** — fuentes del breakdown de `comprometido`
- **`deepCleanForFirestore` / `getCreateTrace` / `getUpdateTrace` / `createBatch`** — helpers de Firestore (hard rule)
- **`useUrlFilters`** — obligatorio para filtros de la vista de planificación
- **`apps/reportes-ot/functions/src/mailer.ts`** — pattern de service account auth + envío server-side (inspiración para functions futuras; NO para este phase porque mailQueue consumer se defiere)
- **`functions/src/index.ts`** — scaffold de PREC-03 con `helloPing`; base para agregar `updateResumenStock` y `onOTCerrada`

### Established Patterns

- **Servicios Firestore por colección** — nuevo `stockAmplioService.ts` (o expandir existente); nunca Firestore directo desde components
- **`TabContentManager.tsx`** es donde se registran rutas nuevas (no `App.tsx`)
- **250-line budget** en componentes React — vista de planificación + drawer + row components respetan
- **RBAC** — `/stock/planificacion` accesible por rol admin + coordinador stock (o equivalente)
- **firebase-functions v2** — convenciones establecidas en `helloPing`: región `southamerica-east1`, Node 20

### Integration Points

- **`atpHelpers.ts`** — el TODO concreto a reemplazar
- **`PresupuestoItemsTableContrato.handlePickArticulo` (Phase 8)** — consumer de `computeStockAmplio()` para detectar `itemRequiereImportacion`
- **`articulos` collection** — nuevo campo `resumenStock: StockAmplio` denormalizado
- **`useReservaStock` hook** — consumer en Reserva modal
- **Sidebar nav** — agregar entrada bajo "Stock" para `/stock/planificacion`
- **Functions `package.json`** — agregar imports para los 2 triggers nuevos

</code_context>

<deferred>
## Deferred Ideas

- **`mailQueue` consumer Cloud Function** — diferido post-v2.0. Retry manual desde `/admin/acciones-pendientes` (Phase 8) alcanza.
- **CI/CD para Cloud Functions** — post-v2.0.
- **Stock min/max reglas de reorden automático** — phase propio.
- **Multi-warehouse / posiciones avanzadas** — phase propio.
- **Refactor `presupuestosService.ts` 1388 LOC** — post-v2.0.
- **`onPresupuestoAceptado` server-side trigger** — hoy es client-side y anda; mover es scope creep. Post-v2.0 si se necesita auditoría reforzada.
- **Semaforizado por stock mínimo** (verde/amarillo/rojo) en el StockAmplioIndicator — requiere que todos los artículos tengan `stockMinimo` definido. Post-v2.0.
- **Filtro por familia/categoría del artículo** en vista de planificación — depende de que el modelo soporte categoría de artículo; scope creep en este phase.
- **"Presión" de stock (% comprometido vs disponible)** como columna analítica — post-v2.0.
- **Columna totalizadores al pie de la vista** (suma de ATP, etc) — Claude's Discretion si hay budget; si no, v2.1.

</deferred>

---

*Phase: 09-stock-atp-extendido*
*Context gathered: 2026-04-21 via /gsd:discuss-phase 9 — 4 areas discutidas + 1 clarifier*
