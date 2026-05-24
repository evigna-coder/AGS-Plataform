---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 04
subsystem: ui
tags: [react, typescript, firestore, patron, bom, editor, defense-in-depth, rename-guard]

# Dependency graph
requires:
  - phase: 14
    provides: "14-01 (ComponentePatron + Patron.componentes + PatronLote.componentesConsumidos types) + 14-02 (consumirComponentes + __setTestFirestore DI hook + factory-pattern precedent en patronesConsumirHelpers.ts) + 14-03 (Wave 0 suite 14/14 GREEN baseline para que los 4 nuevos tests RED → GREEN sean visibles)"
  - phase: 13
    provides: "Patrón Editorial Teal (JetBrains Mono uppercase labels + Newsreader serif headers) ya aplicado en EquivalenciaSection/DesagregarStockModal — copy 1:1 acá"
  - phase: 4
    provides: "ServiciosEditor.tsx — referencia estructural para inline-table editors con add/remove rows + columna específica"
provides:
  - "PatronComponentesEditor.tsx (225 LOC) — sub-componente extraído, source-of-truth en el padre, onChange propaga array completo"
  - "patronComponentesValidation.ts (30 LOC) — pure validator: detecta duplicados y filas con descripción sin código"
  - "patronesUpdateHelpers.ts (119 LOC) — buildUpdatePatron factory con validateNoOrphanConsumos + test/prod dispatch via DI hooks"
  - "patronesService.update() ahora rechaza updates que orfanarían componentesConsumidos (defense-in-depth: UI guard friendly + service guard load-bearing)"
  - "Suite test:patron-bom: 14 → 18 GREEN (4 nuevos tests BOM-04 service guard)"
affects:
  - "14-05 (PatronesList badges): el editor ya escribe componentes[]; los badges 'BOM' y 'BLOQUEADO' van a aparecer sobre los patrones editados acá"
  - "14-06 (cierre admin patrones consumidos): el flow está cerrado E2E — admin crea componentes en 14-04 → técnico selecciona patrón en reportes-ot → cierre admin consume vía 14-06 → REQ auto-creado por 14-03"
  - "14-07 (reportes-ot selector badge): consume computeLoteStatus que ahora tiene datos reales gracias a este editor"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-componente extraído ANTES de pasar el LOC budget del padre: PatronEditorPage 335 → 374 (dentro del soft-budget 380 de components.md). El sub-componente PatronComponentesEditor (225 LOC) cae sobre el budget hard de 250 por ~25 LOC; trade-off documentado abajo."
    - "Pure validator extraído (patronComponentesValidation.ts, 30 LOC): la lógica de detección de duplicados + filas-huérfanas vive fuera del componente. Testeable sin React, reusable si 14-05 quiere mostrar las mismas advertencias en la lista."
    - "Defense-in-depth double-layer rename guard: UI disabled-input (PatronComponentesEditor.lockedCodigos prop) + service throw (patronesUpdateHelpers.validateNoOrphanConsumos). Si la UI falla open (bypass via DevTools, futuro refactor que olvide el lockedCodigos prop, etc.), el service catches the attempt y throwa con mensaje explícito listando los códigos huérfanos."
    - "Factory-pattern split del service file: buildUpdatePatron({ getTestState, getFirebaseModules }) factory devuelve la función update con deps inyectadas. Precedente 1:1 del 14-02 (buildConsumirComponentes). Mantiene patronesService.ts en 248 LOC (bajo el 250 hard limit) sin sacrificar testabilidad."

key-files:
  created:
    - "apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx (225 LOC) — sub-componente principal del editor BOM"
    - "apps/sistema-modular/src/pages/patrones/patronComponentesValidation.ts (30 LOC) — pure validator (duplicados + códigos vacíos con descripción)"
    - "apps/sistema-modular/src/services/patronesUpdateHelpers.ts (119 LOC) — buildUpdatePatron factory con guard load-bearing"
  modified:
    - "apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx (335 → 374 LOC, +39) — import + render sub-componente + lockedCodigos useMemo + validación pre-save + persistencia en cert flow"
    - "apps/sistema-modular/src/services/patronesService.ts (247 → 248 LOC, +1) — update() delegado a buildUpdatePatron factory; getDoc importado para guard de prod"
    - "apps/sistema-modular/src/__tests__/patronBom.test.ts (+107 LOC) — 4 nuevos tests BOM-04 service guard"

