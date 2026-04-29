---
phase: 04-presupuestos-anexo-consumibles
plan: 02
subsystem: api
tags: [firestore, consumibles, presupuestos, admin-crud, react, anexo-pdf]

requires:
  - phase: 04-presupuestos-anexo-consumibles
    provides: ConsumibleModulo + ConsumiblesPorModulo types in @ags/shared (plan 04-01)
provides:
  - consumiblesPorModuloService (CRUD + getByCodigoModulo lookup) — read by builder de anexos en plan 04-04
  - Página admin /presupuestos/consumibles-por-modulo con CRUD inline + búsqueda
  - Entry point en toolbar de PresupuestosList (Editorial Teal, junto a Tipos de equipo)
affects: [04-04-builder-anexo, 04-05-pdf-render-anexo]

tech-stack:
  added: []
  patterns:
    - "Servicio espejo de tiposEquipoService con getByCodigoModulo (lookup case-sensitive por part number)"
    - "deepCleanForFirestore en create/update — payload contiene array nested consumibles[]"
    - "List + Form split (180 + 199 LOC) para mantener budget de 250 líneas"

key-files:
  created:
    - apps/sistema-modular/src/services/consumiblesPorModuloService.ts
    - apps/sistema-modular/src/pages/consumibles-por-modulo/index.ts
    - apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumiblesPorModuloList.tsx
    - apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumibleModuloForm.tsx
  modified:
    - apps/sistema-modular/src/components/layout/TabContentManager.tsx
    - apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx

key-decisions:
  - "deepCleanForFirestore en create+update (no cleanFirestoreData shallow): array consumibles[] es nested y la regla firestore.md exige deep para payloads con arrays de objetos."
  - "getByCodigoModulo NO filtra por activo: política de inactivos queda en el caller (builder anexo plan 04-04 puede filtrar; admin UI puede mostrar)."
  - "codigoModulo case-sensitive: part numbers Agilent son códigos cerrados (decisión CONTEXT.md)."
  - "Form auto-uppercase codigoModulo on blur — captura entrada inconsistente sin trabarte tipeando."
  - "Sin cache (no serviceCache): catálogo cambia con cierta frecuencia y builder de anexos necesita data fresca."
  - "Form en archivo separado (199 LOC) para mantener List bajo 250 líneas (regla components.md)."

patterns-established:
  - "Lookup unique-key en services: query where('field','==',v) limit(1) — sin índice compuesto necesario."
  - "Hydrate normaliza nested arrays: consumibles[] siempre array, cantidad siempre number, codigo/descripcion siempre string."

requirements-completed: [ANXC-02, ANXC-03]

duration: 8 min
completed: 2026-04-29
---

# Phase 04 Plan 02: Servicio + Admin de Consumibles por Módulo Summary

**`consumiblesPorModuloService` (CRUD + lookup case-sensitive por part number) + página admin `/presupuestos/consumibles-por-modulo` con CRUD inline y búsqueda — entry point en toolbar de `PresupuestosList` junto a "Tipos de equipo".**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-29T15:33:32Z
- **Completed:** 2026-04-29T15:41:43Z
- **Tasks:** 3
- **Files created:** 4 (1 service + 3 page files)
- **Files modified:** 2 (TabContentManager + PresupuestosList toolbar)

## Accomplishments

- **Servicio Firestore** con 6 métodos (`getAll`, `getById`, `getByCodigoModulo`, `create`, `update`, `delete`), `deepCleanForFirestore` en writes para garantizar zero-undefined al persistir el array `consumibles[]`, sin cache para freshness.
- **Página admin** operativa con búsqueda por código/descripción, CRUD inline, validación de `codigoModulo` duplicado al crear (lookup pre-write), auto-uppercase on blur.
- **Form editable** con tabla de consumibles (código / descripción / cantidad) + agregar/quitar fila, mismo patrón que `ComponentesEditor` de `TipoEquipoNestedEditors`.
- **Wiring completo**: ruta gateada (`admin / admin_soporte / administracion`) + entry point en toolbar de `PresupuestosList`.
- **Plan 04-04 desbloqueado**: el builder de anexos puede importar `consumiblesPorModuloService.getByCodigoModulo(codigoModulo)` sin trabajo adicional.

## Task Commits

1. **Task 1: consumiblesPorModuloService.ts (CRUD + lookup por codigoModulo)** — `bbde394` (feat)
2. **Task 2: ConsumiblesPorModuloList + ConsumibleModuloForm + index barrel** — `b8147a1` (feat)
3. **Task 3: Wire ruta + entry point en PresupuestosList toolbar** — `270b166` (feat)

## Files Created/Modified

### Created

- `apps/sistema-modular/src/services/consumiblesPorModuloService.ts` (113 lines) — CRUD + getByCodigoModulo, COLLECTION = `'consumibles_por_modulo'`, hydrate normaliza array `consumibles[]`. Plan 04-04 va a importar `consumiblesPorModuloService.getByCodigoModulo()`.
- `apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumiblesPorModuloList.tsx` (180 lines) — Lista admin con `useUrlFilters({ q })`, búsqueda case-insensitive contra `codigoModulo` + `descripcion`, tabla con badge Activo/Inactivo, toggle `showForm` para CRUD inline.
- `apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumibleModuloForm.tsx` (199 lines) — Form con tabla editable de consumibles[], dup-check pre-create via `getByCodigoModulo`, auto-uppercase on blur.
- `apps/sistema-modular/src/pages/consumibles-por-modulo/index.ts` (1 line) — Barrel export.

