---
plan: 08-05
phase: 08
status: complete
completed: 2026-04-21
requirements: [FLOW-04, FLOW-06, FLOW-07]
approved_by: user (executor hit rate limit after 3/3 code commits; finalized by orchestrator)
---

# 08-05 Summary — Cierre OT + mailQueue + dashboards admin

## Objective delivered

Cierre del circuito comercial: OT al `CIERRE_ADMINISTRATIVO` dispara aviso atómico a facturación (ticket interno + mailQueue), UI admin real para config de flujos + dashboard live de acciones pendientes.

## Commits

| Commit | Change |
|--------|--------|
| `999df7a` | `otService.cerrarAdministrativamente` transactional (update OT + create ticket admin + mailQueue enqueue en 1 tx) + wire en `useOTDetail` |
| `6a2153b` | `ConfigFlujosPage` UI real (3 SearchableSelect + input email + validación activo) reemplaza placeholder |
| `fc4a938` | `AccionesPendientesPage` dashboard + `AccionesPendientesRow` subcomponente (filtros `useUrlFilters`, retry, marcar resuelta) |

## Files changed

**New:**
- `apps/sistema-modular/src/pages/admin/AccionesPendientesRow.tsx` (89 LOC)

**Modified:**
- `apps/sistema-modular/src/services/otService.ts` (+198 LOC — `cerrarAdministrativamente` transactional method; legacy `enviarAvisoCierreAdmin` marcado `@deprecated` pero no eliminado)
- `apps/sistema-modular/src/hooks/useOTDetail.ts` (+86 LOC — llama `cerrarAdministrativamente` en lugar del flow antiguo al cierre admin)
- `apps/sistema-modular/src/pages/admin/ConfigFlujosPage.tsx` (placeholder → 194 LOC UI real)
- `apps/sistema-modular/src/pages/admin/AccionesPendientesPage.tsx` (placeholder → 219 LOC dashboard)
- `apps/sistema-modular/e2e/circuits/11-full-business-cycle.spec.ts` (desfixme 11.13b — mailQueue assertion GREEN-ready)

## Verification

- Build pre-rate-limit: passes (`pnpm --filter sistema-modular build:web`)
- 3 commits atomic y independientes
- Specs RED ahora GREEN-ready para 11.13b (mailQueue), 12 Scenario B (dashboard), 10 smoke para ambas rutas admin
- Budget: AccionesPendientesPage 219 LOC, ConfigFlujosPage 194 LOC, AccionesPendientesRow 89 LOC — todos bajo 250 ✓

## Deviations

Ninguna deviación de scope. Executor hit rate limit tras commitear las 3 tasks de código pero antes del docs commit — el finalize (SUMMARY + STATE + ROADMAP) lo hizo el orchestrator manualmente. Todas las tasks ejecutadas según plan.

## Known follow-ups

- `mailQueue` consumer (Cloud Function que procesa los docs encolados) queda para Phase 9 — en v2.0 el doc queda encolado pero sin consumer activo; retry manual desde dashboard lo regenera
- `enviarAvisoCierreAdmin` legacy: `@deprecated` pero no eliminado — fallback si alguien necesita disparo client-side
- `presupuestosService.ts` ya en 1146+ LOC (repeat offender pre-existente) — flagged en `deferred-items.md` para refactor post-v2.0
