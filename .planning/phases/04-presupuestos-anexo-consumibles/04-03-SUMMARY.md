---
phase: 04-presupuestos-anexo-consumibles
plan: 03
subsystem: ui
tags: [react, firestore, presupuestos, plantillas, tipos-equipo, anexo, consumibles, hydrate, normalize]

# Dependency graph
requires:
  - phase: 04-presupuestos-anexo-consumibles
    provides: TipoEquipoServicio.requiereAnexoConsumibles?: boolean (flag opcional definido en 04-01)
provides:
  - "Columna 'Anexo' (checkbox) en ServiciosEditor del editor de plantillas tipo de equipo"
  - "tiposEquipoService.hydrate() defaultea requiereAnexoConsumibles a false para docs legacy"
  - "tiposEquipoService.create()/update() normalizan servicios[] antes de persistir (forma determinística)"
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hydrate-normalize pattern: el servicio defaultea flags opcionales en read-time, garantizando boolean determinístico para consumers downstream sin migración"
    - "Write-normalize pattern: create/update mapean arrays anidados antes de cleanFirestoreData para evitar docs con shape mixto"
    - "Optional flag UI binding: checkbox lee `valor ?? false`, write entrega boolean explícito — consistente con el patrón schema-flex de 04-01"

key-files:
  created: []
  modified:
    - "apps/sistema-modular/src/pages/tipos-equipo/TipoEquipoNestedEditors.tsx (header + cell de columna 'Anexo' en ServiciosEditor; +10 líneas)"
    - "apps/sistema-modular/src/services/tiposEquipoService.ts (hydrate normaliza servicios[]; create/update normalizan input; +25 líneas)"
    - "apps/sistema-modular/src/pages/tipos-equipo/seedPlantillas.ts (comentario explicativo; sin cambios estructurales)"

key-decisions:
  - "hydrate() siempre devuelve boolean (no undefined) para requiereAnexoConsumibles — plan 04-04 puede asumir el campo definido sin nullish-checks repetitivos"
  - "create() y update() normalizan SOLO si servicios[] viene en el patch — preserva semántica partial-update de update()"
  - "No migración de docs Firestore: hydrate defaultea en read; primer save persiste el flag como false automáticamente"
  - "Seed permanece sin marcar requiereAnexoConsumibles=true — el operador decide caso por caso desde UI; default ON generaría falsos positivos al disparar anexos sin haber modelado consumiblesPorModulo"

patterns-established:
  - "Hydrate-normalize: cuando un campo opcional de schema afecta lógica downstream, el servicio lo normaliza en read-time (deterministic shape para consumers)"
  - "Write-normalize sobre Partial<T>: en update(), normalizar campos anidados solo si vienen en el patch — evita romper updates parciales que no tocan el array"

requirements-completed: [ANXC-04]

# Metrics
duration: 5min
completed: 2026-04-29
---

# Phase 04 Plan 03: Editor + Servicio de Plantillas — Wiring del Flag `requiereAnexoConsumibles` Summary

