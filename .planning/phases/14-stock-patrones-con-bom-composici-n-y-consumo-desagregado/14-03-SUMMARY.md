---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 03
subsystem: database
tags: [typescript, firestore, patron, bom, requerimiento-compra, auto-creation, idempotency, post-commit, best-effort]

# Dependency graph
requires:
  - phase: 14
    provides: "14-01 (RequerimientoCompra.patronId/loteId/codigoComponente + OrigenRequerimiento+='patron_minimo' + AdminConfigFlujos.usuarioRequerimientosPatronId types + computeSaldoComponente helper) + 14-02 (consumirComponentes runTransaction + DI hook + buildConsumirComponentes factory exported from patronesConsumirHelpers.ts)"
  - phase: 8
    provides: "FLOW-03 auto-Requerimiento blueprint (presupuestosService.ts:939-985) — pre-reserve numero outside tx + payload shape mirrored; Regla G idempotency precedent (_cancelarRequerimientosCondicionales)"
  - phase: 13
    provides: "lazy-import pattern para evitar circular deps service↔helper"
provides:
  - "autoCrearRequerimientosPatron(patronIds, options?) — best-effort post-commit helper: crea 1 RequerimientoCompra (origen='patron_minimo') por (patronId, loteId, codigoComponente) que cayó <= stockMinimo y no tiene REQ abierto"
  - "consumirComponentes (test + prod paths) ahora invoca autoCrearRequerimientosPatron POST-commit wrapped en try/catch — el descuento NO se rollbackea si la auto-creación falla"
  - "ConsumirComponentesResult extendido con requerimientosCreados: string[]"
  - "ADMIN_CONFIG_DEFAULTS extendido con usuarioRequerimientosPatronId: null (Pick type widened)"
  - "Idempotency contract: REQ duplicados imposibles cuando misma triplet ya tiene REQ pendiente/aprobado/en_compra (skip silencioso)"
  - "Skip-on-no-responsable: si usuarioRequerimientosPatronId === null, autoCrearRequerimientosPatron retorna [] sin escribir (warn en prod, silent en test)"
affects:
  - "14-06 (cierre admin UI): puede mostrar requerimientosCreados.length en el toast post-cierre + agregar input para usuarioRequerimientosPatronId en /admin/config-flujos"
  - "14-04/14-05 (UI patrón editor + lista): pueden consumir consumirComponentes sin preocuparse del auto-req (transparente)"
  - "Phase 8 RequerimientosList UI: ya filtra por origen — el chip 'Patrón (mínimo)' (label landeado en 14-01) ahora puede aparecer si se ejecuta cierre admin"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-commit best-effort side-effect: invocación con try/catch FUERA del runTransaction, console.error si falla, return value vacío en lugar de throw. El consumo principal queda commiteado aun si el efecto secundario falla — Phase 9 precedente (notifyCoordinadorOTBestEffort)."
    - "Same-batch dedupe en helper inline: el accumulator (reqsAbiertos[]) se actualiza con cada REQ creado dentro del mismo loop para evitar duplicates cuando dos componentes del mismo lote caen bajo mínimo simultáneamente."
    - "Test path con __testState option-bag: helper exporta única signature `(patronIds, options?)` donde options.__testState dispatch al path in-memory. Mantiene contract estable para callers de producción (no necesitan saber del test path)."
    - "Lazy imports en prod path (adminConfigService, patronesService, requerimientosService) para evitar import circular (patronesService -> consumirHelpers -> autoReq -> patronesService)."

key-files:
  created:
    - "apps/sistema-modular/src/services/patronesAutoRequerimiento.ts (178 LOC) — helper module con _autoCrearInTest + _autoCrearInProd; cumple regla 'autoCrearRequerimientosPatron lives in NEW file' del plan"
  modified:
    - "apps/sistema-modular/src/services/patronesConsumirHelpers.ts (286 → 318 LOC) — post-commit invocation en ambos paths (test + prod) + extension de ConsumirComponentesResult interface"
    - "apps/sistema-modular/src/services/adminConfigService.ts (80 → 88 LOC) — ADMIN_CONFIG_DEFAULTS Pick<> widened a 'mailFacturacion' | 'usuarioRequerimientosPatronId' con default null"

