---
phase: 10-presupuestos-partes-mixto-ventas
plan: 04
subsystem: api
tags: [firestore, typescript, presupuestos, ordenes-trabajo, facturacion, transactions]

# Dependency graph
requires:
  - phase: 10-01
    provides: "SolicitudFacturacion type + VentasMetadata type + SolicitudFacturacionEstado con 'enviada'"
  - phase: 10-02
    provides: "ArticuloPickerPanel + VentasMetadataSection UI wired to ventasMetadata field"
  - phase: 08-04
    provides: "_appendPendingAction pattern + aceptarConRequerimientos base implementation"
  - phase: 09-02
    provides: "Deterministic sentinel ID pattern for idempotency in runTransaction"
provides:
  - "Auto-OT genérica post-commit cuando se acepta ppto tipo 'ventas' (PTYP-04)"
  - "solicitudesFacturacion creadas en mismo tx de cerrarAdministrativamente con ID determinístico (FMT-03)"
  - "Idempotency en cerrarAdministrativamente via tx.get sentinel + Map en READ PHASE"
  - "marcarEnviada / marcarFacturada / agregarNota en facturacionService (dashboard Phase 10-06)"
affects: [10-05, 10-06, facturacion-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy import para romper circular dep: await import('./otService') dentro de presupuestosService (replica Phase 8-03 leadsService pattern)"
    - "READ PHASE / WRITE PHASE separation en runTransaction: todos los tx.get antes de cualquier tx.set/update"
    - "Deterministic doc ID {otNumber}_{presupuestoId} en solicitudesFacturacion — idempotency sin index extra"
    - "pendingAction fallback multi-branch: no coordId config + catch general — presupuesto queda aceptado en todos los casos"

key-files:
  created: []
  modified:
    - apps/sistema-modular/src/services/presupuestosService.ts
    - apps/sistema-modular/src/services/otService.ts
    - apps/sistema-modular/src/services/facturacionService.ts

key-decisions:
  - "Lazy import de otService dentro de presupuestosService para romper circular dep (precedente Phase 8-03 leadsService)"
  - "Post-commit auto-OT ventas (no nested tx): getNextOtNumber usa runTransaction propio, no anidable"
  - "solicitudesFacturacion ID determinístico {otNumber}_{presupuestoId}: replica pattern Phase 9-02; un doc por presupuesto vinculado a la OT"
  - "READ PHASE antes de WRITE PHASE en cerrarAdministrativamente: todos los tx.get de solicitudesFacturacion sentinels van en un loop en READ PHASE; Map<solId, exists> consultado en WRITE PHASE"
  - "condicionPago: '' (empty string) en solicitudesFacturacion — Phase 10-06 UI permite editar antes de enviar"
  - "marcarFacturada acepta datos opcionales: permite dashboard row-action sin tener numero de factura AFIP aun"
  - "bodyWithCTA reemplaza body en mailQueue doc: path relativo /facturacion?solicitudId={id}, consumer compone URL base"

patterns-established:
  - "Auto-OT ventas: idempotency via getDocs query budgets.array-contains + pendingAction fallback multi-branch"
  - "cerrarAdministrativamente READ PHASE: loop sobre solicitudDeterministicIds con tx.get, popula Map<string, boolean>"
  - "solicitudesFacturacion payload: items snapshot con crypto.randomUUID fallback para item ids, ordenesCompraIds snapshot"

requirements-completed: [PTYP-04, FMT-03]

# Metrics
duration: 6min
completed: 2026-04-22
---

# Phase 10 Plan 04: Services Extensions Summary

**Auto-OT ventas post-commit con pendingAction fallback + solicitudesFacturacion en tx de cerrarAdministrativamente con ID determinístico idempotente + 3 métodos nuevos en facturacionService**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-22T04:38:34Z
- **Completed:** 2026-04-22T04:44:07Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `aceptarConRequerimientos` extendido: cuando tipo === 'ventas', post-commit crea 1 OT genérica via lazy import de otService; idempotencia por query `budgets array-contains`; pendingAction fallback si falta coordId o si OT create falla (presupuesto queda aceptado en todos los casos)
- `cerrarAdministrativamente` refactorizado con READ PHASE / WRITE PHASE estrictos: sentinels de solicitudesFacturacion leídos en loop en READ PHASE, Map consultado en WRITE PHASE; ID determinístico `{otNumber}_{presupuestoId}` evita duplicados en race conditions; body de mail con CTA deep link al dashboard; return extendido con `solicitudIds`
- `facturacionService` extendido con `marcarEnviada`, `marcarFacturada`, `agregarNota` — listos para el dashboard Phase 10-06

## Task Commits

1. **Task 1: Auto-OT ventas en aceptarConRequerimientos** - `c25da87` (feat)
2. **Task 2: cerrarAdministrativamente + solicitudesFacturacion + deep link** - `2146f88` (feat)
3. **Task 3: marcarEnviada / marcarFacturada / agregarNota** - `45ab8cf` (feat)

## Files Created/Modified

- `apps/sistema-modular/src/services/presupuestosService.ts` - Bloque ventas (Paso 6) al final de `aceptarConRequerimientos`: +59 líneas
- `apps/sistema-modular/src/services/otService.ts` - `cerrarAdministrativamente` restructurado con READ/WRITE PHASE + solicitudesFacturacion: +100 líneas / -11 eliminadas + JSDoc extendido
- `apps/sistema-modular/src/services/facturacionService.ts` - `marcarEnviada`, `marcarFacturada`, `agregarNota` al final del objeto: +48 líneas

## Decisions Made

- **Lazy import** en presupuestosService para importar otService: mismo patrón que Phase 8-03 (leadsService importaba presupuestosService). Evita circular dep sin reorganizar módulos.
- **Post-commit (no nested tx)** para auto-OT: `getNextOtNumber()` usa su propio runTransaction — no anidable por SDK de Firebase. Best-effort post-commit + pendingAction fallback es el patrón correcto.
- **condicionPago: ''**: en solicitudesFacturacion vacío — Phase 10-06 dashboard permite editar antes de enviar al contable.
- **marcarFacturada acepta datos?: opcionales**: permite disparar transición de estado desde dashboard sin tener numero de factura AFIP todavía.
- **bodyWithCTA**: reemplaza `body` en mailQueue doc; incluye path relativo `/facturacion?solicitudId=X`, consumer compone URL base desde env. Backward compat si consumer ya consumió doc: body es string, formato sin breaking change.

## Idempotency Strategy — Diagrama READ/WRITE PHASE

```
cerrarAdministrativamente(otNumber, cierreData, actor):

Pre-tx (fuera de runTransaction):
  - getByOtNumber(otNumber) → ot
  - adminConfigService.getWithDefaults() → mailTo
  - presupuestosService.getAll() → presupuestosPorNumero, presupuestoIds
  - solicitudDeterministicIds = presupuestoIds.map(pid => `${otNumber}_${pid}`)

runTransaction:
  READ PHASE (todos los tx.get aquí):
    R1: tx.get(doc('reportes', otNumber)) → validate existe
    R2+: for solId of solicitudDeterministicIds:
           tx.get(doc('solicitudesFacturacion', solId)) → existingSolicitudes Map

  WRITE PHASE (todos los tx.set/update después):
    W1: tx.update(otRef, { estadoAdmin: 'CIERRE_ADMINISTRATIVO', ... })
    W2: tx.set(newAdminTicketRef, adminTicketPayload)
    W3: tx.set(newMailQueueRef, { body: bodyWithCTA, ... })
    W4+: for each presupuestoId:
           if !existingSolicitudes.get(solId) → tx.set(solRef, solPayload)
           else → skip (idempotent)

Post-tx:
  - leadsService.syncFromOT (best-effort)
```

## Deviations from Plan

None - plan executed exactly as written. El error TS2322 en presupuestosService.ts línea 415 (`clienteNombre: null`) es pre-existing (reserva de stock, no relacionado con nuestros cambios) y no introducido en este plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PTYP-04 cerrada: auto-OT ventas production-ready con pendingAction fallback
- FMT-03 cerrada: solicitudesFacturacion en tx idempotente — ready para 10-05 (exports) y 10-06 (dashboard)
- facturacionService.marcarEnviada/marcarFacturada/agregarNota ready para wiring en dashboard 10-06
- E2E tests que pueden salir de fixme: specs que aserten OT auto-creada en ventas + solicitudesFacturacion en cierre admin

---
*Phase: 10-presupuestos-partes-mixto-ventas*
*Completed: 2026-04-22*
