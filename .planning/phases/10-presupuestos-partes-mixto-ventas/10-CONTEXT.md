# Phase 10: Presupuestos Partes/Mixto/Ventas + Aviso Facturación + Exports - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Cierra el circuito comercial: los 3 tipos de presupuesto restantes (`partes`, `mixto`, `ventas`) quedan operativos con PDF, mail y side-effects específicos; el aviso de facturación llega al contable con doc auditable en colección dedicada + dashboard admin; los 3 listados operativos (presupuestos, OCs pendientes, solicitudes facturación) se pueden exportar a Excel **y PDF**.

Fuera de scope:
- Editor UI para partes/mixto/ventas — **YA EXISTE** en el codebase (confirmado por user); Phase 10 audita + polishea donde haga falta, no rebuilds
- Motor de precios automáticos (Phase 6 diferido)
- mailQueue consumer Cloud Function (diferido post-v2.0)
- Rol `admin_contable` formal (pendiente del RBAC tracking, no bloquea Phase 10 — se usa `admin + admin_soporte` para RBAC del dashboard y exports)
- Integración real con Bejerman (out-of-scope del milestone)
- Auto-crear las 5 OTs específicas del flujo de ventas (se crea 1 OT de seguimiento; coordinador arma el resto a mano)

</domain>

<decisions>
## Implementation Decisions

### Prior decisions carrying forward

- **`TipoPresupuesto` enum completo:** `'servicio' | 'partes' | 'ventas' | 'contrato' | 'mixto'` ya en `@ags/shared`. Phase 10 no agrega tipos nuevos.
- **`PresupuestoItemsTable` flat reusable** para los 4 tipos non-contrato. Branch condicional por tipo en `EditPresupuestoModal` ya existe (Phase 7).
- **`PresupuestoPDFEstandar` + `EnviarPresupuestoModal` + `useEnviarPresupuesto`** con token-first order + guardas R3/R4 — reuso directo desde Phase 7.
- **`cargarOC` modal + `ordenesCompraCliente` N:M** — reuso desde Phase 8 para cualquier tipo.
- **`aceptarConRequerimientos` + `_cancelarRequerimientosCondicionales`** (Phase 8) ya genera requerimientos condicionales automáticos al aceptar — aplica a partes/mixto/ventas sin cambios.
- **`StockAmplioIndicator` + `useStockAmplio`** (Phase 9) — listo para wire-up en `AddItemModal` del editor para mostrar ATP inline al agregar artículos.
- **`cerrarAdministrativamente` + `mailQueue` enqueue + `onOTCerrada` safety-net** (Phase 8+9) — reuso para aviso facturación, agregando contenido nuevo.
- **Precios 100% manuales**, **no snapshot técnico**, **validity del PDF es el contrato**.
- **Mail contable default `mbarrios@agsanalitica.com`**, configurable en `/admin/config-flujos` (Phase 8). **1 destinatario**.
- **xlsx library ya instalada** (`^0.18.5`) + `exportVentasInsumosExcel.ts` pattern reusable.
- **`facturacionService.ts` ya existe** — Phase 10 lo extiende (no rebuild).

### Partes + Ventas — diferencias vs `'servicio'` (scope real)

**Revelación clave (confirmada por user):** los tipos no distinguen por item-type. Un presupuesto `partes`, `mixto` o `ventas` usa el mismo editor flat, y cada línea del ppto puede ser servicio (`ConceptoServicio`) o artículo (stock) — decisión por-línea via dropdown. El `tipo` del presupuesto es un **label semántico** que drivea side-effects downstream y adaptaciones del PDF.

- **`partes`:** convención = todas las líneas apuntan a `stockArticuloId`. FLOW-03 de Phase 8 ya crea requerimientos condicionales automáticos via `aceptarConRequerimientos` si hay artículos sin stock disponible. **Sin cambio en el flow de acceptance** — reusa lo de Phase 8.

