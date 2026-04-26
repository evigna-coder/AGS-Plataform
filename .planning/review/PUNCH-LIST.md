# Revisión integral — Punch List & Wave Plan

> Síntesis de los 5 reportes en `.planning/review/01..05-*.md` + typecheck previo.
> Total findings: **~120 ítems** (≈20 P0 / ≈70 P1 / ≈30 P2). Aquí solo los que vale la pena tocar.

---

## Wave A — "Stop the bleeding" (P0 silenciosos, alto impacto)

Bugs reales con riesgo de plata/datos o que ya están corrompiendo state. Todo es de cirugía pequeña.

| # | Fix | File:line | Por qué |
|---|---|---|---|
| A1 | `WorkOrder.budgets[]` con doc-ID en vez de `numero` | `pages/ordenes-trabajo/OTNew.tsx:203` | OTs creadas desde esa ruta nunca syncan finalización, no entran al cierre admin, el aviso al contable dice "(sin presupuesto vinculado)". 1 línea. |
| A2 | Auto-reserva de stock al aceptar presupuesto = código muerto | `services/presupuestosService.ts:331-478` | El `return` en `:357` saltea el bloque `:412-478`. Dos presupuestos pueden prometer la misma unidad física. Mover el bloque dentro de `aceptarConRequerimientos`. |
| A3 | `ordenesTrabajoService.create` permite overwrite silencioso | `services/otService.ts:268-323` | Si el usuario tipea un nro de OT existente, `setDoc` pisa la OT real (artículos, fechas, ingeniero, todo). Sin alerta. |
| A4 | `useCreateOTForm` doble-crea el child `.01` | `hooks/useCreateOTForm.ts:261-267` | El parent ya autocrea `.01` internamente. Segunda llamada lo pisa, desincroniza el counter, corrompe agenda entry. |
| A5 | `stockService.liberar()` no es transaccional | `services/stockService.ts:993-1045` | TODO documentado. Race con `reservar()` concurrente puede perder reservas silenciosamente. |
| A6 | Tipos de Calificación-Proveedores faltan en `@ags/shared` | `pages/calificacion-proveedores/*` | Módulo no compila. Bloquea build. Falta `CalificacionProveedor`, `CriterioEvaluacion`, `EstadoCalificacion`, `CRITERIOS_DEFAULT`. |
| A7 | `Ticket.createdAt` required pero 3 callers omiten + `Ticket.updatedBy` no existe | `packages/shared/src/types/index.ts:691-745` | Typecheck rojo. `useLeadNotifications:117` usa `updatedBy`. `useCrearLeadForm`, `useOTActions`, `presupuestosService` omiten `createdAt`. |
| A8 | `ModuloId` no incluye `'calificacion-proveedores'` | `packages/shared/src/types/index.ts:3139` + `MODULO_LABELS`/`RUTA_MODULO`/`ROLE_DEFAULTS` | Sidebar gate no compila; la ruta no se controla por permisos. |

**Estimación**: 1 día de trabajo. ~500 líneas tocadas. Cierra 5 bugs silenciosos + restaura typecheck verde.

---

## Wave B — "Stop the drift" (extracción a `@ags/shared`)

El #2 problema más grave: lo mismo implementado N veces y ya divergiendo. Cada bug fix de aquí en adelante cuesta 1× en vez de 2-3×.

| # | Acción | Files |
|---|---|---|
| B1 | Extraer `qfDocumentosService` (200 LOC duplicados byte-for-byte) | `apps/{sistema-modular,portal-ingeniero}/src/services/qfDocumentosService.ts` |
| B2 | Extraer parsers + migration tables de leads/tickets | `services/leadsService.ts` ↔ `apps/portal-ingeniero/src/services/firebaseService.ts:221-509` (drift confirmado) |
| B3 | Extraer `OT_TO_LEAD_ESTADO` + helper de transición | `services/leadsService.ts` ↔ `apps/reportes-ot/services/firebaseService.ts:101-160` |
| B4 | Extraer `useUrlFilters` (versiones distintas — sistema-modular es la canónica) | `apps/*/src/hooks/useUrlFilters.ts` |
| B5 | Extraer `useResizableColumns` (byte-idénticos) | idem |
| B6 | Extraer `fcmTokensService` (3 copias) | `services/fcmService.ts` + portal + reportes-ot |
| B7 | **Bug real ya divergido**: `LeadTimeline` ordena distinto entre apps | `apps/{portal,sistema-modular}/src/components/leads/LeadTimeline.tsx` |

