# Phase 10 Research — Presupuestos Partes/Mixto/Ventas + Aviso Facturación + Exports

**Researched:** 2026-04-22
**Domain:** Integración de tipos de presupuesto restantes + dashboard facturación + export helpers
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- El editor flat para partes/mixto/ventas **ya existe** en el codebase — Phase 10 audita + parcha, **no rebuild**
- `TipoPresupuesto` completo ya en `@ags/shared`: `'servicio' | 'partes' | 'ventas' | 'contrato' | 'mixto'` — no se agregan tipos nuevos
- **Ventas:** al `aceptado` se auto-crea **1 OT genérica de seguimiento** (NO las 5 del flujo de equipo) asignada a `adminConfig.usuarioCoordinadorOTId`
- **Ventas metadata:** campos `fechaEstimadaEntrega + lugarInstalacion + requiereEntrenamiento` almacenados en `Presupuesto.ventasMetadata` (shape opcional nueva, **no** en `PresupuestoItem`)
- **PDF template único** `PresupuestoPDFEstandar` con branching interno por tipo:
  - mixto → 2 secciones (Servicios / Partes) + subtotales
  - partes → misma estructura, hide-if-empty la sección Servicios
  - ventas → bloque "Datos de entrega e instalación" antes de items
  - servicio → sin cambios (Phase 7)
- **Aviso facturación:** `solicitudesFacturacion` se crea en la **misma `runTransaction`** de `cerrarAdministrativamente` (idempotente por `otId`)
- **Mail facturación minimal:** solo link al dashboard, sin adjuntos. Subject `"Aviso facturación — OT {numero}"`
- **`enviarAvisoCierreAdmin`** queda `@deprecated` (backward compat, no eliminar)
- **Exports:** ambos formatos XLSX + PDF para FMT-04/05/06, filter-aware (toman `useUrlFilters` actuales), plain (sin branding teal)
- **Dashboard RBAC:** `admin + admin_soporte` (admin_contable pendiente formal — no bloquea)
- **`mailQueue` consumer sigue diferido** post-v2.0 (no se implementa en Phase 10)

### Claude's Discretion
- Naming exacto de campos en `ventasMetadata` (`fechaEstimadaEntrega` vs `fechaEntrega`, etc)
- Layout exacto del bloque "Datos de entrega e instalación" en editor y PDF
- Cómo se computa `montoTotal` en `solicitudesFacturacion` cuando hay multi-moneda (MIXTA)
- Diseño visual del dashboard (cards vs tabla densa)
- Formato del deep link en el mail (query param vs segment)
- Template visual del PDF de exports (bordes vs alternada vs sin bordes)
- Nombre del archivo exportado (ej. `ocs-pendientes_2026-04-22.xlsx`)

### Deferred Ideas (OUT OF SCOPE)
- Rol `admin_contable` formal (MEMORY.md marca "Pending"); Phase 10 usa `admin + admin_soporte`
- Auto-crear las 5 OTs del flujo de ventas (descartado — solo 1 de seguimiento)
- Templates de rich-text para condiciones comerciales (Phase 3 diferido v1.0)
- Integración real con Bejerman (out-of-scope milestone)
- Adjuntos en el mail aviso facturación (link al dashboard es suficiente)
- Multi-destinatario en mail facturación / CC (post-v2.0)
- Branding teal en exports (plain xlsx/PDF suficientes)
- Modal "opciones de export" (todo vs filtros vs rango) — por default usa filtros actuales
- mailQueue consumer Cloud Function (diferido post-v2.0)
- Pivot-ready Excel exports con múltiples sheets (post-v2.0)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PTYP-02 | Implementación de presupuesto **partes** — similar a per_incident pero con items de stock; disparador del cruce ATP al aceptar | Challenge §1 (editor audit) + §3 (aceptarConRequerimientos ya activo via FLOW-03) + §5 (PDF branching) |
| PTYP-03 | Implementación de presupuesto **mixto simple** — combina servicios + partes | Challenge §1 (editor audit) + §5 (PDF 2-sections) |
| PTYP-04 | Implementación de presupuesto **ventas de equipos** — genera OT, PDF, envío | Challenge §1 (editor audit + ventasMetadata UI) + §2 (shape nuevo) + §3 (aceptarConRequerimientos extension 1-OT) + §5 (PDF bloque instalación) |
| FMT-03 | Template mail automático al contable para aviso facturación con presupuesto + OC + OTs | Challenge §4 (extender `cerrarAdministrativamente` tx) — mail minimal solo con link al dashboard |
| FMT-04 | Excel export de listado de presupuestos con filtros aplicados | Challenge §5 (helper genérico) + `exportVentasInsumosExcel.ts` pattern |
| FMT-05 | Excel export de OCs pendientes por cliente/coordinador | Challenge §5 + filtro nuevo en `/presupuestos` (OC sin recibir) |
| FMT-06 | Excel export de solicitudes de facturación pendientes (reconciliación con Bejerman) | Challenge §5 + dashboard nuevo `/admin/solicitudes-facturacion` |
</phase_requirements>

## Executive summary

Phase 10 cierra el ciclo comercial con trabajo altamente **integrativo** — cada requirement extiende código Phase 7/8/9 existente y el valor de la investigación está en **mapear con precisión los 5 puntos de inserción** y sus riesgos, no en proponer arquitecturas nuevas.

Tres findings críticos que contradicen suposiciones del CONTEXT y el planner debe conocer antes de abrir plans:

1. **`SolicitudFacturacion` ya existe en `@ags/shared` (types/index.ts:1280) pero con una shape distinta** a la que CONTEXT propone. El shape actual soporta un flujo *item-level partial billing* (ver `SolicitarFacturaModal.tsx`) — facturar parcialmente N items de un mismo ppto. El flow nuevo de Phase 10 (aviso automático al `cerrarAdministrativamente`) crea solicitudes *full-presupuesto*. Conclusión: **reusar la colección + service existente, no crear otra**. El type actual tiene campos suficientes (`presupuestoId`, `clienteId`, `montoTotal`, `moneda`, `estado`, `otNumbers[]`) y el service ya expone `create/getAll/subscribe/update/registrarFactura`. Solo falta el disparador transaccional desde `cerrarAdministrativamente` y el dashboard admin.

2. **El "editor flat ya existe para partes/mixto/ventas" es solo parcialmente cierto.** El editor renderea la tabla con `tipoPresupuesto !== 'contrato'` (EditPresupuestoModal.tsx:232), pero `AddItemModal` **no tiene selector de artículo de stock** para tipos non-`'contrato'` (AddItemModal.tsx:94: `showEquipoPanel = tipoPresupuesto === 'contrato' && ...`). El único picker de `stockArticuloId` vive en `PresupuestoItemsTableContrato.handlePickArticulo` (Phase 8-04 finding). Conclusión: **partes/mixto/ventas hoy pueden escribir items manualmente pero no vincular a stock** → FLOW-03 ATP cruce nunca dispara para esos tipos. Hay que agregar un article picker al `AddItemModal` gated por tipo.