### Modified

- `apps/sistema-modular/src/components/layout/TabContentManager.tsx` — Import `ConsumiblesPorModuloList` + `Route path="/presupuestos/consumibles-por-modulo"` gated `admin / admin_soporte / administracion`.
- `apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx` — Botón "Consumibles por módulo" en toolbar, junto a "Tipos de equipo", usando `navigateInActiveTab`.

## Decisions Made

Ver `key-decisions` en frontmatter — todas anticipadas en el plan; ninguna decisión nueva durante la ejecución.

## Deviations from Plan

None - plan executed exactly as written.

(Single minor adaptation: en lugar de seguir literalmente la sugerencia "copiar la estructura de TiposEquipoList.tsx líneas 141-251" — que incluye `useResizableColumns`, `SortableHeader`, `ColAlignIcon` y un sort schema URL-based — se simplificó a una tabla plana con `thClass` constante. Razón: el plan explícitamente pide "patrón list-page-conventions" + budget de 250 líneas; reproducir el árbol entero de `TiposEquipoList` (255 líneas) llevaría inevitablemente a violar el budget. La simplificación queda alineada con la sección "Table Tokens" del skill y con el `output` del plan: "documentar cualquier desviación del patrón list-page-conventions y por qué" — ésta es la desviación documentada.)

## Issues Encountered

**Working tree had unrelated uncommitted/untracked changes when plan started.** Pre-existing modifications to `tiposEquipoService.ts`, `apps/reportes-ot/components/*`, and `apps/sistema-modular/src/components/leads/pdf/ReporteVentasInsumosPDF.tsx`, plus untracked `AnexoConsumiblesPDF.tsx` and `buildAnexosFromPresupuesto.ts`, were present in the working tree at plan start. A pre-commit hook auto-classified some of those files into separate `feat(04-03)` and `feat(04-04)` commits during the session (`a9b934c`, `310f552`, `e61f112`, `6a28b7a`). These commits are NOT part of plan 04-02 — they're parallel work from earlier sessions auto-promoted by the project's commit hook. My three Task commits (`bbde394`, `b8147a1`, `270b166`) staged only the files created by this plan.

Type-check baseline = 37 pre-existing errors in unrelated modules (AgendaGridCell, CreateEquipoModal, CreateLoanerModal, MigracionPatronesModal, etc.); my changes introduced **zero** new type errors (verified via `npx tsc --noEmit -p .` baseline-vs-after diff).

## User Setup Required

None - no external service configuration required. Smoke-test post-deploy:

1. Login admin → ir a `/presupuestos`
2. Click "Consumibles por módulo" → la página carga
3. "+ Nuevo módulo" → form aparece
4. Crear "G7129A" con descripción "Inyector Iso Pump" + 2 consumibles → guarda OK
5. Editar → cambios persisten
6. Crear "G7129A" duplicado → alerta de duplicado
7. Eliminar → confirmDialog → remueve

## Next Phase Readiness

- **Plan 04-04 (builder de anexos)** desbloqueado: puede importar `consumiblesPorModuloService.getByCodigoModulo(codigoModulo: string): Promise<ConsumiblesPorModulo | null>` sin trabajo adicional. La política de filtrado por `activo` queda en el builder.
- **Plan 04-05 (PDF render)** indirectamente desbloqueado vía 04-04.

## Self-Check: PASSED

Files verified on disk:

- `apps/sistema-modular/src/services/consumiblesPorModuloService.ts` ✓
- `apps/sistema-modular/src/pages/consumibles-por-modulo/index.ts` ✓
- `apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumiblesPorModuloList.tsx` ✓
- `apps/sistema-modular/src/pages/consumibles-por-modulo/ConsumibleModuloForm.tsx` ✓

Commits verified in `git log --oneline --grep="04-02"`:

- `bbde394 feat(04-02): add consumiblesPorModuloService with CRUD + codigoModulo lookup` ✓
- `b8147a1 feat(04-02): add ConsumiblesPorModuloList admin page + ConsumibleModuloForm` ✓
- `270b166 feat(04-02): wire /presupuestos/consumibles-por-modulo route + toolbar entry` ✓

Wiring verified:

- `grep -n "consumibles-por-modulo" TabContentManager.tsx` → import (line 30) + Route (line 95) ✓
- `grep -n "consumibles-por-modulo" PresupuestosList.tsx` → toolbar Button (line 281) ✓
- `grep -n "deepCleanForFirestore" consumiblesPorModuloService.ts` → 4 matches (import + comment + create + update) ✓
- `grep -n "cleanFirestoreData" consumiblesPorModuloService.ts` → 0 matches ✓
- `grep -n "consumibles_por_modulo" consumiblesPorModuloService.ts` → COLLECTION constant ✓

Component size budget (regla components.md):

- `ConsumiblesPorModuloList.tsx` 180 lines ≤ 250 ✓
- `ConsumibleModuloForm.tsx` 199 lines ≤ 250 ✓
- `consumiblesPorModuloService.ts` 113 lines ≤ 250 ✓

---
*Phase: 04-presupuestos-anexo-consumibles*
*Completed: 2026-04-29*
