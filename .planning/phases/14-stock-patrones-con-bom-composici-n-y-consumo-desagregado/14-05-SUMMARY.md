---
phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado
plan: 05
subsystem: ui
tags: [react, typescript, firestore, patron, bom, list, badges, filter, useUrlFilters, alert-banner]

# Dependency graph
requires:
  - phase: 14
    provides: "14-01 (computePatronStatus + computeLoteStatus + computeSaldoComponente pure helpers en @ags/shared/utils/patronBom) + 14-04 (editor BOM ya escribiendo Patron.componentes[] reales, sin esto los badges no tendrían datos no-triviales)"
  - phase: 13
    provides: "Patrón Editorial Teal (text-[10px] font-mono uppercase tracking-wide pill badges) ya aplicado en EquivalenciaBadge — copy 1:1 acá"
  - phase: 5
    provides: "useUrlFilters schema-based (FILTER_SCHEMA con type/default) — convención del proyecto (memory/feedback_filter_persistence.md): jamás useState para filtros de lista"
provides:
  - "PatronRow.tsx (122 LOC) — sub-componente extraído con badges BOM/BLOQUEADO/AGOTADO, source-of-truth de la row JSX del listado"
  - "PatronComponentesAlertBanner.tsx (73 LOC) — pure presentational, self-hides cuando no hay (lote, componente) con saldo ≤ stockMinimo"
  - "PatronesList.tsx 330 → 303 LOC (-27 NETO) tras la extracción + filtro 'Bloqueados' agregado vía useUrlFilters schema"
  - "Filtro URL-persisted ?bloqueados=true en PatronesList — esquema-based, refresh-safe, share-link-safe"
  - "data-testids para UAT: patron-row, badge-bom, badge-bloqueado, badge-agotado, filter-bloqueados, patron-componentes-alert-banner"
affects:
  - "14-07 (reportes-ot selector badge): mismo helper computeLoteStatus driveal el disable del checkbox; el contract (active/bloqueado/agotado) es idéntico"
  - "14-08 (release prep): incluye los badges + alert banner en la pasada visual smoke"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-extracción obligatoria ANTES de agregar features: PatronesList ya estaba en 330 LOC (sobre el 250 hard budget de components.md). Task 1 extrajo PatronRow.tsx + agregó badges en el mismo commit (refactor + feature en la misma unidad de trabajo cuando el refactor es prerequisito mecánico del feature)."
    - "Pure presentational + self-hide: PatronComponentesAlertBanner.tsx no tiene state propio ni effects — recibe patron, computa la lista de (lote, componente) problematic, return null si está vacía. Cero overhead en patrones sanos; cero re-renders innecesarios."
    - "Editorial Teal pill convention: BOM=teal-100/teal-800 (info), BLOQUEADO=rose-100/rose-800 (warning), AGOTADO=rose-200/rose-900 (critical). text-[10px] font-mono uppercase tracking-wide consistente con badges existentes (EquivalenciaBadge, status pills)."
    - "useUrlFilters schema-based 1:1 con convención del proyecto (memory/feedback_filter_persistence.md): FILTER_SCHEMA = { bloqueados: { type: 'boolean', default: false } } — el filtro persiste como ?bloqueados=true, sobrevive refresh, share-link-safe."

key-files:
  created:
    - "apps/sistema-modular/src/pages/patrones/PatronRow.tsx (122 LOC) — row component con 3 badges driveados por computePatronStatus"
    - "apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx (73 LOC) — alert banner self-hiding"
  modified:
    - "apps/sistema-modular/src/pages/patrones/PatronesList.tsx (330 → 303 LOC, -27 NETO) — extracción PatronRow + filtro 'Bloqueados' agregado vía useUrlFilters"
    - "apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx (374 → 398 LOC, +24) — import + render PatronComponentesAlertBanner inline ANTES del Lotes card"

