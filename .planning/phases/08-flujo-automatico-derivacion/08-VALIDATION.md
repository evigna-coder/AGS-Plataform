---
phase: 08
slug: flujo-automatico-derivacion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 08 — Validation Strategy

> Per-phase validation contract derived from `08-RESEARCH.md §Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 (E2E only — no unit test runner) |
| **Config file** | `apps/sistema-modular/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @ags/sistema-modular type-check` |
| **Full suite command** | `pnpm --filter @ags/sistema-modular e2e` |
| **Workers** | 1 (serial — shared login fixture) |
| **Estimated runtime** | type-check ~10s; full E2E ~15-25min; target specs ~5-8min |

**Unit test gap acknowledged:** `runTransaction` logic + retry loops + mapping functions land without unit coverage. Phase 11 (TEST-01) is where the unit runner story is addressed.

---

## Sampling Rate

- **After every task commit:** `pnpm type-check` (<10s) + smoke E2E of the spec touched (~30-60s)
- **After every wave merge:** `pnpm e2e -- 11-full-business-cycle 12-pending-actions-retry 13-oc-cliente-flow` (~5-8min)
- **Phase gate:** full `pnpm e2e` (~15-25min) before `/gsd:verify-work`
- **Max feedback latency:** type-check <10s; per-spec <60s

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Command | File |
|-------------|----------|-----------|---------|------|
| FLOW-01 | Presupuesto sin ticket → markEnviado → auto-ticket creado | E2E | `e2e -- 11-full-business-cycle` (extended step 5-6) | ⚠️ Wave 0 extension |
| FLOW-01 edge | `clienteId: null` → pendingAction → retry al resolver | E2E | `e2e -- 12-pending-actions-retry` | ❌ Wave 0 new |
| FLOW-02 | Cargar OC desde list → ticket `oc_recibida` | E2E | `e2e -- 13-oc-cliente-flow` | ❌ Wave 0 new |
| FLOW-02 N:M | 1 OC cubre 2 presupuestos → back-refs OK en ambos | E2E | `13-oc-cliente-flow.spec.ts` step 3-4 | ❌ Wave 0 new |
| FLOW-03 | Aceptar con item import → req `condicional: true` created; anular → req cancelado | E2E | Extender `03-presupuestos` + assert en `05-stock` | ⚠️ Wave 0 extension |
| FLOW-04 | OT `CIERRE_ADMINISTRATIVO` → `mailQueue` doc + ticket admin | E2E | Extender `11-full-business-cycle` step 13-14 | ⚠️ Wave 0 extension |
| FLOW-04 content | Mail tiene adjuntos correctos + PDF | Manual | N/A (inbox real) | Manual-only |
| FLOW-05 | `runTransaction` previene race | Manual | 2 browsers paralelos submit rápido | Manual stress test |
| FLOW-06 | pendingAction persiste + retry manual desde dashboard | E2E | `12-pending-actions-retry.spec.ts` | ❌ Wave 0 new |
| FLOW-07 | `/admin/config-flujos` guarda + valida activo | E2E smoke | Extender `10-smoke-all-pages` | ⚠️ Wave 0 extension |

---

## Wave 0 Requirements

**Must exist before executing any Wave ≥1 plan:**

- [ ] NEW: `apps/sistema-modular/e2e/circuits/12-pending-actions-retry.spec.ts` — cubre FLOW-01 edge + FLOW-06 dashboard
- [ ] NEW: `apps/sistema-modular/e2e/circuits/13-oc-cliente-flow.spec.ts` — cubre FLOW-02 carga OC + N:M relationship
- [ ] EXTEND: `11-full-business-cycle.spec.ts` — assert `mailQueue` doc al llegar a `CIERRE_ADMINISTRATIVO` (FLOW-04)
- [ ] EXTEND: `10-smoke-all-pages.spec.ts` — agregar `/admin/config-flujos` + `/admin/acciones-pendientes`
- [ ] NEW helper (si no existe): `apps/sistema-modular/e2e/helpers/firestore-assert.ts` — leer Firestore docs via Admin SDK para validar `pendingActions[]` + `mailQueue` state

**Explicit out-of-scope for Wave 0:** instalar vitest/jest en este phase. Scope creep — Phase 11 TEST-01 territory.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mail delivery content + PDF adjunto | FLOW-04 | Inbox real + validación humana | Disparar `CIERRE_ADMINISTRATIVO` → revisar inbox del destinatario → abrir PDF adjunto → validar que contenga presupuesto + OC + OTs vinculadas |
| Mail destinatario correcto tras cambio de config | FLOW-07 | Requiere cambio de config + disparo real | Cambiar mail en `/admin/config-flujos` → disparar FLOW-04 → confirmar recepción en nuevo destinatario |
| Race condition real `runTransaction` | FLOW-05 | No determinístico en Playwright serial | Abrir presupuesto en 2 browsers → simultáneo submit OC (o doble click rápido) → verificar que solo un doc se creó y no hay duplicaciones |
| OAuth popup bloqueado retry manual | FLOW-06 | Popup no es controlable headless | Bloquear popups → intentar retry manual desde dashboard → verificar mensaje popup-blocker + reset de status |

---

## Risk Acknowledgements (from RESEARCH §Risk surface)

Key risks that Wave 0 tests + runtime discipline cover:

1. **No `arrayUnion` inside `runTransaction`** — hard rule in plans. Use `tx.get()` → merge array → `tx.set()`.
2. **No nested `runTransaction`** — new atomic methods inline all writes.
3. **`condicional: true` requerimiento cleanup** — test in `03-presupuestos` spec (aceptar → anular → assert req cancelled).
4. **mailQueue consumer inert** — safe default, retry manual works without it (explicit in CONTEXT + RESEARCH).
5. **Retry retroactive from `/admin/revision-clienteid`** — `12-pending-actions-retry.spec.ts` covers this path explicitly.

---

## Validation Sign-Off

- [x] All phase requirements have automated OR manual verify mapped
- [x] Sampling continuity: type-check per commit + smoke per task
- [ ] Wave 0 specs created (`12-pending-actions-retry`, `13-oc-cliente-flow`, extensions) — blocks Wave 1
- [x] No watch-mode flags
- [x] Feedback latency documented (<10s type-check, <60s smoke per spec)
- [ ] `nyquist_compliant: true` — pending Wave 0 completion

**Approval:** pending — blocks on Wave 0 spec creation.