- **`ventas`:** convención = líneas apuntan a artículos tipo equipo.
  - **Trigger al `aceptado`:** auto-crea **1 OT genérica de seguimiento** asignada al `usuarioCoordinadorOTId` (de `/admin/config-flujos` Phase 8). El coordinador arma manualmente las 5 OTs específicas del flujo del equipo (bench → entrega → instalación → calif. instalación → calif. operación) a partir de esa OT root. Diseño elegido por user: máxima flexibilidad sin over-automation.
  - **Campos extra obligatorios:** `fechaEstimadaEntrega` + `lugarInstalacion` + `requiereEntrenamiento: boolean`, almacenados en `Presupuesto.ventasMetadata` (nueva shape opcional).
  - **UI:** sección dedicada **"Datos de entrega e instalación"** en el editor, visible solo si `tipo === 'ventas'`, entre el metadata strip y los items.
  - **PDF:** incluye el bloque `ventasMetadata` en una sección propia para el cliente.

- **`mixto`:** convención = combina servicios + artículos libremente. Editor igual que otros; PDF diferente (ver abajo).

### Mixto + Partes + Ventas en PDF

Una sola entrada en el dispatcher: `PresupuestoPDFEstandar` con branching interno por `tipo`:

- **`mixto`:** **2 secciones con headers + subtotales** — "Servicios" (todas las líneas con `conceptoServicioId`) y "Partes" (todas las líneas con `stockArticuloId`). Subtotal por sección + total general al final.
- **`partes`:** reusa la estructura mixto pero **oculta la sección Servicios si está vacía** (hide-if-empty).
- **`ventas`:** bloque "Datos de entrega e instalación" con `fechaEstimadaEntrega`, `lugarInstalacion`, `requiereEntrenamiento` antes del detalle de items.
- **`servicio`:** sin cambios (ya pulido en Phase 7).

Template único = un solo lugar para fixes futuros. Editor puede seguir renderizando como ya está (tabla única con toggle de tipo por línea) aunque el PDF los agrupe visualmente — el agrupamiento es presentacional para el cliente.

### Aviso Facturación (FMT-03)

**Colección nueva:** `solicitudesFacturacion` con shape mínimo:
```ts
interface SolicitudFacturacion {
  id: string;
  otId: string;
  presupuestoId: string;
  clienteId: string;
  numeroOT: string;
  numeroPresupuesto: string;
  ordenesCompraIds: string[];  // back-refs
  montoTotal: number;
  moneda: string;              // 'ARS' | 'USD' | 'MIXTA'
  estado: 'pendiente' | 'enviada' | 'facturada';
  createdAt: Timestamp;
  createdBy: string;
  enviadaAt?: Timestamp;       // cuando el mail se marcó como enviado
  facturadaAt?: Timestamp;     // cuando el contable marca facturada
  facturadaPor?: string;
  nota?: string;               // notas del contable
}
```

Se crea en la misma `runTransaction` de `cerrarAdministrativamente` (Phase 8) — extender el método existente para que también persista esta solicitud (idempotente por `otId`).

**Dashboard:** `/admin/solicitudes-facturacion` — nueva página con filtros `useUrlFilters`:
- Filtros: `estado | cliente | rangoFechaDesde | rangoFechaHasta`
- Columnas: OT # | Presupuesto # | Cliente | Total | Fecha | Estado | Acciones
- Acciones por fila: ver detalle (link al ppto), marcar "enviada", marcar "facturada" + agregar nota
- RBAC: `admin + admin_soporte` (consistente con otros admin dashboards)

**Mail al contable (minimal):**
- Via `mailQueue` enqueue (consistente con Phase 8/9 — consumer sigue diferido; retry manual en `/admin/acciones-pendientes`).
- Template: **solo link al dashboard**, sin adjuntos pesados. Subject `"Aviso facturación — OT {numero}"`. Body HTML con un CTA "Ver en sistema" que linkea a `/admin/solicitudes-facturacion?solicitudId=xxx` (deep link).
- Rationale: los adjuntos ya quedan accesibles desde el dashboard; el mail es solo una notificación.

**`enviarAvisoCierreAdmin` legacy:** queda marcado `@deprecated` (no eliminar — backward compat). El nuevo flow es `cerrarAdministrativamente` → `solicitudesFacturacion` → `mailQueue enqueue`.