3. **Ya existe una ruta `/facturacion` con `FacturacionList.tsx`** que consume `facturacionService.subscribe()` con `useUrlFilters` completo. La propuesta de CONTEXT `/admin/solicitudes-facturacion` **se superpone**. Decisión recomendada para el planner: **extender `/facturacion` existente** con columnas + acciones nuevas (marcar enviada, nota del contable), en vez de crear un dashboard paralelo. El single source of truth evita duplicación y es consistente con "no hand-roll" principle.

Los otros 2 challenges (ventasMetadata, export helpers) son directos y bajo riesgo.

**Primary recommendation:** Plan Phase 10 como **5 waves secuenciales**, cada una de 1-2 plans, reutilizando y extendiendo en vez de reconstruir. El budget total (~7 requirements) es holgado; el riesgo principal es el "just-a-small-change" creep en `cerrarAdministrativamente` tx.

---

## Integration challenges

### 1. Editor audit for partes / mixto / ventas

**Scope:** `EditPresupuestoModal.tsx` + `PresupuestoItemsTable.tsx` + `AddItemModal.tsx` + `PresupuestoItemRow.tsx`.

#### What works today (✅ reuse, no change)

- **Dispatcher por tipo** en `EditPresupuestoModal.tsx:221-253`: si `form.tipo === 'contrato'` usa `PresupuestoItemsTableContrato`; caso contrario cae al `PresupuestoItemsTable` flat. Ya cubre los 4 tipos non-contrato con un solo componente.
- **`PresupuestoItemsTable`** (tabla flat) ya soporta agrupación por sistema (`itemsByGrupo`, `hasGrupos`) + concepto de servicio + categorías + cuotas + multi-moneda MIXTA. Fully funcional para items manuales.
- **`handleEstadoChange`** (via `usePresupuestoActions`) dispara transición a `'aceptado'` → `presupuestosService.update()` → branch FLOW-03 (presupuestosService.ts:286-322) → delega en `aceptarConRequerimientos` cuando hay `itemRequiereImportacion`. Aplica **a los 4 tipos non-contrato por igual**. FLOW-03 no tiene rama por tipo — es agnóstico.
- **`EnviarPresupuestoModal` + `useEnviarPresupuesto`** (Phase 7) — token-first + R3/R4 guardas, funciona para cualquier tipo sin cambios.
- **`CargarOCModal`** (Phase 8) — N:M + multi-upload, ya accesible desde footer (`form.estado === 'aceptado'`); sirve a los 4 tipos.

#### What's missing (⚠️ requires implementation)

**CRITICAL GAP: stock picker no existe en editor flat.**

- `AddItemModal.tsx:94`: `showEquipoPanel = tipoPresupuesto === 'contrato' && sistemas && sistemas.length > 0 && !!loadModulos` — el panel que permite elegir módulos/equipo está **gated estrictamente por contrato**. Los otros tipos solo tienen texto libre + concepto de servicio.
- `PresupuestoItemRow.tsx:21` solo expone `codigoProducto` como input de texto — no hay picker de artículo. El `stockArticuloId` se puede escribir (es campo del PresupuestoItem) pero **solo desde `PresupuestoItemsTableContrato` hoy** (PresupuestoItemsTableContrato.tsx:47: `handlePickArticulo`).
- Consecuencia práctica: un ppto `partes` creado hoy NO puede marcar `stockArticuloId` en sus líneas → FLOW-03 ATP cruce (que chequea `itemRequiereImportacion: true && stockArticuloId`) nunca dispara. **Feature rota silenciosamente**.

**Fix prescrito:** agregar panel de selección de artículo en `AddItemModal` gated por `tipoPresupuesto === 'partes' || 'mixto' || 'ventas'`. Cuando el user elige artículo, se rellenan `stockArticuloId`, `codigoProducto`, `descripcion`, `precioUnitario` (si hay precio configurado), y se calcula `itemRequiereImportacion` vía `atpHelpers.itemRequiresImportacion(articuloId)` (ya existe comentario TODO en AddItemModal.tsx:58-61).

**StockAmplioIndicator wire-up (Phase 9 building block):**
- `useStockAmplio(articuloId)` está listo (hook reactivo con `onSnapshot`, dual-source firestore/computed — useStockAmplio.ts:18).
- `StockAmplioIndicator` renderea 4 buckets + ATP neto (StockAmplioIndicator.tsx:30-47).
- Plug-in point: cuando el user selecciona un artículo en el picker nuevo, mostrar `<StockAmplioIndicator stockAmplio={state.stockAmplio} size="sm" />` al lado del selector. Hook funciona desde dentro de modales (no depende de layout ni scroll — useEffect con clean-up disposado).
- Riesgo: si el user agrega **10+ items con stockArticuloId distinto**, tendremos 10 subscripciones activas simultáneas. `onSnapshot` por-articulo es OK en docs individuales pero hacer esto durante tipeo puede saturar. Recomendación: `StockAmplioIndicator` solo en el item **en creación** del AddItemModal, no en cada row de la tabla.

**Ventas: sección "Datos de entrega e instalación"**

- Componente nuevo `VentasMetadataSection` entre `PresupuestoMetadataStrip` (EditPresupuestoModal.tsx:184-191) y `PresupuestoItemsTable` (línea 232), gated por `form.tipo === 'ventas'`.
- Campos: `fechaEstimadaEntrega` (date), `lugarInstalacion` (text), `requiereEntrenamiento` (checkbox).
- Persistir en `Presupuesto.ventasMetadata` (nuevo, ver Challenge 2).
- Budget estimado: ~80 líneas — comfortably under 250.

#### Concrete findings table