**Checkbox 'Anexo' funcional en ServiciosEditor + hydrate/create/update normalizan el flag en `tiposEquipoService` — el flag definido en 04-01 deja de ser type ghost y queda persistido determinísticamente como boolean para que el builder de anexo (04-04) pueda leerlo sin nullish guards.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T15:32:42Z
- **Completed:** 2026-04-29T15:38:03Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **UI editor:** Columna "Anexo" (checkbox 14×14, teal-700) entre "Tipo" y "Precio def." en `ServiciosEditor` (líneas 95-96 header, líneas 113-120 cell). Tooltip en `<th>` explica el efecto del flag. onChange dispara `update(s.id, 'requiereAnexoConsumibles', e.target.checked)` reusando el helper genérico ya existente.
- **Service hydrate:** `hydrate()` (líneas 22-30) ahora mapea cada servicio para defaultear `requiereAnexoConsumibles: srv.requiereAnexoConsumibles ?? false`. Plantillas legacy en Firestore (HPLC 1100/1200/1260/1290, GC 6890/8890A, UV/VIS 8453, UV/VIS G6860A) leen como boolean determinístico sin migración.
- **Service writes:** `create()` (línea 56-61) y `update()` (líneas 81-92) normalizan el array `servicios` antes de `cleanFirestoreData`. `update()` solo normaliza si el patch trae `servicios[]` — preserva semántica partial-update de otros patches (ej: solo cambiar `nombre`).
- **Seed:** `seedPlantillas.ts` permanece sin cambios estructurales. Agregado bloque de comentario al inicio del archivo documentando que las 7 plantillas seed NO marcan el flag por default — el operador lo tilda caso por caso. El seed compila sin tocarlo gracias al campo opcional.
- **Type-check clean:** `npx tsc --noEmit -p .` confirma cero errores en los 3 archivos modificados (`TipoEquipoNestedEditors.tsx`, `tiposEquipoService.ts`, `seedPlantillas.ts`). Errores TS preexistentes en otros archivos del repo (AgendaGridCell, CreateLoanerModal, stockAmplioService, etc.) están fuera del scope de este plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Agregar columna "Anexo" en ServiciosEditor** — `a9b934c` (feat)
2. **Task 2: hydrate() defaults flag y create/update lo persisten** — `310f552` (feat)
3. **Task 3: Verificar seedPlantillas.ts compila** — `6a28b7a` (docs)

**Plan metadata:** `a9c4c17` (docs: complete plan — SUMMARY + STATE + REQUIREMENTS)

## Files Created/Modified

- `apps/sistema-modular/src/pages/tipos-equipo/TipoEquipoNestedEditors.tsx` — 124 → 133 líneas (≤250 budget OK):
  - Línea 95-96: nuevo `<th>` con `title` tooltip explicativo entre "Tipo" y "Precio def."
  - Líneas 113-120: nuevo `<td>` con checkbox controlado leyendo `s.requiereAnexoConsumibles ?? false`
- `apps/sistema-modular/src/services/tiposEquipoService.ts` — 82 → 106 líneas:
  - Líneas 21-30: `hydrate()` mapea servicios para defaultear el flag
  - Líneas 56-61: `create()` declara `serviciosNormalizados` antes de `cleanFirestoreData`
  - Líneas 81-92: `update()` declara `dataNormalizada` solo si `data.servicios` está presente en el patch
- `apps/sistema-modular/src/pages/tipos-equipo/seedPlantillas.ts` — 136 → 140 líneas:
  - Líneas 1-4: bloque de comentario `(Phase 4 / ANXC-04)` documentando la decisión de NO marcar el flag por default

## Decisions Made

- **hydrate() siempre normaliza:** No solo se defaultea el flag a `false`; se itera el array `servicios` completo para garantizar shape determinístico. Cualquier consumer downstream (plan 04-04 builder de anexo, futuros componentes) puede asumir `servicio.requiereAnexoConsumibles` como `boolean`, no `boolean | undefined`. Esto elimina nullish-checks repetitivos en el código de detección.
- **update() conditional-normalize:** Solo se mapea `servicios[]` si el patch lo incluye. Patches que solo tocan `nombre`/`descripcion`/`activo` pasan sin tocar el array — preserva la semántica de updates parciales y evita re-escribir el array completo cuando no hace falta.
- **No migración:** Documentos Firestore previos (7 plantillas seed actuales) NO requieren backfill. `hydrate()` los lee con default; al primer `update()` que toque `servicios[]` se persiste el flag como `false` automáticamente. Esto evita un script de migración tocando 7+ docs en producción.
- **Seed con comentario, sin cambios funcionales:** Por la naturaleza opcional del campo en `TipoEquipoServicio`, el seed compila igual. El comentario al inicio del archivo es declarativo — fija la decisión "no marcar por default" para que futuros mantenedores no agreguen `requiereAnexoConsumibles: true` a las plantillas iniciales sin pensarlo.

## Deviations from Plan

None — plan executed exactly as written. Las 3 tasks se ejecutaron en el orden previsto; los snippets del plan se aplicaron tal cual; los conteos de líneas finales coincidieron con la estimación del plan (133 vs estimación ~130 para el editor; 106 vs estimación ~95 para el servicio).

