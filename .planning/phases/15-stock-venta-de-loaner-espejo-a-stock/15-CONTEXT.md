# Phase 15: Stock — Venta de loaner espejo a stock — Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Source:** Sesión `/gsd:discuss-phase 15` 2026-05-24 sobre `memory/project_stock_v2_decisions.md` (sección "3. Venta de loaner espejo a stock").

<domain>
## Phase Boundary

### Qué SÍ entra

- Reemplazo del flujo actual `loanersService.registrarVenta(...)` por una versión transaccional que además crea **espejo contable** en el módulo Stock cuando se vende un loaner.
- Extensión de `LoanerVentaModal`: cuando `loaner.articuloId` está vacío, exige vincular un Artículo del catálogo (`SearchableSelect` inline, bloqueante). Inputs nuevos `costoUnitario` + `monedaCosto` (separados del precio/moneda de venta).
- Extensión de tipos `@ags/shared`:
  - `MovimientoStock.subtipo` extendido a `'conversion' | 'venta_loaner'`.
  - `MovimientoStock.referenciaLoanerId?: string | null` (nuevo).
  - `MovimientoStock.referenciaLoanerCodigo?: string | null` (denormalización opcional, sigue patrón `articuloCodigo`).
  - `VentaLoaner.costoUnitario?: number | null` + `VentaLoaner.monedaCosto?: 'ARS' | 'USD' | null` (separados de `precio`/`moneda` que ya existen).
- Servicio: nuevo método transaccional en `loanersService` (`registrarVentaConEspejo` o reemplazo de `registrarVenta`) que ejecuta como `runTransaction` única: (a) update loaner → `estado: 'vendido'`, `venta`, `activo: false`, y si recién se vinculó `articuloId/Codigo/Descripcion`; (b) create `UnidadStock` espejo; (c) create `MovimientoStock` espejo.
- Guard READ-FIRST en la tx: si `loaner.estado === 'vendido'` al leer adentro, abortar con error "Loaner ya vendido" que la UI captura como banner — protege ante doble click + concurrencia entre tabs/users.

### Qué NO entra

- **Equivalencias compra↔uso** (Phase 13, completada). Otra área de stock; no se toca.
- **Patrones con BOM** (Phase 14, completada). No tocar `patronesService`.
- **Anulación / reversa de venta de loaner**: no en v1. Si aparece, compensating MovimientoStock en una fase posterior.
- **Migración batch de loaners ya vendidos sin espejo (pre-Phase 15)**: no en scope. Si hace falta, script one-shot posterior.
- **Tocar `apps/reportes-ot/`**: esta fase es 100% `sistema-modular` (módulos Loaners + Stock).
- **Tocar `apps/portal-ingeniero/`**: ninguna vista del portal lee ventas de loaner.
- **Filtros nuevos en `MovimientosList` ("Ventas de loaner")**: no en v1. Si aparece la necesidad, se agrega después; la query queda habilitada via `referenciaLoanerId`/`subtipo='venta_loaner'`.
- **Auto-disparo desde aceptación de presupuesto de ventas**: descartado. El vínculo `VentaLoaner.presupuestoId` sigue siendo informativo/manual (campo opcional ya existente — no se cambia).
- **Permitir venta sin espejo** (toggle "Crear espejo en stock"): descartado. Toda venta procesada por Phase 15 deja espejo (es el invariante).
- **Reusar `UnidadStock` existente del mismo `articuloId`**: descartado. Siempre se crea unidad NUEVA (el espejo es contabilidad, no inventario).
- **Crear Artículo desde dentro del `LoanerVentaModal`**: descartado por scope. El SearchableSelect lista Artículos ya cargados; si falta uno, el user lo crea desde el módulo Artículos y vuelve.
- **Filtrar el SearchableSelect por categoría 'equipo'**: descartado. Cualquier Artículo activo es elegible.
- **Persistir costo en el Loaner permanentemente** (campo `Loaner.costoUnitario?`): descartado. El costo se captura en la `VentaLoaner` (momento de la venta), no en el activo.

</domain>

