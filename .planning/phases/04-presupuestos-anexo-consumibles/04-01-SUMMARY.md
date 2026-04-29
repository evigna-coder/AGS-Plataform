---
phase: 04-presupuestos-anexo-consumibles
plan: 01
subsystem: types
tags: [typescript, shared-types, firestore, presupuestos, consumibles, anexo, mpcc]

# Dependency graph
requires:
  - phase: 03-presupuestos-plantillas-texto
    provides: TipoEquipoServicio + TipoEquipoPlantilla baseline en @ags/shared (extendido aquí)
provides:
  - "TipoEquipoServicio.requiereAnexoConsumibles?: boolean (flag opcional, schema-flexible)"
  - "ConsumibleModulo interface (row shape: codigo/descripcion/cantidad, sin precio)"
  - "ConsumiblesPorModulo interface (Firestore doc shape de colección consumibles_por_modulo)"
affects: [04-02, 04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional flag pattern: campo `?:` opcional con default omitido = false; back-compat con docs Firestore previos sin migración"
    - "Catalog-by-code pattern: doc Firestore unique-key por part number (codigoModulo) reusable entre plantillas"
    - "Firestore-safe audit fields: createdBy/updatedBy y *Name siempre `string | null`, nunca `undefined`"

key-files:
  created: []
  modified:
    - "packages/shared/src/types/index.ts (3 cambios: flag línea 1382 + 2 interfaces líneas 1415 y 1430)"

key-decisions:
  - "Flag ortogonal al campo `tipo` — cualquier tipo (mantenimiento/regulatorio/consumible/otro) puede llevar requiereAnexoConsumibles. NO restringir por tipo."
  - "ConsumibleModulo SIN precio ni periodicidad — el precio queda implícito en el ítem MPCC del PDF principal; periodicidad se decide a nivel de servicio, no de consumible."
  - "consumibles[] vacío = skip silencioso (NO warning) al generar anexo — caso 'módulo sin consumibles declarados intencionalmente'."
  - "Arrays sobre Record<string,...> o Map para `consumibles[]` — orden estable necesario en el PDF anexo."

patterns-established:
  - "Optional schema-flex flags: nuevos campos del modelo se agregan como `?:` para no romper docs previos; reads usan `?? false` para default."
  - "Catálogo declarativo por part number: módulos se registran una sola vez en `consumibles_por_modulo` y se reutilizan via match por `codigoModulo` desde plantillas/sistemas del cliente."

requirements-completed: [ANXC-01]

# Metrics
duration: 2min
completed: 2026-04-29
---

# Phase 04 Plan 01: Foundation Types Summary

**Tipos `@ags/shared` extendidos con flag opcional `requiereAnexoConsumibles` en `TipoEquipoServicio` + nuevas interfaces `ConsumibleModulo` y `ConsumiblesPorModulo` para la colección Firestore `consumibles_por_modulo` — desbloquea Wave 2 (service, admin CRUD, builder anexo, PDF).**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-29T15:23:18Z
- **Completed:** 2026-04-29T15:25:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `TipoEquipoServicio.requiereAnexoConsumibles?: boolean` agregado en `packages/shared/src/types/index.ts:1382` con JSDoc explicando el trigger Phase 4 / ANXC-01 y la naturaleza ortogonal al campo `tipo`.
- `ConsumibleModulo` interface (codigo/descripcion/cantidad, sin precio) en línea 1415.
- `ConsumiblesPorModulo` interface (doc Firestore en colección `consumibles_por_modulo`) en línea 1430 con audit fields Firestore-safe (`string | null`, nunca `undefined`).
- `pnpm type-check` pasa en `packages/shared` y en `apps/sistema-modular` (consumers existentes — `EditPresupuestoModal`, `tiposEquipoService`, etc. — no se rompen).
- Plantillas existentes en Firestore (HPLC 1100, 1200, 1260, 1290 — sin el campo `requiereAnexoConsumibles`) siguen siendo válidas: el flag es opcional y se hidrata como `false` cuando está ausente.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extender TipoEquipoServicio con flag requiereAnexoConsumibles** — `b1723b0` (feat)
2. **Task 2: Agregar tipos ConsumibleModulo + ConsumiblesPorModulo** — `3ba75b4` (feat)

**Plan metadata:** `14a9aa7` (docs: complete foundation types plan — SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified

- `packages/shared/src/types/index.ts` — 3 cambios:
  - Líneas 1374–1383: prop `requiereAnexoConsumibles?: boolean` agregado a `TipoEquipoServicio` con JSDoc.
  - Líneas 1404–1442: nuevo bloque con header de sección Phase 4 + interfaces `ConsumibleModulo` y `ConsumiblesPorModulo`.

## Decisions Made

- **Flag opcional, no required:** Plantillas previas a Phase 4 NO requieren migración. `tiposEquipoService.hydrate()` (en plan 04-03) leerá `data.requiereAnexoConsumibles ?? false` para soportar lecturas viejas. Esto evita un script de backfill que tocaría 7+ docs de plantillas en producción.
- **Schema-flexible (no restringido por `tipo`):** El flag puede aparecer en cualquier `tipo` ('mantenimiento' | 'regulatorio' | 'consumible' | 'otro'). Operacionalmente se usa en MPCC pero el modelo no lo amarra — preserva flexibilidad si en el futuro hay otro caso (ej: regulatorio con consumibles de calibración).
- **Sin precio en `ConsumibleModulo`:** El precio del consumible queda implícito en el ítem MPCC del PDF principal. El anexo es un listado informativo. Si en el futuro hay que cotizar consumibles individualmente, se agrega `precioReferencia?: number | null` (campo opcional, no rompe).
- **Sin periodicidad:** La periodicidad se decide a nivel de servicio (cuándo se ejecuta MPCC), no a nivel de consumible. Cada evento de MPCC consume la misma cantidad declarada en `cantidad`.
- **Arrays para `consumibles[]`:** Mantienen orden estable en el PDF (importante para que técnicos vean ítems en el mismo orden que el catálogo administrativo). `Record<string, ...>` o `Map` no garantiza orden de iteración consistente cross-environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered ANXC-01..ANXC-06 en REQUIREMENTS.md**
- **Found during:** Final metadata sync (post-SUMMARY)
- **Issue:** Las 5 plans de Phase 4 (04-01..04-05) declaran requirements `ANXC-01..ANXC-06` en su frontmatter, pero `.planning/REQUIREMENTS.md` nunca los registró — el phase planner saltó este paso. Esto bloquea `gsd-tools requirements mark-complete` para todas las plans de la fase (devuelve `not_found`) y rompe la traceability matrix.
- **Fix:** Agregada sección "Anexo de Consumibles por Módulo" con ANXC-01..ANXC-06 (ANXC-01 = `[x]`, resto = `[ ]`); 6 filas nuevas en la tabla Traceability; coverage actualizada de 43/43 a 49/49.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Grep confirma ANXC-01 presente en sección + tabla; coverage line ahora dice "49 total". Plans 04-02..04-05 podrán llamar `requirements mark-complete` sin error.
- **Committed in:** `14a9aa7` (final metadata commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 - Blocking)
**Impact on plan:** El fix es puramente meta (registro de IDs en archivo de tracking) — cero código tocado. Necesario para que las plans subsiguientes (04-02..04-05) puedan reportar progreso correctamente. Sin el fix, el comando `requirements mark-complete` falla silently para los plans Wave 2.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 04-02 desbloqueado:** Puede crear `consumiblesPorModuloService.ts` importando `ConsumibleModulo` y `ConsumiblesPorModulo` desde `@ags/shared` para el CRUD Firestore.
- **Plan 04-03 desbloqueado:** Puede agregar la columna "Anexo de consumibles" al editor de plantillas tipo de equipo (admin) y leer/escribir `requiereAnexoConsumibles` en `tiposEquipoService`.
- **Plan 04-04 desbloqueado:** Puede implementar el builder de anexo PDF que matchea `requiereAnexoConsumibles=true` en items del presupuesto contra `ConsumiblesPorModulo` por `codigoModulo`.
- **Plan 04-05 desbloqueado:** PDF template del anexo puede consumir `ConsumibleModulo[]` directamente para renderizar las filas.
- **Sin blockers.** Plantillas previas en Firestore (HPLC 1100, 1200, 1260, 1290, GC 6890, GC 7890, UV/VIS 8453) siguen siendo válidas sin migración — el flag es opcional y los consumers de plan 04-03 leerán `?? false`.

---
*Phase: 04-presupuestos-anexo-consumibles*
*Completed: 2026-04-29*

## Self-Check: PASSED

- `packages/shared/src/types/index.ts` exists on disk.
- `.planning/phases/04-presupuestos-anexo-consumibles/04-01-SUMMARY.md` exists on disk.
- Commit `b1723b0` (Task 1: requiereAnexoConsumibles flag) present in git log.
- Commit `3ba75b4` (Task 2: ConsumibleModulo + ConsumiblesPorModulo) present in git log.
- `pnpm type-check` passes en `packages/shared` y en `apps/sistema-modular` (cero errores TS).
- Grep confirma `requiereAnexoConsumibles` (línea 1382), `interface ConsumibleModulo` (línea 1415), `interface ConsumiblesPorModulo` (línea 1430) presentes.
