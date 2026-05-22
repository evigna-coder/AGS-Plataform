---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 01
subsystem: database
tags: [typescript, types, firestore, patron, bom, shared-package, deep-import]

# Dependency graph
requires:
  - phase: 14
    provides: "14-00 — Wave 0 RED baseline (14 tests fixtures + scripts + test:patron-bom npm script)"
  - phase: 13
    provides: "lazy-firebase-import pattern (equivalenciasService) — replicated to patronesService to unblock tsx test runner"
provides:
  - "ComponentePatron + PatronComponenteConsumido interfaces (Patron BOM model)"
  - "Patron.componentes? extension (backwards-compat optional field)"
  - "PatronLote.componentesConsumidos? extension (per-lote consumption ledger)"
  - "MovimientoStock.entidadTipo?/patronId?/lote?/codigoComponente? (audit extension)"
  - "OrigenRequerimiento += 'patron_minimo' + label entry"
  - "RequerimientoCompra.patronId?/loteId?/codigoComponente? (auto-req metadata)"
  - "AdminConfigFlujos.usuarioRequerimientosPatronId? (FLOW-07-style responsable)"
  - "5 pure helpers in @ags/shared/utils/patronBom: computeSaldoComponente, computeLoteStatus, computePatronStatus, findLoteFifoDisponible, buildPatronesConsumidosSugerencia"
  - "Deep import path '@ags/shared/utils/patronBom' resolves under Vite (alias) AND tsx/Node (exports map + tsconfig paths)"
  - "patronesService.ts refactored to lazy-import './firebase' (Phase 13 pattern)"
  - "patronesService.__setTestFirestore + consumirComponentes stubs (THROW NOT_IMPLEMENTED) to unblock 9/14 BOM-02 helper tests while 5/14 BOM-03+BOM-08 tests stay RED for 14-02/14-03"
affects:
  - "14-02 (consumirComponentes runTransaction will overwrite the stubs)"
  - "14-03 (auto-req helper extends RequerimientoCompra fields landed here)"
  - "14-04/14-05 (PatronEditorPage + PatronesList consume computeLoteStatus + computePatronStatus)"
  - "14-06 (cierre admin paso consumirá buildPatronesConsumidosSugerencia + findLoteFifoDisponible)"
  - "14-07 (reportes-ot selector consume computeLoteStatus para bloquear lotes — excepción frozen)"
  - "All future shared-package work that needs deep imports (utils/ structure + exports map)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deep import via package.json exports map ('./utils/patronBom' + './*' wildcard) + tsconfig paths ('@ags/shared/*' → src/*) — enables `from '@ags/shared/utils/patronBom'` across Vite (dev/build) + tsx/Node (unit tests)."
    - "Lazy-load './firebase' in services that need to be unit-testable under tsx (mirror Phase 13 equivalenciasService) — avoids `import.meta.env.VITE_*` crash at module-evaluation time."
    - "Stub exports (THROW NOT_IMPLEMENTED) for cross-plan type contracts — pattern from Phase 8 cargarOC."

key-files:
  created:
    - "packages/shared/src/utils/patronBom.ts — 5 pure helpers (130 LOC)"
    - "packages/shared/src/utils/index.ts — renamed from utils.ts (preserves existing helpers: cleanFirestoreData, deepCleanForFirestore, numberToWords, normalizeRazonSocial, etc.)"
  modified:
    - "packages/shared/src/types/index.ts (+38/-1) — 6 type extensions for BOM-01"
    - "packages/shared/src/index.ts — flat re-export of patronBom"
    - "packages/shared/package.json — exports map for deep import"
    - "apps/sistema-modular/tsconfig.json — '@ags/shared/*' path mapping"
    - "apps/sistema-modular/src/services/patronesService.ts — lazy firebase + BOM-03 stubs"

