---
phase: 15
slug: stock-venta-de-loaner-espejo-a-stock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (built-in Node) ejecutados via `tsx` ^4.21.0 |
| **Config file** | none — cada test es un script standalone (mirror `apps/sistema-modular/scripts/test-patron-bom.ts`) |
| **Quick run command** | `pnpm --filter @ags/sistema-modular test:venta-loaner` |
| **Full suite command** | `pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular test:venta-loaner && pnpm --filter @ags/sistema-modular test:patron-bom && pnpm --filter @ags/sistema-modular test:equivalencias && pnpm --filter @ags/sistema-modular test:cuotas-facturacion && pnpm --filter @ags/sistema-modular test:stock-amplio` |
| **Estimated runtime** | ~10s quick / ~30s full suite |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ags/sistema-modular type-check && pnpm --filter @ags/sistema-modular test:venta-loaner`
- **After every plan wave:** Run full suite command above
- **Before `/gsd:verify-work`:** Full suite must be green + `pnpm --filter @ags/sistema-modular build` GREEN + UAT manual checklist firmado por el user
- **Max feedback latency:** ~10s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-VLN-01 | 01 | 1 | VLN-01 (types extension backwards-compat) | unit (type-check) | `pnpm --filter @ags/sistema-modular type-check` | ✅ existing | ⬜ pending |
| 15-VLN-02a | 02 | 2 | VLN-02a (happy path pre-vinculado) | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='happy path pre-vinculado'` | ❌ W0 | ⬜ pending |
| 15-VLN-02b | 02 | 2 | VLN-02b (happy path sin vínculo + denormaliza) | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='happy path sin vinculo'` | ❌ W0 | ⬜ pending |
| 15-VLN-02c | 02 | 2 | VLN-02c (guard idempotencia) | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='guard ya vendido'` | ❌ W0 | ⬜ pending |
| 15-VLN-02d | 02 | 2 | VLN-02d (rollback atómico) | unit (DI throw mid-write) | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='rollback'` | ❌ W0 | ⬜ pending |
| 15-VLN-02e | 02 | 2 | VLN-02e (validación costo requerido) | unit | `pnpm --filter @ags/sistema-modular test:venta-loaner -- --test-name-pattern='costo requerido'` | ❌ W0 | ⬜ pending |
| 15-VLN-03 | 03 | 3 | VLN-03 (UI extension: picker condicional + banner + disabled) | manual UAT | UAT pasos 2-4 abajo | N/A | ⬜ pending |
| 15-VLN-04 | 04 | 3 | VLN-04 (E2E full pipeline) | manual UAT | UAT pasos 1-8 abajo | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/sistema-modular/src/services/__tests__/ventaLoaner.test.ts` — RED baseline para VLN-02a..e (5 tests con `__setTestFirestore` DI hook)
- [ ] `apps/sistema-modular/src/services/__tests__/fixtures/ventaLoaner.ts` — 3 fixtures (PRE_VINCULADO, SIN_ARTICULO, YA_VENDIDO) + tipo `MockVentaLoanerState`
- [ ] `apps/sistema-modular/scripts/test-venta-loaner.ts` — tsx runner re-exportando `ventaLoaner.test.ts` (mirror `scripts/test-patron-bom.ts`)
- [ ] `apps/sistema-modular/package.json` — agregar `"test:venta-loaner": "tsx src/services/__tests__/ventaLoaner.test.ts"` (mirror línea 23: `test:equivalencias`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI extendida del modal (SearchableSelect condicional + banner error + botón disabled) | VLN-03 | TEST-01 (emulador Firestore) sigue Pending; mount React + Firestore real es frágil en CI | Pasos 2-4 del checklist UAT abajo |
| E2E full pipeline modal → 3 docs Firestore | VLN-04 | Misma razón (sin emulador) — Phase 14 documentó que Playwright contra Firestore real es frágil por TLS proxy | Pasos 1-8 del checklist UAT abajo |

### UAT manual checklist (8 pasos)

1. Abrir `/loaners`, crear un Loaner test con `articuloId: null` (campo opcional en LoanerEditor).
2. Abrir `/loaners/<id>` → click "Vender" → modal abre con SearchableSelect "Vincular artículo del catálogo *" visible.
3. Buscar y seleccionar un Artículo (ej. cualquier HPLC). Cargar Cliente, Precio venta=$1000 USD, Costo=$700 USD, notas="Test Phase 15".
4. Click "Confirmar venta" → modal cierra → loaner aparece con badge "Vendido"; `LoanerVentaSection` muestra cliente + precio + notas.
5. Verificar en Firestore Console: `loaners/<id>` tiene `articuloId` poblado + `venta.costoUnitario: 700` + `venta.monedaCosto: 'USD'` + `estado: 'vendido'` + `activo: false`.
6. Verificar en Firestore Console: nuevo doc en `unidadesStock` con `articuloId` matching + `estado: 'vendido'` + `condicion: 'bien_de_uso'` + `ubicacion.tipo: 'cliente'` + `costoUnitario: 700` + `monedaCosto: 'USD'`.
7. Verificar en Firestore Console: nuevo doc en `movimientosStock` con `subtipo: 'venta_loaner'` + `referenciaLoanerId: <loaner.id>` + `referenciaLoanerCodigo: <loaner.codigo>` + `cantidad: 1` + `destinoTipo: 'cliente'` + `origenTipo: 'baja'`.
8. Doble-click test (concurrencia): abrir 2 tabs del mismo loaner sin vender, en ambas abrir modal de venta. En tab A confirmar (success). En tab B confirmar → banner inline "Loaner ya vendido", modal NO cierra. Verificar en Firestore que NO se creó una segunda UnidadStock/MovimientoStock.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (VLN-01 type-check existing; VLN-02a..e Wave 0 stubs; VLN-03/VLN-04 manual UAT documented)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (3 of 8 tasks manual; alternated with automated tasks)
- [ ] Wave 0 covers all MISSING references (4 W0 artifacts above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (quick command runs only `ventaLoaner.test.ts` + type-check)
- [ ] `nyquist_compliant: true` set in frontmatter (after planner verifies all 8 tasks map to Wave 0 stubs or existing infra)

**Approval:** pending