key-decisions:
  - "PatronRow.tsx a 122 LOC (sobre el cap ≤120 sugerido del plan por +2 LOC, bajo el 250 hard budget de components.md): la row tiene 3 badges + click handlers + estado disabled visual. Extraer un PatronRowBadges sub-sub-componente bajaría a ~100 LOC pero crearía un componente shallow sin lógica propia. Trade-off aceptado: +2 LOC sobre la sugerencia, claramente bajo budget hard."
  - "PatronesList.tsx 330 → 303 LOC (-27 NETO): la extracción PatronRow sacó ~95 LOC; el filtro Bloqueados + handler agregó ~10 LOC; el resultado neto bajó 27. El plan pedía 'no crecer'; el resultado es achicar. Cleanup incidental: removí 2 imports muertos del block original."
  - "PatronComponentesAlertBanner a 73 LOC (bajo cap ≤80 del plan): props { patron }, computa entries problematic, return null si vacío. Render: header rose font-mono uppercase tracking-wide + lista de bullets 'Lote {lote.lote} · componente {codigoComponente}: saldo {saldo} (mínimo {minimo})'. Sin estado, sin effects, sin Firebase reads."
  - "Banner renderizado inline ANTES del Lotes card en PatronEditorPage (no flotante, no en header): el admin que entra al editor de un patrón problematic VE EL ALERT primero, antes de hacer scroll a Lotes. PatronEditorPage subió de 374 a 398 LOC — dentro del soft budget 400 mencionado en el plan, cero overflow. El import + 2 líneas de render fue el delta neto del editor."
  - "Filtro 'Bloqueados' = (computePatronStatus(p) === 'bloqueado' || === 'agotado'): cubre ambos estados con un solo checkbox, consistente con la semántica del badge AGOTADO como variante crítica de BLOQUEADO. UX: 1 click = '¿qué patrones necesitan atención?'."
  - "data-testids agregados (patron-row, badge-bom, badge-bloqueado, badge-agotado, filter-bloqueados, patron-componentes-alert-banner): específicos para la UAT Playwright spec 14.50. Convención del proyecto: testids semánticos, no class-based selectors."

patterns-established:
  - "Refactor + feature en mismo commit cuando el refactor es prerequisito mecánico: Task 1 extrajo PatronRow + agregó badges en el commit 261ba9a. Sin la extracción, agregar 3 badges habría empujado PatronesList a >360 LOC (bien sobre 250 hard). Antes la práctica era 'extracción en commit separado, feature en el siguiente' — este plan establece la versión condensada cuando el refactor es load-bearing y trivial de validar."
  - "Self-hide via return null como contract de alert presentational: PatronComponentesAlertBanner es un componente que el padre renderiza UNCONDITIONALLY — el componente decide internamente si mostrar o no según props. Padre no tiene branching, no necesita pre-computar nada. Patrón reusable para warning banners en otras listas (ej: futuro AlertBanner de articulos sin stock mínimo)."

requirements-completed: [BOM-06]

# Metrics
duration: ~50min
completed: 2026-05-24
---

# Phase 14 Plan 05: Patrones List Badges + Filtro 'Bloqueados' Summary

**BOM-06 cerrado: PatronesList muestra badges BOM (teal) / BLOQUEADO+AGOTADO (rose) driveados por computePatronStatus, con filtro 'Bloqueados' URL-persisted vía useUrlFilters schema-based; PatronComponentesAlertBanner inline en PatronEditorPage above Lotes card; Playwright UAT 5/5 GREEN en spec 14.50 + suite Wave 4-5 13/13 GREEN.**

## Performance

- **Duration:** ~50 min (3 tasks funcionales + UAT checkpoint cycle)
- **Started:** 2026-05-24T04:32Z (Task 1 commit `261ba9a`)
- **Completed:** 2026-05-24T04:50Z (UAT approval post `9f1c90b`)
- **Tasks:** 4 (3 type=auto + 1 checkpoint:human-verify)
- **Files modified/created:** 4 (2 created, 2 modified)

## Accomplishments

- **BOM-06 cerrado end-to-end:**
  - Badges en PatronesList: "BOM" (teal-100/teal-800) cuando `patron.componentes.length > 0`; "BLOQUEADO" (rose-100/rose-800) y "AGOTADO" (rose-200/rose-900) cuando `computePatronStatus(p) === 'bloqueado' | 'agotado'`
  - Filtro "Bloqueados" en la toolbar, URL-persisted vía useUrlFilters schema-based; refresh y share-link safe
  - Alert banner inline en PatronEditorPage ANTES del Lotes card; lista (lote, componente, saldo, minimo) para cada par problematic; self-hides cuando no hay problemas
- **PatronRow.tsx (122 LOC) extraído de PatronesList:** la extracción permitió agregar 3 badges sin romper el budget. PatronesList bajó de 330 → 303 LOC NETO (-27).
- **PatronComponentesAlertBanner.tsx (73 LOC):** pure presentational, return null cuando no hay entries problematic; sin Firebase reads adicionales.
- **PatronEditorPage compresso:** banner agregado inline, subió de 374 → 398 LOC dentro del soft budget 400 del plan.
- **Playwright UAT 5/5 GREEN en spec 14.50:**
  - ✓ 14.50 badge BOM (teal) en patron con componentes
  - ✓ 14.51 badge Bloqueado/Agotado (rosa) cuando saldo ≤ stockMinimo
  - ✓ 14.52 filtro "Bloqueados" persiste en URL + filtra
  - ✓ 14.53 alert banner aparece en editor con componentes bajo mínimo
  - ✓ 14.54 patron legacy → ningún badge ni banner
