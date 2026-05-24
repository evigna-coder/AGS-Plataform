---
phase: 15-stock-venta-de-loaner-espejo-a-stock
plan: 01
subsystem: types
tags: [typescript, shared-types, stock, loaners, backwards-compat, union-widening]

# Dependency graph
requires:
  - phase: 15-stock-venta-de-loaner-espejo-a-stock
    provides: "Wave 0 RED baseline (15-00) — test infra + 5 RED tests con fixtures locales que asertan los campos type-extended de Phase 15"
  - phase: 13-stock-equivalencias-compra-uso
    provides: "Patrón subtipo refinement sobre tipo existente (`subtipo: 'conversion'`) — Phase 15 widening puro a `'conversion' | 'venta_loaner'`"
  - phase: 14-stock-patrones-bom
    provides: "Patrón backwards-compat field extension en MovimientoStock (entidadTipo, patronId, lote, codigoComponente) — Phase 15 sigue el mismo patrón con referenciaLoanerId/Codigo"
provides:
  - "MovimientoStock.subtipo widened a `'conversion' | 'venta_loaner'` (union widening backwards-compat)"
  - "MovimientoStock.referenciaLoanerId?: string | null (FK opcional al loaner del espejo)"
  - "MovimientoStock.referenciaLoanerCodigo?: string | null (denormalización código LNR-NNNN)"
  - "VentaLoaner.costoUnitario?: number | null (costo del activo, separado de precio=revenue)"
  - "VentaLoaner.monedaCosto?: 'ARS' | 'USD' | null (moneda del costo)"
affects:
  - 15-02-service-transaccional (Wave 2 — service.registrarVenta usa los 5 nuevos campos)
  - 15-03-modal-ui-y-uat (Wave 3 — modal valida costoUnitario/monedaCosto required en UI)
  - "Consumidores existentes de MovimientoStock (zero impact — union widening + opcionales)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Union widening backwards-compat: `'conversion'` → `'conversion' | 'venta_loaner'` sin breaking changes (consumidores que filtran por el valor existente siguen compilando)"
    - "Backwards-compat field extension con opcionales nullable (Phase 13/14 precedent — Phase 15 agrega 4 campos más)"
    - "Denormalización ref + código en MovimientoStock (referenciaLoanerCodigo sigue patrón articuloCodigo)"
    - "Costo vs precio separados conceptualmente en VentaLoaner (precio=revenue al cliente, costo=valor del activo)"

key-files:
  created: []
  modified:
    - "packages/shared/src/types/index.ts (2 hunks: MovimientoStock líneas 2802-2826, VentaLoaner líneas 3209-3238)"

key-decisions:
  - "JSDoc explica explícitamente la backwards-compat del subtipo widening: 'consumidores que sólo leen subtipo === \"conversion\" siguen funcionando'"
  - "VentaLoaner extends al final del interface (después de notas) para minimizar diff y preservar orden histórico de campos"
  - "Cero cambios a otros tipos (Loaner, EstadoLoaner, CondicionUnidad, EstadoUnidad, UbicacionStock, TipoMovimiento, TipoOrigenDestino) — confirmado en CONTEXT.md como locked"

patterns-established:
  - "Backwards-compat protocol: documentar en el JSDoc del campo modificado qué consumidores siguen funcionando (Phase 15 lo aplica en subtipo, line 2807-2810)"

requirements-completed: [VLN-01]

# Metrics
duration: 5m
completed: 2026-05-24
---

# Phase 15 Plan 01: Tipos foundation Summary

**Extiende `@ags/shared` con 5 campos nuevos (1 union widening + 4 opcionales nullable) para Phase 15 Venta-loaner-espejo-a-stock — backwards-compat 100%, zero breaking changes en consumidores.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-24T07:08:41Z
- **Completed:** 2026-05-24T07:13:31Z
- **Tasks:** 2/2 (TDD: tipos son el "test setup" para Wave 2, el RED real vive en 15-00 test:venta-loaner)
- **Files modified:** 1 (`packages/shared/src/types/index.ts`)

## Accomplishments

