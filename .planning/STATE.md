---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 08-04 (Wave 3 — FLOW-03 aceptarConRequerimientos transaccional + cleanup condicionales + ATP wiring + RequerimientosList UI)
last_updated: "2026-04-21T19:48:56.764Z"
last_activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado
progress:
  total_phases: 11
  completed_phases: 4
  total_plans: 27
  completed_plans: 24
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: Completed 08-04 (Wave 3 — FLOW-03 aceptarConRequerimientos transaccional + cleanup condicionales + ATP wiring + RequerimientosList UI)
last_updated: "2026-04-21T12:34:11.465Z"
last_activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado
progress:
  total_phases: 11
  completed_phases: 3
  total_plans: 27
  completed_plans: 23
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Cerrar end-to-end el ciclo comercial desde la consulta inicial hasta el aviso de facturación — con trazabilidad, estados automáticos y sin datos que se pierdan entre áreas.
**Current focus:** v2.0 Circuito Comercial Completo — Phase 5: Pre-condiciones

## Current Position

Phase: 5 of 11 (Pre-condiciones — Migración + Infra)
Plan: 4 of 4 completed at code level (05-01 clienteId, 05-02 contactos, 05-03 functions bootstrap, 05-04 featureFlags). Pending user actions: run migration scripts 05-01/05-02 (--dry-run/--run), deploy functions 05-03, human-verify admin UI 05-04.
Status: In Progress (awaiting user human-verify + manual script runs)
Last activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado

Progress: [████████░░] 84% (v2.0 milestone)

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 4 (05-01, 05-02, 05-03, 05-04 — all pending user checkpoint verification for scripts / human-verify)
- Average duration: ~5.5min
- Total execution time: ~23min

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 05-pre-condiciones-migracion-infra | 01 | 10min | 4 | 8 |
| 05-pre-condiciones-migracion-infra | 02 | 2min | 1 | 1 |
| 05-pre-condiciones-migracion-infra | 03 | ~5min | 2 | 7 |
| 05-pre-condiciones-migracion-infra | 04 | 5min | 3 | 8 |

*Updated after each plan completion*
| Phase 08-flujo-automatico-derivacion P00 | 55min | 3 tasks | 6 files |
| Phase 08-flujo-automatico-derivacion P01 | 7min | 3 tasks | 8 files |
| Phase 08-flujo-automatico-derivacion P03 | ~35min | 3 tasks | 3 files |
| Phase 08-flujo-automatico-derivacion P02 | 14min | 3 tasks | 7 files |
| Phase 08-flujo-automatico-derivacion P04 | 14min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