| Area | Status | File | Line | Action |
|------|--------|------|------|--------|
| Dispatcher por tipo | ✅ works | EditPresupuestoModal.tsx | 221-253 | none |
| PresupuestoItemsTable flat | ✅ works | PresupuestoItemsTable.tsx | 54-173 | none |
| Transición `'aceptado'` branches to FLOW-03 | ✅ works | presupuestosService.ts | 286-322 | none (ventas extiende en Challenge 3) |
| AddItemModal concepto servicio picker | ✅ works | AddItemModal.tsx | 40-56, 89-105 | none |
| **AddItemModal articulo picker** | ❌ **missing** | AddItemModal.tsx | 94 | **add new panel, gated by tipo ∈ {partes, mixto, ventas}** |
| StockAmplioIndicator wire-up | ❌ not-wired | AddItemModal.tsx | new | integrar cuando stockArticuloId selected |
| VentasMetadataSection | ❌ missing | EditPresupuestoModal.tsx | new | nuevo componente, gated por tipo==='ventas' |
| Post-aceptado OT genérica ventas | ❌ missing | presupuestosService.ts | 785-907 | extender (ver Challenge 3) |
| CargarOC footer button | ✅ works | EditPresupuestoModal.tsx | 323-327 | none |
| EnviarPresupuestoModal token-first | ✅ works (Phase 7) | EnviarPresupuestoModal.tsx | — | none |
| Cuotas section multi-moneda | ✅ works | PresupuestoCuotasSection | — | none |

---

### 2. `Presupuesto.ventasMetadata` shape + integration

**Context:** El user quiere campos `fechaEstimadaEntrega + lugarInstalacion + requiereEntrenamiento`. Almacenar en `Presupuesto.ventasMetadata` (opcional, solo para tipo `'ventas'`).

#### Similar patterns to reuse

- **`contratoFechaInicio`/`contratoFechaFin`** (types/index.ts:1188-1190) — dos campos top-level opcionales `string | null`, documentados con JSDoc "Solo aplica para tipo === 'contrato'". Patrón simple, sin sub-objeto. Pero al tener 3 campos (uno boolean) merece una sub-object para no contaminar el root.
- **`cantidadCuotasPorMoneda: Record<string, number> | null`** (types/index.ts:1185) — patrón de objeto plano opcional en el root.

**Recomendación:** sub-object propio para ventas (agrupa semánticamente, mantiene root limpio):

```ts
// packages/shared/src/types/index.ts — adyacente a contratoFechaInicio/Fin
/**
 * Datos de entrega e instalación — solo aplica cuando tipo === 'ventas'.
 * Se muestra en el editor en sección dedicada y se renderiza en el PDF
 * antes del detalle de items.
 */
export interface VentasMetadata {
  /** ISO date — fecha estimada de entrega del equipo */
  fechaEstimadaEntrega?: string | null;
  /** Dirección libre donde se instalará (puede diferir de establecimiento) */
  lugarInstalacion?: string | null;
  /** Si el cliente requiere entrenamiento post-instalación */
  requiereEntrenamiento?: boolean;
}

// En interface Presupuesto:
ventasMetadata?: VentasMetadata | null;
```

**Integration points:**
- Editor: nuevo `VentasMetadataSection` (ver Challenge 1). Setea via `setField('ventasMetadata', { ... })`.
- Persistencia: `deepCleanForFirestore` ya strips undefined del sub-object. Safe.
- PDF: `PresupuestoPDFEstandar` branch `tipo === 'ventas'` renderea bloque con estos 3 campos.
- Reads: type cast automático desde `presupuestosService.getById()` (no transformer adicional necesario — es JSON plano).

**Firestore rules:** no requiere regla nueva si `/presupuestos/{id}` ya permite writes al campo `ventasMetadata` (los rules actuales validan shape entero o permiten arbitrary fields — verificar en `firestore.rules`; **posible blocker**, el planner debe confirmar).

**Risk low:** campo opcional, no rompe lecturas de pptos existentes.

---

### 3. `aceptarConRequerimientos` extension for ventas (1 OT genérica)

**Context:** Phase 8-04 (presupuestosService.ts:785-907) ya implementa el método con `runTransaction` atómico (update ppto + crear requerimientos condicionales) + post-commit lead sync + pendingAction append. Extender para que **si `tipo === 'ventas'`**, **también cree 1 OT genérica de seguimiento** asignada al `adminConfig.usuarioCoordinadorOTId`.

#### Where to insert

Hay dos opciones; la segunda es preferible:

**Opción A (inline en tx):** Agregar `tx.set(otRef, ...)` dentro del runTransaction existente (presupuestosService.ts:827-879).
- **Pro:** atomicidad total (ppto `aceptado` ↔ OT `CREADA` guaranteed).
- **Con:** OT numeros se generan via `getNextOtNumber` que usa `_counters/otNumber` con **su propia `runTransaction`** (otService.ts:47-73). **No se pueden anidar runTransactions** — nested es prohibido en Firebase SDK. Requeriría reservar el número FUERA de la tx (similar a cómo `aceptarConRequerimientos` pre-reserva numerosReservados[]), lo cual complica el código y rompe la isolación del counter doc.
- **Pro (alternativo):** hacer el counter-read con `getDoc` (no tx) dentro del outer tx — pero no es atómico respecto de otros create-OT concurrentes. Podría resultar en colisión de numeros si dos usuarios aceptan simultáneamente.

**Opción B (post-commit, best-effort):** agregar bloque en presupuestosService.ts:906 después del `if (itemsImport.length > 0) { ... pendingAction derivar_comex ... }`:

```ts
// Phase 10: si tipo === 'ventas', auto-crear 1 OT genérica de seguimiento
if (pres.tipo === 'ventas') {
  try {
    const cfg = await adminConfigService.getWithDefaults();
    const coordId = cfg.usuarioCoordinadorOTId;
    if (!coordId) {
      await this._appendPendingAction(presupuestoId, {
        type: 'notificar_coordinador_ot',  // reusar type existente
        reason: `Auto — ppto ventas ${pres.numero} aceptado; falta config usuarioCoordinadorOTId`,
      });
    } else {
      const otNumber = await ordenesTrabajoService.getNextOtNumber();
      await ordenesTrabajoService.create({
        otNumber,
        clienteId: pres.clienteId,
        razonSocial: pres.responsableNombre ?? '',  // tomar del ppto si está, o lookup a cliente
        contactoId: pres.contactoId ?? null,
        ingenieroAsignadoId: coordId,
        ingenieroAsignadoNombre: null,  // lookup optional
        fechaServicioAprox: pres.ventasMetadata?.fechaEstimadaEntrega ?? null,
        budgets: [pres.numero],
        estadoAdmin: 'CREADA',
        status: 'BORRADOR',
        leadId: pres.origenTipo === 'lead' ? pres.origenId : null,
        descripcion: `Seguimiento venta equipo — ppto ${pres.numero}. Coordinador arma OTs específicas (bench, entrega, instalación, QI, QO)`,
        // ... otros campos null-safe
      } as any);
      // Back-link: update ppto.otsVinculadasNumbers
      await this.update(presupuestoId, {
        otsVinculadasNumbers: [...(pres.otsVinculadasNumbers ?? []), otNumber],
      } as any);
    }
  } catch (err) {
    console.error('[aceptarConRequerimientos] auto-create OT ventas failed:', err);
    await this._appendPendingAction(presupuestoId, {
      type: 'notificar_coordinador_ot',
      reason: `Auto — ppto ventas ${pres.numero} aceptado; OT auto-create falló: ${String(err)}`,
    }).catch(() => {});
  }
}
```