### Excel + PDF Exports (FMT-04/05/06)

**Scope expandido:** user eligió que los 3 exports tengan AMBOS formatos: XLSX y PDF.

- **FMT-04** Presupuestos — desde `/presupuestos` list page
- **FMT-05** OCs pendientes — desde `/presupuestos` o nueva sub-página filtrando OCs sin recibir
- **FMT-06** Solicitudes facturación — desde `/admin/solicitudes-facturacion`

**Pattern técnico:**
- **Excel:** helper `exportToExcel.ts` genérico (extensión del pattern de `exportVentasInsumosExcel.ts`). Firma: `exportToExcel({ data, columns, sheetName, filename })`. Genera xlsx plain con:
  - Headers bold
  - Auto-width de columnas
  - Primera fila congelada
  - Sin branding / colores / logo
- **PDF:** helper `exportToPDF.ts` o reusar `@react-pdf/renderer` con template simple — tabla + header con fecha + totales. Branding mínimo (no full Editorial Teal). Útil para enviar resumenes oficiales (ej. OCs pendientes que el cliente pide como doc).

**Filter-aware:** los exports toman los `useUrlFilters` actuales de la list page. Si el user filtró por `cliente=X`, el export tiene solo esos. Botón "Exportar Excel" + "Exportar PDF" en la toolbar de cada list page, visible solo para roles permitidos.

**RBAC:** `admin + admin_soporte` — consistente con resto del sistema.

**Columnas (cada export):**

- **FMT-04 Presupuestos:** Número | Cliente | Tipo | Estado | Total | Moneda | Vendedor | Creado | Enviado | Validez | OC vinculada | Próximo contacto
- **FMT-05 OCs pendientes:** Número OC | Cliente | Presupuesto(s) | Fecha OC | Estado ppto | Adjuntos | Días desde carga | Coordinador asignado
- **FMT-06 Solicitudes facturación:** Número OT | Ppto | Cliente | Total | Moneda | Fecha cierre admin | Estado | Facturada por | Fecha facturación | Nota

### Claude's Discretion

- Naming exacto de campos en `ventasMetadata` (`fechaEstimadaEntrega` vs `fechaEntrega`, etc)
- Layout exacto del bloque "Datos de entrega e instalación" en editor y PDF
- Cómo se computa `montoTotal` en `solicitudesFacturacion` cuando hay multi-moneda (MIXTA) — probablemente mostrar cada moneda separadamente
- Diseño visual del dashboard `/admin/solicitudes-facturacion` (cards vs tabla densa)
- Formato del deep link en el mail (query param vs segment)
- Template visual del PDF de exports (tabla con bordes vs alternada vs sin bordes)
- Nombre del archivo exportado (ej. `ocs-pendientes_2026-04-22.xlsx`)

</decisions>

<specifics>
## Specific Ideas

- El user confirmó que **el editor para todos los tipos non-contrato ya existe** en el codebase. Phase 10 en términos de editor es audit + fixes donde falle (similar a Phase 7 para `'servicio'`), no build-from-scratch.
- El flujo de ventas con 5 OTs encadenadas es una particularidad del negocio: una sola OT de seguimiento + coordinador arma las específicas. No sobre-automatizar.
- Los exports son data operativa pura (reconciliación con Bejerman, cruce interno). Plain es deliberado — no es doc para cliente.
- El mail aviso facturación "solo link" asume que el contable es interno con acceso admin. Si en el futuro se abre a contadores externos, hay que revisar.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`EditPresupuestoModal.tsx`** con branching por tipo — reusa para partes/mixto/ventas (audit, no rebuild)
- **`PresupuestoItemsTable.tsx`** flat — reusa; AddItemModal ya maneja dropdown servicio vs artículo
- **`AddItemModal.tsx`** — consumer natural del `StockAmplioIndicator` de Phase 9 (wire-up nuevo)
- **`PresupuestoPDFEstandar.tsx`** — extender con branching interno por tipo (mixto → 2 sections, ventas → bloque datos instalación)
- **`EnviarPresupuestoModal.tsx`** + **`useEnviarPresupuesto.ts`** — Phase 7 token-first + R3/R4 guardas; reuso sin cambios
- **`cerrarAdministrativamente`** (Phase 8) — extender tx para también crear doc en `solicitudesFacturacion`
- **`mailQueue`** pattern enqueue (Phase 8) — reuso con nuevo template
- **`onOTCerrada` safety-net** (Phase 9) — ya observa los cierres OT; puede crear `solicitudesFacturacion` fallback si el client-side falla
- **`useUrlFilters`** — obligatorio para filtros del dashboard + para que exports sean filter-aware
- **`xlsx ^0.18.5`** ya instalado; **`exportVentasInsumosExcel.ts`** pattern base para helper genérico
- **`@react-pdf/renderer`** ya usado en `PresupuestoPDFEstandar` — reusable para templates de exports PDF
- **`facturacionService.ts`** — extender para CRUD de `solicitudesFacturacion`
- **`otService.cerrarAdministrativamente`** (Phase 9) — hook point para crear `solicitudFacturacion` en la misma tx