- **Phase 5 pre-condition (hard):** Migración clienteId null debe completarse ANTES de habilitar derivaciones automáticas (Pitfall 7-A). Sin esto, auto-tickets fallan silenciosamente.
- **Client-side triggers:** El pipeline comercial (ticket → presupuesto → OC → OT → facturación) usa client-side triggers. Cloud Functions SOLO para `resumenStock` aggregation.
- **Token-first mail order:** Siempre validar OAuth token ANTES de cambiar estado en Firestore (Pitfall 5-A). Implementar desde Phase 7.
- **runTransaction obligatorio:** Transiciones críticas de estado (acceptance, OC, cierre) usan `runTransaction` para prevenir race conditions (Pitfall 2-D). Desde Phase 8.
- **Snapshot de precios:** `precioUnitarioSnapshot` se congela al transicionar a `oc_recibida` (no al enviar). Antes de OC los precios pueden recalcularse (útil para negociaciones con el cliente). Establecer en Phase 6.
- **TC MIXTA snapshot (confirmado):** El tipo de cambio USD-ARS se congela al recibirse la OC, consistente con la política general de precios. Establecer en Phase 6.
- **Revisiones de presupuesto:** Al crear revisión (item 2, item 3...), por defecto se anula la anterior. Nuevo requerimiento REV-01: agregar pregunta "¿mantener ambas revisiones activas?" para casos donde el cliente recibe dos opciones (ej: con/sin una parte). Establecer en Phase 8.
- **Sin cache en stock views:** Las vistas de planificación de stock nunca usan serviceCache.ts (Pitfall 3-C). Aplicar en Phase 9.
- [Phase 05-pre-condiciones-migracion-infra]: Script migración contactos[] defaults a --dry-run; --run requiere flag explícito y ejecución manual del usuario (no se incluye service-account en repo)
- [Phase 05-01]: Ruta admin registrada en `components/layout/TabContentManager.tsx` (no `App.tsx`) — el routing real vive allí. Patrón a usar para futuras rutas admin.
- [Phase 05-01]: `useUrlFilters` es schema-based `(schema) => [filters, setFilter, setFilters, resetFilters]` — NO shape simple. Documentado en RevisionClienteIdPage como referencia.
- [Phase 05-01]: Plan 05-01 estableció que tickets con `clienteId: null` se matchean por CUIT (≥8 dígitos) → razón social exacta (NFD normalizada). Ambiguos quedan con `pendienteClienteId: true` + `candidatosPropuestos` con `score: 'cuit' | 'razonSocial'` para UI de revisión admin en `/admin/revision-clienteid`.
- [Phase 05-04]: Feature flags runtime vía colección Firestore `/featureFlags/modules` + `FeatureFlagsContext` + hook `useNavigation()` reactivo. `VITE_DESKTOP_MVP` queda como default de build; Firestore override por módulo gana. UI admin en `/admin/modulos` (icon 🧩). `DESKTOP_MVP_ALLOWED` ahora exportado desde `navigation.ts` con helper `isMvpDefault(path)` — source of truth única (no duplicar el set en la admin UI).
- [Phase 05-04]: `useAuth()` retorna `{ firebaseUser, usuario, ... }`; el uid real vive en `firebaseUser.uid`. Usar ese campo para `updatedBy` en writes (no `usuario.id`, que en transiciones puede ser null).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-00]: Wave 0 testing strategy: Playwright client SDK (not Admin) via fixtures/firebase-e2e.ts. Specs fail RED hasta Wave 1-3. Local type aliases en firestore-assert.ts para tipos que landea 08-01.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-00]: e2e/helpers/ pattern establecido: readers tipados compartidos entre specs, 192 líneas bajo budget, pollUntil para eventual consistency.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-00]: sistema-modular no tiene script type-check; Wave 3 (plan 08-05) podría agregarlo. Verificación manual via temp tsconfig+tsc --noEmit.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-01]: 'oc_recibida' landed en TicketEstado con color 'bg-orange-200 text-orange-900' (bg-amber-100 ya era pendiente_facturacion). PendingAction/OrdenCompraCliente/AdminConfigFlujos exportados. getSimplifiedEstado no se tocó (whitelist fallback ya cubre 'en_proceso').
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-01]: Sidebar consolidado en un único root 'Admin' (/admin, icon ⚙️) con 5 children. Antes había 2 items separados ('Importar Datos' + 'Módulos'). getAllModulePaths() ahora expone '/admin' unificado; overrides Firestore para '/admin/importar' y '/admin/modulos' quedan orphan (no bloqueante).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-01]: ordenesCompraClienteService.cargarOC implementado como stub que THROWS 'NOT_IMPLEMENTED — plan 08-02'. Esto falla loud cualquier caller prematuro, mejor que fake data. Plan 08-02 reemplaza con runTransaction real.
- [Phase 08-flujo-automatico-derivacion]: 08-03: Lazy import presupuestosService inside leadsService to break circular dependency for retry-after-resolve trigger
- [Phase 08-flujo-automatico-derivacion]: 08-03: Auto-ticket uses motivoLlamado='ventas_equipos', areaActual='ventas', estado='esperando_oc'; asignadoA=adminConfig.usuarioSeguimientoId
- [Phase 08-flujo-automatico-derivacion]: 08-03: v2.0 no-op success for derivar_comex and notificar_coordinador_ot retry handlers; 08-04/08-05 can extend
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-02]: cargarOC implementado con runTransaction multi-colección — reads-first + merge manual de arrays (NO arrayUnion) + writes inline (NO nested tx). 269 líneas; post-commit notifyCoordinadorOTBestEffort extraído a cargarOCHelpers.ts. NO appendea pendingAction 'derivar_comex' (W1 fix; 08-04 responsable); 'notificar_coordinador_ot' solo se appendea cuando el side-effect falla.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-02]: Modal CargarOCModal (201 + 135 Parts) con tabs 'Existente' (default si hay OCs previas) / 'Nueva' + upload multi-archivo + checkbox N:M filtrado por estado aceptado-sin-OC. Pre-genera ocId en client antes del upload a Storage → mismo id que la tx. Wire en PresupuestosList (row action gated) + EditPresupuestoModal footer (NO PresupuestoDetail.tsx: es redirector de 49 líneas, detail real es el floating modal).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-04]: FLOW-03 implementado con runTransaction atómico. aceptarConRequerimientos pre-reserva numeros REQ-XXXX fuera de tx (getNextNumber no es safe en runTransaction) y pre-carga articulos. _cancelarRequerimientosCondicionales respeta Regla G (skip comprado/en_compra). Collection reutilizada: requerimientos_compra snake_case legacy.
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-04]: ATP check suma simple de unidades por estado (disponible+reservado+en_transito+asignado) en nuevo atpHelpers.ts. TODO(STKP-01) documentado para swap a computeStockAmplio() en Phase 9. Integration point real Task 2: PresupuestoItemsTableContrato.handlePickArticulo (no AddItemModal — ese modal no tiene selector de stock; solo conceptosServicio).
- [Phase 08-flujo-automatico-derivacion]: [Phase 08-04]: Derivación real a TicketArea='materiales_comex' deferida v2.1 — el union no incluye ese valor hoy. En lugar de derivar, el post-commit de aceptarConRequerimientos appendea pendingAction 'derivar_comex' con reason descriptivo. Retry handler de 08-03 ya trata ese tipo como no-op success.

### Pending Todos

- Definir límites de zonas geográficas (AMBA / Interior BA / Interior país) con equipo comercial antes de Phase 6 — sesión 30 min (pendiente)
- ~~Confirmar activación plan Blaze en Firebase~~ ✓ Confirmado 2026-04-19
- ~~Decidir política de `tipoCambioSnapshot` MIXTA~~ ✓ Resuelto 2026-04-19: snapshot al `oc_recibida`

### Blockers/Concerns

- **Zonas geográficas:** Los límites/tarifas de zonas (AMBA / Interior BA / Interior país) son decisión comercial. Sin ellos Phase 6 no puede completarse. Sesión con equipo prevista para 2026-04-20.

## Session Continuity

Last session: 2026-04-21T12:34:11.462Z
Stopped at: Completed 08-04 (Wave 3 — FLOW-03 aceptarConRequerimientos transaccional + cleanup condicionales + ATP wiring + RequerimientosList UI)
Resume file: None
