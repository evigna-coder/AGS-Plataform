---
phase: 03-presupuestos-plantillas-texto
plan: 07
subsystem: database
tags: [firestore, seed, migration, browser-script, plantillas-texto, presupuestos]

requires:
  - phase: 03-presupuestos-plantillas-texto
    provides: "PlantillaTextoPresupuesto type + plantillasTextoPresupuestoService (03-01)"

provides:
  - "Browser-based one-shot seed script at apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs"
  - "8 default plantillas bootstrapped from PRESUPUESTO_TEMPLATES: 6 base (servicio/partes/ventas/mixto) + 2 contrato"
  - "plainToHtml conversion: bullets → <ul><li>, blank lines → <br>, text → <div>"
  - "Idempotent by (nombre, tipo) key — safe to re-run"
  - "Closes VERIFICATION gap #5"

affects: [03-04-plan, 03-05-plan, UAT-phase-03]

tech-stack:
  added: []
  patterns:
    - "Browser-based seed script pattern (outer mjs logs inner script for console paste)"
    - "Idempotency via existingKeys Set with composite key (nombre + tipo)"
    - "plainToHtml: consecutive bullet lines collapse into single <ul>, blank lines → <br>, text → <div>"

key-files:
  created:
    - apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs
  modified: []

key-decisions:
  - "null (not undefined) for all absent audit fields (createdBy, createdByName, updatedBy, updatedByName) — Firestore hard rule"
  - "Idempotency uses (nombre, tipo) composite key, not document id — addDoc lets Firestore auto-generate ids"
  - "PRESUPUESTO_TEMPLATES inlined as single-quoted strings to avoid backtick/template-literal escaping complexity"
  - "Bullet detection uses unicode escape \\u2022 in the inner script string so it survives the outer template literal"
  - "8 plantillas: 6 with tipoPresupuestoAplica=['servicio','partes','ventas','mixto'] + 2 contrato-specific"

patterns-established:
  - "Seed scripts: outer .mjs file just console.log(script) so no Firestore writes happen on node execution"
  - "All string content for Firestore seed uses single-quoted strings (no template literals inside template literal)"

requirements-completed: [SCOPE-PLANTILLAS-SEED]

duration: 5min
completed: 2026-04-29
---

# Phase 03 Plan 07: Seed Script for plantillas_texto_presupuesto Summary

**Browser-based one-shot seed that creates 8 default plantillas from PRESUPUESTO_TEMPLATES with plainToHtml conversion and idempotency by (nombre, tipo) key**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T02:05:26Z
- **Completed:** 2026-04-29T02:10:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `seed-plantillas-texto-browser.mjs` following the `fix-inyectores-browser.mjs` pattern
- 6 base plantillas cover all sections (notasTecnicas, notasAdministrativas, garantia, variacionTipoCambio, condicionesComerciales, aceptacionPresupuesto) for tipos servicio/partes/ventas/mixto
- 2 contrato-specific plantillas (notasSobrePresupuesto mapped to tipo=notasTecnicas, and condicionesComerciales)
- Idempotency: reads existing docs first, skips by (nombre, tipo) composite key — safe to re-run on same DB
- All audit fields use null per Firestore hard rule; no undefined written

## Task Commits

1. **Task 1: Create the seed script with HTML conversion + idempotency check** - `0efd5ad` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs` — One-shot browser seed for plantillas_texto_presupuesto; 138 lines; outer file logs inner script for console paste

## Decisions Made

- PRESUPUESTO_TEMPLATES content inlined as single-quoted strings (not template literals) inside the outer template literal — avoids nested backtick escaping issues entirely
- Bullet character (U+2022 •) detection uses `•` unicode escape in the inner plainToHtml function string so it survives the outer template literal stringification correctly
- `addDoc` used (not `setDoc` with fixed id) — idempotency is by content key, not by document id
- `null` for all four audit fields (createdBy, createdByName, updatedBy, updatedByName) — script has no user context; typed as `string | null` in the interface (per 03-01 SUMMARY)

## Seeded Plantillas

| # | Nombre | tipo | tipoPresupuestoAplica |
|---|--------|------|-----------------------|
| 1 | Notas Tecnicas - Estandar | notasTecnicas | [servicio, partes, ventas, mixto] |
| 2 | Notas Administrativas - Estandar | notasAdministrativas | [servicio, partes, ventas, mixto] |
| 3 | Garantia - Estandar | garantia | [servicio, partes, ventas, mixto] |
| 4 | Variacion Tipo de Cambio - Estandar | variacionTipoCambio | [servicio, partes, ventas, mixto] |
| 5 | Condiciones Comerciales - Estandar | condicionesComerciales | [servicio, partes, ventas, mixto] |
| 6 | Aceptacion del Presupuesto - Estandar | aceptacionPresupuesto | [servicio, partes, ventas, mixto] |
| 7 | Notas sobre Presupuesto - Contrato | notasTecnicas | [contrato] |
| 8 | Condiciones Comerciales - Contrato | condicionesComerciales | [contrato] |

All 8 have `esDefault: true`, `activo: true`.

## Environment Seed Status

| Environment | Seeded | Date |
|-------------|--------|------|
| local (localhost:3001) | No — pending user execution | — |
| production | No — pending user execution | — |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Admin must run the seed once per environment:**

1. Open `localhost:3001` (dev) or production URL, authenticate as admin.
2. In terminal: `node apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs`
3. Copy the printed script.
4. Paste into browser console (F12 → Console).
5. Expected output: `Done. Created: 8. Skipped: 0. Total seeded so far: 8`
6. Re-running is safe: `Done. Created: 0. Skipped: 8. Total seeded so far: 8`

## Next Phase Readiness

- Seed script ready for admin execution on both local and production
- After seeding, 03-04 (per-section dropdown) and 03-05 (auto-apply on tipo select) will have data to display
- VERIFICATION gap #5 is closed — UAT for Phase 03 is unblocked

---
*Phase: 03-presupuestos-plantillas-texto*
*Completed: 2026-04-29*
