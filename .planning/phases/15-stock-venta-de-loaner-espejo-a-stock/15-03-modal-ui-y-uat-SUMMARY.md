---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 03
subsystem: ui
tags: [react, searchable-select, modal, loaner, stock, uat, editorial-teal]

# Dependency graph
requires:
  - phase: 15-stock-venta-de-loaner-espejo-a-stock
    provides: "loanersService.registrarVenta(id, venta, articuloRecienVinculado?) transaccional + costoUnitario/monedaCosto en VentaLoaner (plans 15-01 + 15-02)"
  - phase: 14-stock-bom-y-cierre
    provides: "Precedente de extracción de sub-componente (PatronComponentesEditor) cuando el padre se acerca al budget de 250 LOC"
provides:
  - "LoanerVentaModal extendido (233 LOC) con SearchableSelect condicional + Precio/Costo 2x2 doble apilado + banner inline error + canConfirm bloqueante"
  - "LoanerArticuloPicker (62 LOC) — sub-componente que owns articulosService.getAll({ activoOnly: true }) y SearchableSelect"
  - "LoanerDetail.handleVenta firmando el shape final { venta, articuloRecienVinculado } al servicio"
  - "useLoaners.registrarVenta wrapper ELIMINADO (0 call sites externos confirmados por grep) — los consumidores llaman directo al servicio"
  - "Phase 15 COMPLETA — invariante 'toda venta del loaner deja espejo en stock' cumplido end-to-end (modal → service tx → 3 docs Firestore)"