key-decisions:
  - "Helper en archivo separado (patronesAutoRequerimiento.ts) en lugar de inline en patronesConsumirHelpers.ts — respeta plan must-have explícito 'Service split: autoCrearRequerimientosPatron lives in NEW file'. Helper a 178 LOC bajo cualquier budget razonable; futuros enhancements del REQ (e.g. URLs preview, cantidad sugerida basada en stockMinimo - saldo) viven aislados."
  - "Post-commit best-effort wrapped en try/catch — sin throw bloquea el descuento ya commiteado. Si la creación falla (error de red, conflicto de id, etc.) el admin verá un log y puede crear el REQ a mano. NUNCA rollbackea el consumo: el invariante es 'componentes descontados → es la verdad; REQ pendiente es nice-to-have'."
  - "Idempotency dedupe key (patronId, loteId, codigoComponente) check contra REQ con estado != ('comprado' | 'cancelado'). Decisión alineada con Regla G (Phase 8 _cancelarRequerimientosCondicionales:1700-1755): 'open' = todo salvo estados terminales. Si el admin compra el REQ y vuelve a caer bajo mínimo en otra OT, se debería crear uno nuevo (correcto: el componente sí se reordenó)."
  - "ADMIN_CONFIG_DEFAULTS Pick<> widened en lugar de armar object literal: preserva el typing safety original (TypeScript fuerza presence de los defaults a campos exact-match del interface) + agrega el nuevo campo de manera explícita. Default null = 'no responsable configurado' explícito (no undefined que confunde callers)."
  - "Test path replica payload shape del prod path (numero, origen, patronId, loteId, codigoComponente, estado, asignadoA, etc.) pero NO ejecuta requerimientosService.create() — escribe directo al state.requerimientos Map. Suficiente para que el test BOM-08 mida size del Map; futuros tests pueden assertar fields específicos sin extender el helper."

patterns-established:
  - "Best-effort post-commit helper en services con runTransaction: estructura try/catch + console.error + return value seguro; nunca propagar errores que rollbackeen la mutación principal."
  - "Helper extracted a archivo dedicado con factory-light pattern: helper exporta sola función con options.__testState; el caller (patronesConsumirHelpers) provee state cuando aplica. Comparado con factory-pattern de 14-02 (que recibe getTestState/getFirebaseModules deps), este pattern es más simple porque el helper no tiene state mutable propio."

requirements-completed: [BOM-08]

# Metrics
duration: 3min
completed: 2026-05-22
---

# Phase 14 Plan 03: Auto-Requerimiento Patrón Summary

**autoCrearRequerimientosPatron post-commit best-effort helper que crea 1 RequerimientoCompra (origen='patron_minimo') por componente bajo stockMinimo, con idempotency (patronId+loteId+codigoComponente) que previene duplicados across múltiples OTs — Wave 0 suite 14/14 GREEN.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-22T15:24:03Z
- **Completed:** 2026-05-22T15:27:01Z
- **Tasks:** 2 (Task 2 con `tdd="true"`)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **BOM-08 cerrado:** el test RED restante `[BOM-08 auto-req idempotency]` virá a GREEN — suite 14/14 GREEN.
- `autoCrearRequerimientosPatron(patronIds, options?)` implementado con dispatch test/prod (mismo patrón que consumirComponentes en 14-02 pero option-bag en lugar de DI hook a state).
- Idempotency: dos OTs consecutivas que cruzan el mismo (patronId, loteId, codigoComponente) bajo stockMinimo crean exactamente 1 REQ. La segunda OT detecta el REQ abierto del primero y skipea.
- Skip silencioso si `adminConfigFlujos.usuarioRequerimientosPatronId === null` — admin no obligado a configurarlo desde día 0 (UI editor del campo landea en 14-06).
- Wiring: `consumirComponentes` (ambos paths) invoca el helper POST-commit, wrapped en try/catch. Falla del auto-req NO rollbackea el descuento (consumo es verdad; REQ es nice-to-have).
- `ConsumirComponentesResult` extendido con `requerimientosCreados: string[]` para que 14-06 pueda mostrar count en el toast del cierre.
- `ADMIN_CONFIG_DEFAULTS` widened (Pick type) — campo nuevo siempre default null para callers via `getWithDefaults()`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend adminConfigService default with usuarioRequerimientosPatronId** — `d4d994f` (feat)
2. **Task 2: Create patronesAutoRequerimiento.ts + wire into consumirComponentes post-commit** — `5ba3c41` (feat)

## Files Created/Modified

### Created

