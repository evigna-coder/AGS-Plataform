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
- [x] **ANXC-02**: `consumiblesPorModuloService.ts` — CRUD Firestore para la colección `consumibles_por_modulo` con cleanFirestoreData, audit fields nullables y validación de unicidad por `codigoModulo`.
- [x] **ANXC-03**: Página admin `/presupuestos/consumibles-por-modulo` con CRUD UI (lista, modal de creación/edición, eliminación lógica via `activo: false`) + entry point en toolbar de Presupuestos.
- [x] **ANXC-04**: Editor de plantillas tipo de equipo: columna "Anexo" en ServiciosEditor (checkbox por servicio) + persistencia en `tiposEquipoService.update()` (lee `requiereAnexoConsumibles ?? false`).
- [x] **ANXC-05**: `AnexoConsumiblesPDF` (template Editorial Teal liviano) + `buildAnexosFromPresupuesto()` (matcheo híbrido módulos reales del cliente → plantilla de tipo de equipo, con warnings de módulos sin entrada en catálogo).
- [x] **ANXC-06**: Integración mail: `useEnviarPresupuesto` extendido + `EnviarAnexosSection` en `EnviarPresupuestoModal` para adjuntar N PDFs anexos (uno por módulo) al email — con smoke E2E checkpoint.

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

### Stock — Equivalencias compra↔uso (Phase 13)

- [x] **STKE-01**: Tipos foundation en `@ags/shared` — `Articulo.equivalencias?: { articuloIdDestino, articuloCodigoDestino, articuloDescripcionDestino, factor }[]` (en v1 a lo sumo un elemento por ser 1→1) + `MovimientoStock.subtipo?: 'conversion'` (compatible con consumidores que sólo leen `tipo: 'transferencia'`).
- [x] **STKE-02**: `articulosService` extendido con `linkEquivalencia(origenId, destinoId, factor)` / `unlinkEquivalencia(origenId)` validando 1→1 (rechazar si origen ya tiene equivalencia, si destino ya es destino de otro origen, si crea ciclo A→B→A, o si factor ≤ 0).
- [x] **STKE-03**: UI de vinculación — en la ficha/edición del artículo de compra, sección "Equivalencia (código de uso)" con `SearchableSelect` de artículos destino + input numérico de factor (acepta decimales). Botón unlink para romper la vinculación.
- [x] **STKE-04**: `desagregarUnidades(articuloOrigenId, cantidad, ubicacion)` como `runTransaction` atómica que baja N del origen, alta `N × factor` del destino en la misma ubicación, y crea `MovimientoStock { tipo: 'transferencia', subtipo: 'conversion' }` con audit completo. Falla atómicamente si no hay stock suficiente.
- [x] **STKE-05**: CTA "Desagregar ahora" en `ArticuloDetail` del lado de compra — modal con cantidad a desagregar, ubicación origen (con stock visible), preview del resultado (`N × factor = M`).
- [x] **STKE-06**: Display dual en `ArticuloDetail` — dos líneas: stock real del artículo (siempre) + lado opuesto calculado (reverso `÷ factor` si estoy en uso, directo `× factor` si estoy en compra). Visible siempre dentro del detail.
- [x] **STKE-07**: Display dual on-demand en lista de artículos y `SearchableSelect` — badge "tiene equivalente" en filas normales; al buscar específicamente uno de los códigos vinculados, despliega la fila con ambas existencias. No renderizar el desglose en todas las filas a la vez.

### Stock — Patrones con BOM (Phase 14)

