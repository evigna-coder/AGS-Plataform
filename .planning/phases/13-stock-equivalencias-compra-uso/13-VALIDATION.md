---
phase: 13
slug: stock-equivalencias-compra-uso
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: synthesized from `13-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit)** | `node:assert/strict` ejecutado via `tsx` (sin framework instalado — patrón de Phase 9 y Phase 12) |
| **Framework (E2E)** | Playwright `@playwright/test ^1.59.1` — config en `apps/sistema-modular/playwright.config.ts` |
| **Config files** | Unit: ninguno (scripts `.ts` standalone). E2E: `apps/sistema-modular/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @ags/sistema-modular test:equivalencias` (a crear en Wave 0) |
| **Full suite command** | `pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular e2e -g equivalencias` |
| **Estimated runtime** | Unit ~5s · E2E ~30s |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @ags/sistema-modular test:equivalencias` (unit, < 5s)
- **After every plan wave:** `pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular e2e -g equivalencias` (~30s)
- **Before `/gsd:verify-work`:** Full suite green + manual UAT del display dual (visual checkpoint con user, patrón de Phase 12 plan 12-06)
- **Max feedback latency:** < 5s en commit, < 30s en wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-00-01 | 00 | 0 | STKE-02/04 unit scaffolding | unit RED | `pnpm --filter @ags/sistema-modular test:equivalencias` | ❌ Wave 0 | ⬜ pending |
| 13-00-02 | 00 | 0 | STKE-03/05/06/07 E2E fixme baseline | e2e RED | `pnpm --filter @ags/sistema-modular e2e -g equivalencias` | ❌ Wave 0 | ⬜ pending |
| 13-01-XX | 01 | 1 | STKE-01 | unit (type-level) | `tsc --noEmit -p packages/shared` + tsc en sistema-modular | ✅ via Wave 0 import-shape | ⬜ pending |
| 13-02-XX | 02 | 1 | STKE-02 link/unlink | unit (DI Firestore) | `pnpm --filter @ags/sistema-modular test:equivalencias` | ✅ via Wave 0 | ⬜ pending |
| 13-03-XX | 03 | 1 | STKE-04 desagregarUnidades | unit (DI Firestore + tx mock) | `pnpm --filter @ags/sistema-modular test:equivalencias` | ✅ via Wave 0 | ⬜ pending |
| 13-04-XX | 04 | 2 | STKE-03 EquivalenciaSection en EditArticuloModal | E2E smoke | `e2e -g "equivalencia.*edit"` | ✅ via Wave 0 fixme | ⬜ pending |
| 13-05-XX | 05 | 2 | STKE-05 DesagregarStockModal | E2E smoke | `e2e -g "desagregar"` | ✅ via Wave 0 fixme | ⬜ pending |
| 13-06-XX | 06 | 2 | STKE-06 display dual ArticuloDetail | E2E smoke + manual visual | `e2e -g "detail.*equivalencia"` + checkpoint | ✅ via Wave 0 fixme | ⬜ pending |
| 13-07-XX | 07 | 3 | STKE-07 lista on-demand expansion | E2E smoke (Playwright snapshot + interaction) | `e2e -g "lista.*equivalencia"` | ✅ via Wave 0 fixme | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan/wave/task ID assignments above are placeholders; gsd-planner emits the authoritative IDs in PLAN frontmatter.*

---

## Wave 0 Requirements

- [ ] `apps/sistema-modular/src/services/__tests__/equivalencias.test.ts` — unit tests STKE-02 + STKE-04 con DI Firestore (patrón de `stockAmplio.test.ts`)
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/equivalencias.ts` — fixtures para los casos (happy, self-link, destino-tomado, ciclo, stock-insuficiente)
- [ ] `apps/sistema-modular/e2e/equivalencias.spec.ts` — E2E specs con `test.fixme` baseline (RED until Waves 1-3 land)
- [ ] Script en `apps/sistema-modular/package.json`: `"test:equivalencias": "tsx src/services/__tests__/equivalencias.test.ts"`
- [ ] (Opcional) Helper `apps/sistema-modular/e2e/helpers/equivalencias.ts` — crear pares vinculados via Firestore Admin en setup

---

## Per-Requirement Map (from research)

| Req ID | Behavior | Test Type |
|--------|----------|-----------|
| STKE-01 | Tipos `Articulo.equivalencias?` + `MovimientoStock.subtipo?` compilan y se importan en sistema-modular | unit (type-level, `tsc --noEmit` + shape import en `equivalencias.test.ts`) |
| STKE-02a | `linkEquivalencia` rechaza self-link (origenId === destinoId) | unit (pure validation) |
| STKE-02b | `linkEquivalencia` rechaza factor ≤ 0 / NaN / Infinity | unit |
| STKE-02c | `linkEquivalencia` rechaza origen ya vinculado | unit (DI Firestore) |
| STKE-02d | `linkEquivalencia` rechaza destino ya tomado por otro origen | unit (DI; usa `articuloIdDestinoEquivalencia` plano) |
| STKE-02e | `linkEquivalencia` rechaza ciclo A→B→A | unit (DI) |
| STKE-02f | `unlinkEquivalencia` limpia ambos campos (`equivalencias`, `articuloIdDestinoEquivalencia`) | unit (DI) |
| STKE-03 | UI: sección equivalencia en `EditArticuloModal` renderiza con `SearchableSelect` + factor input | E2E smoke (Playwright) |
| STKE-04a | `desagregarUnidades(5)` baja 5 del origen y crea 5×factor en destino dentro de una sola tx | unit (DI + tx mock) |
| STKE-04b | `desagregarUnidades` falla atómicamente si no hay stock suficiente (no escribe nada) | unit (DI) |
| STKE-04c | `desagregarUnidades` crea exactamente UN `MovimientoStock` con `subtipo: 'conversion'` | unit (DI) |
| STKE-05 | Modal "Desagregar ahora" valida cantidad ≤ stock disponible | E2E smoke |
| STKE-06 | `ArticuloDetail` muestra display dual visible siempre (lado origen Y lado destino) | E2E smoke + manual visual (DETAIL_SCREENSHOT_CHECKPOINT) |
| STKE-07 | `ArticulosList` y `SearchableSelect` muestran badge "↔" en filas vinculadas; expansión dual sólo al matchear código | E2E smoke (Playwright snapshot + interaction) |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual del display dual en `ArticuloDetail` (jerarquía tipográfica, badge, CTA "Desagregar ahora") | STKE-06 | Editorial Teal requiere chequeo visual; el snapshot E2E confirma estructura pero no la sensación visual | UAT checkpoint con user — abrir un artículo con equivalencia (ambos lados) y comparar contra Editorial Teal tokens (teal-700, Newsreader serif title si modal, JetBrains Mono labels) |
| On-demand dual expansion en `ArticulosList` al buscar específicamente uno de los códigos vinculados | STKE-07 | Confirmar que NO se renderiza el desglose para todas las filas con equivalencia, sólo para la fila buscada | Cargar la lista, buscar el código de compra → ver fila colapsada con badge; buscar el código de uso → ver fila desplegada con ambas existencias |
| Toast + link al `MovimientoStock` creado al confirmar `desagregarUnidades` | STKE-05 | UX feedback no semánticamente cubierto por unit | Disparar conversión exitosa y seguir el link a histórico |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (full wave)
- [ ] `nyquist_compliant: true` set in frontmatter at phase close
- [ ] Manual UAT (display dual) approved before `/gsd:verify-work`

**Approval:** pending
