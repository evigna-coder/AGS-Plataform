# Requirements: Circuito Comercial Completo v2.0

**Defined:** 2026-04-19
**Core Value:** Cerrar end-to-end el ciclo comercial desde la consulta inicial hasta el aviso de facturación — con trazabilidad, estados automáticos y sin datos que se pierdan entre áreas.

## v2.0 Requirements

### Pre-conditions — Data + Infra

- [x] **PREC-01**: Migración batch de tickets con `clienteId: null` — intenta resolver por razón social exacta; los no resueltos quedan marcados para revisión manual.
- [x] **PREC-02**: Migración batch de tickets con `contacto/email/telefono` planos → array estructurado `contactos[]` con principal marcado.
- [ ] **PREC-03**: Bootstrap del workspace `functions/` en el monorepo con una primera Cloud Function de ejemplo (base para resumenStock posterior).
- [x] **PREC-04**: Colección `featureFlags` en Firestore + UI admin para togglear módulos sin rebuild (extiende VITE_DESKTOP_MVP con flags remotos).

### Anexo de Consumibles por Módulo

- [x] **ANXC-01**: Tipos foundation en `@ags/shared`: flag opcional `requiereAnexoConsumibles?: boolean` en `TipoEquipoServicio` + interfaces `ConsumibleModulo` y `ConsumiblesPorModulo` (doc shape de la colección Firestore `consumibles_por_modulo`).
- [ ] **ANXC-02**: `consumiblesPorModuloService.ts` — CRUD Firestore para la colección `consumibles_por_modulo` con cleanFirestoreData, audit fields nullables y validación de unicidad por `codigoModulo`.
- [ ] **ANXC-03**: Página admin `/presupuestos/consumibles-por-modulo` con CRUD UI (lista, modal de creación/edición, eliminación lógica via `activo: false`) + entry point en toolbar de Presupuestos.
- [x] **ANXC-04**: Editor de plantillas tipo de equipo: columna "Anexo" en ServiciosEditor (checkbox por servicio) + persistencia en `tiposEquipoService.update()` (lee `requiereAnexoConsumibles ?? false`).
- [ ] **ANXC-05**: `AnexoConsumiblesPDF` (template Editorial Teal liviano) + `buildAnexosFromPresupuesto()` (matcheo híbrido módulos reales del cliente → plantilla de tipo de equipo, con warnings de módulos sin entrada en catálogo).
- [ ] **ANXC-06**: Integración mail: `useEnviarPresupuesto` extendido + `EnviarAnexosSection` en `EnviarPresupuestoModal` para adjuntar N PDFs anexos (uno por módulo) al email — con smoke E2E checkpoint.

### Catálogo de Servicios y Precios

- [ ] **CSVC-01**: CRUD completo de servicios con categorías, precio base, flags (`requiereImportacion`, `generaOT`, etc.) y UI admin.
- [ ] **CSVC-02**: CRUD completo de categorías de servicios desde UI.
- [ ] **CSVC-03**: Collection global `zonasGeograficas` (AMBA / Interior BA / Interior país) con tarifa por zona. Asignar zona al establecimiento desde UI.
- [ ] **CSVC-04**: Override de precio por servicio sobre tarifa de zona (flag `sobrescribeZona` + tarifa propia).
- [ ] **CSVC-05**: Precios preferenciales por contrato — cliente con contrato tiene tabla de precios distinta. Override por servicio.

### Pricing Discipline

- [ ] **PRIC-01**: Snapshot de precio al transicionar a estado `oc_recibida` — guarda `precioUnitarioSnapshot` en cada ítem del presupuesto. Antes de OC los precios pueden recalcularse (útil para negociaciones). Al recibirse la OC, los precios quedan congelados y nunca se recalculan retroactivamente.
- [ ] **PRIC-02**: Recálculo automático mientras está en borrador o `enviado` (antes de OC) — cambios en catálogo/zona/contrato actualizan items del presupuesto solo si no están manualmente editados.
- [ ] **PRIC-03**: Override manual de precio — usuario puede editar precio, flag `precioManual: boolean` lo marca; tiene prioridad sobre reglas automáticas.
- [ ] **PRIC-04**: Snapshot de tipo de cambio USD-ARS al transicionar a `oc_recibida` para presupuestos MIXTA. Se guarda `tipoCambioSnapshot` en el presupuesto. (Decisión confirmada: el TC se congela cuando llega la OC, no al enviar.)
- [ ] **PRIC-05**: Descuento porcentual sobre tarifa base (validar que el flag ya existente funciona con las nuevas reglas de zona/contrato).

### Tipos de Presupuesto