**Decisión**: no abro un nuevo paquete `@ags/leads-ui` todavía — extraer a `@ags/shared/services/*` y `@ags/shared/hooks/*` alcanza por ahora. Si después hace falta separar UI vs lógica, se hace.

**Estimación**: 2-3 días. Riesgo medio (toca cosas live). Probar con feature toggle por app.

---

## Wave C — "Convention compliance" (P1 violaciones de reglas escritas)

Cosas donde el repo tiene una regla y la viola en N lugares. Trabajo mecánico, alto valor de orden.

| # | Acción | Scope |
|---|---|---|
| C1 | Sacar Firestore directo de componentes/hooks | `useLeadDetail` (portal), `TicketPendientesChips`, `CargarOCModal` |
| C2 | Migrar 9 list pages a `useUrlFilters` | LoanersList, ColumnasListPage, PatronesListPage, InstrumentosListPage, CalificacionesList, AsignacionesList, OCList, TiposEquipoList, UsuariosList |
| C3 | Renombrar `size` → `maxWidth` en 3 modals | CreateColumnaModal:74, CreatePatronModal:74, MigracionPatronesModal:57 (este último renderiza más chico de lo diseñado) |
| C4 | Cerrar gaps de cache invalidation | `marcasService`, `sectoresCatalogService`, `proveedoresService`, `usuariosService.updateStatus/approveUser/updatePermissions` |
| C5 | Cerrar gaps de audit log | `usuariosService` RBAC writes (¡crítico para compliance!), `tableCatalogService.publish/archive/clone/bulkAddModelos`, `vehiculosService` subcollections, `clientesService` contactos, `feriadosService`/`agendaNotasService` |
| C6 | Tightener type de `batchAudit.after` para drop ~130 `as any` | hotspot: `presupuestosService` (31), `importacionesService` (14), `stockService` (14) |
| C7 | portal-ingeniero `leadsService` — envolver mutaciones en `createBatch + batchAudit` | `apps/portal-ingeniero/src/services/firebaseService.ts:323-508` |
| C8 | `viaticosService.agregarGasto/editar/eliminar` → `runTransaction` o `arrayUnion` | portal-ingeniero firebaseService:918-950 |
| C9 | `ImportacionDatos.tsx` raw Firestore + 3 migration hooks bypassean services | extraer a `migrationsService` |

**Estimación**: 1-2 días, paralelizable.

---

## Wave D — "Defensive correctness" (P1 dominio)

Bugs lógicos de borde. Menos urgentes que Wave A pero sin recovery automático cuando aparecen.

| # | Acción | File |
|---|---|---|
| D1 | Numeradores atómicos (`presupuestos`, `OC`, `remito`, `ticket`, `asignaciones`) | template ya existe en `otService.ts:43` (`_counters/runTransaction`) |
| D2 | `otService.delete` debe limpiar agenda + ticket + presupuesto refs (o pasar a baja lógica) | `services/otService.ts:462-467` |
| D3 | Centralizar side-effects de presupuesto en `markAceptado` / `markAnulado` / `markFinalizado` | `presupuestosService.ts:378-481` |
| D4 | `agendaService.subscribeToRange` add lower bound (escanea histórico entero) | `agendaService.ts:51-69` |
| D5 | `facturacionService.marcarFacturada` idempotency check | `facturacionService.ts:141` |
| D6 | `ventasInsumosReport` timezone bug — `lead.createdAt <= '2026-04-25'` deja afuera el día | `leadsService.ts:265-281` |
| D7 | Matriz `OT_TRANSICIONES_VALIDAS` y validar en `update()` | nuevo, en `@ags/shared` |
| D8 | `PRESUPUESTO_TO_LEAD_ESTADO` agregar `anulado`/`en_ejecucion` | `leadsService.ts:17-21` |
| D9 | Anulación de presupuesto debe avisar/bloquear si hay OTs activas | `presupuestosService.ts:392-403` |
| D10 | `sistemasService.delete` pre-validar refs (OTs, presupuestos, contratos) | `equiposService.ts:335-355` |
| D11 | `parseLeadDoc` migración legacy no contempla estados de Phase 8/10 | `leadsService.ts:42-55` |
| D12 | `derivar()` no debería pisar `descripcion` — usar `ultimaObservacion` | `leadsService.ts:315-338` |
| D13 | `contratos.incrementVisitas` validar activo/fechaFin dentro de la tx | `contratosService.ts:110-124` |