**Pros opción B:**
- No conflicto con nested tx.
- Fallback via `pendingAction` + retry handler (Phase 8-03 ya trata `notificar_coordinador_ot` como no-op success → necesita extender el handler real para que reintente el create OT).
- Idempotencia: chequear antes del create si ya hay una OT con `budgets.includes(pres.numero)` para no duplicar en caso de retry.

**Cons:**
- Race condition window: si el proceso crashea entre tx-commit y create OT, el ppto queda `aceptado` sin OT. **Mitigado** por pendingAction + retry.

**Recomendación:** opción B (post-commit best-effort con pendingAction fallback), consistente con cómo Phase 8 maneja `derivar_comex` fallido.

#### Dependency: `ordenesTrabajoService.create` signature

- **Shape esperada** (otService.ts:264): `Omit<WorkOrder, 'otNumber'> & { otNumber: string }` — el caller debe pasar `otNumber` explícito.
- El `getNextOtNumber()` es la función canónica para reservar un número atómicamente (otService.ts:43-77).
- Auto-creación de agenda al tener `ingenieroAsignadoId + fechaServicioAprox` (otService.ts:283-288) — puede disparar si pasamos ambos. Aceptable para el caso ventas (el coordinador luego reajusta).

**Blocker posible:** importar `ordenesTrabajoService` en `presupuestosService` introduciría **circular dependency** si otService ya importa presupuestosService (otService.ts:5 lo hace). Solución: **lazy import** dentro de la función (precedente en el codebase: `leadsService → presupuestosService` usa lazy import, ver STATE.md entry "08-03: Lazy import presupuestosService inside leadsService to break circular dependency").

```ts
if (pres.tipo === 'ventas') {
  const { ordenesTrabajoService } = await import('./otService');
  // ... usar
}
```

---

### 4. `solicitudesFacturacion` tx integration into `cerrarAdministrativamente`

**Context:** Phase 8 `otService.cerrarAdministrativamente` (otService.ts:394-523) ya ejecuta una `runTransaction` con 3 writes: update OT → set ticket admin → set mailQueue doc. Phase 10 requiere agregar un 4° write: `set solicitudesFacturacion/{id}`.

#### Current state of `SolicitudFacturacion` (CRITICAL finding)

`SolicitudFacturacion` **ya existe** en `@ags/shared` (types/index.ts:1280-1308) con shape más rica que la propuesta de CONTEXT:

```ts
export interface SolicitudFacturacion {
  id: string;
  presupuestoId: string;
  presupuestoNumero: string;
  clienteId: string;
  clienteNombre: string;
  condicionPago: string;
  items: FacturaItem[];              // ← item-level breakdown (usado por SolicitarFacturaModal)
  montoTotal: number;
  moneda: MonedaPresupuesto;
  estado: SolicitudFacturacionEstado;  // 'pendiente' | 'facturada' | 'cobrada' | 'anulada'
  observaciones?: string | null;
  otNumbers?: string[] | null;
  // Datos de factura emitida
  numeroFactura?: string | null;
  fechaFactura?: string | null;
  tipoComprobante?: string | null;
  puntoVenta?: string | null;
  cae?: string | null;
  fechaVencimientoCae?: string | null;
  fechaCobro?: string | null;
  solicitadoPor?: string | null;
  solicitadoPorNombre?: string | null;
  facturadoPor?: string | null;
  facturadoPorNombre?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Y `facturacionService.ts` **ya existe** (117 líneas) con `getAll/subscribe/getById/getByPresupuesto/create/update/registrarFactura/registrarCobro`.

**Reconciliación con CONTEXT propuesta:**

| CONTEXT proposal | Current shape | Resolution |
|------------------|---------------|-----------|
| `otId: string` | `otNumbers?: string[] \| null` | Usar `otNumbers: [ot.otNumber]` — array permite multi-OT por ppto |
| `ordenesCompraIds: string[]` | ✗ no existe | **Agregar campo nuevo** `ordenesCompraIds?: string[]` |
| `numeroOT: string` | (derivado via `otNumbers[0]`) | No agregar — se deriva |
| `estado: 'pendiente' \| 'enviada' \| 'facturada'` | `'pendiente' \| 'facturada' \| 'cobrada' \| 'anulada'` | **Conflict**: agregar `'enviada'` al union (mail CTA marcado) o reutilizar `'facturada'`. Recomendación: **agregar `'enviada'`** como estado intermedio |
| `enviadaAt?, facturadaAt?, facturadaPor?, nota?` | (parcialmente presente via `fechaFactura`, `facturadoPor`, `observaciones`) | Reutilizar existentes; agregar `enviadaAt?: string \| null` |

**Recomendación:** **extender el type existente** (agregar `ordenesCompraIds?`, `enviadaAt?`, estado `'enviada'`), **NO crear colección paralela**. El shape hoy soporta item-level (manual via SolicitarFacturaModal) y tras extensión soportará full-presupuesto (automático via cerrarAdministrativamente — `items` queda como snapshot completo de los items del ppto).

#### Where to insert in `cerrarAdministrativamente`

- **Pre-reads fuera de tx** (otService.ts:399-435) ya carga todos los presupuestos vinculados y sus OCs. Datos suficientes para poblar `SolicitudFacturacion` están disponibles.
- **Transaction block** (otService.ts:441-511): 3 writes actuales. Agregar **write #4 por cada presupuesto válido**:

```ts
// dentro de runTransaction, después del Write 3 (mailQueue)
for (let i = 0; i < presupuestoIds.length; i++) {
  const pid = presupuestoIds[i];
  const p = presupuestosPorNumero[i];
  if (!p) continue;

  // Idempotencia: si ya hay una solicitud para este ppto+OT, skip
  const solRef = doc(collection(db, 'solicitudesFacturacion'));
  const solPayload = deepCleanForFirestore({
    presupuestoId: pid,
    presupuestoNumero: p.numero,
    clienteId: p.clienteId,
    clienteNombre: ot.razonSocial || '',
    condicionPago: '',  // lookup ocurre afuera o queda empty para rellenar manual
    items: (p.items || []).map(it => ({
      id: crypto.randomUUID(),
      presupuestoItemId: it.id,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      cantidadTotal: it.cantidad,
      precioUnitario: it.precioUnitario,
      subtotal: it.subtotal,
    })),
    montoTotal: p.total,
    moneda: p.moneda,
    estado: 'pendiente',
    otNumbers: [otNumber],
    ordenesCompraIds: p.ordenesCompraIds || [],
    observaciones: `Auto — cierre administrativo de OT ${otNumber}`,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: actor?.uid ?? null,
    solicitadoPor: actor?.uid ?? null,
    solicitadoPorNombre: actor?.name ?? null,
  });
  tx.set(solRef, solPayload);
}
```

#### Idempotencia

El método actual NO tiene idempotencia check (si dos usuarios disparan `cerrarAdministrativamente` simultáneamente, los 3 writes se duplican). Con `solicitudesFacturacion` hay que decidir:

- **Pre-read dentro de tx**: `tx.get(query(solicitudesFacturacion where otNumbers contains otNumber where presupuestoId == pid))` — **BLOCKED**: Firestore runTransaction no permite queries, solo `tx.get(docRef)` con id conocido. No sirve.
- **Pre-read fuera de tx + re-check dentro**: pre-read existing solicitudes via `facturacionService.getByPresupuesto()`. Si encuentra una con `otNumbers.includes(otNumber)`, skip.

**Riesgo real (documentar en el plan):** lockstep con duplicación del ticket admin — el diseño actual *ya permite duplicados* en casos extremos. Phase 10 introduce el mismo riesgo para solicitudesFacturacion. Mitigación: generar ID determinístico `solicitudId = \`${otNumber}_${presupuestoId}\`` y usar `tx.get(docRef(solicitudId))` como idempotency sentinel (semejante a `ot_cierre_idempotency/{otNumber}` de Phase 9-02).