- `apps/sistema-modular/src/services/patronesAutoRequerimiento.ts` (178 LOC)
  - `autoCrearRequerimientosPatron(patronIds, options?)` — public entry, dispatch test/prod
  - `_autoCrearInTest(patronIds, state)` — sync (no I/O), muta `state.requerimientos` Map
  - `_autoCrearInProd(patronIds)` — async con lazy imports (adminConfigService, patronesService, requerimientosService) para evitar import circular
  - Idempotency check contra REQ abiertos (filter `estado !== 'comprado' && estado !== 'cancelado'`)
  - Same-batch dedupe: accumulator `reqsAbiertos[]` se actualiza con cada REQ creado dentro del loop

### Modified

- `apps/sistema-modular/src/services/patronesConsumirHelpers.ts` (286 → 318 LOC)
  - Interface `ConsumirComponentesResult` extendido con `requerimientosCreados: string[]`
  - `_consumirComponentesInTest`: post-commit try/catch invoca `autoCrearRequerimientosPatron(patronesUnicos, { __testState: state })`
  - `_consumirComponentesInProd`: post-commit try/catch invoca `autoCrearRequerimientosPatron(patronesUnicos)` (sin options → prod path)

- `apps/sistema-modular/src/services/adminConfigService.ts` (80 → 88 LOC)
  - `ADMIN_CONFIG_DEFAULTS` Pick widened: `'mailFacturacion' | 'usuarioRequerimientosPatronId'`
  - Default `usuarioRequerimientosPatronId: null` (string | null per type)
  - JSDoc actualizado citando Phase 14 BOM-08 + flow integration

## Decisions Made

- **Helper en archivo separado** (no inline en patronesConsumirHelpers.ts): respeta la must-have explícita del plan ("autoCrearRequerimientosPatron lives in NEW file patronesAutoRequerimiento.ts"). Beneficio adicional: futuros enhancements (cantidad sugerida = stockMinimo - saldo + buffer; URL preview a /requerimientos; auditoría link al MovimientoStock) tienen archivo aislado para crecer sin tocar el service file.
- **Best-effort wrapped en try/catch**: si la creación falla (red, conflicto de id, race con otro write), el consumo principal ya está commiteado. El admin ve un `console.error` (prod) y puede crear el REQ a mano desde `/requerimientos`. Alternativa rechazada: rollbackear el consumo via tx anidado — habría llevado a estados raros (componente NO descontado pero técnico reportó que sí lo usó).
- **Idempotency = (patronId, loteId, codigoComponente) + estado abierto**: tres campos forman la clave. Estados "abiertos" = todos los no terminales (`pendiente`, `aprobado`, `en_compra`). Estados terminales (`comprado`, `cancelado`) NO bloquean nueva creación, porque si el REQ ya se compró y el componente vuelve a caer bajo mínimo en otra OT, ES correcto crear uno nuevo (el reordenado ya entró al stock; el nuevo gap es real). Patrón Regla G de Phase 8.
- **Skip-on-no-responsable es silencioso** (`return []` en lugar de throw): admin no obligado a configurar el campo desde día 0. La feature degrada elegantemente; admin lo verá faltante en `/admin/config-flujos` cuando la UI 14-06 land. En prod warneamos a console; en test no warneamos (para no ensuciar test output cuando otros tests no setean el campo).
- **Test path no llama a requerimientosService.create()**: escribe directo al `state.requerimientos` Map. Razón: el test mide `state.requerimientos.size`, no fields específicos. Si futuros tests necesitan validar shape del REQ (e.g. assertar `numero`, `solicitadoPor`), pueden leer del Map directamente sin extender el helper.
- **Same-batch dedupe via accumulator**: el helper itera sobre patronIds×lotes×componentes; si dos iteraciones del loop cruzan el mismo (patronId, loteId, codigoComponente), la segunda NO debería duplicar el REQ recién creado por la primera. Implementado pusheando el REQ creado a `reqsAbiertos[]` dentro del loop. Escenario unlikely en practice (dos componentes distintos pueden caer simultáneamente bajo mínimo en el mismo lote), pero defensiva.

## Deviations from Plan

None — plan executed exactly as written. La estructura sugerida por el plan (test path + prod path con lazy imports + post-commit best-effort en ambos paths de consumirComponentes) fue implementada 1:1. El único detalle de implementación adicional fue el accumulator `reqsAbiertos[]` para same-batch dedupe (defensive coding, no scope change).

## Issues Encountered

