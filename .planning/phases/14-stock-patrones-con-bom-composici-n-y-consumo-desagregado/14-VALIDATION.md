---
phase: 14
slug: stock-patrones-con-bom-composici-n-y-consumo-desagregado
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx + node:assert/strict (Phase 12/13 precedent) |
| **Config file** | none — runs via per-domain `test:*` script in `apps/sistema-modular/package.json` |
| **Quick run command** | `pnpm --filter @ags/sistema-modular test:patron-bom` |
| **Full suite command** | `pnpm --filter @ags/sistema-modular test:patron-bom && pnpm type-check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ags/sistema-modular test:patron-bom`
- **After every plan wave:** Run `pnpm --filter @ags/sistema-modular test:patron-bom && pnpm type-check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner once PLAN.md files are written. Each task row maps to a `<verify>` block in its plan and to one of the BOM-NN requirement IDs.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | BOM-01 | unit (types) | `pnpm type-check` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | BOM-02 | unit (saldo) | `pnpm --filter @ags/sistema-modular test:patron-bom` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | BOM-03 | unit (consumo) | `pnpm --filter @ags/sistema-modular test:patron-bom` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 2 | BOM-04 | unit (auto-req) | `pnpm --filter @ags/sistema-modular test:patron-bom` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The planner MUST fill the full map (one row per task) before plans are considered complete. Rows above are illustrative anchors for the dimensions tested.*

---

## Wave 0 Requirements

- [ ] `apps/sistema-modular/scripts/test-patron-bom.ts` — runner entry point (tsx)
- [ ] `apps/sistema-modular/src/__tests__/patronBom.test.ts` — unit tests for saldo + bloqueo + consumo
- [ ] `apps/sistema-modular/src/__tests__/fixtures/patronBom.ts` — fixtures: patrón legacy (sin componentes), patrón simple (3 ampollas iguales), patrón complejo (8 ampollas distintas), lote bloqueado
- [ ] `apps/sistema-modular/package.json` — add `"test:patron-bom": "tsx scripts/test-patron-bom.ts"`
- [ ] DI hook on `patronesService.consumirComponentes` — `__setTestFirestore(...)` shim mirroring `equivalenciasService.__setTestFirestore` pattern (Phase 13 precedent)
- [ ] DI hook on `movimientosService` write path used by `consumirComponentes` so movements can be asserted without real Firestore
- [ ] `packages/shared/src/utils/patronBom.ts` — pure saldo/bloqueo helpers (no Firestore) — testable directly

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sección "Componentes (BOM)" en `PatronEditorPage` permite alta/edición/baja de componentes | BOM-05 | UX inline form, mejor cubierto visualmente que en unit test | 1) `/patrones/{id}/editar` 2) Agregar componente A (cantidadPorKit=3, stockMinimo=1) 3) Guardar 4) Reabrir, agregar componente B (cantidadPorKit=1) 5) Eliminar A 6) Verificar persistencia y backwards-compat con lotes existentes |
| Paso "Patrones consumidos" en `OTCierreAdminSection` auto-prefilla desde reporte técnico y permite edición admin | BOM-06 | Integración Firestore + UI multi-sección | 1) Crear OT con reporte técnico que use patron+lote 2) Cierre admin → paso "Patrones consumidos" muestra sugerencia auto 3) Editar cantidad de un componente 4) Confirmar → verificar `MovimientoStock` con divergencia anotada en `motivo` 5) Reporte técnico permanece intocado |
| Badge "lote bloqueado" visible en selector técnico de `apps/reportes-ot` y selección deshabilitada | BOM-07 | Tab UI en app frozen, sólo verificable en runtime | 1) Bajar saldo de un componente a 0 desde admin 2) Abrir reporte técnico en `apps/reportes-ot` 3) Tab "Patrones" → lote afectado muestra badge rojo "AGOTADO" 4) Click en lote bloqueado: no se selecciona |
| Requerimiento de patrón auto-generado al cruzar `stockMinimo` aparece en dashboard del responsable configurado | BOM-08 | Trigger cross-service + visibilidad UI | 1) Configurar responsable en `/admin/config-flujos` (FLOW-07 style) 2) Consumir componente hasta cruzar mínimo 3) Verificar Requerimiento creado en Firestore 4) Verificar visibilidad en vista de requerimientos del responsable |
| PDF pipeline de `apps/reportes-ot` intacto (regresión) | — | App frozen, regresión visual no automatizable | Generar 1 PDF de OT con patrones BOM y 1 PDF de OT con patrones legacy. Diff visual contra baseline. Hoja 1, protocolos y fotos sin cambios. |
| `sistema-modular` instalado vía auto-update sigue funcionando tras release Phase 14 | — | Auto-update Electron + tag GH | Antes de tag: smoke `apps/sistema-modular/RELEASE-CHECKLIST.md`. Después: instalar `.exe`, confirmar update popup, validar módulos críticos. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test runner, fixtures, DI hooks, shared helper)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