- [ ] **PTYP-01**: Implementación completa de presupuesto **per_incident** — editor, PDF (template teal adaptado), envío por mail OAuth, flujo de estados.
- [x] **PTYP-02**: Implementación de presupuesto **partes** — similar a per_incident pero con items de stock; disparador del cruce ATP al aceptar.
- [x] **PTYP-03**: Implementación de presupuesto **mixto simple** — combina servicios + partes en un solo documento. (Orquestación multi-OT queda para v2.1).
- [x] **PTYP-04**: Implementación de presupuesto **ventas de equipos** — genera OT (correcciones: sí genera OT), PDF, envío.

### Revisiones de Presupuesto

- [ ] **REV-01**: Al crear una revisión (item 2, item 3…) el sistema debe preguntar si se anula el presupuesto anterior o se mantienen ambas revisiones activas simultáneamente. Default: anular anterior (comportamiento actual). Caso de uso de "mantener ambas": enviar al cliente dos opciones — una con parte X y otra sin la parte — y que elija.
- [ ] **REV-02**: UI del presupuesto muestra claramente qué revisiones están activas y cuáles anuladas, con link entre revisiones hermanas.

### Flujo Automático de Derivación

- [x] **FLOW-01**: Auto-creación de ticket de seguimiento cuando un presupuesto se crea sin ticket previo. Asignado al usuario fijo configurable. Motivo/descripción: "Presupuesto N° XXX pendiente de aceptación/OC".
- [x] **FLOW-02**: Al cargar OC del cliente (número + adjunto PDF obligatorio), el ticket de seguimiento se deriva automáticamente al coordinador fijo configurable para crear OT. Cambio de estado se dispara al adjuntar la OC.
- [x] **FLOW-03**: Cruce ATP en acceptance detecta items que requieren importación → auto-creación de requerimiento para Comex + derivación del ticket al área Importaciones.
- [x] **FLOW-04**: OT con `estadoAdmin: CIERRE_ADMINISTRATIVO` dispara aviso a Facturación — crea ticket interno al área administración + envía mail al contable (Miguel Barrios) con presupuesto, OC y datos de OTs.
- [x] **FLOW-05**: `runTransaction` en transiciones críticas de estado (acceptance, OC, cierre) para prevenir race conditions multi-usuario.
- [x] **FLOW-06**: Manejo robusto de errores en auto-derivación — reemplazar `.catch(console.error)` silenciosos por logs + campo `pendingActions[]` en el presupuesto para detectar y reintentar.
- [x] **FLOW-07**: Configuración UI: setear usuarios fijos (seguimiento, coordinador OT, contable facturación) desde pantalla admin.

### Stock Planning ATP

- [x] **STKP-01**: Pure function `computeStockAmplio(articuloId)` que calcula ATP: `disponible + tránsito + OCs abiertas - reservado`. Reusable desde detail views y triggers.
- [ ] **STKP-02**: Cloud Function `updateResumenStock` — denormaliza `resumenStock: { disponible, enTransito, reservado, comprometido }` en el doc del artículo cuando cambia cualquier unidad/reserva/OC. Alimenta la planning list view.
- [x] **STKP-03**: Conversión a `runTransaction` de las mutaciones críticas de stock (reservas, movimientos, requerimientos) para garantizar atomicidad.
- [x] **STKP-04**: Deshabilitar cache de 2 min en stock views (planning list, reserva modal) — datos siempre frescos.
- [x] **STKP-05**: Revisión y fix del pitfall en `presupuestosService.ts` líneas 252-258 (fórmula `disponible - reservado + enTransito` potencial doble conteo).

### Formatos

- [ ] **FMT-01**: PDF generator para cada tipo de presupuesto (per_incident, partes, mixto, ventas) reusando el template teal del contrato con adaptaciones por tipo.
- [ ] **FMT-02**: Envío de presupuesto por mail OAuth extendido para todos los tipos. Invertir orden: validar token ANTES de cambiar estado (Pitfall 5-A).
- [x] **FMT-03**: Template mail automático al contable para aviso facturación con PDF del presupuesto, OC adjunta y detalle OTs. Destinatario configurable desde UI (default: mbarrios@agsanalitica.com).
- [x] **FMT-04**: Excel export de listado de presupuestos con filtros aplicados (xlsx ya instalado).
- [x] **FMT-05**: Excel export de OCs pendientes por cliente/coordinador.
- [x] **FMT-06**: Excel export de solicitudes de facturación pendientes (para reconciliación con Bejerman).

### Testing Playwright

- [ ] **TEST-01**: Setup del emulador Firestore local + fixtures base + `clearFirestoreData()` entre suites. Pre-requisito para E2E confiable.
- [ ] **TEST-02**: Suite E2E del camino feliz: crear ticket → presupuesto → enviar → OC → OT → aviso facturación. Con `expect.poll()` para asserts async.
- [ ] **TEST-03**: Suite E2E de branches: presupuesto standalone → auto-ticket; derivación a importaciones; multi-moneda MIXTA; precio congelado post-envío.
- [ ] **TEST-04**: Integración de suite E2E en CI (GitHub Actions) con cache de emulador Firestore y pnpm install.
- [ ] **TEST-05**: Mocks de Gmail y Google Maps via `page.route()` para prevenir side effects en CI.