**Recomendación:** ID determinístico + `tx.get` idempotency check. Un write adicional (`tx.get` + conditional `tx.set`) **NO rompe Firestore tx limits** (500 ops por tx, lejos de llenar).

#### Firestore transaction limits

- Firestore: 500 writes per tx, 500 reads per tx, no-nested, reads-before-writes.
- Current tx: 1 read (OT) + 3 writes. Agregar 1 ppto: +1 read (idempotency) +1 write = 2 reads total, 4 writes. Holgado.
- Con N presupuestos vinculados: 1 + N reads + (3 + N) writes. Para N ≤ 10 (caso real: 1-3), sin problema. Para N > 100 (degenerado), hay que chunkear — **no es caso real** en Phase 10.

#### Extension point: mail body update

El mail body actual (otService.ts:15-38, `buildAvisoFacturacionBody`) es plaintext con lista de pptos. Phase 10 lo simplifica a **solo un CTA "Ver en sistema"** que linkea a `/admin/solicitudes-facturacion?solicitudId={id}` (o `/facturacion` si reusamos).

Problema: el `solicitudId` se genera dentro de la tx, pero el mail body se buildea ANTES (otService.ts:434). Solución: generar IDs determinísticos `${otNumber}_${presupuestoId}` pre-tx → incluir en body → persistir dentro de la tx con esos mismos IDs. **Requiere coordinar el id pattern** con el dashboard URL.

---

### 5. Export helper design (Excel + PDF)

**Context:** FMT-04/05/06 piden exports en AMBOS formatos (XLSX + PDF). El user ya tiene `exportVentasInsumosExcel.ts` (90 líneas, usa `xlsx ^0.18.5`) como pattern base.

#### Excel helper — `utils/exportToExcel.ts`

**Existing pattern observations (exportVentasInsumosExcel.ts):**
- Usa `XLSX.utils.aoa_to_sheet` (array of arrays) — simple, sin dependencia de templates.
- Column widths via `ws['!cols']` array.
- Styling por cell (`cell.s = { font, fill, alignment }`) funciona aunque xlsx free version lo ignora en algunos viewers — "best-effort styling".
- Filename pattern: `${slug}_${range-label}_${fecha-hoy}.xlsx`.

**Generic design:**

```ts
// utils/exportToExcel.ts
import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  width?: number;                  // char width (auto if omitted)
  get: (row: T) => string | number | null;
  align?: 'left' | 'center' | 'right';
}

export interface ExportOptions<T> {
  data: T[];
  columns: ExportColumn<T>[];
  sheetName: string;
  filename: string;                 // sin .xlsx
  freezeHeader?: boolean;           // default true
}

export function exportToExcel<T>(opts: ExportOptions<T>): void {
  const { data, columns, sheetName, filename, freezeHeader = true } = opts;

  const headers = columns.map(c => c.header);
  const aoa: (string | number | null)[][] = [headers];
  for (const row of data) {
    aoa.push(columns.map(c => c.get(row)));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? Math.max(10, c.header.length + 2) }));

  // Header bold styling
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0D6E6E' } },  // Editorial Teal aunque CONTEXT dijo "plain"
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }

  // Freeze first row
  if (freezeHeader) {
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
```

**Column types que soporta (heterogeneous data):** cada column define `get(row)` → podés mezclar libremente string, number, null. Fechas se formatean antes via caller. No se meten tipos fancy (Date, RichText) — simple y predecible.

**Caveat CONTEXT:** decisión "sin branding / colores / logo". Si se quiere plain, remover el `fill` header teal. Recomendación: **mantener fill teal header** (consistente con `exportVentasInsumosExcel.ts`) y solo omitir logos/imágenes.

#### PDF helper — `utils/exportToPDF.tsx`

**Existing precedent:** `@react-pdf/renderer` ya usado en `PresupuestoPDFEstandar.tsx` (473 líneas). Tabla + header + totales ya es pattern establecido.

**Generic design:**

```tsx
// utils/exportToPDF.tsx
import { Document, Page, View, Text, pdf } from '@react-pdf/renderer';
import { baseStyles, COLORS } from '../components/presupuestos/pdf/pdfStyles';

export interface ExportPDFColumn<T> {
  header: string;
  width: string | number;  // '20%' or px
  get: (row: T) => string;
  align?: 'left' | 'center' | 'right';
}

export interface ExportPDFOptions<T> {
  data: T[];
  columns: ExportPDFColumn<T>[];
  title: string;
  subtitle?: string;       // eg "Filtros: cliente=X, estado=pendiente"
  filename: string;
  orientation?: 'portrait' | 'landscape';  // default landscape para tablas anchas
}

export async function exportToPDF<T>(opts: ExportPDFOptions<T>): Promise<void> {
  const blob = await pdf(<ExportDocument {...opts} />).toBlob();
  // Browser download via URL.createObjectURL + <a download>
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opts.filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportDocument<T>({ data, columns, title, subtitle, orientation = 'landscape' }: ExportPDFOptions<T>) {
  return (
    <Document title={title}>
      <Page size="A4" orientation={orientation} style={{ padding: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 9, color: '#666', marginBottom: 10 }}>{subtitle}</Text>}
        <Text style={{ fontSize: 8, color: '#999', marginBottom: 10 }}>
          Generado: {new Date().toLocaleString('es-AR')} — {data.length} registro(s)
        </Text>
        {/* Table */}
        <View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: COLORS.primary, paddingVertical: 4 }}>
            {columns.map((c, i) => (
              <Text key={i} style={{ width: c.width, fontSize: 8, fontWeight: 700, textAlign: c.align || 'left' }}>{c.header}</Text>
            ))}
          </View>
          {data.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderColor: '#eee' }}>
              {columns.map((c, j) => (
                <Text key={j} style={{ width: c.width, fontSize: 7, textAlign: c.align || 'left' }}>{c.get(row)}</Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
```