key-decisions:
  - "Patron.componentes/PatronLote.componentesConsumidos quedan opcionales — patrones legacy con array vacío/undefined siguen funcionando exactamente como antes (computeSaldoComponente=Infinity, computeLoteStatus='active')."
  - "Deep import path '@ags/shared/utils/patronBom' implementado vía package.json exports map + tsconfig paths — alternativa a 'flat reexport only', porque la 14-00 test fixture importa por path explícito."
  - "patronesService.ts requirió refactor lazy-firebase para desbloquear tsx tests — gap descubierto al correr el suite. Pattern existente en Phase 13 equivalenciasService aplicado 1:1."
  - "Stubs __setTestFirestore + consumirComponentes en patronesService que THROW NOT_IMPLEMENTED — pattern Phase 8 cargarOC. Permite que los 9 helper tests corran sin que las 5 BOM-03/BOM-08 tests falsamente pasen."

patterns-established:
  - "Deep-import-friendly shared package: src/utils/ as directory (con index.ts barrel) + exports map + tsconfig wildcard path. Plantilla para futuros sub-modules de @ags/shared."
  - "Lazy-firebase services para testability bajo tsx: cualquier service que vaya a tener __setTestFirestore DI hook usa `getFirebaseModules()` async helper en lugar de static import de './firebase'."

requirements-completed: [BOM-01, BOM-02]

# Metrics
duration: 17min
completed: 2026-05-22
---

# Phase 14 Plan 01: Tipos y Helpers Puros Summary

**6 backwards-compat type extensions (ComponentePatron + 5 interface additions) + 5 pure BOM helpers shared entre sistema-modular y reportes-ot, con deep-import support y patronesService lazy-firebase refactor.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-22T14:48:11Z
- **Completed:** 2026-05-22T15:05:09Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 6 (1 created in shared utils, 1 renamed, 4 modified)

## Accomplishments

- **BOM-01 type foundation:** 6 backwards-compat extensions to @ags/shared (`Patron`, `PatronLote`, `MovimientoStock`, `OrigenRequerimiento`, `RequerimientoCompra`, `AdminConfigFlujos`) + 2 new interfaces (`ComponentePatron`, `PatronComponenteConsumido`). All additions optional; no existing consumer breaks.
- **BOM-02 pure helpers:** 5 functions in `packages/shared/src/utils/patronBom.ts` covering saldo computation, lote status (active/bloqueado/agotado), patron aggregate status, FIFO selection y sugerencia dedupe. Sin Firestore, sin async, sin side-effects.
- **Wave 0 baseline:** 9/14 GREEN (todos los BOM-02 helper tests) + 5/14 RED (BOM-03 tx + BOM-08 auto-req — confirma RED baseline correcto para 14-02/14-03).
- **Lazy-firebase refactor:** `patronesService.ts` migrado al pattern Phase 13 — los 9 métodos CRUD existentes preservan su API pública; static `./firebase` import reemplazado por `getFirebaseModules()` async helper.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend @ags/shared types — BOM-01 foundation** — `513fbe3` (feat)
2. **Task 2: Pure BOM helpers + barrel re-export + lazy-firebase stubs** — `e6fd68d` (feat)

## Files Created/Modified

### Created
- `packages/shared/src/utils/patronBom.ts` — 5 pure BOM helpers (130 LOC). Imports only `Patron` y `PatronLote` types; sin Firestore.
- `.planning/phases/14-.../14-01-SUMMARY.md` — este archivo.

### Renamed
- `packages/shared/src/utils.ts` → `packages/shared/src/utils/index.ts` — preserva todos los exports existentes (cleanFirestoreData, deepCleanForFirestore, PRESUPUESTO_TEMPLATES, numberToWords, normalizeRazonSocial, findClienteCandidatesByRazonSocial); cambio puramente estructural.

### Modified
- `packages/shared/src/types/index.ts` (+38/-1)
  - Líneas ~2275 (`PatronLote.componentesConsumidos?`)
  - Líneas ~2279-2295 (nuevas interfaces `ComponentePatron` y `PatronComponenteConsumido`)
  - Línea ~2320 (`Patron.componentes?`)
  - Líneas ~2818-2825 (`MovimientoStock.entidadTipo/patronId/lote/codigoComponente`)
  - Línea ~3235 (`OrigenRequerimiento += 'patron_minimo'`)
  - Línea ~3257 (`ORIGEN_REQUERIMIENTO_LABELS.patron_minimo = 'Patrón (mínimo)'`)
  - Líneas ~3328-3332 (`RequerimientoCompra.patronId/loteId/codigoComponente`)
  - Línea ~1029 (`AdminConfigFlujos.usuarioRequerimientosPatronId`)