## v2.1 Requirements (Deferred)

### Presupuestos avanzados

- **PTYP-V21-01**: Presupuesto mixto con orquestación multi-OT automática (cosecha Items→OT del diseño en `.claude/plans/presupuestos-item-a-ot-design.md`).
- **PTYP-V21-02**: OT parcial con continuación automática — partes llegaron, otras no; OT sigue abierta esperando resto.

### Facturación integración

- **FACT-V21-01**: Integración bidireccional con Bejerman (hoy: aviso + mail; futuro: crear factura directo).
- **FACT-V21-02**: Facturación parcial — acuerdos con clientes específicos para emitir en tramos.

### Distribución desktop

- **DIST-V21-01**: electron-updater con auto-update desde GitHub Releases.
- **DIST-V21-02**: Firma de instalador Windows (eliminar warning de Defender).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Facturación real en Bejerman | Out of scope milestone; milestone cierra con aviso. Bejerman integración futura. |
| Distance calc por GPS/ruta real | Anti-feature sin GPS de movilidad; usar zonas geográficas. |
| Parseo de emails entrantes con OC | Complejidad desproporcionada; OC se carga siempre manual (nº + adjunto). |
| Auto-approval de presupuestos sin OC | Cliente debe mandar OC física (conformidad legal). |
| Precio dinámico retroactivo en ppto viejos | Industry anti-pattern; precios se congelan al enviar. |
| Cosecha Items→OT automática v2.0 | Complejidad; diferido a v2.1. OT se crea con prefill manual desde presupuesto aceptado. |
| Email entrante parseado para OC | Out of scope; siempre carga manual. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PREC-01 | Phase 5 | Complete |
| PREC-02 | Phase 5 | Complete |
| PREC-03 | Phase 5 | Pending |
| PREC-04 | Phase 5 | Complete |
| ANXC-01 | Phase 4 | Complete |
| ANXC-02 | Phase 4 | Pending |
| ANXC-03 | Phase 4 | Pending |
| ANXC-04 | Phase 4 | Complete |
| ANXC-05 | Phase 4 | Pending |
| ANXC-06 | Phase 4 | Pending |
| CSVC-01 | Phase 6 | Pending |
| CSVC-02 | Phase 6 | Pending |
| CSVC-03 | Phase 6 | Pending |
| CSVC-04 | Phase 6 | Pending |
| CSVC-05 | Phase 6 | Pending |
| PRIC-01 | Phase 6 | Pending |
| PRIC-02 | Phase 6 | Pending |
| PRIC-03 | Phase 6 | Pending |
| PRIC-04 | Phase 6 | Pending |
| PRIC-05 | Phase 6 | Pending |
| PTYP-01 | Phase 7 | Pending |
| FMT-01 | Phase 7 | Pending |
| FMT-02 | Phase 7 | Pending |
| REV-01 | Phase 8 | Pending |
| REV-02 | Phase 8 | Pending |
| FLOW-01 | Phase 8 | Complete |
| FLOW-02 | Phase 8 | Complete |
| FLOW-03 | Phase 8 | Complete |
| FLOW-04 | Phase 8 | Complete |
| FLOW-05 | Phase 8 | Complete |
| FLOW-06 | Phase 8 | Complete |
| FLOW-07 | Phase 8 | Complete |
| STKP-01 | Phase 9 | Complete |
| STKP-02 | Phase 9 | Pending |
| STKP-03 | Phase 9 | Complete |
| STKP-04 | Phase 9 | Complete |
| STKP-05 | Phase 9 | Complete |
| PTYP-02 | Phase 10 | Complete |
| PTYP-03 | Phase 10 | Complete |
| PTYP-04 | Phase 10 | Complete |
| FMT-03 | Phase 10 | Complete |
| FMT-04 | Phase 10 | Complete |
| FMT-05 | Phase 10 | Complete |
| FMT-06 | Phase 10 | Complete |
| TEST-01 | Phase 11 | Pending |
| TEST-02 | Phase 11 | Pending |
| TEST-03 | Phase 11 | Pending |
| TEST-04 | Phase 11 | Pending |
| TEST-05 | Phase 11 | Pending |

**Coverage:**
- v2.0 requirements: **49 total** (4 PREC + 6 ANXC + 5 CSVC + 5 PRIC + 4 PTYP + 2 REV + 7 FLOW + 5 STKP + 6 FMT + 5 TEST)
- Mapped: **49/49** ✓ — no orphaned requirements

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-19 — added REV-01/02 (revisiones con opción de mantener anterior) + confirmed TC MIXTA snapshot at oc_recibida*