**Filter-aware:** caller pasa el subtitle con los filtros aplicados (e.g. `useUrlFilters` state serialized). Los datos que vienen ya están filtrados por el list page.

**Risk:** `@react-pdf/renderer` necesita fonts registradas (via `pdfFonts.ts`). Si los exports no usan la misma font family, puede crashear o fallback a Helvetica. Mitigación: importar `pdfFonts.ts` como side-effect en `exportToPDF.tsx`.

#### Per-export implementation

Cada export es un wrapper fino que compone los `ExportColumn`/`ExportPDFColumn` específicos:

- **FMT-04 Presupuestos:** `utils/exports/exportPresupuestos.ts` → columnas del CONTEXT.
- **FMT-05 OCs pendientes:** `utils/exports/exportOCsPendientes.ts`. Requiere filtro nuevo en `/presupuestos` (OC cargada pero `estado !== 'recibida'` o similar — definir criterio exacto con planner).
- **FMT-06 Solicitudes facturación:** `utils/exports/exportSolicitudesFacturacion.ts` desde `/facturacion` (o `/admin/solicitudes-facturacion` si se opta por nueva ruta).

Cada uno exporta dos funciones `exportXxxExcel(rows, filters)` + `exportXxxPDF(rows, filters)`. El list page añade 2 botones "Exportar Excel" / "Exportar PDF" en la toolbar, gated por `role ∈ { admin, admin_soporte }`.

---

## Risk surface

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Stock picker no existe para non-contrato** → FLOW-03 ATP silent-fail para partes/mixto/ventas | HIGH | Add panel in AddItemModal (Challenge 1). Verification test: crear ppto partes con artículo sin stock → aceptar → chequear que se creó requerimiento condicional |
| **`SolicitudFacturacion` shape overlap** — nueva flow vs existente `SolicitarFacturaModal` | MEDIUM | Extender tipo (no crear colección paralela). Decision log en type JSDoc: "creación automática from cerrarAdministrativamente vs manual from SolicitarFacturaModal — ambos flujos legítimos, se diferencian por `createdBy` y `observaciones` prefix" |
| **`/admin/solicitudes-facturacion` vs `/facturacion` overlap** | MEDIUM | Planner debe decidir: extender `/facturacion` existente (preferred) o crear `/admin/solicitudes-facturacion` como view filtered sobre la misma colección |
| **Nested runTransaction prohibido** — auto-OT desde aceptar ppto ventas | HIGH | Usar post-commit + pendingAction fallback (Opción B Challenge 3) |
| **Circular dependency** presupuestosService ↔ otService | MEDIUM | Lazy import (precedente Phase 8-03) |
| **Duplicado solicitudesFacturacion** bajo race | MEDIUM | ID determinístico `${otNumber}_${presupuestoId}` + `tx.get` idempotency check |
| **Mail body contiene solicitudId pre-tx** — coordinar pre-generación de IDs | LOW | IDs determinísticos resuelven ambos problemas (idempotency + deep link) |
| **xlsx styling ignorado por viewers free** | LOW | Best-effort; documented caveat |
| **@react-pdf/renderer fonts no registradas** | LOW | Side-effect import `pdfFonts.ts` en exportToPDF |
| **Firestore rules block `ventasMetadata` field** | LOW | Verify rules pre-Wave 1 (falsifiable con un write test) |
| **250-line component budget** AddItemModal (171 hoy) | MEDIUM | El nuevo article picker subrepticiamente crecerá. Extraer `ArticuloPickerPanel.tsx` subcomponente antes de agregar |
| **StockAmplio subscripciones leak** si se renderea por cada row | MEDIUM | Solo en el item *en creación* del AddItemModal, no en la tabla |
| **Phase 9-02 `onOTCerrada` observational-only** podría overlap con nuevo flow | LOW | Phase 9-02 notes: "writes sentinel, no mail send; mailQueue consumer deferred — pendingActions[] retry path remains authoritative". Phase 10 extiende pendingActions[] path; no conflicto |

---

