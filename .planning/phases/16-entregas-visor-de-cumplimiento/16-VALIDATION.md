---
phase: 16
slug: entregas-visor-de-cumplimiento
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript + Node `--experimental-strip-types` (patrón Phase 14-15) |
| **Config file** | `apps/sistema-modular/package.json` → script `"test:entregas"` (Wave 0 gap) |
| **Quick run command** | `pnpm --filter @ags/sistema-modular test:entregas` |
| **Full suite command** | `pnpm --filter @ags/sistema-modular test:entregas && pnpm --filter @ags/sistema-modular test:patron-bom && pnpm --filter @ags/sistema-modular test:venta-loaner` |
| **Estimated runtime** | ~3 seconds (pure functions, no I/O) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ags/sistema-modular test:entregas`
- **After every plan wave:** Run full suite (`test:entregas && test:patron-bom && test:venta-loaner`)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | ENT-W0 | wave-0 fixtures | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 0 | ENT-W0 | wave-0 helper | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | ENT-01 | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | ENT-02 | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 1 | ENT-03 | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 1 | ENT-04 | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-03-03 | 03 | 1 | ENT-05 | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-04-01 | 04 | 2 | ENT-06 | unit | `pnpm --filter @ags/sistema-modular test:entregas` | ❌ W0 | ⬜ pending |
| 16-05-01 | 05 | 2 | UI-01 | manual-only | N/A — UAT | N/A | ⬜ pending |
| 16-05-02 | 05 | 2 | UI-02 | manual-only | N/A — UAT | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Plan/Task IDs are illustrative — planner refines in Step 8. Each plan must keep the requirement→test mapping.*

---

## Wave 0 Requirements

- [ ] `apps/sistema-modular/scripts/test-entregas.ts` — cubre ENT-01 a ENT-06 con fixtures de presupuesto, requerimiento, OC y importación
- [ ] `apps/sistema-modular/src/utils/entregasResolver.ts` (stub) — pure functions `computeSemaforo`, `computeEtaFecha`, `buildEntregaRows` para testear sin Firestore
- [ ] `apps/sistema-modular/package.json` script: `"test:entregas": "node --experimental-strip-types scripts/test-entregas.ts"`

*Patrón idéntico a `scripts/test-patron-bom.ts` y `scripts/test-venta-loaner.ts` ya en el proyecto.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edición inline de OT# guarda en `presupuestoItem.otNumeroVinculada` | UI-01 | UX interaction (focus, blur, persistencia visual) y verificación post-Firestore writes | 1) Abrir `/entregas`, 2) Clickear celda OT# de una fila, 3) Tipear "OT-1234", 4) Blur → fila refleja el valor, 5) F5 → valor persiste |
| Filtros persisten en URL al navegar hacia atrás | UI-02 | Comportamiento de browser history + `useUrlFilters` con React Router | 1) En `/entregas`, aplicar filtros (cliente + semáforo=rojo), 2) Click row → navega a presupuesto, 3) Browser back → filtros intactos, URL contiene query params |
| Banner "Sin ETA" se muestra para presupuestos legacy | UI-03 | UX edge case con datos históricos sin `fechaAceptacion` ni `etaDiasEstimados` | 1) Abrir `/entregas`, 2) Verificar que filas de presupuestos pre-cutover muestran badge gris "Sin ETA" y no rompen rendering |
| Atajo "aplicar a todos los items" en editor de presupuestos | UI-04 | Bulk action con confirm modal | 1) Abrir editor de presupuesto con N items, 2) Setear disponibilidad+eta en row 1, 3) Click "Aplicar a todos", 4) Confirmar, 5) Todas las rows reflejan los valores |
| Auto-detección default de `disponibilidad` (ATP>0→stock, ATP=0→a_importar) | UI-05 | Depende de `computeStockAmplio()` con datos reales (no testeable en unit) | 1) Agregar item con artículo cuyo ATP=0 → default `'a_importar'`, 2) Agregar item con stock disponible → default `'stock'` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after Wave 0 plan exists)

**Approval:** pending