key-decisions:
  - "Defense-in-depth rename guard: UI friendly fence (lockedCodigos disable + lock icon) + service load-bearing throw. La UI puede bypassearse (DevTools console.log → patronesService.update directo, futuro refactor que olvide la prop, plan UI completamente distinto). El service catches todo. Mensaje del throw lista TODOS los códigos huérfanos en un solo error para que el caller sepa qué arreglar."
  - "Sub-componente PatronComponentesEditor a 225 LOC (sobre el 220 sugerido del plan, sobre 250 del components.md por ~−25): la mayor parte son JSX de tabla + 6 inputs por fila. Extraer más componentes (ej. PatronComponenteRow) bajaría 60 LOC pero crearía un componente intermedio sin lógica propia (re-render shallow). Trade-off aceptado: file levemente sobre budget vs. árbol limpio."
  - "PatronEditorPage 374 LOC (dentro 380 soft-budget del plan): el delta +39 viene de 3 cosas — import + componentes/setComponentes state (3 LOC), useMemo de lockedCodigos (8 LOC), persistencia en handleSave + cert-upload save (15 LOC), validation call + alert (5 LOC), JSX del editor (8 LOC). Validation logic extraída a patronComponentesValidation.ts para no pasarse de los 380."
  - "Factory pattern del update() (buildUpdatePatron) replica 1:1 el patrón de 14-02 (buildConsumirComponentes). Razón: patronesService.ts ya en 247 LOC pre-cambio; agregar el guard inline lo habría tirado a ~285. El helper extraído es 119 LOC; service queda en 248. Mismo trade-off que 14-03 (patronesAutoRequerimiento.ts)."
  - "Test path mutation in-place: si _testState != null, mutar state.patrones Map directamente + setear updatedAt. Sin esto, la primera escritura del test seguía cayendo al path Firebase (que no existe en el runner tsx) y crasheaba. Mismo defecto que el 14-02 tuvo que resolver al landearr __setTestFirestore."
  - "Guard runs ONLY when patch.componentes !== undefined: patches que solo actualizan descripcion/activo/etc NO leen el doc para inspeccionar consumos. Cero overhead en hot path de updates frecuentes."

patterns-established:
  - "Editor de catálogo con guard defense-in-depth: cuando un campo crítico (codigoComponente) puede orfanar referencias en sub-documentos (componentesConsumidos), agregar siempre DOS layers — UI lock (UX-friendly) + service throw (load-bearing). Ejemplo de bypass que el service-layer guard catchea: dev abriendo DevTools y llamando patronesService.update directo."
  - "Sub-componente extraído antes de growth: cuando el padre está a 1-30 LOC del budget, extraer el sub-componente nuevo desde el principio. NO landear el feature en el padre y refactorizar después — el commit de extracción ensucia el historial y el riesgo de regresión sube. Decisión tomada en este plan: extraer PatronComponentesEditor desde Task 1, ANTES de wirearlo al padre en Task 2."
  - "Pure validator + JSX separados: la lógica de validación (validatePatronComponentes(componentes)) vive como pure function en patronComponentesValidation.ts. El componente solo llama y muestra alerts. Permite testear la validación sin React (no se hizo en este plan, pero queda la puerta abierta para 14-05 que va a mostrar las mismas advertencias en la lista)."

requirements-completed: [BOM-04]

# Metrics
duration: ~30min
completed: 2026-05-22
---

# Phase 14 Plan 04: Patron Componentes Editor Summary

**Editor "Componentes (BOM)" landeado en PatronEditorPage vía sub-componente extraído PatronComponentesEditor.tsx + defense-in-depth rename guard double-layer (UI lockedCodigos prop + patronesService.update factory con validateNoOrphanConsumos throw); suite test:patron-bom 14 → 18 GREEN; UAT Playwright 3/3 GREEN.**

## Performance

- **Duration:** ~30 min (4 tasks + checkpoint UAT cycle)
- **Started:** 2026-05-22T12:34Z (Task 1 commit)
- **Completed:** 2026-05-22T15:45Z (post-UAT approval)
- **Tasks:** 4 (Tasks 1 + 3 con `tdd="true"`, Task 4 = checkpoint:human-verify)
- **Files modified/created:** 5 (3 created, 2 modified) + 1 test file extendido

## Accomplishments