### Established Patterns

- **Servicios Firestore por colección** — agregar `solicitudesFacturacionService.ts` (o extender `facturacionService.ts`)
- **`TabContentManager.tsx`** para registrar rutas nuevas
- **250-line budget** en componentes React
- **RBAC admin** gating consistente con `/admin/*` existente
- **`runTransaction` patterns** de Phase 8 (reads-first, no arrayUnion, no nested tx)
- **`deepCleanForFirestore`** obligatorio en writes

### Integration Points

- **`AddItemModal.tsx`** — wire-up de `StockAmplioIndicator` + `useStockAmplio` hook cuando se selecciona artículo (cierre de loop con Phase 9)
- **`PresupuestoItem` type** — agregar campo opcional `ventasMetadata?` en `Presupuesto` (no en item) con shape `{ fechaEstimadaEntrega, lugarInstalacion, requiereEntrenamiento }`
- **`otService.cerrarAdministrativamente`** — extender tx para persistir `solicitudesFacturacion/{id}` junto con el ticket admin existente
- **Ppto ventas `aceptar`** — extender `aceptarConRequerimientos` para que también cree 1 OT genérica de seguimiento cuando `tipo === 'ventas'`, asignada al `usuarioCoordinadorOTId`
- **Sidebar nav** — agregar `/admin/solicitudes-facturacion` bajo Admin
- **List pages** — agregar botones Export Excel/PDF en `/presupuestos`, `/admin/solicitudes-facturacion`, y posiblemente un filtro OCs pendientes en `/presupuestos`

</code_context>

<deferred>
## Deferred Ideas

- **Rol `admin_contable` formal** — MEMORY.md marca "Pending"; por ahora Phase 10 usa `admin + admin_soporte`. Cuando se formalice el rol, se puede migrar el gating.
- **Auto-crear las 5 OTs del flujo de ventas** — descartado para v2.0 (decisión: solo 1 OT de seguimiento, coordinador arma el resto)
- **Templates de rich-text para condiciones comerciales** — Phase 3 diferido de v1.0
- **Integración real con Bejerman** (emisión fiscal) — out-of-scope milestone explícito
- **Adjuntos en el mail aviso facturación** — descartado; link al dashboard es suficiente. Si un contable externo pidiera mail con adjuntos, se revisita.
- **Multi-destinatario en mail facturación** (CC)  — post-v2.0
- **Branding teal en exports** — descartado por ahora; plain xlsx/PDF son suficientes para reconciliación
- **Modal "opciones de export"** (todo vs filtros vs rango) — Claude's Discretion; por default usa filtros actuales
- **mailQueue consumer Cloud Function** — sigue diferido post-v2.0 (ya notado en Phase 8/9)
- **Pivot-ready Excel exports** con múltiples sheets — post-v2.0

</deferred>

---

*Phase: 10-presupuestos-partes-mixto-ventas*
*Context gathered: 2026-04-22 via /gsd:discuss-phase 10 — 4 areas discutidas + 2 clarifiers*