<decisions>
## Implementation Decisions

### Modelo del MovimientoStock espejo

- **Locked**: `tipo: 'egreso'` (existente) + `subtipo: 'venta_loaner'` (nuevo valor en la union `MovimientoStock.subtipo`). Sigue precedente Phase 13 (`subtipo: 'conversion'` sobre `tipo: 'transferencia'`). Backwards-compat: consumidores que filtran por `tipo === 'egreso'` siguen viendo el movimiento; quien quiera distinguir ventas, lee `subtipo`.
- **Locked**: NO agregar `'venta'` al enum `TipoMovimiento`. Romper exhaustive switches sin beneficio claro vs el patrón subtipo ya establecido.
- **Locked**: Nuevo campo opcional `referenciaLoanerId?: string | null` en `MovimientoStock`. Permite query "movimientos de venta de tal loaner".
- **Locked**: Nuevo campo opcional `referenciaLoanerCodigo?: string | null` denormalizado (formato `LNR-NNNN`). Sigue patrón `articuloCodigo` ya denormalizado en `MovimientoStock` — evita join al renderizar listas históricas.
- **Locked**: `origenTipo: 'baja'` (valor existente del enum `TipoOrigenDestino`), `origenId: loaner.id`, `origenNombre: loaner.codigo` (o equivalente legible). El loaner sale del circuito interno via "baja"; el `referenciaLoanerId` + `subtipo` desambigua que la baja fue por venta.
- **Locked**: `destinoTipo: 'cliente'`, `destinoId: clienteId`, `destinoNombre: clienteNombre` — coherente con `UbicacionStock.tipo === 'cliente'` en la unidad creada.
- **Locked**: NO agregar `'loaner'` al enum `TipoOrigenDestino`. `'baja'` cubre el origen sin extender otro enum.
- **Locked**: `cantidad: 1` siempre (loaner = activo individual, no consumible). No introducir `Loaner.cantidad`.
- **Locked**: `unidadId`: el id de la UnidadStock recién creada (la espejo).
- **Locked**: `articuloId`/`articuloCodigo`/`articuloDescripcion`: heredados del `loaner.articuloId` (que en este punto siempre existe — ver "Flujo cuando no existe").
- **Locked**: `motivo`: opcional, puede registrar info contextual (ej. "Venta vinculada a presupuesto X"); no es la fuente de la referencia al loaner (eso es `referenciaLoanerId`).
- **Locked**: `creadoPor` y audit automáticos via `movimientosService.create` (que ya hace `batchAudit` + `logBusinessEvent`).

### Modelo de la UnidadStock espejo

- **Locked**: Siempre se crea una `UnidadStock` NUEVA. No se busca ni reusa unidades existentes del mismo `articuloId`. Justificación: el espejo es trazabilidad contable, no inventario físico — confundirlo con stock real puede tocar reservas/unidades en uso.
- **Locked**: `articuloId` = `loaner.articuloId` (garantizado no-nulo por el flujo bloqueante). `articuloCodigo`/`articuloDescripcion` denormalizados del artículo en el momento del write.
- **Locked**: `condicion: 'bien_de_uso'` (valor existente del enum `CondicionUnidad`). Sin dropdown en el modal — los loaners son equipos usados del circuito interno por definición.
- **Locked**: `estado: 'vendido'` (valor existente del enum `EstadoUnidad`).
- **Locked**: `ubicacion`: `{ tipo: 'cliente', referenciaId: clienteId, referenciaNombre: clienteNombre }`. Coherente con `destinoTipo: 'cliente'` del movimiento.
- **Locked**: `costoUnitario` y `monedaCosto`: cargados manualmente en `LoanerVentaModal` (admin/contable los ingresa). NO se infiere del precio de venta (semánticamente: precio = revenue, costo = lo que valió el activo).
- **Locked**: Vínculo con presupuesto de ventas (típica fuente del costo): el admin lo carga manual; el campo existente `VentaLoaner.presupuestoId?` sigue opcional y NO se fuerza. La memoria del costo "sale de un presupuesto de ventas" pero la fase no automatiza esa herencia.
- **Locked**: `nroSerie`/`nroLote`: derivar de `loaner.serie` si existe (denormalizar al crear unidad); si no existe, null.
- **Locked**: `observaciones`: pasar `venta.notas` si existe, para que la unidad tenga el mismo contexto que la venta.
- **Locked**: `activo: true` (la unidad existe; el `estado: 'vendido'` ya la excluye de inventario disponible).
- **Locked**: `reservadoPara*`: null (la unidad nace vendida, no reservada).

