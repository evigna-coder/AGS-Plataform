---
phase: 03-presupuestos-plantillas-texto
verified: 2026-04-28T18:00:00Z
status: human_needed
score: 8/8 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/8
  gaps_closed:
    - "PlantillasTextoModal UI (03-03): PlantillasTextoModal.tsx + PlantillaTextoForm.tsx + PlantillaRow.tsx created; toolbar button wired in PresupuestosList.tsx; useUrlFilters used for all filters"
    - "Editor refactor (03-04): PresupuestoCondicionesEditor.tsx no longer imports PRESUPUESTO_TEMPLATES; uses RichTextEditor; per-section dropdown reads from plantillasTextoPresupuestoService.getAll() filtered by tipo; Gestionar plantillas button opens PlantillasTextoModal inline"
    - "Auto-apply defaults (03-05): useCreatePresupuestoForm.ts imports plantillasTextoPresupuestoService; PresupuestoFormState extended with all 6 section fields; effect calls getDefaultsForTipo(form.tipo); alphabetical sort by nombre; console.warn for multi-default; autoAppliedOnce flag prevents repeat; usePresupuestoEdit.ts NOT touched"
    - "HTML PDF rendering (03-06): react-pdf-html installed; PDFRichText.tsx created with stylesheet + FontRenderer + dual-layer error safety; PDFRichTextErrorBoundary.tsx class-based with componentDidCatch + getDerivedStateFromError; PresupuestoPDFEstandar.tsx line 472 uses PDFRichText html={section.content}"
    - "Seed script (03-07): seed-plantillas-texto-browser.mjs created; 8 plantillas (6 base + 2 contrato); idempotent via (nombre, tipo) key; null for absent audit fields"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Create a plantilla with bold, italic, a bullet list, font-size 20pt, and centered text. Assign to a presupuesto. Generate PDF."
    expected: "Bold, italic, bullets, centered alignment, and larger font-size all render correctly in the PDF — no raw HTML tags visible."
    why_human: "@react-pdf/renderer produces binary PDF output; no snapshot test framework exists in this project."
  - test: "Create two plantillas for condicionesComerciales with esDefault=true for tipo=servicio. Create a new presupuesto tipo=servicio."
    expected: "One plantilla is auto-applied (alphabetically first by nombre). Console.warn is emitted. User can swap via the per-section dropdown."
    why_human: "Multi-default conflict resolution in the browser cannot be verified programmatically; requires live session to confirm the correct plantilla is selected and the warning appears."
  - test: "Open an existing presupuesto tipo=servicio with text in condicionesComerciales. Change tipo to contrato."
    expected: "Existing text is preserved — no auto-replacement occurs (autoAppliedOnce already true for this edit session)."
    why_human: "Guards against data-loss regression in the edit flow; requires a real browser session."
---

# Phase 03: Presupuestos — Plantillas de textos rich text — Verification Report

**Phase Goal:** Habilitar gestión de plantillas rich text (condiciones comerciales, notas técnicas, garantía, etc.) por tipo de presupuesto con auto-aplicación de defaults, dropdown de selección por sección en el editor, y renderizado HTML formateado en el PDF.

**Verified:** 2026-04-28
**Status:** human_needed (all automated checks passed — 3 human-only items remain)
**Re-verification:** Yes — after gap closure (03-03 through 03-07)

---

## Re-verification Summary