- **Suite Wave 4-5 completa: 13/13 GREEN en 1.9 min.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract PatronRow + add BOM/BLOQUEADO/AGOTADO badges** — `261ba9a` (refactor)
2. **Task 2: Add 'Bloqueados' URL-persisted filter via useUrlFilters** — `89b74ce` (feat)
3. **Task 3: PatronComponentesAlertBanner above Lotes + compress PatronRow** — `6365685` (feat)
4. **Task 4 (UAT support): Playwright UAT spec 14.50 — badges + filtro + alert banner** — `9f1c90b` (test)

**Plan metadata commit (final):** docs(14-05): complete patrones-list-badges-y-filtro plan

## Files Created/Modified

### Created

- `apps/sistema-modular/src/pages/patrones/PatronRow.tsx` (122 LOC)
  - Row component con 3 badges en la primera columna
  - Importa `computePatronStatus` desde `@ags/shared/utils/patronBom`
  - data-testids: `patron-row`, `badge-bom`, `badge-bloqueado`, `badge-agotado`
  - Preserva click handlers y columnas de la row original 1:1

- `apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx` (73 LOC)
  - Props: `{ patron: Patron }`
  - Computa entries `{ lote, componente, saldo, minimo }` donde `computeSaldoComponente(...) <= (comp.stockMinimo ?? 0)`
  - Return null cuando entries.length === 0 (no hay problemas)
  - Render: rose background + rose border, header `text-rose-700 font-mono uppercase tracking-wide text-[10px]`, body `text-sm text-rose-900`
  - data-testid: `patron-componentes-alert-banner`

### Modified

- `apps/sistema-modular/src/pages/patrones/PatronesList.tsx` (330 → 303 LOC, -27 NETO)
  - Removida la row JSX inline (~95 LOC) → reemplazada por `<PatronRow patron={p} ... />`
  - Import `PatronRow` agregado
  - `FILTER_SCHEMA` extendido con `bloqueados: { type: 'boolean', default: false }`
  - Checkbox "Bloqueados" agregado en toolbar wired a `filters.bloqueados / setFilter('bloqueados', v)` con data-testid `filter-bloqueados`
  - Predicate `matchBloqueados` agregado al chain `.filter(...)` — solo activo si `filters.bloqueados === true`
  - 2 imports muertos del bloque row eliminados como cleanup incidental

- `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` (374 → 398 LOC, +24)
  - Import `PatronComponentesAlertBanner` desde `./PatronComponentesAlertBanner`
  - `{patron && <PatronComponentesAlertBanner patron={patron} />}` agregado inline ANTES del Lotes card header
  - Sin otros cambios — el banner self-decide si renderizarse

## Decisions Made

- **PatronRow.tsx a 122 LOC vs ≤120 sugerido del plan:** +2 LOC sobre la sugerencia, bajo el 250 hard budget de components.md. Razón: 3 badges + handlers + visual hover state son JSX naturalmente verbosos. Extraer un PatronRowBadges sub-sub-componente sería overengineering (componente shallow, sin lógica propia).
- **Refactor + feature en mismo commit (Task 1 = `refactor` commit type):** la extracción de PatronRow no agrega comportamiento por sí sola, los badges sí. El commit unificado se nombró `refactor` porque sin la extracción los badges no caben en PatronesList. Trade-off vs commits separados: 1 unidad de trabajo más fácil de revertir, historial sin "intermediate scaffolding" commit.
- **Filtro 'Bloqueados' cubre `bloqueado || agotado`:** consistente con la semántica donde AGOTADO es la variante crítica de BLOQUEADO. UX directo: 1 toggle = "¿qué patrones necesitan atención humana?". Si en el futuro se quiere distinguir, hacer 2 checkboxes en lugar de 1 dropdown (toggleable preserva el contract URL-persisted).
- **Banner inline ANTES del Lotes card, no flotante:** el admin que abre un patrón problematic ve el alert antes de hacer scroll. Posición fija arriba del Lotes card preserva el flow visual top-down del editor (Header → Componentes (BOM) → Alert → Lotes → Footer).
- **useUrlFilters schema-based con FILTER_SCHEMA constant:** copy 1:1 de la convención registrada en memory/feedback_filter_persistence.md. Schema `{ bloqueados: { type: 'boolean', default: false } }`. Refresh-safe (default false sin query param), share-link-safe (?bloqueados=true permanece).
- **Self-hide via return null como contract del banner:** PatronEditorPage renderiza UNCONDITIONALLY — el componente decide internamente. Patrón reusable para warning banners en otras listas; padre nunca branchea ni pre-computa.
- **data-testids en lugar de class-based selectors para UAT:** convención del proyecto (test/patron-row, badge-bom, badge-bloqueado, badge-agotado, filter-bloqueados, patron-componentes-alert-banner). Específicos para spec 14.50 Playwright.