- `packages/shared/src/index.ts` — `export * from './utils/patronBom'` adicional al `export * from './utils'`.
- `packages/shared/package.json` — `exports` map con `.`, `./utils/patronBom`, `./*` wildcard.
- `apps/sistema-modular/tsconfig.json` — `paths['@ags/shared/*']: ['../../packages/shared/src/*']` para deep imports.
- `apps/sistema-modular/src/services/patronesService.ts` — refactor a lazy-firebase + stubs `__setTestFirestore` y `consumirComponentes`.

## Decisions Made

- **Deep-import strategy:** packages/shared como directorio (`utils/`) en lugar de archivo (`utils.ts`) + `exports` map + tsconfig wildcard path. Necesario porque la Wave 0 test fixture importa por path explícito (`from '@ags/shared/utils/patronBom'`) y necesita resolver bajo tres runtimes: Vite (dev/build), tsc (type-check), tsx/Node (test).
- **lote como string natural (no id sintético):** RequerimientoCompra.loteId? y MovimientoStock.lote? siguen la recomendación del RESEARCH (pitfall 3): persistir el código de lote tal cual lo escribe el técnico. NO se introduce `PatronLote.id`.
- **patronesService stubs THROW (no fake data):** mismo criterio que cargarOC en Phase 8-01 — un stub que retorna `{movimientoIds:[]}` haría que `[BOM-03 happy]` falsamente pase. Throwing 'NOT_IMPLEMENTED — plan 14-02' deja el RED honesto.
- **Lazy-firebase NO solo para consumirComponentes:** la refactorización tocó TODOS los métodos existentes de patronesService (getAll, getById, create, update, deactivate, activate, delete, uploadCertificadoLote, deleteCertificadoLote, subscribe). En el callsite Vite tree-shakea sin penalty; bajo tsx evita el crash de `import.meta.env`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Lazy-firebase refactor de patronesService**
- **Found during:** Task 2 (correr `pnpm test:patron-bom` por primera vez)
- **Issue:** El archivo de test (Wave 0) importa `__setTestFirestore + consumirComponentes` desde `patronesService`, lo cual cargaba `./firebase`, que crasheaba con `TypeError: Cannot read properties of undefined (reading 'VITE_FIREBASE_API_KEY')` porque tsx no expone `import.meta.env`. Sin este fix los 9 helper tests no corrían (failure al cargar el módulo).
- **Fix:** Reemplazé `import { db, storage, createBatch, ... } from './firebase'` (static) por un async helper `getFirebaseModules()` que carga `./firebase` vía dynamic import on-demand. Los 9 métodos CRUD existentes preservan su API pública (todos eran `async` ya); solo cambia que ahora hacen `const { db } = await getFirebaseModules()` adentro. Pattern existente en `equivalenciasService.ts` (Phase 13).
- **Files modified:** `apps/sistema-modular/src/services/patronesService.ts`
- **Verification:** `pnpm type-check` GREEN; `pnpm test:patron-bom` arranca y corre los 14 tests (antes ni cargaba el módulo).
- **Committed in:** `e6fd68d` (Task 2 commit)

**2. [Rule 3 — Blocking] Stubs `__setTestFirestore` y `consumirComponentes` en patronesService**
- **Found during:** Task 2 (después del fix 1, el módulo carga pero los imports fallaban con `Module '../services/patronesService' has no exported member '__setTestFirestore'`)
- **Issue:** El test file importa dos símbolos del patronesService que solo van a existir en plan 14-02. Sin stubs, el módulo no parsea las imports y ningún test corre.
- **Fix:** Append al final de patronesService.ts de dos exports stub que THROW 'NOT_IMPLEMENTED — patronesService.consumirComponentes lands en plan 14-02'. Pattern: Phase 8-01 `cargarOC` stub.
- **Files modified:** `apps/sistema-modular/src/services/patronesService.ts`
- **Verification:** `pnpm test:patron-bom` ahora corre los 14 tests; 9 GREEN, 5 RED (los 5 RED esperaban estos stubs).
- **Committed in:** `e6fd68d` (Task 2 commit, mismo commit que el lazy-firebase fix)