The first pass (same date, earlier run) found 5 gaps corresponding to unimplemented capabilities. All 5 gaps have been closed by plans 03-03 through 03-07. All 8 observable truths are now VERIFIED at all three levels (exists, substantive, wired). The only remaining items require a live browser session.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `PlantillaTextoPresupuesto` interface exported from `@ags/shared` and compiles | VERIFIED | `packages/shared/src/types/index.ts` line 1172 — full interface with all required fields. |
| 2 | `plantillasTextoPresupuestoService` exported from `presupuestosService.ts` with 6 CRUD methods | VERIFIED | Lines 2159-2234, all 6 methods, collection `'plantillas_texto_presupuesto'`. Re-exported via `firebaseService.ts` barrel. |
| 3 | RichTextEditor toolbar has 3 alignment buttons with active-state tracking | VERIFIED | `BtnId` union, `TOOLBAR_BUTTONS`, and `queryCommandState` calls for justifyLeft/Center/Right at lines 19-76. File is 170 lines. |
| 4 | Management UI exists: `PlantillasTextoModal` + `PlantillaTextoForm` + `PlantillaRow`; toolbar button in `PresupuestosList` | VERIFIED | All 3 files created. `PresupuestosList.tsx` line 279 has the button; line 565 renders the modal. Filters use `useUrlFilters` (line 34-38 of PlantillasTextoModal.tsx). |
| 5 | `PresupuestoCondicionesEditor` has per-section dropdown loading Firestore plantillas; no `PRESUPUESTO_TEMPLATES` import; `RichTextEditor` in use; "Gestionar plantillas" second access point | VERIFIED | No `PRESUPUESTO_TEMPLATES` import found. `RichTextEditor` used at line 167. Per-section `<select>` at line 147 calls `handleLoadPlantilla` which loads from `plantillasTextoPresupuestoService.getAll()`. "Gestionar plantillas →" button at line 88 opens `PlantillasTextoModal` at line 185. File is 188 lines. |
| 6 | Auto-apply fires once on modal open (creation only); `autoAppliedOnce` flag; alphabetical sort; `console.warn` for conflicts; edit flow NOT touched | VERIFIED | `useCreatePresupuestoForm.ts` lines 153-202: effect gated on `!autoAppliedOnce`; `localeCompare` sort at line 169; `console.warn` at line 178-180. `usePresupuestoEdit.ts` has zero references to `plantillasTextoPresupuestoService`. |
| 7 | `PDFRichText.tsx` renders HTML as formatted PDF content; `PDFRichTextErrorBoundary.tsx` class-based with dual-layer fallback; `PresupuestoPDFEstandar.tsx` uses `<PDFRichText html={section.content} />` | VERIFIED | `PDFRichText.tsx` 114 lines with `Html` from `react-pdf-html`, `FONT_SIZE_MAP`, `stylesheet`, `FontRenderer`, and parse-time try/catch. `PDFRichTextErrorBoundary.tsx` 75 lines with `componentDidCatch` + `getDerivedStateFromError`. `PresupuestoPDFEstandar.tsx` line 6 imports `PDFRichText`; line 472 uses it with `fallbackStyle`. |
| 8 | `react-pdf-html` installed; seed script exists with 8 plantillas, idempotent, `null` audit fields | VERIFIED | `apps/sistema-modular/package.json` line 37: `"react-pdf-html": "^2.1.5"`. `seed-plantillas-texto-browser.mjs` exists; 8 entries; `existingKeys` idempotency via `(nombre + '||' + tipo)`; `createdBy: null`, `createdByName: null`, etc. |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/index.ts` | `PlantillaTextoPresupuesto` interface | VERIFIED | Line 1172, all 11 fields, `string | null` audit types |
| `apps/sistema-modular/src/services/presupuestosService.ts` | `plantillasTextoPresupuestoService` with 6 methods | VERIFIED | Line 2159, re-exported via firebaseService.ts barrel |
| `apps/sistema-modular/src/components/ui/RichTextEditor.tsx` | 3 alignment buttons + active state | VERIFIED | BtnId union, TOOLBAR_BUTTONS, queryCommandState all present. 170 lines. |
| `apps/sistema-modular/src/components/presupuestos/PlantillasTextoModal.tsx` | Management modal, useUrlFilters, CRUD dispatch | VERIFIED | 183 lines. useUrlFilters at lines 34-38. Calls create/update/delete via service. |
| `apps/sistema-modular/src/components/presupuestos/PlantillaTextoForm.tsx` | Create/edit form with RichTextEditor for contenido | VERIFIED | 159 lines. RichTextEditor at line 141-146. |
| `apps/sistema-modular/src/components/presupuestos/PlantillaRow.tsx` | Table row with preview + edit/delete actions | VERIFIED | 56 lines. `stripHtmlPreview` helper exported. |
| `apps/sistema-modular/src/pages/presupuestos/PresupuestosList.tsx` | Toolbar button wired to PlantillasTextoModal | VERIFIED | Lines 22 (import), 279 (button), 565 (modal). `showPlantillas` state at line 50. |
| `apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx` | Firestore dropdown, RichTextEditor, Gestionar button | VERIFIED | 188 lines. No textarea, no PRESUPUESTO_TEMPLATES. Full Firestore fetch + per-section dropdown + inline modal. |
| `apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts` | Auto-apply effect, 6 section fields, autoAppliedOnce | VERIFIED | Lines 22-28 (6 section fields in PresupuestoFormState). Lines 153-202 (auto-apply effect). Line 100 (autoAppliedOnce state). |
| `apps/sistema-modular/src/components/presupuestos/pdf/PDFRichText.tsx` | Html renderer, FONT_SIZE_MAP, stylesheet, FontRenderer, dual-layer safety | VERIFIED | 114 lines. All components present. Error boundary wrapped via PDFRichTextErrorBoundary. |
| `apps/sistema-modular/src/components/presupuestos/pdf/PDFRichTextErrorBoundary.tsx` | Class-based Error Boundary with componentDidCatch, getDerivedStateFromError, resetKey | VERIFIED | 75 lines. All three required class methods implemented. |
| `apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx` | PDFRichText used instead of plain Text for condiciones | VERIFIED | Line 6 imports PDFRichText; line 472 uses `<PDFRichText html={section.content} fallbackStyle={S.condicionText} />` |
| `apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs` | 8 plantillas, idempotent, null audit fields | VERIFIED | 8 entries defined. Idempotency via `(nombre + '||' + tipo)` set. Audit fields explicitly `null`. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PlantillaTextoPresupuesto` in @ags/shared | `presupuestosService.ts` | `import ... from '@ags/shared'` | WIRED | Confirmed in presupuestosService.ts line 2 |
| `plantillasTextoPresupuestoService` | Firestore `plantillas_texto_presupuesto` | `collection(db, ...)` string | WIRED | String appears 7 times in service methods |
| `PresupuestosList.tsx` toolbar button | `PlantillasTextoModal` | `showPlantillas` state + `open={showPlantillas}` | WIRED | Lines 50, 279, 565 |
| `PlantillasTextoModal` | `plantillasTextoPresupuestoService` | import from firebaseService barrel | WIRED | Line 2 of PlantillasTextoModal.tsx; firebaseService.ts exports `presupuestosService.ts` via `export *` |
| `PlantillaTextoForm.contenido` | `RichTextEditor` | `<RichTextEditor value={form.contenido} onChange={...} />` | WIRED | Line 141-146 of PlantillaTextoForm.tsx |
| `PresupuestoCondicionesEditor` per-section | `plantillasTextoPresupuestoService.getAll()` | useEffect + useMemo filter by tipo | WIRED | Lines 50-66 of PresupuestoCondicionesEditor.tsx |
| `PresupuestoCondicionesEditor` "Gestionar plantillas" button | `PlantillasTextoModal` | `showGestion` state + `open={showGestion}` | WIRED | Lines 38, 88, 185 of PresupuestoCondicionesEditor.tsx |
| `useCreatePresupuestoForm` tipo selection | `plantillasTextoPresupuestoService.getDefaultsForTipo()` | useEffect on `form.tipo` gated by `autoAppliedOnce` | WIRED | Lines 153-202 of useCreatePresupuestoForm.ts |
| `PDFRichText` | `react-pdf-html` `<Html>` | `import Html from 'react-pdf-html'` | WIRED | Line 3 of PDFRichText.tsx; package in package.json line 37 |
| `PresupuestoPDFEstandar.tsx` condiciones renderer | `PDFRichText` | `<PDFRichText html={section.content} ... />` | WIRED | Line 6 (import) + line 472 (usage) |
| `PDFRichText` | `PDFRichTextErrorBoundary` | `<PDFRichTextErrorBoundary fallback={...} resetKey={html}>` | WIRED | Line 105 of PDFRichText.tsx |
| Alignment buttons (justifyLeft/Center/Right) | `document.execCommand` | `exec(btn.id)` generic handler | WIRED | Lines 19-30 (BtnId + TOOLBAR_BUTTONS), lines 74-76 (queryCommandState) |