### Flujo cuando `loaner.articuloId` no existe

- **Locked**: **Bloqueante**. Sin `articuloId`, no se puede confirmar la venta. Garantiza el invariante "venta = espejo siempre".
- **Locked**: SearchableSelect inline DENTRO de `LoanerVentaModal`. Cuando se abre el modal y `loaner.articuloId` es null/vacío, aparece arriba (antes de cliente/precio) un campo "Vincular artículo del catálogo *" con `SearchableSelect` de `articulosService.getAll()` filtrado por `activo: true`.
- **Locked**: Sin filtros adicionales por categoría: **cualquier Artículo activo** es elegible (no se exige `categoria === 'equipo'` ni similar). Simpler; el user es responsable de elegir el correcto.
- **Locked**: Al confirmar la venta, dentro de la tx, si el loaner se acaba de vincular: el update del loaner incluye `articuloId`, `articuloCodigo`, `articuloDescripcion` denormalizados (precedente Phase 13 — la denormalización se hace tx-internal para mantener atomicidad).
- **Locked**: Si `loaner.articuloId` YA existe al abrir el modal: el SearchableSelect no se muestra (o se muestra como `Input` readonly con código + descripción del artículo, decisión visual del planner).
- **Locked**: NO se permite crear Artículo nuevo desde el modal. Si el equipo no está en el catálogo, el user cancela, va al módulo Artículos, lo crea, vuelve. Scope simple.

### Atomicidad e idempotencia

- **Locked**: Una única `runTransaction` Firestore agrupa las 3 escrituras (update loaner + create unidad + create movimiento). Precedente Phase 13 (`equivalenciasService.desagregarUnidades`) y Phase 14 (`patronesService.consumirComponentes`).
- **Locked**: Pre-fetch FUERA de la tx: datos del cliente seleccionado (razonSocial denormalizada), datos del artículo recién vinculado si aplica. Mínimo necesario.
- **Locked**: READ-FIRST DENTRO de la tx: `tx.get(loanerRef)` antes de cualquier write. Si `loaner.estado === 'vendido'` → `throw new Error('Loaner ya vendido')` y abort. La UI captura el error y muestra banner.
- **Locked**: UI también con `setSaving(true)` durante la operación (el modal ya lo hace) — protege el caso común de doble click. La tx guard protege el caso de concurrencia entre tabs/users.
- **Locked**: IDs de unidad y movimiento: `crypto.randomUUID()` pre-generados fuera de la tx (mismo patrón que `movimientosService.create` actual). Dentro de la tx se hace `tx.set(doc(db, 'unidadesStock', unidadId), ...)` y `tx.set(doc(db, 'movimientosStock', movimientoId), ...)`.
- **Locked**: `deepCleanForFirestore` aplicado a TODOS los payloads (loaner update, unidad create, movimiento create) — regla `.claude/rules/firestore.md`.
- **Locked**: Audit/business event: dado que la tx escribe directo (no via `movimientosService.create` que hace `batchAudit`+`logBusinessEvent` automáticamente), el método nuevo debe registrar el audit equivalente DESPUÉS del commit (best-effort, no bloquea la tx). El planner decide la forma exacta (helper compartido o duplicar la lógica de `movimientosService.create`).
- **Locked**: Si la tx falla (cualquier write), rollback completo: loaner queda intacto, no se crea unidad ni movimiento. La UI muestra el error y el modal NO cierra (para permitir reintento).
- **Locked**: Reversa/anulación de venta: **fuera de scope v1**. Si aparece el caso, compensating movement en una fase posterior.

### UX del modal extendido

