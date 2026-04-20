---
plan: 07-02
phase: 07
status: complete
completed: 2026-04-20
requirements: [FMT-02, PTYP-01]
approved_by: user (UAT reviewed inline)
---

# 07-02 Summary — Token-first mail order + guardas R3/R4

## Objective delivered

Envío por mail OAuth invertido: `requestToken()` → `sendGmail()` → `markEnviado()` atómico. Si cualquier stage falla antes del update, el presupuesto NO transiciona a `enviado`. Guardas adicionales contra popup blocker (R3) y dirty-guard del form (R4).

## Commits

| Commit | Change |
|--------|--------|
| `cd562cc` | `presupuestosService.markEnviado(id, hint?)` — atomic `updateDoc` con `estado: 'enviado' + fechaEnvio`; hint `{origenTipo, origenId, numero}` evita `getById` innecesario (W-6); `numero` propagado a `leadsService.syncFromPresupuesto` (N1); lead-sync con `TODO(FLOW-06)` explícito (W-5) |
| `b829aa8` | Extract `useEnviarPresupuesto` hook (169 LOC). Stage machine `authorizing → generating_pdf → sending → updating_firestore`. Stage 1 con `Promise.race` 10s timeout → mensaje popup-blocker específico (R3/FINDING-H). `EnviarPresupuestoModal` refactorizado a shell UI (196→156 LOC) |
| `05fdff2` | `EditPresupuestoModal.onSent` llama `load()` explícito post-markEnviado → bypass dirty-guard en `usePresupuestoEdit:197` (R4/FINDING-I) |

## Findings absorbed (del audit + research)

- **FINDING-A** (critical): estado change vivía afuera del token-flow → ahora atómico dentro de `markEnviado` llamado SOLO post-sendGmail exitoso
- **FINDING-B**: Errores no diferenciados → status stages específicas por etapa
- **FINDING-C**: Order `token → pdf → mail → markEnviado` implementado
- **FINDING-D**: `EnviarPresupuestoModal` ahora recibe `presupuestoId` + `presupuestoEstado`
- **FINDING-E (W-4)**: `subscribeById` confirmado activo en `usePresupuestoEdit:183` — pero dirty-guard en :197 bloqueaba → Task 3 llama `load()` explícito
- **FINDING-F (W-3)**: Hook `useEnviarPresupuesto` extraído (MANDATORY, no condicional)
- **FINDING-G (W-6 + N1)**: hint signature con `numero`; posta del lead muestra número
- **FINDING-H (R3)**: `Promise.race` 10s timeout → defeat popup-blocker hang
- **FINDING-I (R4)**: `load()` post-markEnviado → bypass dirty-guard del form

## Files changed

- `apps/sistema-modular/src/services/presupuestosService.ts` (+57 líneas; nuevo método `markEnviado`)
- NEW: `apps/sistema-modular/src/hooks/useEnviarPresupuesto.ts` (169 LOC)
- `apps/sistema-modular/src/components/presupuestos/EnviarPresupuestoModal.tsx` (196→156 LOC — hook consumption)
- `apps/sistema-modular/src/components/presupuestos/EditPresupuestoModal.tsx` (384→388 LOC; pre-existing repeat offender, acknowledged en notes)

## Verification

- `pnpm type-check` ✓ (error pre-existente en `presupuestosService:368` fuera de scope)
- `pnpm --filter sistema-modular build:web` ✓ 1m36s
- UAT: user approved inline (9 test scenarios incluyendo Tests 8/9 para R4/R3)

## Deviations

- **[Rule 3]** El plan decía `actions.load()` pero `usePresupuestoActions.ts` no expone `load` — la función vive en el retorno directo de `usePresupuestoEdit`. Integration fix: agregar `load` al destructure en `EditPresupuestoModal` y llamarlo directo. Intent preservado (dirty-guard bypass). Commit `05fdff2`.

## Known follow-ups (explicit, out of scope)

- `EditPresupuestoModal.tsx` sigue en 388 LOC, sobre el budget de 250 (repeat offender pre-existente) — flagged para refactor post-v2.0
- `TODO(FLOW-06)` en `markEnviado` lead-sync catch → Phase 8 reemplaza por `pendingActions[]`
