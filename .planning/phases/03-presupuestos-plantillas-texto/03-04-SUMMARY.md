---
phase: 03-presupuestos-plantillas-texto
plan: "04"
subsystem: presupuestos/plantillas-texto
tags: [ui, rich-text, firestore, refactor, editor]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [editor-with-firestore-plantillas, gestionar-plantillas-link]
  affects: [PresupuestoCondicionesEditor, EditPresupuestoModal, useCreatePresupuestoForm]
tech_stack:
  added: []
  patterns: [useMemo-filtered-map, cancelled-effect-pattern, local-modal-mount-refresh]
key_files:
  created: []
  modified:
    - apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx
decisions:
  - "Gestionar plantillas link placed in card header (single shared link) — default locked decision per CONTEXT.md; modal manages all sections at once so one entry point avoids visual noise"
  - "cancelled flag pattern in useEffect for async getAll() — prevents stale setState on unmount"
  - "select reset-after-select via e.target.value='' in onChange handler — dropdown is a command, not a stored value"
  - "loadPlantillas() called on handleGestionClose so newly-created/edited plantillas appear in dropdowns without page reload"
metrics:
  duration: "~90s"
  completed: "2026-04-28"
  tasks: 1
  files: 1
requirements:
  - SCOPE-EDITOR-RICHTEXT
---

# Phase 03 Plan 04: Editor Refactor — RichTextEditor + Firestore Plantilla Dropdowns Summary

**One-liner:** Refactored PresupuestoCondicionesEditor to use RichTextEditor per section, per-section Firestore plantilla dropdowns filtered by tipo, and a "Gestionar plantillas →" card-header link mounting PlantillasTextoModal locally.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor PresupuestoCondicionesEditor | 96df079 | PresupuestoCondicionesEditor.tsx (188 lines) |

## Verification Results

| Check | Result |
|-------|--------|
| `PRESUPUESTO_TEMPLATES` import removed | 0 matches |
| `<textarea>` removed | 0 matches |
| `RichTextEditor` present | 2 matches (import + JSX) |
| `PlantillasTextoModal` present | 2 matches (import + JSX) |
| "Gestionar plantillas" link | 1 match |
| Line count ≤ 250 | 188 lines |
| TS errors in this file | 0 (pre-existing unrelated errors untouched) |

## What Changed

### Removed
- `PRESUPUESTO_TEMPLATES` import from `@ags/shared`
- `useCallback` import (no longer needed)
- `Button` import (no longer needed)
- `getTemplate()` callback (hardcoded template lookup)
- `handleLoadTemplate()` (hardcoded load per section)
- `handleLoadAll()` (mass-load all sections from hardcoded templates)
- "Cargar plantillas" `<Button>` in card header
- Per-section "Plantilla" `<button>` in each section header row
- `<textarea>` per section

### Added
- `useEffect`, `useMemo` imports
- `PlantillaTextoPresupuesto` type import from `@ags/shared`
- `RichTextEditor` import from `../ui/RichTextEditor`
- `plantillasTextoPresupuestoService` import from `../../services/firebaseService`
- `PlantillasTextoModal` import from `./PlantillasTextoModal`
- `plantillas: PlantillaTextoPresupuesto[]` state + `useEffect` on mount (cancelled flag pattern)
- `showGestion: boolean` state for modal toggle
- `plantillasBySeccion` useMemo: filters by `activo + tipoPresupuestoAplica.includes(tipo)`, groups by `p.tipo`
- `handleLoadPlantilla(key, plantillaId)`: confirms if content non-empty, calls `onValueChange`
- `handleGestionClose()`: closes modal + reloads plantillas list
- "Gestionar plantillas →" `<button>` in card header (teal-700 color, no underline default, hover underline)
- Per-section `<select>` dropdown (rendered only when `opts.length > 0`), with `★` prefix for `esDefault` plantillas
- `<RichTextEditor>` replacing `<textarea>` in expanded section body
- `<PlantillasTextoModal>` mounted inside component return (local instance)

## "Gestionar plantillas" Link Placement

The link is placed **in the card header** (single shared entry point). CONTEXT.md locks this as the second access point. The modal manages all plantillas across all sections, so one header link avoids per-section repetition and visual noise. No deviation from the default decision.

## Plain-Text Newline Regression Risk

Pre-existing presupuestos may have plain-text content with `\n` newlines in their `notasTecnicas`, `condicionesComerciales`, etc. fields. When these strings are loaded into `RichTextEditor` (which uses `contentEditable` with HTML), raw newlines render as a single collapsed line — they do not convert to `<br>` or `<p>` tags automatically.

**Impact for users:** Opening an old presupuesto's condiciones section will show the text collapsed onto one line. The content is not lost — it's still in the field. The user can manually re-edit the section to restore visual formatting.

**Going forward:** New presupuestos created via 03-05 auto-defaults will receive proper HTML from Firestore plantillas. The seed script (03-07) converts `\n\n` to `<br><br>` in the initial plantillas. So this regression only affects pre-existing data.

**Not a blocker.** No migration of stored data is in scope for this plan.

## Props Contract Preserved

`PresupuestoCondicionesEditorProps` interface is unchanged:

```typescript
interface PresupuestoCondicionesEditorProps {
  tipo: TipoPresupuesto;
  seccionesVisibles: PresupuestoSeccionesVisibles;
  values: Record<SeccionKey, string>;
  onSeccionToggle: (key: SeccionKey, visible: boolean) => void;
  onValueChange: (key: SeccionKey, value: string) => void;
}
```

Both consumers (`EditPresupuestoModal` and the `useCreatePresupuestoForm`-driven create modal) continue to work without changes.

## Deviations from Plan

None — plan executed exactly as written. The card-header placement of the "Gestionar plantillas →" link matches the default locked decision in the plan's action notes.

## Self-Check: PASSED

Files exist:
- apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx — FOUND (188 lines)

Commits exist: 96df079 — FOUND in git log.