- **Locked**: Bloque 1 (condicional, si `articuloId` null): SearchableSelect "Vincular artículo del catálogo *" — required, bloquea confirm.
- **Locked**: Bloque 2 (existente): Cliente (SearchableSelect/select, ya existe).
- **Locked**: Bloque 3 (existente, refactor visual): Precio de venta + Moneda venta (2 cols). **NUEVO**: Costo del activo + Moneda costo (2 cols adicionales). El planner decide si va en mismo grid 4 cols, dos grids 2x2 apilados, o lo que el diseño Editorial Teal prefiera.
- **Locked**: Bloque 4 (existente): Notas (textarea).
- **Locked**: Validaciones para confirmar: `articuloId` no-nulo (post-vinculación si aplica), `clienteId` no-nulo, `costoUnitario` no-nulo + `monedaCosto` no-nulo (el costo del activo es required para que el espejo tenga sentido contable; el precio de venta sigue siendo opcional como hoy).
- **Locked**: Mensaje de error transaccional ("Loaner ya vendido") se muestra como banner dentro del modal (no toast efímero) — el user debe entender qué pasó.
- **Locked**: Botón "Confirmar venta" deshabilitado mientras `saving === true` (ya implementado).

### Convenciones del repo (carry-forward)

- **Locked**: Firestore writes nunca con `undefined` — `deepCleanForFirestore` para payloads anidados (`.claude/rules/firestore.md`).
- **Locked**: Writes solo via services (`loanersService`, `stockService.unidadesService`, `stockService.movimientosService`). Componentes nunca llaman Firestore directo.
- **Locked**: Timestamps en write con `Timestamp.now()`; en read a UI con `.toDate().toISOString()`.
- **Locked**: Componentes ≤250 LOC. `LoanerVentaModal` hoy tiene 86 LOC, hay margen — pero si crece >250 con el SearchableSelect + costo inputs + validaciones, extraer hook `useLoanerVenta` o sub-componente `LoanerArticuloPicker` antes.
- **Locked**: Filtros de lista vía `useUrlFilters` — N/A en Phase 15 (no agrega filtros nuevos).
- **Locked**: Design Editorial Teal — atoms `Modal`, `Input`, `Button`, `SearchableSelect` ya en uso. JetBrains Mono uppercase labels para los inputs nuevos.
- **Locked**: Excepción frozen — `apps/reportes-ot/` NO se toca en Phase 15 (cero excepciones autorizadas, distinto a Phase 14).

### Claude's Discretion (no decidido explícitamente — planner/researcher resuelve)

- Nombre exacto del nuevo método en `loanersService` (`registrarVentaConEspejo` / `venderConStock` / reemplazo de `registrarVenta`). Preferir reemplazo del método existente para evitar dos caminos paralelos.
- Forma del audit/business event después del commit de la tx: helper compartido nuevo en `firebase.ts` (`auditCreatedDoc(...)`) vs duplicar la lógica de `movimientosService.create`. Preferir extraer helper si la duplicación es grande.
- Layout exacto de los 4 inputs de precio+moneda (venta y costo) en el modal — grid 2x2 doble apilado, 4 cols, o cards. Editorial Teal consistente.
- Estado visual del SearchableSelect cuando el `articuloId` YA existe (esconder, mostrar readonly, etc.).
- Si el sub-componente `LoanerArticuloPicker` se extrae preventivamente o solo si LoanerVentaModal supera ~200 LOC.
- Si `useLoaners.registrarVenta` (`apps/sistema-modular/src/hooks/useLoaners.ts:101`) se mantiene como wrapper o se elimina (el modal puede llamar directo al service). Preferir consolidar para no dejar dos caminos.
- Forma de presentar errores transaccionales en el banner del modal (Card rojo + texto, alert tag, etc.). Editorial Teal.
- Si se agrega tooltip explicativo en el modal junto a "Costo del activo" para diferenciar de "Precio de venta" (UX optional).
- Tests: el planner decide alcance (unit del nuevo método con `__setTestFirestore` DI hook similar a `consumirComponentes`, smoke E2E con Playwright si TEST-01 está disponible, o solo manual UAT).

