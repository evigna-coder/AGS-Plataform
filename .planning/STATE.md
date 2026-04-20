# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Cerrar end-to-end el ciclo comercial desde la consulta inicial hasta el aviso de facturación — con trazabilidad, estados automáticos y sin datos que se pierdan entre áreas.
**Current focus:** v2.0 Circuito Comercial Completo — Phase 5: Pre-condiciones

## Current Position

Phase: 5 of 11 (Pre-condiciones — Migración + Infra)
Plan: — (not started)
Status: Ready to plan
Last activity: 2026-04-19 — Roadmap v2.0 created; 41 requirements mapped to Phases 5-11

Progress: [░░░░░░░░░░] 0% (v2.0 milestone)

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v2.0 not started | — | — | — |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- **Phase 5 pre-condition (hard):** Migración clienteId null debe completarse ANTES de habilitar derivaciones automáticas (Pitfall 7-A). Sin esto, auto-tickets fallan silenciosamente.
- **Client-side triggers:** El pipeline comercial (ticket → presupuesto → OC → OT → facturación) usa client-side triggers. Cloud Functions SOLO para `resumenStock` aggregation.
- **Token-first mail order:** Siempre validar OAuth token ANTES de cambiar estado en Firestore (Pitfall 5-A). Implementar desde Phase 7.
- **runTransaction obligatorio:** Transiciones críticas de estado (acceptance, OC, cierre) usan `runTransaction` para prevenir race conditions (Pitfall 2-D). Desde Phase 8.
- **Snapshot de precios:** `precioUnitarioSnapshot` se congela al transicionar a `enviado`. Nunca recalcular retroactivamente (Pitfall 1-A). Establecer en Phase 6.
- **Sin cache en stock views:** Las vistas de planificación de stock nunca usan serviceCache.ts (Pitfall 3-C). Aplicar en Phase 9.

### Pending Todos

- Definir límites de zonas geográficas (AMBA / Interior BA / Interior país) con equipo comercial antes de Phase 6 — sesión 30 min
- Confirmar activación plan Blaze en Firebase antes de Phase 5 (functions/ workspace)
- Decidir política de `tipoCambioSnapshot` para MIXTA: ¿fecha de `enviado` o `oc_recibida`? (decisión de negocio antes de Phase 7)

### Blockers/Concerns

- **Blaze plan:** Cloud Functions requieren plan de pago en Firebase. Confirmar antes de iniciar Phase 5.
- **Zonas geográficas:** Los límites km de zonas son una decisión comercial. Sin ellos Phase 6 no puede completarse.

## Session Continuity

Last session: 2026-04-19
Stopped at: Roadmap v2.0 creado y aprobado — ROADMAP.md, STATE.md y REQUIREMENTS.md actualizados
Resume file: None