- `MovimientoStock.subtipo` widened: `'conversion'` → `'conversion' | 'venta_loaner'` (union widening puro, JSDoc explica backwards-compat)
- `MovimientoStock.referenciaLoanerId?: string | null` y `referenciaLoanerCodigo?: string | null` declarados (FK + denormalización al loaner para el espejo contable)
- `VentaLoaner.costoUnitario?: number | null` y `monedaCosto?: 'ARS' | 'USD' | null` declarados (separados de precio/moneda existentes que son revenue al cliente)
- Type-check GREEN end-to-end: shared (`pnpm --filter @ags/shared type-check`) + sistema-modular (`tsc --noEmit`, cero NUEVOS errores) + reportes-ot (cero impacto) + portal-ingeniero (cero impacto)
- Test `pnpm --filter @ags/sistema-modular test:venta-loaner` mantiene el RED esperado de Wave 0 (`does not provide an export named '__setTestFirestore'`), pero el payload del test ahora type-checks contra `VentaLoaner.costoUnitario`/`monedaCosto` — confirma que el shape está listo para Wave 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Extender MovimientoStock.subtipo + agregar referenciaLoanerId/Codigo** — `915bbfb` (feat)
2. **Task 2: Extender VentaLoaner con costoUnitario + monedaCosto** — `de2c213` (feat)