**Total deviations:** 0
**Impact on plan:** Cero. Plan estaba completamente especificado a nivel de snippet.

## Issues Encountered

- **`pnpm type-check` no existe en sistema-modular:** El plan pedía correr `cd apps/sistema-modular && pnpm type-check`, pero ese script no está definido en `package.json` (limitación ya documentada en STATE.md desde plan 08-00). Solución: `npx tsc --noEmit -p .` directo. Verificado que los 3 archivos modificados no introducen errores TS nuevos (los errores que aparecen son preexistentes y fuera del scope de este plan).

## User Setup Required

None - no external service configuration required.

**Manual smoke test pendiente (post-execute, fuera del scope autonómico):**
1. Login admin
2. /presupuestos → "Tipos de equipo" → editar HPLC 1100
3. Verificar que la tabla de Servicios tiene la columna "Anexo" entre "Tipo" y "Precio def."
4. Tildar el flag en "Mantenimiento Preventivo - HPLC 1100 Con ALS"
5. Guardar → cerrar modal → reabrir
6. El check sigue tildado (persistencia confirmada vía hydrate/update normalize)

## Plantillas Existentes en Firestore

Las plantillas ya cargadas en Firestore (HPLC 1100, 1200, 1260 Infinity, GC 6890, GC 8890A, UV/VIS 8453, UV/VIS G6860A) NO tienen el campo `requiereAnexoConsumibles` en sus servicios. Esto es esperado y no requiere acción:

- Lectura: `hydrate()` defaultea cada servicio a `false`. La UI muestra el checkbox desmarcado.
- Escritura: La primera vez que el operador edite cualquier plantilla y guarde, `update()` normaliza el array completo y persiste el flag como `false` en Firestore para todos los servicios. Sin downtime, sin script.
- El operador puede tildar el flag en los servicios MPCC relevantes desde la UI cuando esté listo para modelar el catálogo `consumiblesPorModulo` (plan 04-02 / 04-04).

## Next Phase Readiness

- **Plan 04-04 desbloqueado:** El builder de anexo de consumibles puede iterar `presupuesto.items[]`, lookupear cada item contra su plantilla origen, y leer `servicio.requiereAnexoConsumibles` con la garantía de que es `boolean` (no `undefined`). El matcheo por `codigoModulo` (plan 04-02) puede combinarse con este flag para decidir cuándo generar el PDF anexo.
- **Plan 04-02 (paralelo):** No conflicta — toca `consumiblesPorModuloService.ts` y rutas admin separadas. Ambos plans pueden cerrarse en cualquier orden.
- **Plan 04-05 (PDF):** No bloqueado por este plan; bloqueado por 04-04 (builder).
- **Sin blockers.** Type-check clean en los 3 archivos modificados; budget de líneas respetado; reglas Firestore (cleanFirestoreData) y components (≤250 lines) honradas.

---
*Phase: 04-presupuestos-anexo-consumibles*
*Completed: 2026-04-29*

## Self-Check: PASSED

- `.planning/phases/04-presupuestos-anexo-consumibles/04-03-SUMMARY.md` exists on disk.
- `apps/sistema-modular/src/pages/tipos-equipo/TipoEquipoNestedEditors.tsx` exists on disk (133 lines, ≤250 budget).
- `apps/sistema-modular/src/services/tiposEquipoService.ts` exists on disk (106 lines).
- `apps/sistema-modular/src/pages/tipos-equipo/seedPlantillas.ts` exists on disk (140 lines).
- Commit `a9b934c` (Task 1: Anexo column) present in git log.
- Commit `310f552` (Task 2: hydrate/create/update normalize) present in git log.
- Commit `6a28b7a` (Task 3: seed comment) present in git log.
- `npx tsc --noEmit -p .` reports zero errors in the 3 modified files (preexisting errors in unrelated files out of scope).
- Grep confirms `requiereAnexoConsumibles` present in editor (2 matches) and service (6 matches).