---

## Requirements Coverage

The three phase-local scope IDs declared in the 03-01 and 03-02 PLAN frontmatter remain satisfied. No project-level REQUIREMENTS.md rows are tied to Phase 03 (this phase predates the v2.0 requirements catalogue). No orphaned requirements detected.

| Req ID | Source | Description | Status |
|--------|--------|-------------|--------|
| SCOPE-PLANTILLA-TYPE | 03-01-PLAN.md | PlantillaTextoPresupuesto interface in @ags/shared | SATISFIED |
| SCOPE-PLANTILLA-SERVICE | 03-01-PLAN.md | plantillasTextoPresupuestoService CRUD + getDefaultsForTipo | SATISFIED |
| SCOPE-RTE-ALIGN | 03-02-PLAN.md | RichTextEditor alignment buttons with active-state | SATISFIED |

Plans 03-03 through 03-07 do not declare additional requirement IDs in frontmatter; their scope is covered by the observable truths verified above.

---

## Anti-Patterns Found

No blocker anti-patterns detected. No stub implementations, no raw `return null` / `return {}` without purpose, no `PRESUPUESTO_TEMPLATES` leftovers in any modified file. All new components are under the 250-line budget (max: 188 lines for PresupuestoCondicionesEditor.tsx).

---

## Human Verification Required