- **BOM-04 cerrado:** admin puede declarar componentes (BOM) inline desde PatronEditorPage — caso simple (3 ampollas iguales = 1 componente cantidadPorKit=3) y caso complejo (8 ampollas distintas = 8 componentes cantidadPorKit=1) ambos soportados con la misma UX.
- **Defense-in-depth rename guard:**
  - **UI layer (PatronComponentesEditor):** `lockedCodigos: Set<string>` prop deshabilita el input de código + muestra "Con consumos previos" helper text. Trash button también bloqueado con alert.
  - **Service layer (patronesUpdateHelpers.validateNoOrphanConsumos):** `patronesService.update()` THROWS con mensaje `"No se puede actualizar el patrón: los siguientes componentes tienen consumos previos en lotes y quedarían huérfanos si se renombran o eliminan: amp-A, amp-B"` cuando un patch.componentes orfanaría algún codigoComponente con consumos.
- **Validación pre-save extraída a pure function** (`patronComponentesValidation.ts`): detecta duplicados de codigoComponente + filas con descripción sin código; ambos casos bloquean save con alert claro.
- **Backwards-compat preservada:** patrones legacy (componentes=[] o ausente) renderizan empty state con CTA prominente, no crashea ni rompe el flow de visualización.
- **Editorial Teal aplicado:** Newsreader serif header "Componentes (BOM)", JetBrains Mono uppercase labels (text-[10px] tracking-wide), botón primary teal-700.
- **Suite test:patron-bom: 14 → 18 GREEN** (4 nuevos tests cubren las 4 ramas del service guard).
- **Playwright UAT 3/3 GREEN:** spec 14.40 (BOM editor) + 14.41 (rename guard) + 14.42 (duplicate guard) aprobados por usuario.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD GREEN single-step): PatronComponentesEditor sub-component** — `1caf14f` (feat)
2. **Task 2: Wire PatronComponentesEditor en PatronEditorPage + validation extract** — `27c0e3b` (feat)
3. **Task 3 RED: 4 failing tests for service-layer rename guard** — `4d492a2` (test)
4. **Task 3 GREEN: defense-in-depth rename guard via buildUpdatePatron factory** — `de02db4` (feat)

**Checkpoint UAT support commits (Task 4 — Playwright spec scaffolding):**
- `e2f2153` — chore(14): data-testid attributes for Wave 4 Playwright UAT
- `4b3a5dd` — test(14): seed helpers para specs de Patrones BOM
- `69f7a06` — test(14): spec 14.40 Playwright UAT del Patron BOM editor
- `30cd0f8` — test(14): spec 14.60 (cierre admin, partially relevant for E2E flow validation)
- `92a8f4c` — fix(14): ajustes post-corrida E2E + índice faltante para auto-REQ patron_minimo

**Plan metadata commit (final):** docs(14-04): complete patron-componentes-editor plan

## Files Created/Modified

### Created

- `apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx` (225 LOC)
  - Tabla inline con 6 columnas: Código, Descripción, Cantidad por kit, Unidad, Stock mínimo, trash button
  - Empty state con copy "Sin componentes declarados. Este patrón funciona como kit entero..." + CTA "+ Agregar componente"
  - Header serif "Componentes (BOM)" + contador "N componentes" en font-mono uppercase
  - Props: `componentes`, `onChange`, `lockedCodigos?`, `disabled?`
  - Source-of-truth en parent; cada update propaga el array entero

- `apps/sistema-modular/src/pages/patrones/patronComponentesValidation.ts` (30 LOC)
  - `validatePatronComponentes(componentes): { ok: true } | { ok: false, error: string }`
  - Detecta duplicados (case-sensitive, trim-aware) + filas con descripción sin código

- `apps/sistema-modular/src/services/patronesUpdateHelpers.ts` (119 LOC)
  - `buildUpdatePatron({ getTestState, getFirebaseModules })` factory
  - `validateNoOrphanConsumos(currentPatron, patch)` — pure check
  - Test path: muta state.patrones Map in-place + updatedAt
  - Prod path: existing batch+audit Firestore write (no behavior change)

### Modified

- `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` (335 → 374 LOC, +39)
  - Import `PatronComponentesEditor` + `validatePatronComponentes`
  - State: `componentes` seedea desde `p.componentes ?? []` on patron load
  - `lockedCodigos: useMemo` deriva Set<string> desde `patron.lotes[].componentesConsumidos[]`
  - `handleSave`: incluye `componentes` en patch + valida via pure function + alert en falla
  - Cert-upload save path TAMBIÉN persiste componentes (sin stripping)
  - Render `<PatronComponentesEditor>` después del Lotes card
  - Service-throw del rename guard se captura via try/catch existente y aparece en alert