## Validation Architecture [MANDATORY — Nyquist Dimension 8]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `^1.59.1` (config: `playwright.config.ts` — project "chromium") |
| Config file | `apps/sistema-modular/playwright.config.ts` |
| Quick run command | `pnpm --filter sistema-modular e2e` |
| Full suite command | `pnpm --filter sistema-modular e2e:full` (incluye generate-report) |
| Emulador Firestore | TEST-01 en Phase 11 (aún NO en v2.0); Phase 10 specs corren contra prod-like session persistente |
| Test data prefix | `TEST_PREFIX` via `fixtures/test-base.ts` |
| Firestore assertion helpers | `e2e/helpers/firestore-assert.ts` (Phase 8 incluyó `getMailQueueDocs`, `pollUntil`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PTYP-02 | Crear ppto partes, agregar artículo de stock, aceptar → FLOW-03 crea requerimiento condicional | E2E | `pnpm --filter sistema-modular e2e -- circuits/03-presupuestos.spec.ts -g "3.5"` (nueva) | ❌ Wave 0 — extender 03-presupuestos.spec.ts |
| PTYP-02 | ATP breakdown visible al seleccionar artículo en AddItemModal | Manual-only | — (xDOM assertion + captura pantalla) | Manual — tooltip + snapshot visual no se prestan a E2E robusto |
| PTYP-03 | Crear ppto mixto (servicios + partes mezclados), generar PDF, verificar dos secciones en render | E2E (smoke) + Manual (visual PDF check) | Smoke: `... -g "3.6"`. PDF render: manual | ❌ Wave 0 + Manual |
| PTYP-04 | Crear ppto ventas, completar ventasMetadata, aceptar → 1 OT auto-creada con `budgets.includes(pres.numero)` | E2E | `pnpm --filter sistema-modular e2e -- circuits/03-presupuestos.spec.ts -g "3.7"` (nueva) | ❌ Wave 0 |
| PTYP-04 | Campo `ventasMetadata` persistido correctamente en Firestore | E2E | extensión del anterior + assertion `expect(pres.ventasMetadata?.fechaEstimadaEntrega).toBe(...)` | ❌ Wave 0 — requiere helper `getPresupuesto(id)` nuevo en `firestore-assert.ts` |
| FMT-03 | `cerrarAdministrativamente` persiste doc en `solicitudesFacturacion` con shape válido | E2E | extender `11-full-business-cycle.spec.ts:11.13b` con assertion `getSolicitudesFacturacion({ otNumbers: [otNumber] }).length >= 1` | ❌ Wave 0 — agregar helper en firestore-assert.ts + extender test existente |
| FMT-03 | Mail body contiene link al dashboard (no adjuntos) | E2E | extension del anterior — assert `body.includes('/facturacion?solicitudId=')` | ❌ Wave 0 |
| FMT-03 | Idempotencia: dispatch doble de `cerrarAdministrativamente` no crea solicitudes duplicadas | E2E | test nuevo | ❌ Wave 0 — race-condition test |
| FMT-04 | Botón "Exportar Excel" visible en `/presupuestos` para admin; descarga archivo .xlsx | E2E (visible assertion) | `... -g "3.8"` (nueva) | ❌ Wave 0. Descarga real: smoke check con Playwright `waitForEvent('download')` |
| FMT-04 | Botón NO visible para role no-admin | E2E (RBAC) | `... -g "3.9"` | ❌ Wave 0 |
| FMT-05 | Export OCs pendientes respeta filtros de list page | E2E + unit | Unit test del helper `exportOCsPendientes`: mockear data → verificar columnas esperadas | ❌ Wave 0. **Vitest not set up** — usar `__tests__` pattern si se adopta; si no, E2E only |
| FMT-06 | Dashboard `/facturacion` (o `/admin/solicitudes-facturacion`) accesible + muestra doc auto-creado | E2E | extender `07-facturacion.spec.ts` (actualmente 33 líneas, ligero) | ❌ Wave 0 — extender 07 |
| FMT-06 | "Marcar enviada" action (row-level) cambia estado a `'enviada'` | E2E | nuevo test | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter sistema-modular type-check` (pnpm root) + smoke `e2e -- circuits/03-presupuestos.spec.ts` (2-5 min)
- **Per wave merge:** full `03-presupuestos.spec.ts` + `07-facturacion.spec.ts` + `11-full-business-cycle.spec.ts` (~10-15 min)
- **Phase gate:** full suite `e2e:full` + generate-report verde antes de `/gsd:verify-work`
- **Manual check:** PDF renders (mixto 2 sections, ventas bloque instalación) via download + visual inspect

### Wave 0 Gaps

- [ ] `e2e/helpers/firestore-assert.ts` — agregar `getSolicitudesFacturacion({ otNumbers?, presupuestoId?, estado? })` — Wave 0 pre-Phase 1
- [ ] `e2e/helpers/firestore-assert.ts` — agregar `getPresupuesto(id)` + `getOTsByBudget(budgetNumber)` si no existen — Wave 0
- [ ] `e2e/circuits/03-presupuestos.spec.ts` (actualmente 72 líneas, solo 4 tests) — extender con:
  - 3.5 Partes + article picker + ATP + aceptar → requerimiento condicional
  - 3.6 Mixto smoke
  - 3.7 Ventas + ventasMetadata + auto-OT assertion
  - 3.8 Export buttons visible para admin
  - 3.9 Export buttons hidden para non-admin
- [ ] `e2e/circuits/07-facturacion.spec.ts` (33 líneas, ligero) — extender con dashboard auto-doc + estado 'enviada'
- [ ] `e2e/circuits/11-full-business-cycle.spec.ts:11.13b` — extender para assert `solicitudesFacturacion` creado en la misma tx
- [ ] Test de idempotencia `solicitudesFacturacion` (race-like, dos dispatches rápidos)
- [ ] No framework install requerido — Playwright `^1.59.1` + tsx ya instalados

---

## Reusable helpers & patterns

### Direct reuse (no change)

- **`EditPresupuestoModal.tsx`** con dispatcher por tipo (línea 221) — infraestructura reusable para los 4 tipos non-contrato
- **`PresupuestoItemsTable.tsx`** flat con agrupación por sistema — reuse para partes/mixto/ventas
- **`PresupuestoMetadataStrip`, `PresupuestoHeaderBar`, `PresupuestoOTsVinculadas`, `PresupuestoRevisionHistory`** — agnósticos al tipo, full reuse
- **`EnviarPresupuestoModal` + `useEnviarPresupuesto`** — Phase 7 token-first + R3/R4, sin cambios
- **`CargarOCModal`** — Phase 8, N:M OC upload, sin cambios
- **`facturacionService.ts`** — CRUD completo de solicitudesFacturacion, solo extender con filtros + acciones nuevas ("marcar enviada" — agregar método)
- **`FacturacionList.tsx`** — ya usa `useUrlFilters` + `subscribe`, el dashboard nuevo se construye **extendiendo** esta lista con botones export + acciones row-level nuevas (o se clona a `/admin/solicitudes-facturacion` con RBAC gate distinto)
- **`useStockAmplio` hook + `StockAmplioIndicator`** — wire-up limpio dentro de `AddItemModal` (un solo item en creación → sin leak)
- **`exportVentasInsumosExcel.ts`** — template mental para `utils/exportToExcel.ts` genérico
- **`PresupuestoPDFEstandar.tsx` + `pdfStyles.ts` + `pdfFonts.ts`** — `@react-pdf/renderer` infrastructure para `utils/exportToPDF.tsx`
- **`atpHelpers.ts`** (`itemRequiresImportacion`) — usar en nuevo article picker para setear `itemRequiereImportacion` al seleccionar artículo
- **`adminConfigService.getWithDefaults()`** — lee `usuarioCoordinadorOTId` + `mailFacturacion` con fallbacks. Patrón ya usado en `cerrarAdministrativamente`
- **`runTransaction` pattern de Phase 8** (reads-first, no nested tx, inline `tx.set`/`tx.update`) — literal extension del método existente
- **`deepCleanForFirestore`** — obligatorio en todos los writes nuevos
- **`_appendPendingAction`** (Phase 8-03) + retry handlers — mecanismo de fallback para auto-OT ventas
- **`ordenesTrabajoService.getNextOtNumber() + .create()`** — patrón establecido de counter-doc
- **`useUrlFilters`** schema-based `(schema) => [filters, setFilter, setFilters, resetFilters]` — ya usado en FacturacionList, PresupuestosList

### Patterns to reuse verbatim

- **Lazy import para circular deps:** `const { ordenesTrabajoService } = await import('./otService')` dentro de presupuestosService (Phase 8-03 precedent)
- **Counter + pre-reserve para runTransaction:** pattern de `aceptarConRequerimientos` (numerosReservados[] fuera de tx, luego writes con los IDs pre-computados) — aplicable a auto-OT ventas si se quisiera in-tx (aunque recomendamos post-commit)
- **ID determinístico para idempotency:** Phase 9-02 `ot_cierre_idempotency/{otNumber}` sentinel. Aplicar a `solicitudesFacturacion/{otNumber}_{presupuestoId}`
- **Post-commit best-effort + pendingAction fallback:** pattern Phase 8 para side effects que no caben en tx (retry observado en Phase 8-03)
- **`batchAudit(batch, { action, collection, documentId, after })`** — cada write nuevo necesita esto para el trail

### What to build new (small surface)

- `utils/exportToExcel.ts` — genérico, ~80 líneas
- `utils/exportToPDF.tsx` — genérico, ~120 líneas
- `utils/exports/exportPresupuestos.ts` / `exportOCsPendientes.ts` / `exportSolicitudesFacturacion.ts` — wrappers con columnas específicas, ~40 líneas cada uno
- `components/presupuestos/ArticuloPickerPanel.tsx` — panel para seleccionar artículo en AddItemModal, ~120 líneas
- `components/presupuestos/VentasMetadataSection.tsx` — 3-field form, ~80 líneas
- `VentasMetadata` type + `ventasMetadata` field en `Presupuesto` — `@ags/shared` extension
- Extensión de `SolicitudFacturacion` (agregar `ordenesCompraIds?`, `enviadaAt?`, estado `'enviada'`) — `@ags/shared` extension
- `facturacionService.marcarEnviada(id, uid)` — nuevo método para la acción row-level

---

## References (paths + line numbers)

### Files read (HIGH confidence)

| File | Lines | Purpose |
|------|-------|---------|
| `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` | 1-463 | Dispatcher por tipo + flow actions wiring |
| `apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx` | 1-234 | Tabla flat con agrupación, reusable 4 tipos |
| `apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx` | 1-171 | Modal sin article picker para non-contrato (**gap**) |
| `apps/sistema-modular/src/components/presupuestos/PresupuestoItemRow.tsx` | 1-62 | Row sin stock field |
| `apps/sistema-modular/src/components/presupuestos/SolicitarFacturaModal.tsx` | 1-207 | Existing item-level facturación flow |
| `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` | 1-473 | PDF template con ya-branching por `hasGrupos`, extender con branching por `tipo` |
| `apps/sistema-modular/src/services/presupuestosService.ts` | 270-353, 785-949 | `update` branching FLOW-03 + `aceptarConRequerimientos` + `_cancelarRequerimientosCondicionales` |
| `apps/sistema-modular/src/services/otService.ts` | 1-90, 260-370, 394-565 | `getNextOtNumber`, `create`, `cerrarAdministrativamente`, `enviarAvisoCierreAdmin` (deprecated) |
| `apps/sistema-modular/src/services/facturacionService.ts` | 1-117 | CRUD completo listo para reuse |
| `apps/sistema-modular/src/pages/facturacion/FacturacionList.tsx` | 1-80 | Dashboard ya existe con useUrlFilters + subscribe |
| `apps/sistema-modular/src/hooks/useStockAmplio.ts` | 1-72 | Hook reactivo dual-source |
| `apps/sistema-modular/src/components/stock/StockAmplioIndicator.tsx` | 1-84 | Indicador 4-bucket |
| `apps/sistema-modular/src/utils/exportVentasInsumosExcel.ts` | 1-90 | Pattern base para exportToExcel genérico |
| `packages/shared/src/types/index.ts` | 756-768 (TipoPresupuesto), 798-825 (PresupuestoEstado), 912-927 (PendingAction), 950-963 (AdminConfigFlujos), 1129-1201 (Presupuesto), 1252-1308 (SolicitudFacturacion) | Shared types |
| `apps/sistema-modular/e2e/circuits/03-presupuestos.spec.ts` | 1-72 | 4 tests smoke — necesita extensión grande |
| `apps/sistema-modular/e2e/circuits/07-facturacion.spec.ts` | 1-33 | 3 tests smoke — necesita extensión |
| `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` | 382-413 | Assertion de mailQueue ya existe; agregar solicitudesFacturacion assertion |

### STATE.md accumulated context (MEDIUM-HIGH confidence)

- Phase 8-03: lazy import pattern para circular deps
- Phase 8-04: `aceptarConRequerimientos` pre-reserva IDs fuera de tx + `handlePickArticulo` solo en `PresupuestoItemsTableContrato`
- Phase 9-02: ID determinístico sentinel (`ot_cierre_idempotency/{otNumber}`) + `mailQueue` consumer diferido

## Metadata

**Confidence breakdown:**
- Integration challenges 1-5: HIGH — todos los hallazgos verificados en código directamente
- Shape de `ventasMetadata`: HIGH — precedente claro con `contratoFechaInicio/Fin` y `cantidadCuotasPorMoneda`
- Decisión de extender `SolicitudFacturacion` vs crear colección nueva: MEDIUM — depende de política final del planner
- Decisión de `/facturacion` vs `/admin/solicitudes-facturacion`: MEDIUM — user elegirá
- Validation architecture: HIGH — specs existentes leídos, extensiones claras

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable infrastructure; risk de invalidación baja)

## RESEARCH COMPLETE

**Summary:** Phase 10 es integrativa por naturaleza — 5 integration points claros, cada uno con reuso >> rebuild. Tres findings que contradicen el CONTEXT y que el planner debe internalizar antes de crear plans:

1. **`SolicitudFacturacion` y `facturacionService` ya existen** con una shape más rica que CONTEXT propone — extender, no crear paralelo. `/facturacion` ya es un dashboard completo.
2. **Editor flat non-contrato NO tiene article picker** — es un gap funcional (FLOW-03 nunca dispara para partes/mixto/ventas hoy). Requiere parche en `AddItemModal` con `ArticuloPickerPanel` nuevo.
3. **Auto-OT ventas debe ir post-commit** (no dentro de la tx de `aceptarConRequerimientos`) para evitar nested runTransaction. Pattern: `_appendPendingAction` fallback si falla.

Los challenges 2 (ventasMetadata) y 5 (export helpers) son directos, bajo riesgo, con patrones existentes reusables (`contratoFechaInicio` / `exportVentasInsumosExcel.ts`).

**Confidence:** HIGH para todos los findings estructurales. Decisiones de UX / pathing (dashboard existente vs nuevo, shape de estados) marcadas para el planner.