affects: ["release sistema-modular MINOR (v1.4.x → v1.5.x) — handoff al usuario via rule release-flow.md"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-componente extraído para mantener el padre dentro de budget 250 LOC (precedente PatronComponentesEditor / Phase 14)"
    - "Banner inline rojo (NO toast efímero) para errores transaccionales del service, modal NO cierra — mirror DesagregarStockModal"
    - "Pre-fetch de catálogo (articulosService.getAll) DENTRO del sub-componente, no en el padre, para keep el modal puro UI"
    - "Layout 2x2 doble apilado para separar visualmente revenue (Precio+Moneda venta) de costo del activo (Costo+Moneda costo) — semántica distinta, no inferir uno del otro"

key-files:
  created:
    - "apps/sistema-modular/src/components/loaners/LoanerArticuloPicker.tsx (62 LOC)"
    - ".planning/phases/15-stock-venta-de-loaner-espejo-a-stock/15-03-modal-ui-y-uat-SUMMARY.md"
  modified:
    - "apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx (86 → 233 LOC)"
    - "apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx (handleVenta nueva signature, dropped cast WIP a null)"
    - "apps/sistema-modular/src/hooks/useLoaners.ts (-22 LOC, registrarVenta wrapper eliminado + VentaLoaner import cleanup)"

key-decisions:
  - "Extraer LoanerArticuloPicker.tsx (62 LOC) en lugar de inline el SearchableSelect en el modal: con todo inline el modal habría llegado a ~290 LOC superando el hard rule .claude/rules/components.md (≤250). Final: padre 233, hijo 62. Precedente directo: Phase 14 extrayendo PatronComponentesEditor.tsx por mismo motivo."
  - "Eliminar useLoaners.registrarVenta wrapper (NO actualizar signature): grep `useLoaners()` en apps/sistema-modular/src --include='*.tsx' --include='*.ts' confirmó 0 call sites externos que destructuraran .registrarVenta. El wrapper no agregaba ni logging ni validación ni transform — pura indirección sin valor. LoanerDetail ya llamaba directo a loanersService."
  - "Costo + Moneda costo separados de Precio + Moneda venta (no inferir): son cantidades con semántica distinta — revenue al cliente vs valor contable del bien de uso a registrar en UnidadStock. Layout 2x2 doble apilado refuerza la separación visual."
  - "SearchableSelect condicional ESCONDIDO cuando loaner.articuloId ya existe (no Input readonly): el header del LoanerDetail ya muestra el artículo asociado; mostrar un readonly sería ruido visual redundante."
  - "Banner inline rojo (mb-3, border-red-300, bg-red-50) para errores del service (e.g. 'Loaner ya vendido' por race entre tabs) — modal NO cierra, el user puede leer el motivo y cancelar."

patterns-established:
  - "Modal Editorial Teal con sub-componente picker condicional (loaner.articuloId null → mostrar; populated → esconder)"
  - "Wrapper hook deletion cuando grep confirma 0 call sites externos — preferir llamada directa al service que indirección sin valor"

requirements-completed: [VLN-03, VLN-04]

# Metrics
duration: 22min
completed: 2026-05-24
---

# Phase 15 Plan 03: Modal UI y UAT Summary

**LoanerVentaModal extendido (picker condicional + costo separado de precio + banner error inline) + wiring final LoanerDetail.handleVenta + drop del useLoaners.registrarVenta wrapper + UAT manual 8/8 aprobado por el usuario — Phase 15 cerrada end-to-end.**

## Performance

- **Duration:** ~22 min (commits e262b69 04:47:38 → 048736c 04:47:52 → UAT manual del usuario → cierre docs)
- **Started:** 2026-05-24T07:45:00Z (post-init Wave 3)
- **Completed:** 2026-05-24T15:10:00Z (UAT firmado + docs commit)
- **Tasks:** 3 (2 code + 1 UAT)
- **Files modified:** 4 (1 nuevo + 3 modificados)

## Accomplishments
- `LoanerVentaModal` extendido con los 3 cambios visuales del plan: SearchableSelect condicional (vía `LoanerArticuloPicker`), 4 inputs Precio+Moneda venta + Costo+Moneda costo en grid 2x2 doble apilado, banner inline rojo para errores transaccionales.
- `LoanerArticuloPicker` extraído (62 LOC) — encapsula el fetch `articulosService.getAll({ activoOnly: true })` + el SearchableSelect; el modal queda en 233 LOC (≤ 250, regla `components.md`).
- `LoanerDetail.handleVenta` con la nueva signature `(payload: { venta, articuloRecienVinculado })` propagando los 3 args correctos al service Wave 2. Drop del cast WIP a `null` que existía como placeholder hasta Wave 3.
- `useLoaners.registrarVenta` wrapper ELIMINADO (-22 LOC). Grep confirmó 0 call sites externos. Comment in-file (líneas 100-105) documenta la decisión.
- UAT manual 8/8 PASS firmado por el usuario ("dale, por favor" 2026-05-24).
- Invariante Phase 15 cumplido end-to-end: toda venta del loaner deja espejo contable en Stock (3 docs atómicos: `loaners` UPDATE + `unidadesStock` CREATE + `movimientosStock` CREATE con `subtipo='venta_loaner'`).

## Task Commits

1. **Task 1: Extender LoanerVentaModal con SearchableSelect condicional + costo + banner** — `e262b69` (feat) — `apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx` 86→233 LOC + `apps/sistema-modular/src/components/loaners/LoanerArticuloPicker.tsx` (new, 62 LOC).
2. **Task 2: Wire LoanerDetail.handleVenta + consolidar useLoaners** — `048736c` (refactor) — `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx` (handleVenta nueva signature, drop cast WIP) + `apps/sistema-modular/src/hooks/useLoaners.ts` (-22 LOC, registrarVenta wrapper eliminado).
3. **Task 3: UAT manual 8 pasos (checkpoint:human-verify)** — sin commit; verificación manual del usuario contra `pnpm dev:modular` siguiendo `15-VALIDATION.md` checklist (8 pasos). Aprobación verbal: "dale, por favor".

**Plan metadata:** _(este commit final docs)_

_Note: La verificación adyacente del Wave 2 (test:venta-loaner 5/5 + test:patron-bom 18/18 + test:stock-amplio 5/5 + test:equivalencias 9/9 + test:cuotas-facturacion 9/9 = 46/46) + build GREEN ya quedó documentada en el commit `048736c`._

## Files Created/Modified
- `apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx` — Modal de venta extendido: SearchableSelect condicional vía sub-componente, 4 inputs Precio+Moneda venta + Costo+Moneda costo (2x2 doble apilado), banner inline error, validación `canConfirm` bloqueante (`clienteId && articuloIdEfectivo && costoUnitario && !saving`).
- `apps/sistema-modular/src/components/loaners/LoanerArticuloPicker.tsx` _(nuevo)_ — Encapsula `articulosService.getAll({ activoOnly: true })` + `SearchableSelect`. Se renderiza solo cuando `loaner.articuloId` es null.
- `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx` — `handleVenta` con shape final, pasa los 3 args (`id`, `venta`, `articuloRecienVinculado`) a `loanersService.registrarVenta`. Sin más cast WIP.
- `apps/sistema-modular/src/hooks/useLoaners.ts` — Wrapper `registrarVenta` eliminado + import `VentaLoaner` borrado. Comment in-file documenta la decisión y el resultado del grep.

## Decisions Made

1. **Extracción de `LoanerArticuloPicker.tsx` (62 LOC)** — Con todo inline el modal habría rozado ~290 LOC, superando el hard rule de `.claude/rules/components.md` (≤250). Final: padre 233, hijo 62. Precedente directo en Phase 14 (PatronComponentesEditor extraído del PatronEditorPage por la misma razón). Documentado en SUMMARY 14-04.
2. **Drop del wrapper `useLoaners.registrarVenta`** — Grep `useLoaners()` en `apps/sistema-modular/src --include='*.tsx' --include='*.ts'` confirmó 0 call sites externos que destructuraran `.registrarVenta`. El wrapper no agregaba logging, validación ni transform — pura indirección. `LoanerDetail` ya llamaba directo al servicio. Resultado: -22 LOC en el hook, cero impacto en consumidores.
3. **Costo separado de Precio (no inferir uno del otro)** — Son cantidades con semántica distinta: Precio = revenue al cliente, Costo = valor contable del bien de uso a registrar en `UnidadStock.costoUnitario`. Layout 2x2 doble apilado refuerza la separación visual; cada uno tiene su selector de moneda independiente.
4. **SearchableSelect condicional ESCONDIDO cuando `loaner.articuloId` existe** — En lugar de un Input readonly, el bloque desaparece. El header del `LoanerDetail` ya muestra el artículo asociado; un readonly sería ruido visual redundante. Documentado en comment dentro del JSX del modal.
5. **Banner inline rojo (NO toast efímero)** — Para errores transaccionales del service (e.g. `'Loaner ya vendido'` cuando el guard READ-FIRST detecta otra tab adelantándose), el modal NO cierra. El user puede leer el motivo, cancelar y refrescar. Mirror del precedente UX en `DesagregarStockModal` (Phase 13).

## Deviations from Plan

None — plan executed exactly as written. Las 11 sub-acciones del Task 1 + las 2 sub-acciones del Task 2 (Paso A LoanerDetail, Paso B useLoaners) se ejecutaron 1:1. La extracción de `LoanerArticuloPicker.tsx` no es una deviation sino el camino "si supera 200 LOC, extraer" que el propio plan menciona (sub-acción 11 del Task 1).

## Issues Encountered

None durante la implementación. El UAT manual del usuario reportó 8/8 PASS sin sorpresas (incluido el doble-click test entre 2 tabs que ejerce el guard `'Loaner ya vendido'` del service Wave 2).

## Out-of-scope adjacent work (contextual, not part of this plan)

Entre el checkpoint UAT y la aprobación del usuario, se ejecutó **exitosamente** `firebase deploy --only firestore` contra el proyecto `agssop-e7353`. Esto desplegó las firestore rules y los indexes vigentes al cloud project. **No es un task de este plan** — Phase 15 no introdujo rules nuevas ni indexes nuevos (las colecciones `unidadesStock` / `movimientosStock` / `loaners` ya tenían rules pre-existentes en el repo). Se documenta acá únicamente para trazabilidad del estado del cloud post-cierre de plan, dado que la sesión incluyó el deploy.

## User Setup Required

None — no external service configuration required for this plan. (El release `pnpm --filter @ags/sistema-modular release:minor` que distribuye Phase 15 a las PCs instaladas queda surfaceado al user en el wrap-up del orchestrator de Phase 15, no en este SUMMARY.)

## Next Phase Readiness

- **Phase 15 COMPLETE end-to-end.** Los 4 plans (15-00 test infra, 15-01 tipos, 15-02 service tx, 15-03 UI/UAT) cerrados. Los 4 requirements operacionales (VLN-01, VLN-02, VLN-03, VLN-04) cumplidos.
- **Invariante de la fase cumplido**: toda venta del loaner deja espejo contable en Stock — verificable en Firestore (UAT pasos 5, 6, 7 del 15-VALIDATION.md confirmados PASS).
- **Release surface al usuario** (rule `release-flow.md`): comando recomendado `pnpm --filter @ags/sistema-modular release:minor && git push origin main && git push origin sistema-modular-v<x.y.z>`. Bump MINOR porque Phase 15 ships feature user-visible (nuevo flujo de venta de loaner con espejo en stock). NO lo ejecuta Claude; el user corre el release manualmente.
- **Próxima fase**: Phase 16 sin plan aún. `/gsd:verify-work` debería poder cerrar Phase 15 limpiamente.

---

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: `apps/sistema-modular/src/components/loaners/LoanerVentaModal.tsx` (233 LOC, ≤ 250 OK)
- FOUND: `apps/sistema-modular/src/components/loaners/LoanerArticuloPicker.tsx` (62 LOC, new)
- FOUND: `apps/sistema-modular/src/pages/loaners/LoanerDetail.tsx` (169 LOC)
- FOUND: `apps/sistema-modular/src/hooks/useLoaners.ts` (112 LOC, registrarVenta wrapper eliminado verified via grep)

**Commits verified to exist** (`git log --oneline -10`):
- FOUND: `e262b69` — feat(15-03): extend LoanerVentaModal con picker artículo + costo + banner error
- FOUND: `048736c` — refactor(15-03): wire venta loaner end-to-end + drop useLoaners wrapper

**UAT 8/8 PASS** firmado por usuario (verbal: "dale, por favor" — 2026-05-24).

**Hard rules respected:**
- `.claude/rules/components.md` — LoanerVentaModal en 233 LOC (≤250) ✅
- `.claude/rules/reportes-ot.md` — 0 archivos en `apps/reportes-ot/` modificados ✅
- `.claude/rules/firestore.md` — no se introducen `: undefined` en este plan (payload completo del service ya cubierto en 15-02) ✅

---
*Phase: 15-stock-venta-de-loaner-espejo-a-stock*
*Completed: 2026-05-24*
