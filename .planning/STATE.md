---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Circuito Comercial Completo
status: executing
stopped_at: "Completed 05-04 end-to-end (feature flags runtime + admin UI); awaiting user human-verify: /admin/modulos toggle reflects in sidebar live. Phase 5 Wave 2 complete at code level (05-03 functions + 05-04 featureFlags). Pending user actions: run migration scripts 05-01/05-02 (--dry-run/--run), deploy functions 05-03, verify admin UI 05-04."
last_updated: "2026-04-20T12:40:55.696Z"
last_activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado
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
Plan: 4 of 4 completed at code level (05-01 clienteId, 05-02 contactos, 05-03 functions bootstrap, 05-04 featureFlags). Pending user actions: run migration scripts 05-01/05-02 (--dry-run/--run), deploy functions 05-03, human-verify admin UI 05-04.
Status: In Progress (awaiting user human-verify + manual script runs)
Last activity: 2026-04-20 — Plan 05-04 executed (featureFlags runtime + /admin/modulos UI); PREC-04 desbloqueado

Progress: [████████░░] 84% (v2.0 milestone)

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 4 (05-01, 05-02, 05-03, 05-04 — all pending user checkpoint verification for scripts / human-verify)
- Average duration: ~5.5min
- Total execution time: ~23min

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 05-pre-condiciones-migracion-infra | 01 | 10min | 4 | 8 |
| 05-pre-condiciones-migracion-infra | 02 | 2min | 1 | 1 |
| 05-pre-condiciones-migracion-infra | 03 | ~5min | 2 | 7 |
| 05-pre-condiciones-migracion-infra | 04 | 5min | 3 | 8 |

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
- [Phase 05-04]: Feature flags runtime vía colección Firestore `/featureFlags/modules` + `FeatureFlagsContext` + hook `useNavigation()` reactivo. `VITE_DESKTOP_MVP` queda como default de build; Firestore override por módulo gana. UI admin en `/admin/modulos` (icon 🧩). `DESKTOP_MVP_ALLOWED` ahora exportado desde `navigation.ts` con helper `isMvpDefault(path)` — source of truth única (no duplicar el set en la admin UI).
- [Phase 05-04]: `useAuth()` retorna `{ firebaseUser, usuario, ... }`; el uid real vive en `firebaseUser.uid`. Usar ese campo para `updatedBy` en writes (no `usuario.id`, que en transiciones puede ser null).

### Pending Todos

- Definir límites de zonas geográficas (AMBA / Interior BA / Interior país) con equipo comercial antes de Phase 6 — sesión 30 min (pendiente)
- ~~Confirmar activación plan Blaze en Firebase~~ ✓ Confirmado 2026-04-19
- ~~Decidir política de `tipoCambioSnapshot` MIXTA~~ ✓ Resuelto 2026-04-19: snapshot al `oc_recibida`

### Blockers/Concerns

- **Zonas geográficas:** Los límites/tarifas de zonas (AMBA / Interior BA / Interior país) son decisión comercial. Sin ellos Phase 6 no puede completarse. Sesión con equipo prevista para 2026-04-20.

## Session Continuity

Last session: 2026-04-20T12:40:06.678Z
Stopped at: Completed 05-04 end-to-end (feature flags runtime + admin UI); awaiting user human-verify: /admin/modulos toggle reflects in sidebar live. Phase 5 Wave 2 complete at code level (05-03 functions + 05-04 featureFlags). Pending user actions: run migration scripts 05-01/05-02 (--dry-run/--run), deploy functions 05-03, verify admin UI 05-04.
Resume file: None