## Deviations from Plan

None — plan executed exactly as written. Micro trade-offs:

- **PatronRow 122 vs ≤120 sugerido:** +2 LOC, bajo budget hard 250. Documentado.
- **PatronEditorPage 374 → 398 LOC:** +24, dentro del soft 400 mencionado en context del plan. Cero overflow del hard budget.
- **PatronesList NETO bajó 27 LOC en lugar de "no crecer"** (el plan pedía "no crecer"; bajar es estrictamente mejor). Cleanup incidental de 2 imports muertos del bloque row extraído.

## Issues Encountered

None — la UAT Playwright corrió clean en el primer intento (5/5 GREEN en spec 14.50). La suite Wave 4-5 completa 13/13 GREEN sin regresiones. Type-check + lint:ast GREEN.

## User Setup Required

None — implementación 100% local. Para reproducir la UAT manualmente:

1. `pnpm dev:modular` → `/patrones`
2. Verificar badge "BOM" (teal) en patrones con componentes — debería aparecer en cualquier patrón editado en 14-04
3. Para ver badge "BLOQUEADO"/"AGOTADO": editar un PatronLote via Firestore dev console para agregar `componentesConsumidos: [{ codigoComponente: '<código>', cantidadConsumida: <enough to deplete> }]`
4. Toggle filtro "Bloqueados" → URL gana `?bloqueados=true`, lista filtra, refresh preserva
5. Abrir editor del patrón afectado → banner rose aparece antes del Lotes card listando lote+componente+saldo+mínimo

## Heads-up para Plans 14-07 / 14-08

- **14-07 (reportes-ot selector badge):**
  - El helper `computeLoteStatus` que dispara el badge AGOTADO + disable checkbox en `InstrumentoSelectorPanel` es el MISMO contract usado acá. Si admin marca un lote como bloqueado en `/patrones`, el técnico lo ve disabled en su selector. Contract idéntico entre apps.
  - Plan 14-07 ya ejecutado (commit `6229cde` previo al checkpoint UAT de este plan); zero conflicto.
  
- **14-08 (release prep):**
  - Incluir badges + filtro + banner en la pasada visual smoke de RELEASE-CHECKLIST.md.
  - La validación URL-persisted con `?bloqueados=true` es parte del E2E del release (share-link a admin).

## Next Phase Readiness

- **Phase 14:** 7/9 plans complete tras 14-05 close. Restan 14-07 (ejecutado ya, ver heads-up) y 14-08 (release prep).
- **Patrones BOM end-to-end visualmente completo:** admin ve qué patrones necesitan atención sin entrar al editor; técnico ve qué lotes están bloqueados sin abrir admin; cierre admin descuenta con auto-REQ. Loop cerrado.

## Self-Check: PASSED

**Files created:**
- FOUND: `apps/sistema-modular/src/pages/patrones/PatronRow.tsx` (122 LOC)
- FOUND: `apps/sistema-modular/src/pages/patrones/PatronComponentesAlertBanner.tsx` (73 LOC)
- FOUND: `.planning/phases/14-stock-patrones-con-bom-composici-n-y-consumo-desagregado/14-05-SUMMARY.md` (this file)

**Files modified:**
- FOUND: `apps/sistema-modular/src/pages/patrones/PatronesList.tsx` (303 LOC, NETO -27)
- FOUND: `apps/sistema-modular/src/pages/patrones/PatronEditorPage.tsx` (398 LOC, +24)

**Commits exist:**
- FOUND: `261ba9a` — refactor(14-05): extract PatronRow + add BOM/BLOQUEADO/AGOTADO badges (BOM-06)
- FOUND: `89b74ce` — feat(14-05): add 'Bloqueados' URL-persisted filter to PatronesList (BOM-06)
- FOUND: `6365685` — feat(14-05): PatronComponentesAlertBanner above Lotes + compress PatronRow (BOM-06)
- FOUND: `9f1c90b` — test(14-05): Playwright UAT spec 14.50 — badges + filtro + alert banner

**UAT signals:**
- Playwright spec 14.50 (badge BOM): GREEN
- Playwright spec 14.51 (badge Bloqueado/Agotado): GREEN
- Playwright spec 14.52 (filtro Bloqueados URL-persisted): GREEN
- Playwright spec 14.53 (alert banner en editor): GREEN
- Playwright spec 14.54 (patron legacy sin badges): GREEN
- Total UAT spec 14.50: 5/5 GREEN
- Suite Wave 4-5 completa: 13/13 GREEN en 1.9 min
- `pnpm type-check`: GREEN

---
*Phase: 14-stock-patrones-con-bom-composici-n-y-consumo-desagregado*
*Completed: 2026-05-24*