</decisions>

<specifics>
## Specific Ideas

### Origen del costo (clarificación del user 2026-05-24)

> "va a salir de un presupuesto de ventas. De igual modo no es tan importante, se puede cargar manual, pero va a salir de un presupuesto de ventas."

Interpretación: el flujo realista es que el admin/contable ya tiene a mano un presupuesto de ventas aprobado al cliente y conoce el costo del activo. Lo carga manual en el modal. La fase NO automatiza la herencia desde el presupuesto (vínculo `VentaLoaner.presupuestoId` queda como referencia informativa, igual que hoy). Si en el futuro aparece la necesidad de auto-heredar costo desde el item del presupuesto, se modela aparte.

### Patrón Phase 13/14 que se reutiliza

- `runTransaction` READ-FIRST con `tx.get` del documento principal bajo lock antes de cualquier write — Phase 13 `desagregarUnidades` y Phase 14 `consumirComponentes`.
- Subtipo refinement sobre `tipo` existente — Phase 13 `subtipo: 'conversion'`. Phase 15 agrega `'venta_loaner'` al union.
- Campos opcionales backwards-compat en `MovimientoStock` — Phase 13/14 ya agregaron 7 campos opcionales sin romper consumidores. Phase 15 agrega 2 más (`referenciaLoanerId`, `referenciaLoanerCodigo`).
- Idempotencia via guard explícito dentro de la tx — Phase 14 `consumirComponentes` chequea movimientos existentes; Phase 15 chequea `loaner.estado === 'vendido'`.

### Diferencia conceptual costo vs precio

- `VentaLoaner.precio` + `VentaLoaner.moneda` (existentes): **precio de venta** al cliente — revenue.
- `VentaLoaner.costoUnitario` + `VentaLoaner.monedaCosto` (nuevos): **costo del activo** — lo que valió el equipo. Va al `UnidadStock.costoUnitario`/`monedaCosto` para que el módulo Stock tenga la valuación contable correcta.

### Punto de entrada en código

- Hoy: `LoanerDetail.handleVenta` (`apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx:87`) llama `loanersService.registrarVenta(loaner.id, { fecha, ...data })` con `data` viniendo del modal.
- Phase 15: ese `handleVenta` pasa `costoUnitario`, `monedaCosto`, y opcionalmente `articuloIdRecienVinculado` al nuevo método transaccional.

### Cliente comprador como destino del activo