### 1. PDF Rendering Quality

**Test:** Create a plantilla with bold text, italic text, a bullet list, font-size 20pt, and centered alignment. Assign it to a presupuesto section. Generate the PDF from the UI.
**Expected:** Bold appears bold, italic appears italic, bullets appear as bullet points, the text is centered where alignment was applied, and font-size 20pt text is visually larger than the base body text. No raw HTML tags (`<b>`, `<ul>`, `<li>`, etc.) appear as literal strings in the PDF.
**Why human:** `@react-pdf/renderer` produces binary PDF output. No snapshot or visual regression test framework exists in this project. The `react-pdf-html` parser and the `FontRenderer` for `<font size>` tags can only be validated by reading the rendered document.

### 2. Multi-Default Conflict Resolution

**Test:** Create two plantillas for the `condicionesComerciales` section, both with `esDefault=true`, both with `tipoPresupuestoAplica` including `'servicio'`. Name them so one comes alphabetically first (e.g. "AAA - Test" and "ZZZ - Test"). Open the Create Presupuesto modal with `tipo = servicio`.
**Expected:** The `condicionesComerciales` field is auto-filled with "AAA - Test"'s content (alphabetically first). A `console.warn` is logged in the browser console describing the conflict and confirming the choice. The user can swap to "ZZZ - Test" via the per-section "Cargar plantilla" dropdown in `PresupuestoCondicionesEditor`.
**Why human:** Multi-default logic runs in the browser's async useEffect; console.warn output and the resulting field value must be inspected live.

### 3. No Auto-Apply on Edit (Data-Loss Guard)

**Test:** Open an existing presupuesto (tipo `'servicio'`) that already has custom text in `condicionesComerciales`. Open it in edit mode and observe the condiciones editor.
**Expected:** The existing text is preserved exactly as-is. No auto-apply of default plantillas fires. The `autoAppliedOnce` guard is irrelevant here because `usePresupuestoEdit.ts` does not contain the auto-apply effect at all.
**Why human:** Requires a real browser session with an actual Firestore document. Verifies no data-loss regression occurred during the 03-05 gap closure.

---

## Gaps Summary

No automated gaps remain. All 5 gaps from the initial verification have been closed:

- **Gap 1 (Management UI):** `PlantillasTextoModal.tsx`, `PlantillaTextoForm.tsx`, `PlantillaRow.tsx` created and wired to `PresupuestosList.tsx` toolbar button.
- **Gap 2 (Editor refactor):** `PresupuestoCondicionesEditor.tsx` fully refactored — `PRESUPUESTO_TEMPLATES` removed, `<textarea>` replaced with `<RichTextEditor>`, per-section Firestore dropdown implemented, "Gestionar plantillas" inline access point added.
- **Gap 3 (Auto-apply):** `useCreatePresupuestoForm.ts` now auto-applies defaults on first open, with alphabetical conflict resolution, `autoAppliedOnce` guard, and zero impact on the edit flow.
- **Gap 4 (HTML PDF):** `PDFRichText.tsx` and `PDFRichTextErrorBoundary.tsx` created; `react-pdf-html` installed; `PresupuestoPDFEstandar.tsx` wired to use `<PDFRichText>` instead of raw `<Text>`.
- **Gap 5 (Seed script):** `seed-plantillas-texto-browser.mjs` created with 8 plantillas, idempotent, null audit fields.

The phase goal — rich-text template management, per-section dropdown, auto-apply defaults on creation, and formatted HTML in PDF — is fully implemented at the code level. Three items require human verification in a live browser before the phase can be considered fully accepted.

---

_Initial verification: 2026-04-28 (score 3/8 — gaps_found)_
_Re-verification: 2026-04-28 (score 8/8 — human_needed)_
_Verifier: Claude (gsd-verifier)_