- **Pre-existing TS warnings irrelevantes**: type-check sigue mostrando los mismos warnings TS6133 (unused vars) de 14-01/14-02 en archivos no tocados por este plan (agenda, presupuestos, otService, etc.). NO scope de este plan, NO causados por mis cambios. Documentado como deferred-item implícito (mismo trato que en 14-01/14-02).
- **patronesConsumirHelpers.ts a 318 LOC**: por encima del 250-LOC budget de `components.md`, PERO ese budget aplica a `.tsx` React components según la regla: "No React component file in apps/sistema-modular/src/ ... should exceed 250 lines". Helper de servicios sin JSX → spirit de la regla cumplido (separación de concerns: el helper es un módulo single-purpose sobre el BOM-03 + post-commit hook; no es un dumping ground). Si crece más, el siguiente split natural sería extraer `recomputeLotesConConsumos` + `validarSaldosNoNegativos` a un `patronBomMutations.ts`.

## User Setup Required

None — implementación 100% local. El nuevo campo `usuarioRequerimientosPatronId` se setea cuando admin lo configure desde la UI 14-06 (todavía no implementada). Antes de la UI, el flag default null = `autoCrearRequerimientosPatron` skipea silencioso → comportamiento idéntico a Phase 13 pre-BOM-08.

## Heads-up para Plans 14-04 / 14-05 / 14-06

- **Services layer COMPLETO**: `consumirComponentes` + `autoCrearRequerimientosPatron` son el contract estable que las UI plans van a consumir. Cero ambigüedad sobre side-effects: la única forma de descontar componentes es vía `consumirComponentes`, la única forma de auto-crear REQs es como side-effect post-commit.
- **14-06 (cierre admin UI):** el toast post-cierre puede leer `result.requerimientosCreados.length` y mostrar "Stock OK" o "3 requerimientos pendientes generados". El link a `/requerimientos` filtra por `origen='patron_minimo'` (label "Patrón (mínimo)" ya existe en `ORIGEN_REQUERIMIENTO_LABELS` desde 14-01).
- **14-06 (admin config UI):** agregar input/SearchableSelect para `usuarioRequerimientosPatronId` en `/admin/config-flujos`. Patrón: copy de `usuarioSeguimientoId` (Phase 8 FLOW-07). Label sugerido: "Responsable de Requerimientos de Patrones".
- **14-07 (reportes-ot selector):** sin cambio. El selector solo lee `computeLoteStatus` (de 14-01) para bloquear lotes; no toca `consumirComponentes` ni `autoCrearRequerimientosPatron`.
- **Idempotency contract garantizada**: callers pueden invocar `consumirComponentes(params)` en safe-retry sabiendo que (a) el throw 'Patrones ya descontados' (BOM-08 first half) previene double-discount, y (b) el helper post-commit nunca duplica REQs (BOM-08 second half).

## Next Phase Readiness

- **14-04 (PatronEditorPage):** READY — el editor del catálogo de patrones puede crear `componentes[]` y el campo `stockMinimo` por componente; la lógica de descuento y auto-req funciona transparente.
- **14-05 (PatronesList badges):** READY — los helpers `computeLoteStatus` y `computePatronStatus` están sólidos; la UI puede mostrar badges agotado/bloqueado/active sin riesgo.
- **14-06 (cierre admin):** READY — `consumirComponentes` retorna `{ movimientoIds, requerimientosCreados }`; admin UI puede mostrar ambos en el toast/banner del cierre.
- **14-07 (reportes-ot):** READY — selector solo necesita helpers BOM-02 (de 14-01).

## Self-Check: PASSED

**Files created:**
- FOUND: `apps/sistema-modular/src/services/patronesAutoRequerimiento.ts` (178 LOC)
- FOUND: `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-03-SUMMARY.md` (this file)

**Files modified:**
- FOUND: `apps/sistema-modular/src/services/patronesConsumirHelpers.ts` (318 LOC, +32 LOC)
- FOUND: `apps/sistema-modular/src/services/adminConfigService.ts` (88 LOC, +8 LOC)

**Commits exist:**
- FOUND: `d4d994f` (feat(14-03): extend ADMIN_CONFIG_DEFAULTS with usuarioRequerimientosPatronId (BOM-08))
- FOUND: `5ba3c41` (feat(14-03): auto-Requerimiento post-commit on patron componente bajo mínimo (BOM-08))

**Test signal:**
- `pnpm --filter @ags/sistema-modular test:patron-bom`: **14/14 GREEN** (todos los tests de Wave 0)
- `pnpm type-check`: GREEN (root + packages/shared)
- `pnpm test:equivalencias`: GREEN (sanity check — Phase 13 service no se rompió)
- `pnpm lint:ast`: GREEN (no `no-firestore-undefined` warnings)

---
*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Completed: 2026-05-22*