**Estimación**: 2 días.

---

## Wave E — "Refactor monstruos" (P1 budget 250 líneas)

23 archivos exceden el budget en sistema-modular + 4 en portal. Top 5 que dan más bang:

| File | Líneas | Plan de extracción |
|---|---|---|
| `components/protocol-catalog/TableEditor.tsx` | 1258 | `TableHeaderRow`, `TableBodyRow`, `RuleEditor`, hook `useTableEditorState` |
| `pages/admin/ImportacionDatos.tsx` | 1123 | un componente por flow + extraer a `migrationsService` (cubre C9) |
| `pages/ordenes-trabajo/OTList.tsx` | 821 | `OTTableRow`, `OTFiltersBar`, hook `useOTListData` |
| `pages/agenda/AgendaPage.tsx` | 793 | hook `useAgendaDnd` + mover constantes a util |
| `components/protocol-catalog/ImportJsonDialog.tsx` | 688 | wizard steps como subcomponentes + hook `useImportJson` |

**Estimación**: 3 días, paralelizable. Lista completa en `02-components-hooks.md`.

---

## Wave F — "Cleanup" (P2 — relleno de tiempos muertos)

- Dead code: `enviarAvisoCierreAdmin`, `inTransition`, `LeadCard.tsx` (portal), `getProtocolTemplateForServiceType` stub
- Tipos shared muertos: `Customer`, `Module`, `Equipment`, `Equipo`, `ServiceReport`, `RenderSpec`, `QuoteItem`, `AreaIngeniero`
- Codemod 24 imports de aliases deprecados `Lead*`/`LEAD_*` → `Ticket*`
- Naming: 3 archivos `*ListPage.tsx` → `*List.tsx`
- 12 page folders sin `index.tsx` barrel
- TODOs/FIXMEs (22 ocurrencias) — revisar uno por uno

---

## Reportes-ot — frozen, observaciones (NO tocar sin OK explícito)

| # | Observación | File |
|---|---|---|
| R1 | UID hardcodeado `pHDkcnzLEdX93APkPcf3ebqyOJL2` para asignar tickets auto-creados | `apps/reportes-ot/services/firebaseService.ts:836` |
| R2 | Generador `TKT-XXXXX` no atómico | mismo file:805-820 |
| R3 | `OT_TO_TICKET_ESTADO` mapeo duplicado (cubierto en B3) | mismo file:101-160 |
| R4 | PDF wait loop puede dar timeout y caer al fallback `html2pdf` legacy silencioso | `usePDFGeneration.ts:220-229` |
| R5 | 2 archivos stale: `ProtocolView - copia.tsx`, `App.tsx.backup` | borrables |
| R6 | Dual alias `@ags/shared` y `@shared` (intencional pero indocumentado) | `vite.config.ts:36` |
| R7 | `firebaseService` mezcla `Date`, `Date.now()`, `ISO string`, `Timestamp` para timestamps | viola regla `firestore.md` |
| R8 | `CATALOG_SERVICE_TYPES` set hardcodeado de 9 strings | `useAppLogic.ts:25-35` |

R1, R2 y R7 ameritan fix con tu OK porque tienen blast radius real. R5 es trivial. El resto observación.

---

## Recomendación de orden

1. **Esta semana**: Wave A completa. ~1 día. Cierra los 5 bugs silenciosos + typecheck verde.
2. **Próximas 2 semanas**: Wave B (drift) en paralelo con Wave C (compliance). C es paralelizable entre nosotros.
3. **Después**: D (defensive) → E (monstruos) → F (cleanup). E se puede ir picando cada vez que hay que tocar uno de esos archivos por feature.

R1/R2 de reportes-ot los meto en Wave A si vos OK. Si no, los dejo en una Wave R separada para tratar aparte cuando estés cómodo de tocar la PWA.