- `UbicacionStock.referenciaId: clienteId` + `referenciaNombre: clienteNombre` — datos que ya colecta el modal. La unidad vendida queda "ubicada" en el cliente comprador, simétrico a destinoTipo del movimiento.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`Loaner` + `VentaLoaner` + `EstadoLoaner`** (`packages/shared/src/types/index.ts:3157-3243`): se extiende `VentaLoaner` con `costoUnitario?` + `monedaCosto?`. `Loaner.articuloId` ya es opcional, se puebla en el flujo si está null.
- **`MovimientoStock`** (`packages/shared/src/types/index.ts:2779-2826`): se extiende `subtipo` union a `'conversion' | 'venta_loaner'`; se agregan `referenciaLoanerId?` y `referenciaLoanerCodigo?`. Cero cambios estructurales rompedores.
- **`UnidadStock` + `EstadoUnidad` + `CondicionUnidad` + `UbicacionStock` + `TipoUbicacionStock`** (`packages/shared/src/types/index.ts:2607-2654`): sin cambios; se crean instancias con valores existentes (`estado: 'vendido'`, `condicion: 'bien_de_uso'`, `ubicacion.tipo: 'cliente'`).
- **`TipoMovimiento` + `TipoOrigenDestino`** (`packages/shared/src/types/index.ts:2767-2778`): sin cambios. Se usa `'egreso'` + `'baja'` + `'cliente'` ya existentes.
- **`loanersService.registrarVenta`** (`apps/sistema-modular/src/services/loanersService.ts:174`): se reemplaza o se agrega método nuevo transaccional.
- **`stockService.unidadesService.create`** y **`stockService.movimientosService.create`** (`apps/sistema-modular/src/services/stockService.ts:~398` y `:~626`): patrones de write existentes. La tx nueva escribe directo via `tx.set(doc(db, 'unidadesStock', id), ...)` y `tx.set(doc(db, 'movimientosStock', id), ...)` con audit post-commit.
- **`articulosService.getAll`** (`apps/sistema-modular/src/services/stockService.ts:153`): fuente para el SearchableSelect cuando hay que vincular artículo.
- **`LoanerVentaModal`** (`apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx`, 86 LOC): se extiende con SearchableSelect condicional + inputs costo/moneda. Margen para extracción si crece (≤250 LOC budget).
- **`LoanerVentaSection`** (`apps/sistema-modular/src/components/loaners/LoanerVentaSection.tsx`): mantiene su lógica actual (oculta botón "Registrar venta" cuando ya hay `loaner.venta`).
- **`LoanerDetail.handleVenta`** (`apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx:87`): apunta al nuevo método transaccional con params extendidos.
- **`useLoaners.registrarVenta`** (`apps/sistema-modular/src/hooks/useLoaners.ts:101`): wrapper. Actualizar o consolidar (decisión del planner).
- **`SearchableSelect`** (`apps/sistema-modular/src/components/ui/SearchableSelect.tsx`): atom con `useDeferredValue` ya integrado. Reutilizar para el picker de artículo.
- **`Modal` / `Button` / `Input`** (`apps/sistema-modular/src/components/ui/`): atoms Editorial Teal en uso.
- **`deepCleanForFirestore` / `cleanFirestoreData` / `getCreateTrace` / `getUpdateTrace` / `createBatch` / `batchAudit` / `logBusinessEvent`** (`apps/sistema-modular/src/services/firebase.ts`): helpers existentes para audit + clean.
- **`crypto.randomUUID()`**: pattern para pre-generar ids de doc fuera de la tx (precedente `movimientosService.create`).

### Established Patterns

- **`runTransaction` READ-FIRST con guard de idempotencia** (Phase 13 `equivalenciasService.desagregarUnidades`, Phase 14 `patronesService.consumirComponentes`): primer `tx.get` del documento principal, validar invariantes, después writes.
- **Subtipo refinement sobre `tipo` existente** (Phase 13 `subtipo: 'conversion'` sobre `'transferencia'`): permite distinguir variantes sin extender enums top-level.
- **Backwards-compat field extensions en `MovimientoStock`** (Phase 13/14): campos opcionales agregados a interfaces existentes. Consumidores que no los leen siguen funcionando.
- **Denormalización code/descripcion al vincular FK** (Phase 13 `articuloCodigoDestino`/`articuloDescripcionDestino`): patrón consistente. Phase 15 denormaliza `articuloCodigo`/`articuloDescripcion` en el Loaner cuando se vincula, y `referenciaLoanerCodigo` en el MovimientoStock.
- **`batchAudit` + `logBusinessEvent` automáticos** en services existentes — Phase 15 reproduce el patrón post-commit (helper compartido a discreción del planner).
- **Modal con `setSaving(true)` durante operación async** (precedente en `LoanerVentaModal` actual y otros modales del sistema).
- **Pre-gen de ids fuera de la tx** (`movimientosService.create` con `crypto.randomUUID()` antes del `tx.set`).
- **Validaciones bloqueantes en confirm via disabled button** (precedente: precio + cliente en `LoanerVentaModal` actual; se extiende a articuloId + costoUnitario + monedaCosto).

### Integration Points

