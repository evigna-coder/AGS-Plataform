---
phase: 05-pre-condiciones-migracion-infra
plan: 02
subsystem: database
tags: [firebase-admin, firestore, migration, tickets, contactos, idempotent]

# Dependency graph
requires:
  - phase: legacy-leadsService
    provides: hydrateContactos() in-memory hydration logic (lines 89-103)
provides:
  - Standalone idempotent migration script that persists `contactos[]` arrays on legacy tickets
  - Guarantee that `getContactoPrincipal()` returns non-null for any migrated ticket with prior `contacto/email/telefono`
  - Foundation for Phase 8 FLOW-04 (aviso facturación) and FLOW-02 (derivación a coordinador) which require persisted `contactos[]`
affects: [phase-08-flow, phase-08-rev, mail-sending-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotency guard pattern: skip when target array has length > 0"
    - "Standalone migration scripts replicate service logic inline (no `@ags/shared` import)"
    - "stripUndefined() + key omission in firebase-admin writes (parallel to `deepCleanForFirestore` in app code)"

key-files:
  created:
    - apps/sistema-modular/scripts/migrate-tickets-contactos.mjs
  modified: []

key-decisions:
  - "Script defaults to --dry-run (safety); --run must be explicit"
  - "Flat fields `contacto/email/telefono` preserved — `syncFlatFromContactos` remains source of truth for new writes"
  - "Empty email/telefono keys are omitted, never written as undefined (Firestore constraint)"
  - "Execution deferred to user: no service-account.json present in working tree; user runs --run manually after dry-run review"

patterns-established:
  - "Migration script shape: bootstrap (firebase-admin + service-account) → inline helper replicating service logic → batch loop with 400-op commits → final resumen log"
  - "Idempotency via content-check (`existing.length > 0`) rather than via mapping.json"

requirements-completed: [PREC-02]

# Metrics
duration: 2min
completed: 2026-04-20
---

# Phase 05 Plan 02: Migración batch contactos planos → contactos[] Summary

**Script standalone idempotente que persiste el output de `hydrateContactos()` en Firestore: convierte `contacto/email/telefono` planos en `contactos[{ id:'legacy-principal', …, esPrincipal:true }]` para todos los tickets legacy, preservando los campos planos intactos.**

## Performance

- **Duration:** ~2 min (script authoring; execution deferred to user)
- **Started:** 2026-04-20T12:07:34Z
- **Completed:** 2026-04-20T12:09:04Z
- **Tasks:** 1/2 (Task 2 is a human-verify checkpoint — awaiting user)
- **Files modified:** 1 (1 created)

## Accomplishments

- Migration script `migrate-tickets-contactos.mjs` created at 163 LOC (>90 min requirement)
- `hydrateContactos()` logic replicated inline with zero dependency on `@ags/shared` (firebase-admin-safe)
- Idempotency guard (`existing.length > 0 → return null`) preserves the "run twice is a no-op" invariant
- Flat fields `contacto/email/telefono` untouched — `syncFlatFromContactos` remains authoritative for future writes
- Never-undefined write pattern: empty `email`/`telefono` keys are omitted from the ContactoTicket object rather than set to `undefined`
- Script boots cleanly and halts at the expected credentials gate (the only plan-accepted failure mode for --dry-run without service-account.json)

## Task Commits

1. **Task 1: Crear script migrate-tickets-contactos.mjs** — `576b416` (feat)
2. **Task 2: Ejecutar dry-run → run → verificar idempotencia** — deferred to user (checkpoint:human-verify)

**Plan metadata:** pending (will be recorded after SUMMARY/STATE commit)

## Files Created/Modified

- `apps/sistema-modular/scripts/migrate-tickets-contactos.mjs` (created, 163 LOC) — migración idempotente de contactos planos a `contactos[]` estructurado

## Decisions Made

- **Execution deferred to user:** `apps/sistema-modular/service-account.json` is not present in the working tree. Running `--dry-run` would only verify credential gating, not the actual migration output. User will provide credentials and run `--dry-run` → review log → `--run` → verify idempotency manually per the plan's Task 2 checklist.
- **Inline type replication over shared import:** The script is `.mjs` with firebase-admin; it cannot import from `@ags/shared` (which is a TS package built for the browser). The `ContactoTicket` shape is replicated inline (id/nombre/email/telefono/esPrincipal) — any future change to the shared type must be mirrored here. Documented in the script header.
- **`--dry-run` as default:** If the user forgets to pass any flag, the script does NOT write. Only `--run` (explicit) triggers writes.
- **Key omission over `null`:** For empty email/telefono, the key is omitted from the `ContactoTicket` object (not set to `null`). This matches the pattern of the in-memory `hydrateContactos()` which returns `email: email || undefined` (and Firestore later strips undefined via `deepCleanForFirestore` on the UI-side). Omitting keys avoids ambiguity between "known-empty" (`null`) and "not set" (missing key).

## Deviations from Plan

None - plan executed exactly as written. Task 2 is a human-verify checkpoint intentionally not executed by the agent (per plan type and per orchestrator instruction).

## Issues Encountered

- **No `service-account.json` in `apps/sistema-modular/`:** Expected by plan (`done` criteria: "o con error esperado de `service-account.json no encontrado` si no hay uno — aceptable"). Confirmed by running `node apps/sistema-modular/scripts/migrate-tickets-contactos.mjs --dry-run` which emitted `No se encontró service-account.json en …` and exited 1 — the script boots, parses flags, and halts at the credentials gate as designed.

## Deferred Execution — User Action Required

Task 2 (checkpoint:human-verify) is not automatable by the agent without Firestore credentials. The user will execute it in three steps:

1. Ensure `apps/sistema-modular/service-account.json` exists (or export `SERVICE_ACCOUNT_PATH`).
2. `cd apps/sistema-modular && node scripts/migrate-tickets-contactos.mjs --dry-run` → review resumen counts.
3. `node scripts/migrate-tickets-contactos.mjs --run` → verify 3 sampled tickets in Firebase console now have `contactos[]`.
4. Re-run `--run` → verify `Migrados: 0` (idempotency).
5. Smoke-test the mail-sending modal in `pnpm dev:modular` — confirm destinatario auto-selects.

## Next Phase Readiness

- ✅ Plan 05-02 code-side ready. Downstream Phase 8 work that expects persisted `contactos[]` (FLOW-04 aviso facturación, FLOW-02 derivación a coordinador) is unblocked once the user completes the checkpoint.
- ⚠️ Persistence itself not yet performed in production Firestore — Phase 8 cannot ship until user runs `--run`.
- ✅ Plan 05-03 (functions workspace) and 05-04 (featureFlags) have no dependency on this script's execution — they can proceed.

---
*Phase: 05-pre-condiciones-migracion-infra*
*Completed: 2026-04-20*

## Self-Check: PASSED

- `apps/sistema-modular/scripts/migrate-tickets-contactos.mjs` — FOUND
- `.planning/phases/05-pre-condiciones-migracion-infra/05-02-SUMMARY.md` — FOUND
- Commit `576b416` (Task 1) — FOUND in git history
