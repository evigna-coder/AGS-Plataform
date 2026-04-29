---
phase: 03-presupuestos-plantillas-texto
plan: "05"
subsystem: presupuestos/plantillas-texto
tags: [hooks, firestore, auto-apply, form-state, gap-closure]
dependency_graph:
  requires: [03-01, 03-04]
  provides: [auto-apply-defaults-on-modal-open, full-6-section-form-state]
  affects: [useCreatePresupuestoForm, CreatePresupuestoModal]
tech_stack:
  added: []
  patterns: [cancelled-effect-pattern, once-per-open-flag, alphabetical-first-conflict-resolution]
key_files:
  created: []
  modified:
    - apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts
decisions:
  - "autoAppliedOnce flag gates the effect to run ONCE per modal open — does not re-trigger on tipo changes (per CONTEXT.md: respect user edits)"
  - "Alphabetical-first conflict resolution: when 2+ defaults exist for the same section+tipo, sort bucket by nombre ASC and take index 0; console.warn names the pick and references CONTEXT.md ## Deferred Ideas"
  - "Silent error path in v1: fetch failure logs console.error + sets autoAppliedOnce=true to prevent retries; sections remain empty; manual recovery via per-section dropdown from 03-04 is always available"
  - "|| undefined pattern for all 6 section fields in data object — mirrors existing notasTecnicas/condicionesComerciales pattern; presupuestosService.create runs deepCleanForFirestore so undefined is stripped before write"
metrics:
  duration: "~130s"
  completed: "2026-04-28"
  tasks: 2
  files: 1
requirements:
  - SCOPE-AUTO-APPLY
---

# Phase 03 Plan 05: Auto-Apply Default Plantillas on Modal Open Summary

**One-liner:** Extended useCreatePresupuestoForm with all 6 condiciones section fields and a once-per-open effect that fetches getDefaultsForTipo, groups by section, sorts alphabetically, and pre-fills empty form fields — closing VERIFICATION gap #3.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend PresupuestoFormState + INITIAL_PRESUPUESTO_FORM + handleSave | b754843 | useCreatePresupuestoForm.ts |
| 2 | Add auto-apply effect + PRESUPUESTO_FIELD_MAP + autoAppliedOnce flag | a4a5d60 | useCreatePresupuestoForm.ts |

## Verification Results

| Check | Result |
|-------|--------|
| `getDefaultsForTipo` matches | 2 |
| `autoAppliedOnce` matches | 4 (declaration + !open reset + handleClose reset + effect dep) |
| `localeCompare` matches | 1 |
| All 6 section fields in interface | confirmed |
| All 6 section fields in INITIAL_PRESUPUESTO_FORM | confirmed |
| All 6 section fields in PRESUPUESTO_FIELD_MAP | confirmed |
| All 6 section fields in data: object (handleSave) | confirmed |
| TS errors in useCreatePresupuestoForm.ts | 0 (pre-existing errors in other files unchanged) |

## What Changed

### Task 1 — Form-state extension

**`PresupuestoFormState` interface** — added 4 fields between `notasTecnicas` and `condicionesComerciales`:
- `notasAdministrativas: string`
- `garantia: string`
- `variacionTipoCambio: string`
- `aceptacionPresupuesto: string`

**`INITIAL_PRESUPUESTO_FORM`** — all 4 seeded to `''`.

**`handleSave` data object** — all 6 section fields passed using `|| undefined` pattern:
```typescript
notasTecnicas: form.notasTecnicas || undefined,
notasAdministrativas: form.notasAdministrativas || undefined,
garantia: form.garantia || undefined,
variacionTipoCambio: form.variacionTipoCambio || undefined,
condicionesComerciales: form.condicionesComerciales || undefined,
aceptacionPresupuesto: form.aceptacionPresupuesto || undefined,
```

The `|| undefined` pattern is safe here because `presupuestosService.create` wraps the payload with `deepCleanForFirestore` before writing, stripping all `undefined` fields. Confirmed by reading `presupuestosService.ts:228`.

### Task 2 — Auto-apply effect

**New imports:**
- `plantillasTextoPresupuestoService` from `../services/firebaseService`
- `PlantillaTextoPresupuesto` type from `@ags/shared`

**`PRESUPUESTO_FIELD_MAP`** — module-scope constant (typed `as const`) mapping the 6 section keys. Acts as a typed allowlist for dynamic key access in the effect.

**`autoAppliedOnce` flag:**
- Declared with `useState(false)` inside the hook
- Reset to `false` in the `!open` branch of the first useEffect (modal-close path)
- Reset to `false` in `handleClose` (explicit close path)
- Listed as dependency in the auto-apply effect

**Auto-apply useEffect** (`[open, form.tipo, autoAppliedOnce]` deps):
1. Guards: `!open || !form.tipo || autoAppliedOnce` → returns early
2. Creates `cancelled` flag (cancelled-effect pattern)
3. Calls `plantillasTextoPresupuestoService.getDefaultsForTipo(form.tipo)`
4. Groups results by `p.tipo` (section key)
5. Sorts each bucket by `nombre` ascending (`localeCompare`) — explicit sort even though `getAll()` already returns sorted, to guard against future service changes
6. In `setForm(prev => ...)`:
   - For each section with ≥1 plantilla: if `lista.length > 1`, logs `console.warn` with picked name and deferred-selector reference
   - Skips sections where `prev[key]` is a non-empty string (respects user edits)
   - Sets `next[key] = lista[0].contenido`
7. `setAutoAppliedOnce(true)` on success
8. On catch: `console.error` + `setAutoAppliedOnce(true)` (no retry)

**`handleClose`** — added `setAutoAppliedOnce(false)` to the reset chain.

## Console.warn Message (Multi-Defaults Case)

```
Multiple default plantillas for section "condicionesComerciales" (tipo "servicio") — using "AAA-Test" (alphabetically first by nombre). Conflict-selector UI deferred per CONTEXT.md ## Deferred Ideas.
```

The section key and `lista[0].nombre` are interpolated at runtime.

## Error-Path UX Decision

**v1 choice: silent (console.error only).** No inline warning under the tipo selector was added.

Rationale: The plan's `<done>` criteria state this is the accepted v1 behavior matching the deferred-selector spirit. The plan's discretion clause says the executor MAY add an inline warning if it costs ≤10 lines — but this was not added because:
1. The manual recovery path (per-section dropdown from 03-04) uses `getAll()` independently; a transient `getDefaultsForTipo` failure doesn't block it
2. Empty sections on fetch failure are immediately visible to the user in the editor, providing implicit feedback
3. Adding inline UI would require prop threading or a new state slice — more than 10 lines and out of Task 2's scope

If UAT shows user confusion, revisit in v1.1 with a small inline warning under the tipo selector.

## Hook Size Note

`useCreatePresupuestoForm.ts` grew from ~315 lines to ~395 lines. The 250-line soft budget from CLAUDE.md applies to `.tsx` component files, not `.ts` hooks. The existing 315-line baseline already confirmed this pattern is acceptable. The 80-line addition (Task 2 effect + field map + state + resets) is the minimum required to close gap #3.

## Deferred Items

None. The conflict-selector UI was already deferred to CONTEXT.md ## Deferred Ideas before this plan. No new deferred items discovered during execution.

## Deviations from Plan

None — plan executed exactly as written. The optional inline-warning copy under the tipo selector was evaluated and intentionally skipped (see Error-Path UX Decision above).

## Self-Check: PASSED

Files exist:
- apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts — FOUND (395 lines)

Commits exist:
- b754843 — FOUND in git log
- a4a5d60 — FOUND in git log