- [x] **BOM-01**: Tipos foundation en `@ags/shared` — `ComponentePatron` interface + `Patron.componentes?: ComponentePatron[]` (BOM declarativo, vacío = legacy) + `PatronLote.componentesConsumidos?: { codigoComponente, cantidadConsumida }[]` (acumulado de consumo por componente) + `MovimientoStock` extension (`entidadTipo?: 'articulo' | 'patron'` + `patronId?` + `lote?` + `codigoComponente?`) + `OrigenRequerimiento` extension (nuevo valor `'patron_minimo'`) + `RequerimientoCompra` extension (`patronId? + loteId? + codigoComponente?`) + `AdminConfigFlujos.usuarioRequerimientosPatronId?`. Todas las extensiones son backwards-compatible (campos opcionales; consumidores que no leen los campos siguen funcionando).
- [x] **BOM-02**: Pure helpers en `packages/shared/src/utils/patronBom.ts` — `computeSaldoComponente(patron, lote, codigoComponente)` (devuelve `Infinity` si no hay BOM = modo legacy; defaultea `lote.cantidad ?? 0` para evitar `NaN`); `computeLoteStatus(patron, lote)` (`'active' | 'bloqueado' | 'agotado'`); `computePatronStatus(patron)` (agrega lotes); `findLoteFifoDisponible(patron, fechaActual)` (FIFO por vencimiento entre lotes con saldo y status != bloqueado/agotado); `buildPatronesConsumidosSugerencia(patronesSeleccionados, patrones)` (dedupe por `${patronId}::${lote}` y expande 1 ampolla por componente). Sin Firestore, sin async, testeable directamente.
- [x] **BOM-03**: `patronesService.consumirComponentes(...)` con `runTransaction` atómica calcada de `equivalenciasService.desagregarUnidades` — pre-fetch fuera de tx; READ-FIRST (`tx.get` del patrón bajo lock); recomputar `lotes[]` aplicando consumos y validar saldos no-negativos; `tx.update` del patrón con `deepCleanForFirestore`; 1 `MovimientoStock` por componente consumido (granularidad fina: 2 patrones × 3 ampollas = 6 movimientos) con `entidadTipo: 'patron' + patronId + lote + codigoComponente + tipo: 'consumo' + otNumber`. **Idempotente en re-cierre admin:** antes de escribir, query `movimientosService` por `otNumber + entidadTipo='patron'`; si existen, lanzar error "Patrones ya descontados para esta OT" (la sección entra en read-only).
- [ ] **BOM-04**: Editor "Componentes (BOM)" en `PatronEditorPage` con sub-componente extraído `PatronComponentesEditor.tsx` (porque el padre ya tiene 334 LOC, sobre budget) — inputs simples por componente: `codigoComponente` (text), `descripcion` (text), `cantidadPorKit` (number), `unidadMedida` (text), `stockMinimo` (number opcional). Agregar/quitar componentes inline (botones "+/x"). Editorial Teal, JetBrains Mono uppercase labels, `text-[10px]` tracking-wide. Guarda en el editor: rechazar rename de `codigoComponente` si ya existen consumos para ese código (pitfall 1 de RESEARCH); rechazar duplicados de `lote` (pitfall 3); persistencia via `patronesService.update()` con `deepCleanForFirestore`.
- [ ] **BOM-05**: Paso "Patrones consumidos" en `OTCierreAdminSection` con sub-componente extraído `CierrePatronesConsumidosSection.tsx` + hook `useCierrePatronesConsumidos.ts` (porque el padre ya tiene 244 LOC, casi en budget) — auto-prefill desde `OT.patronesSeleccionados` (dedupe por `${patronId}::${lote}`, 1 ampolla por componente del kit); FIFO por vencimiento cuando lote ambiguo; tabla editable admin (cambiar cantidades, agregar/quitar filas); idempotencia: si `movimientosService.getAll({ otNumber, entidadTipo:'patron' })` retorna >0, render read-only con banner "Ya descontado el dd/mm/yyyy por X"; al confirmar, invoca `patronesService.consumirComponentes(...)` con `motivo` registrando divergencias vs reporte técnico; reporte técnico INTOCABLE (cero writes a `OT.patronesSeleccionados`).
- [ ] **BOM-06**: Badge "BOM" + badge "lote bloqueado" en `PatronesList` con filtro nuevo "Bloqueados" persistido via `useUrlFilters` (schema-based; jamás `useState`); alerta inline en `PatronEditorPage` mostrando qué componente está en crítico por lote; pre-extracción de `PatronRow.tsx` y `PatronComponentesAlertBanner.tsx` antes de agregar features (PatronesList ya está en 330 LOC sobre budget). Helper `computeLoteStatus`/`computePatronStatus` de BOM-02 driven.
- [ ] **BOM-07**: Excepción frozen autorizada — `apps/reportes-ot/components/InstrumentoSelectorPanel.tsx` (619 LOC, sin refactor en esta fase, intervención mínima): tab "Patrones" muestra badge rojo "AGOTADO" sobre lote bloqueado y deshabilita su selección (checkbox disabled + visual fade). Importa `computeLoteStatus` desde `@ags/shared/utils/patronBom`. Sin tocar: pipeline PDF (`ProtocolSection`, hojas, html2canvas, html2pdf, pdf-lib merge), lógica de firma, otros componentes UI del app. Ejecutar con `CLAUDE_ALLOW_REPORTES_OT=1` (hook `guard-reportes-ot.js`).
- [x] **BOM-08**: Auto-creación de `RequerimientoCompra` con `origen: 'patron_minimo'` cuando un componente cae bajo `stockMinimo` (default 0); disparado **inline desde `patronesService.consumirComponentes`** post-commit (best-effort, no bloquea la tx; precedente: Phase 9 política "Cloud Functions SOLO para denormalización"). Idempotente: skip silencioso si ya existe REQ abierto (`estado != 'comprado' && != 'cancelado'`) con mismos `(patronId, loteId, codigoComponente)` (precedente: Phase 8 Regla G). Asignado a `adminConfigService.getWithDefaults().usuarioRequerimientosPatronId`; configurable desde `/admin/config-flujos` (nuevo `SearchableSelect` "Requerimientos de patrón"). Numeración correlativa via `requerimientosService.getNextNumber()` (pre-gen fuera de tx).

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
| ANXC-02 | Phase 4 | Complete |
| ANXC-03 | Phase 4 | Complete |
| ANXC-04 | Phase 4 | Complete |
| ANXC-05 | Phase 4 | Complete |
| ANXC-06 | Phase 4 | Complete |
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
| STKE-01 | Phase 13 | Complete |
| STKE-02 | Phase 13 | Complete |
| STKE-03 | Phase 13 | Complete |
| STKE-04 | Phase 13 | Complete |
| STKE-05 | Phase 13 | Complete |
| STKE-06 | Phase 13 | Complete |
| STKE-07 | Phase 13 | Complete |
| BOM-01 | Phase 14 | Complete |
| BOM-02 | Phase 14 | Complete |
| BOM-03 | Phase 14 | Complete |
| BOM-04 | Phase 14 | Pending |
| BOM-05 | Phase 14 | Pending |
| BOM-06 | Phase 14 | Pending |
| BOM-07 | Phase 14 | Pending |
| BOM-08 | Phase 14 | Complete |

**Coverage:**
- v2.0 requirements: **49 total** (4 PREC + 6 ANXC + 5 CSVC + 5 PRIC + 4 PTYP + 2 REV + 7 FLOW + 5 STKP + 6 FMT + 5 TEST)
- v2.x stock evolution: **15 total** (7 STKE Phase 13 — equivalencias + 8 BOM Phase 14 — patrones con BOM)
- Mapped: **64/64** ✓ — no orphaned requirements

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-05-20 — added BOM-01..08 (Phase 14 stock patrones con BOM)*