**Plan metadata commit:** (pendiente — incluye este SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_Nota: tasks TDD en este plan no requirieron RED→GREEN separados porque la RED-suite ya está committed en 15-00 (Wave 0) y este plan solo cumple los prerequisitos de TIPO para que Wave 2 pueda exportar `registrarVenta`. No hay lógica nueva que testear todavía._

## Files Created/Modified

- `packages/shared/src/types/index.ts` — Extended `MovimientoStock` (líneas 2802-2826: subtipo widening + 2 nuevos campos opcionales) y `VentaLoaner` (líneas 3209-3238: 2 nuevos campos opcionales para costo).

### Diff exacto aplicado

**Hunk 1 — MovimientoStock (líneas 2803-2826):**
```diff
   /**
    * Phase 13 STKE-01 — refinación opcional del `tipo`.
    * Cuando un MovimientoStock tipo 'transferencia' es una conversión compra↔uso,
    * lleva `subtipo: 'conversion'`. Consumidores actuales que sólo leen `tipo` siguen funcionando sin cambio.
+   *
+   * Phase 15 — extendido a `'venta_loaner'` (sobre `tipo: 'egreso'`) cuando el movimiento es
+   * el espejo contable de una venta de Loaner. Union widening puro: consumidores que sólo leen
+   * `subtipo === 'conversion'` siguen funcionando (backwards-compat).
+   */
+  subtipo?: 'conversion' | 'venta_loaner';
+  /**
+   * Phase 15 — id del Loaner cuando subtipo='venta_loaner'.
+   * Permite query "movimientos de venta de tal loaner". Null/omitido en movimientos no-venta-loaner.
+   */
+  referenciaLoanerId?: string | null;
+  /**
+   * Phase 15 — código del Loaner (LNR-NNNN) denormalizado en el momento del write.
+   * Sigue patrón `articuloCodigo` ya denormalizado en MovimientoStock — evita join al renderizar listas históricas.
    */
-  subtipo?: 'conversion';
+  referenciaLoanerCodigo?: string | null;
```

**Hunk 2 — VentaLoaner (líneas 3209-3238):**
```diff
   presupuestoId?: string | null;
   presupuestoNumero?: string | null;
   notas?: string | null;
+  /**
+   * Phase 15 — costo del activo (lo que valió el equipo).
+   * Separado de `precio` que es revenue. Se carga manual en LoanerVentaModal y se denormaliza
+   * en UnidadStock.costoUnitario del espejo. Required en el modal de Phase 15 (validación UI),
+   * opcional en el tipo para no romper VentaLoaner pre-existentes.
+   */
+  costoUnitario?: number | null;
+  /** Phase 15 — moneda del costoUnitario. Required en el modal de Phase 15. */
+  monedaCosto?: 'ARS' | 'USD' | null;
 }
```

## Decisions Made

- **JSDoc del subtipo refactorizado para preservar history**: en lugar de reescribir el bloque doc completo, agregué un párrafo "Phase 15 — extendido a..." después del párrafo "Phase 13 STKE-01..." existente. Mantiene la trazabilidad de qué fase introdujo cada valor del union.
- **VentaLoaner extends al final del interface**: los campos nuevos van después de `notas` (último existente), no intercalados con `precio`/`moneda`. Minimiza diff y preserva ordering histórico para diff-readability futura.
- **Zero touch a otros tipos**: confirmado contra CONTEXT.md `<decisions>` — `Loaner.costoUnitario?` está LOCKED como descartado (costo vive en VentaLoaner, no en el activo). `EstadoLoaner`/`CondicionUnidad`/`EstadoUnidad`/`UbicacionStock`/`TipoMovimiento`/`TipoOrigenDestino` sin cambios (todos los valores reutilizan los enums existentes — Phase 15 NO extiende `TipoMovimiento` con `'venta'` ni `TipoOrigenDestino` con `'loaner'`).
- **`pnpm type-check` script en sistema-modular no existe** (CLAUDE.md root level lo expone solo para `packages/*`): usé `npx tsc --noEmit` directo en `apps/sistema-modular/`, `apps/reportes-ot/`, `apps/portal-ingeniero/` para validar zero-impact. NO se introdujo un script `type-check` nuevo (fuera de scope; potencial deferred-item de tooling).

## Deviations from Plan

None — plan executed exactly as written.

Single minor procedural note (no plan-content deviation): el comando del `<verify>` `pnpm --filter @ags/sistema-modular type-check` no existe como script. Se sustituyó por `npx tsc --noEmit` corriendo en el cwd de cada app — equivalente funcional, sin cambiar el alcance verificado.

## Issues Encountered

- **Pre-existing type errors en `apps/sistema-modular`**: `npx tsc --noEmit` reporta ~25 errores en archivos NO tocados por este plan (TS6133 unused imports en agenda/AgendaGridCell, presupuestos/PresupuestoHeaderBar, leads/LeadsList, services/otService.ts, services/stockAmplioService.ts; TS2305 en `__tests__/fixtures/cuotasFacturacion.ts`; etc.). Estos son baseline noise pre-existente. Confirmado scope boundary del plan: NO se autofixean (no fueron introducidos por las extensiones de tipo de Phase 15). Loggeados como referencia para futuro cleanup.
- **Pre-existing TS errors en `apps/reportes-ot`**: `ProtocolTableCell` types incompatibles en `protocols/*` (pre-existente, frozen surface — NO se toca por regla `.claude/rules/reportes-ot.md`).
- Cero errores nuevos atribuibles a las extensiones de tipo. Filtros `grep -iE "movimientostock|subtipo|referencialoaner|ventaloaner|costounitario|monedacosto"` sobre la salida de `tsc --noEmit` solo retornan los 2 errores esperados de Wave 0 RED (`ventaLoaner.test.ts:36 — no exported member 'registrarVenta'/'__setTestFirestore'`).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wave 2 (15-02 service transaccional) READY**: los 5 campos están declarados en `@ags/shared`. El método `registrarVenta` puede importar `VentaLoaner` con `costoUnitario`/`monedaCosto` typed correctamente, setear `subtipo: 'venta_loaner'` en el `MovimientoStock` sin TS error, y agregar `referenciaLoanerId`/`referenciaLoanerCodigo` denormalizado.
- **Wave 0 test status**: `pnpm --filter @ags/sistema-modular test:venta-loaner` sigue RED con `SyntaxError: does not provide an export named '__setTestFirestore'` — es el RED signal correcto para Wave 2 (no shape mismatch del payload, los tipos están listos). El error confirma que falta el código del servicio (responsabilidad de 15-02), no falta de tipos.
- **Próximo plan**: `15-02-service-transaccional-PLAN.md` — lift `registrarVenta` a named export + `__setTestFirestore` DI hook + transactional logic (runTransaction READ-FIRST guard + 3 escrituras atómicas: loaner update + unidadStock create + movimientoStock create) hasta GREEN en VLN-02a..e.
- **Wave 3 (15-03 modal UI + UAT)**: bloqueado por Wave 2. Después de 15-02 GREEN, 15-03 toca `LoanerVentaModal.tsx` + `LoanerDetail.handleVenta` + `useLoaners.registrarVenta`.
- **Cero impacto en `apps/reportes-ot/` y `apps/portal-ingeniero/`**: respetada la regla frozen-surface de reportes-ot y la decisión de scope Phase 15 (CONTEXT.md `<decisions>`: "Tocar apps/reportes-ot/: cero excepciones autorizadas").

## Self-Check: PASSED

- `packages/shared/src/types/index.ts` — FOUND (modified, 2 hunks)
- Commit `915bbfb` — FOUND in git log (`feat(15-01): widen MovimientoStock.subtipo + add referenciaLoaner fields`)
- Commit `de2c213` — FOUND in git log (`feat(15-01): add VentaLoaner.costoUnitario + monedaCosto`)
- `grep "venta_loaner" packages/shared/src/types/index.ts` returns 3 lines (1 JSDoc body, 1 type union, 1 JSDoc body — matches expected count for the union widening + 2 doc references)

---
*Phase: 15-stock-venta-de-loaner-espejo-a-stock*
*Completed: 2026-05-24*