**3. [Rule 3 — Blocking] Estructura `utils/` directorio + `exports` map para deep import**
- **Found during:** Task 2 step 3 (Wave 0 fixture importa `from '@ags/shared/utils/patronBom'` — path que no resolvía)
- **Issue:** El plan dice "If a `./utils` barrel file already exists from prior fases, prefer to add the re-export there". Pero el barrel `utils.ts` (file) no permitía agregar archivos hermanos accesibles por sub-path. El test importaría `@ags/shared/utils/patronBom` — sin estructura adecuada, NO resuelve bajo Vite/tsc/Node.
- **Fix:** (a) `git mv packages/shared/src/utils.ts → utils/index.ts` (preserva todos los exports), (b) cree `utils/patronBom.ts`, (c) agregué `exports` map en `packages/shared/package.json` con `'./utils/patronBom'` + wildcard `'./*'`, (d) agregué `@ags/shared/*` path en `apps/sistema-modular/tsconfig.json`.
- **Files modified:** package.json (shared), tsconfig.json (sistema-modular), index.ts (shared barrel)
- **Verification:** Deep import resuelve en pnpm type-check + tsx + (asumido) Vite. Backwards-compat: `from '@ags/shared'` y `from '@shared/*'` siguen funcionando.
- **Committed in:** `e6fd68d` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking)
**Impact on plan:** Las 3 deviaciones fueron necesarias para que la verificación automática del plan corriera. Ninguna cambia el alcance funcional declarado en el plan (tipos + helpers + barrel). Establecen patterns reutilizables (deep-import + lazy-firebase) que las plans 14-02..14-07 consumirán directamente.

## Issues Encountered

- Wave 0 (14-00) y mi plan 14-01 se ejecutaron en paralelo — durante mi Task 2, Wave 0 commits aparecieron en el log (eae3fd4 + 24295e7). Sin impacto: Wave 0 fixtures coinciden con los expected imports del helper module que landé.
- Pre-existing TS6133 warnings en el repo (unused vars en agenda, presupuestos, otService, stockAmplioService, etc.) **NO** son scope de este plan; quedan documentados como deferred-items implícitos. El único TS6133 que tiene relación con mi cambio (`fechaActualIso` parameter sin uso) lo fixéy prefijando con `_` (TS strict ignora prefixed-underscore params).

## Next Phase Readiness

- **14-02 listo:** los tipos `MovimientoStock.entidadTipo/patronId/lote/codigoComponente` y los stubs `__setTestFirestore + consumirComponentes` están en patronesService. Plan 14-02 reemplaza los stubs con la implementación runTransaction real y debería turnar 4 tests RED → GREEN (BOM-03 happy + atomicity + granularidad + idempotency).
- **14-03 listo:** los tipos `RequerimientoCompra.patronId/loteId/codigoComponente` + `OrigenRequerimiento='patron_minimo'` + `AdminConfigFlujos.usuarioRequerimientosPatronId` están persistibles. Plan 14-03 agrega el helper `autoCrearRequerimientosPatron` y debería turnar 1 test RED → GREEN (BOM-08 auto-req idempotency).
- **14-04..14-07 listos:** helpers `computeSaldoComponente`, `computeLoteStatus`, `computePatronStatus`, `findLoteFifoDisponible`, `buildPatronesConsumidosSugerencia` exportados y testeados — directamente consumibles por UI plans.

## Self-Check: PASSED

**Files created:**
- FOUND: packages/shared/src/utils/patronBom.ts
- FOUND: packages/shared/src/utils/index.ts (renamed from utils.ts)
- FOUND: .planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-01-SUMMARY.md (this file)

**Commits exist:**
- FOUND: 513fbe3 — feat(14-01): extend @ags/shared types for Patron BOM (BOM-01)
- FOUND: e6fd68d — feat(14-01): pure BOM helpers in @ags/shared/utils/patronBom (BOM-02)

**Test signal:**
- 9/14 BOM-02 tests GREEN (computeSaldoComponente×3, computeLoteStatus×4, findLoteFifoDisponible×1, buildPatronesConsumidosSugerencia×1)
- 5/14 BOM-03+BOM-08 tests RED (expected — turn GREEN in 14-02/14-03)
- pnpm type-check GREEN (root + shared package)

---
*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Completed: 2026-05-22*
