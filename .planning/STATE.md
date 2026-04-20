---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: in_progress
stopped_at: "Phase 5 Wave 1+2 plans executed (05-01, 05-02, 05-03); 05-04 pending; user --dry-run/--run execution of both migration scripts pending (human-verify)"
last_updated: "2026-04-20T12:17:44Z"
last_activity: 2026-04-20 — Plan 05-01 executed (script clienteId + UI revisión admin + type extensions); PREC-01 desbloqueado
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 19
  completed_plans: 16
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Cerrar end-to-end el ciclo comercial desde la consulta inicial hasta el aviso de facturación — con trazabilidad, estados automáticos y sin datos que se pierdan entre áreas.
**Current focus:** v2.0 Circuito Comercial Completo — Phase 5: Pre-condiciones

## Current Position

Phase: 5 of 11 (Pre-condiciones — Migración + Infra)
Plan: 3 of 4 completed (05-01 clienteId, 05-02 contactos, 05-03 functions bootstrap). 05-04 featureFlags pending. User --dry-run/--run execution of both migration scripts pending.
Status: In Progress
Last activity: 2026-04-20 — Plan 05-01 executed (script + UI admin + type extensions); PREC-01 desbloqueado

Progress: [████████░░] 84% (v2.0 milestone)

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 3 (05-01, 05-02, 05-03 — all pending user checkpoint verification for scripts)
- Average duration: ~6min
- Total execution time: ~18min

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 05-pre-condiciones-migracion-infra | 01 | 10min | 4 | 8 |
| 05-pre-condiciones-migracion-infra | 02 | 2min | 1 | 1 |
| 05-pre-condiciones-migracion-infra | 03 | ~5min | 2 | 7 |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- **Phase 5 pre-condition (hard):** Migración clienteId null debe completarse ANTES de habilitar derivaciones automáticas (Pitfall 7-A). Sin esto, auto-tickets fallan silenciosamente.
- **Client-side triggers:** El pipeline comercial (ticket → presupuesto → OC → OT → facturación) usa client-side triggers. Cloud Functions SOLO para `resumenStock` aggregation.
- **Token-first mail order:** Siempre validar OAuth token ANTES de cambiar estado en Firestore (Pitfall 5-A). Implementar desde Phase 7.
- **runTransaction obligatorio:** Transiciones críticas de estado (acceptance, OC, cierre) usan `runTransaction` para prevenir race conditions (Pitfall 2-D). Desde Phase 8.
- **Snapshot de precios:** `precioUnitarioSnapshot` se congela al transicionar a `oc_recibida` (no al enviar). Antes de OC los precios pueden recalcularse (útil para negociaciones con el cliente). Establecer en Phase 6.
- **TC MIXTA snapshot (confirmado):** El tipo de cambio USD-ARS se congela al recibirse la OC, consistente con la política general de precios. Establecer en Phase 6.
- **Revisiones de presupuesto:** Al crear revisión (item 2, item 3...), por defecto se anula la anterior. Nuevo requerimiento REV-01: agregar pregunta "¿mantener ambas revisiones activas?" para casos donde el cliente recibe dos opciones (ej: con/sin una parte). Establecer en Phase 8.
- **Sin cache en stock views:** Las vistas de planificación de stock nunca usan serviceCache.ts (Pitfall 3-C). Aplicar en Phase 9.
- [Phase 05-pre-condiciones-migracion-infra]: Script migración contactos[] defaults a --dry-run; --run requiere flag explícito y ejecución manual del usuario (no se incluye service-account en repo)
- [Phase 05-01]: Ruta admin registrada en `components/layout/TabContentManager.tsx` (no `App.tsx`) — el routing real vive allí. Patrón a usar para futuras rutas admin.
- [Phase 05-01]: `useUrlFilters` es schema-based `(schema) => [filters, setFilter, setFilters, resetFilters]` — NO shape simple. Documentado en RevisionClienteIdPage como referencia.
- [Phase 05-01]: Plan 05-01 estableció que tickets con `clienteId: null` se matchean por CUIT (≥8 dígitos) → razón social exacta (NFD normalizada). Ambiguos quedan con `pendienteClienteId: true` + `candidatosPropuestos` con `score: 'cuit' | 'razonSocial'` para UI de revisión admin en `/admin/revision-clienteid`.

### Pending Todos

- Definir límites de zonas geográficas (AMBA / Interior BA / Interior país) con equipo comercial antes de Phase 6 — sesión 30 min (pendiente)
- ~~Confirmar activación plan Blaze en Firebase~~ ✓ Confirmado 2026-04-19
- ~~Decidir política de `tipoCambioSnapshot` MIXTA~~ ✓ Resuelto 2026-04-19: snapshot al `oc_recibida`

### Blockers/Concerns

- **Zonas geográficas:** Los límites/tarifas de zonas (AMBA / Interior BA / Interior país) son decisión comercial. Sin ellos Phase 6 no puede completarse. Sesión con equipo prevista para 2026-04-20.

## Session Continuity

Last session: 2026-04-20T12:17:44Z
Stopped at: Completed 05-01 end-to-end (script + UI + type extensions). Awaiting user manual execution of both migration scripts (05-01 clienteId, 05-02 contactos) + verification of /admin/revision-clienteid page. Plan 05-04 (featureFlags) is the only Phase 5 work remaining.
Resume file: None