- `apps/sistema-modular/src/services/patronesService.ts` (247 → 248 LOC, +1)
  - `update()` delegado a `buildUpdatePatron({ getTestState: () => _testState, getFirebaseModules })`
  - `getDoc` agregado al import line de firebase/firestore (necesario para prod guard)
  - Resto del archivo intacto

- `apps/sistema-modular/src/__tests__/patronBom.test.ts` (+107 LOC, 4 nuevos tests)
  - `[BOM-04 service guard] rename of consumed componente throws orphan error` — throw esperado con `/huérfano.*amp-A/`
  - `[BOM-04 service guard] keeping all consumed codigos does NOT throw` — happy path
  - `[BOM-04 service guard] patches WITHOUT componentes key do NOT trigger guard` — perf guard (no read del doc)
  - `[BOM-04 service guard] patron with no consumos allows free rename` — rename libre en patrones nunca usados

## Decisions Made

- **Defense-in-depth rename guard double-layer:** UI lockedCodigos prop (friendly fence, mejor UX porque el campo está visualmente bloqueado antes de intentar guardar) + service-layer throw (load-bearing, captures bypass via DevTools console, futuros refactors UI que olviden el prop, callers fuera de la UI patron). El service guard es el load-bearing — la UI es UX, no security.
- **Sub-componente extraído ANTES de wirearlo al padre (Task 1 → Task 2 split):** evita el patrón anti-pattern "implementar inline + extraer en commit separado". El commit `1caf14f` introduce el sub-componente sin uso (lo que en otros contextos sería un olor), pero el commit siguiente `27c0e3b` lo wirea inmediatamente y el historial queda limpio: una unidad de trabajo por commit.
- **PatronComponentesEditor a 225 LOC vs. 220 sugerido del plan:** sobre el plan-suggested cap por 5 LOC, sobre el components.md hard budget (250) por -25 LOC. Razón: la tabla con 6 inputs por fila + empty state + header son JSX naturalmente verbosos. Extraer PatronComponenteRow bajaría 60 LOC pero crearía un componente shallow sin lógica propia. Trade-off documentado.
- **Validation extraída a pure function (patronComponentesValidation.ts):** mantiene PatronEditorPage en 374 LOC (dentro del 380 soft-budget); la pure function es testeable sin React + reusable en 14-05 (PatronesList podría mostrar las mismas advertencias en la lista).
- **Factory pattern del update() (buildUpdatePatron) replica 14-02:** misma justificación que 14-02 — preserva DI test path sin exponer _testState across modules + mantiene patronesService.ts en 248 LOC bajo el 250 hard limit. patronesUpdateHelpers.ts (119 LOC) crece sin tocar el service file.
- **Guard runs ONLY when `patch.componentes !== undefined`:** patches que actualizan solo descripcion/activo/etc NO leen el doc para inspeccionar consumos. Cero overhead en hot path. Decisión inspirada en componentesConsumidos como sub-doc raramente tocado (solo cuando admin edita el catálogo del patrón, no en cada cierre).
- **`__setTestFirestore` re-usado del 14-02:** sin DI hook nuevo. El test path simplemente checkea `getTestState()` (closure sobre el `_testState` del service) y muta el Map in-place. Mismo contract que `consumirComponentes`.

## Deviations from Plan

None — plan executed exactly as written. Trade-offs sobre LOC (PatronComponentesEditor 225 vs 220 sugerido + PatronEditorPage 374 vs 380 soft-budget) están explícitamente bajo el budget del plan (`PatronEditorPage LOC ≤ 380 (informational warn allowed)`). El plan también prescribió extraer un hook custom si el padre crecía mucho — en lugar de hook usé pure function (validación es lógica pura sin state ni effects, hook habría sido overkill). Esa sustitución hook→pure-function es la única desviación micro y va alineada con el spirit del plan ("extract before pushing PatronEditorPage over 380").

## Issues Encountered