- `packages/shared/src/types/index.ts` — extensión `MovimientoStock` (subtipo union, `referenciaLoanerId?`, `referenciaLoanerCodigo?`) y `VentaLoaner` (`costoUnitario?`, `monedaCosto?`).
- `apps/sistema-modular/src/services/loanersService.ts` — reemplazar/extender `registrarVenta` con versión transaccional que importa `runTransaction` de firebase/firestore y escribe a 3 colecciones (`loaners`, `unidadesStock`, `movimientosStock`).
- `apps/sistema-modular/src/services/firebase.ts` — (opcional) extraer helper `auditCreatedDoc(collection, id, payload)` si se prefiere no duplicar la lógica de `batchAudit` + `logBusinessEvent`.
- `apps/sistema-modular/src/services/stockService.ts` — sin cambios estructurales; los métodos existentes de `unidadesService.create` y `movimientosService.create` quedan disponibles para otros flujos, pero la venta del loaner escribe directo en la tx para mantener atomicidad.
- `apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx` — agregar SearchableSelect condicional para artículo + inputs costo/moneda + validaciones extendidas + banner de error transaccional.
- `apps/sistema-modular/src/hooks/useLoaners.ts` — actualizar `registrarVenta` para apuntar al nuevo método (o eliminar el wrapper si el modal llama directo al service).
- `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx` — actualizar `handleVenta` para pasar los nuevos params (`articuloIdRecienVinculado`, `costoUnitario`, `monedaCosto`).

</code_context>

<deferred>
## Deferred Ideas

- **Anulación / reversa de venta de loaner**: no en v1. Si aparece, compensating MovimientoStock + revertir `UnidadStock.estado` + restaurar `Loaner.estado` en una fase posterior.
- **Migración batch de loaners vendidos pre-Phase 15 sin espejo**: no en scope. Pocos casos, se hace manual si hace falta o script one-shot posterior.
- **Auto-disparo desde aceptación de presupuesto de ventas**: descartado. El vínculo a presupuesto sigue siendo informativo (campo opcional `VentaLoaner.presupuestoId`).
- **Auto-heredar costo desde el item del presupuesto de ventas vinculado**: descartado en v1. El admin carga el costo manual. Si aparece la necesidad de heredar, se modela aparte.
- **Toggle "Crear espejo en stock" en el modal**: descartado. Toda venta procesada por Phase 15 deja espejo (invariante de la fase).
- **Reusar `UnidadStock` existente del mismo articuloId**: descartado. Siempre crear nueva (el espejo es contable, no inventario).
- **Agregar `'venta'` al enum `TipoMovimiento`**: descartado a favor de `'egreso'` + `subtipo: 'venta_loaner'`.
- **Agregar `'loaner'` al enum `TipoOrigenDestino`**: descartado a favor de `'baja'` como origen.
- **Pedir condición de la unidad en el modal (dropdown)**: descartado. Siempre `'bien_de_uso'`.
- **Persistir costo en el Loaner (campo `Loaner.costoUnitario?`)**: descartado. El costo vive en la `VentaLoaner` (momento de la venta).
- **Mantener la última ubicación del loaner como ubicación de la unidad vendida**: descartado. La unidad vendida vive en el cliente comprador (coherente con destinoTipo del movimiento).
- **Crear Artículo nuevo desde dentro de `LoanerVentaModal`**: descartado por scope. User va al módulo Artículos, crea, vuelve.
- **Filtrar el SearchableSelect por categoría 'equipo' u otro flag**: descartado. Cualquier Artículo activo es elegible.
- **Banner explícito en el modal si el loaner cambió a 'vendido' desde otra pestaña**: descartado. La tx guard captura el caso y `LoanerVentaSection` ya oculta el botón cuando hay venta.
- **Filtro nuevo en `MovimientosList` "Ventas de loaner"**: no en v1. La query queda habilitada via `subtipo='venta_loaner'` o `referenciaLoanerId` si se necesita después.
- **Equivalencias compra↔uso** (Phase 13, completada): otra área de stock, no se mezcla.
- **Patrones con BOM** (Phase 14, completada): otra área, no se mezcla.
- **Tocar `apps/reportes-ot/`**: no entra en esta fase (cero excepciones autorizadas, distinto a Phase 14).
- **Tocar `apps/portal-ingeniero/`**: no entra. Ningún flow del portal lee ventas de loaner hoy.

</deferred>

---

*Phase: 15-stock-venta-de-loaner-espejo-a-stock*
*Context gathered: 2026-05-24 via `/gsd:discuss-phase 15`*