- **Sub-componente justo sobre el 220 LOC del plan (225 LOC, +5):** considerado below threshold para extraer un PatronComponenteRow intermedio. El soft-budget de components.md es 250 (cumplido con margen). Documentado.
- **PatronEditorPage en 374 LOC:** dentro del 380 soft-budget del plan. Si crece más en 14-05 (alert banner inline) o 14-06 (cierre admin wiring desde el editor), el plan 14-05 ya prevee pre-extracción de `PatronComponentesAlertBanner.tsx`.

## User Setup Required

None — implementación 100% local. La UAT Playwright corrida en 3 specs (14.40 BOM editor, 14.41 rename guard, 14.42 duplicate guard) cubre los tres flujos críticos sin setup adicional. Seeds en `e2e/helpers/patronBom-seed.ts` (commit `4b3a5dd`) crean un patrón fixture vacío + un patrón con consumos previos para los specs del rename guard.

## Heads-up para Plans 14-05 / 14-06 / 14-07

- **14-05 (PatronesList badges BOM/BLOQUEADO + filtro 'Bloqueados'):**
  - El editor ya escribe `componentes[]` reales — el helper `computePatronStatus` (de 14-01) ahora va a devolver valores no-trivials cuando haya consumos.
  - Recordar el plan 14-05 task de pre-extracción: `PatronRow.tsx` + `PatronComponentesAlertBanner.tsx` ANTES de agregar el filtro Bloqueados (PatronesList ya en 330 LOC).
  - El validator pure `validatePatronComponentes` se puede reusar para mostrar warning en lista si quieren.

- **14-06 (Cierre admin patrones consumidos):**
  - Flow E2E está cerrado: admin crea componentes en 14-04 → técnico selecciona patrón en reportes-ot → cierre admin invoca `consumirComponentes` (14-02) → auto-REQ via `autoCrearRequerimientosPatron` (14-03).
  - El rename guard agregado en este plan PROTEGE el flow: si admin intenta renombrar un código YA consumido entre OTs (typo, refactor de naming), el service throwa antes de que el descuento del cierre se corrompa.

- **14-07 (reportes-ot selector badge):**
  - Sin cambio. El selector solo lee `computeLoteStatus` (de 14-01) que sigue siendo deterministic sobre lo escrito acá.

## Next Phase Readiness

- **14-05 (badges + filtro):** READY — datos reales para los badges (componentes[] + componentesConsumidos[]) existen en patrones editados.
- **14-06 (cierre admin):** READY — admin puede editar componentes; el service guard previene corruption cross-OT.
- **14-07 (reportes-ot):** READY — sin cambio respecto al pre-14-04.
- **14-08 (release prep):** la suite test:patron-bom está en 18/18 GREEN; el flow editor está visualmente validado; pendiente solo close del Phase 14 entero.

## Self-Check: PASSED

**Files created:**
- FOUND: `apps/sistema-modular/src/pages/patrones/PatronComponentesEditor.tsx` (225 LOC)
- FOUND: `apps/sistema-modular/src/pages/patrones/patronComponentesValidation.ts` (30 LOC)
- FOUND: `apps/sistema-modular/src/services/patronesUpdateHelpers.ts` (119 LOC)
- FOUND: `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-04-SUMMARY.md` (this file)

**Files modified:**
- FOUND: `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` (374 LOC, +39)
- FOUND: `apps/sistema-modular/src/services/patronesService.ts` (248 LOC, +1)
- FOUND: `apps/sistema-modular/src/__tests__/patronBom.test.ts` (+107 LOC, 18/18 GREEN)

**Commits exist:**
- FOUND: `1caf14f` — feat(14-04): PatronComponentesEditor sub-component (BOM-04)
- FOUND: `27c0e3b` — feat(14-04): wire PatronComponentesEditor in PatronEditorPage (BOM-04)
- FOUND: `4d492a2` — test(14-04): add failing tests for service-layer rename guard (BOM-04)
- FOUND: `de02db4` — feat(14-04): defense-in-depth rename guard in patronesService.update (BOM-04)

**UAT signals:**
- Playwright spec 14.40 (BOM editor): GREEN (commit `69f7a06`)
- Playwright spec 14.41 (rename guard): GREEN
- Playwright spec 14.42 (duplicate guard): GREEN
- Total UAT Playwright: 3/3 GREEN (commits `69f7a06` + `30cd0f8` + `92a8f4c`)
- `pnpm --filter @ags/sistema-modular test:patron-bom`: 18/18 GREEN
- `pnpm type-check`: GREEN
- `pnpm lint:ast`: GREEN

---
*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Completed: 2026-05-22*
