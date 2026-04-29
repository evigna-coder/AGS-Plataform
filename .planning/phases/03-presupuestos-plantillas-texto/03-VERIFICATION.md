---
phase: 03-presupuestos-plantillas-texto
verified: 2026-04-28T12:00:00Z
status: gaps_found
score: 2/6 must-haves verified
gaps:
  - truth: "PlantillasTextoModal UI exists so users can manage (create/edit/list) rich-text templates from the presupuestos list toolbar"
    status: failed
    reason: "PlantillasTextoModal.tsx and PlantillaTextoForm.tsx do not exist. The service exists but there is no UI to manage plantillas at all."
    artifacts:
      - path: "apps/sistema-modular/src/components/presupuestos/PlantillasTextoModal.tsx"
        issue: "File does not exist"
      - path: "apps/sistema-modular/src/components/presupuestos/PlantillaTextoForm.tsx"
        issue: "File does not exist"
    missing:
      - "Create PlantillasTextoModal.tsx with plantilla list table, filters via useUrlFilters, and inline form toggle"
      - "Create PlantillaTextoForm.tsx with RichTextEditor for contenido field"
      - "Add 'Plantillas de textos' button to PresupuestosList.tsx toolbar"

  - truth: "Each section in PresupuestoCondicionesEditor has a dropdown/button to load a template from Firestore filtered by tipo"
    status: failed
    reason: "PresupuestoCondicionesEditor.tsx still uses PRESUPUESTO_TEMPLATES hardcoded (line 6: import PRESUPUESTO_TEMPLATES) and a plain <textarea>. No call to plantillasTextoPresupuestoService. No dropdown from Firestore."
    artifacts:
      - path: "apps/sistema-modular/src/components/presupuestos/PresupuestoCondicionesEditor.tsx"
        issue: "Still imports PRESUPUESTO_TEMPLATES from @ags/shared; getTemplate() reads from hardcoded object; editor is <textarea> not RichTextEditor; no Firestore dropdown"
    missing:
      - "Replace <textarea> with <RichTextEditor> per section"
      - "Replace getTemplate() and PRESUPUESTO_TEMPLATES import with call to plantillasTextoPresupuestoService.getAll() filtered by tipo"
      - "Add per-section dropdown or button that loads from Firestore plantillas (filtered by tipoPresupuestoAplica includes current tipo)"

  - truth: "Auto-application of default plantillas happens when creating a new presupuesto (tipo selection triggers getDefaultsForTipo)"
    status: failed
    reason: "useCreatePresupuestoForm.ts has no reference to plantillasTextoPresupuestoService or getDefaultsForTipo. Auto-apply logic was not implemented."
    artifacts:
      - path: "apps/sistema-modular/src/hooks/useCreatePresupuestoForm.ts"
        issue: "No plantilla auto-apply effect exists in this hook"
    missing:
      - "Add effect in useCreatePresupuestoForm.ts that calls plantillasTextoPresupuestoService.getDefaultsForTipo(form.tipo) on tipo selection (creation only)"
      - "Apply single defaults per section; surface conflict selector when multiple defaults exist for same section"

  - truth: "PDFRichText component exists and renders HTML from RichTextEditor as formatted content in the PDF (bold, italic, lists, font-size, text-align)"
    status: failed
    reason: "PDFRichText.tsx does not exist. PresupuestoPDFEstandar.tsx PDFCondiciones function still renders plain <Text style={S.condicionText}>{section.content}</Text> — HTML tags would appear as raw strings in the PDF."
    artifacts:
      - path: "apps/sistema-modular/src/components/presupuestos/pdf/PDFRichText.tsx"
        issue: "File does not exist"
      - path: "apps/sistema-modular/src/components/presupuestos/pdf/PresupuestoPDFEstandar.tsx"
        issue: "PDFCondiciones at line 471 uses plain <Text>{section.content}</Text> — no HTML parsing"
    missing:
      - "Create PDFRichText.tsx using react-pdf-html (or custom parser) with stylesheet + font-size renderer for <font size> tags"
      - "Install react-pdf-html in apps/sistema-modular package.json"
      - "Replace <Text style={S.condicionText}>{section.content}</Text> in PDFCondiciones with <PDFRichText html={section.content} />"

  - truth: "Seed script exists to migrate PRESUPUESTO_TEMPLATES to plantillas_texto_presupuesto Firestore collection"
    status: failed
    reason: "No seed-plantillas-texto-browser.mjs or equivalent seed script exists under apps/sistema-modular/scripts/ or any other path."
    artifacts:
      - path: "apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs"
        issue: "File does not exist"
    missing:
      - "Create browser-based seed script that converts PRESUPUESTO_TEMPLATES entries to HTML and writes them to plantillas_texto_presupuesto collection with esDefault=true, idempotency check"
---

# Phase 03: Presupuestos — Plantillas de textos rich text — Verification Report

**Phase Goal:** Habilitar gestión de plantillas rich text (condiciones comerciales, notas técnicas, garantía, etc.) por tipo de presupuesto con auto-aplicación de defaults, dropdown de selección por sección en el editor, y renderizado HTML formateado en el PDF.

**Verified:** 2026-04-28
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

The phase goal has four distinct capabilities. Plans 03-01 and 03-02 were the only plans executed (ROADMAP shows "1/2 plans executed" but two SUMMARY files exist for those two plans). The two executed plans cover only the data-layer foundation and the toolbar extension. The three remaining capabilities — UI management modal, editor dropdown from Firestore, auto-apply on creation, PDF HTML rendering, and the seed script — were never implemented.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `PlantillaTextoPresupuesto` interface is exported from `@ags/shared` and compiles | VERIFIED | `packages/shared/src/types/index.ts` line 1172 has the full interface with all required fields. `presupuestosService.ts` line 2 imports it. |
| 2 | `plantillasTextoPresupuestoService` is exported from `presupuestosService.ts` with 6 methods using batchAudit + cleanFirestoreData | VERIFIED | Lines 2159-2234 contain all 6 methods (`getAll`, `getById`, `getDefaultsForTipo`, `create`, `update`, `delete`). Collection name `'plantillas_texto_presupuesto'` appears 7 times. `cleanFirestoreData` and `batchAudit` used in create/update/delete. |
| 3 | RichTextEditor toolbar has 3 alignment buttons (justifyLeft / justifyCenter / justifyRight) with active-state tracking | VERIFIED | `RichTextEditor.tsx` lines 19-30: `BtnId` union includes all 3; `TOOLBAR_BUTTONS` array has all 3 entries; `updateActiveFormats()` at lines 74-76 calls `queryCommandState('justifyLeft/Center/Right')`. File is 170 lines (under 250 budget). |
| 4 | PlantillasTextoModal and PlantillaTextoForm components exist for managing plantillas from the UI | FAILED | Neither `PlantillasTextoModal.tsx` nor `PlantillaTextoForm.tsx` exists anywhere in the codebase. `PresupuestosList.tsx` has no "Plantillas de textos" toolbar button. |
| 5 | PresupuestoCondicionesEditor provides per-section dropdown/button loading plantillas from Firestore filtered by tipo | FAILED | `PresupuestoCondicionesEditor.tsx` still imports `PRESUPUESTO_TEMPLATES` from `@ags/shared` (line 6) and uses a plain `<textarea>` (line 142). `getTemplate()` reads from hardcoded object (lines 39-51). No call to `plantillasTextoPresupuestoService`. |
| 6 | Auto-apply of default plantillas fires on tipo selection when creating a new presupuesto | FAILED | `useCreatePresupuestoForm.ts` has no reference to `plantillasTextoPresupuestoService` or `getDefaultsForTipo`. No auto-apply effect exists. |
| 7 | PDFRichText component renders HTML from RichTextEditor as formatted content (bold/italic/ul/font-size/align) in the PDF | FAILED | `PDFRichText.tsx` does not exist. `PresupuestoPDFEstandar.tsx` line 471: `<Text style={S.condicionText}>{section.content}</Text>` — plain text render, HTML tags would appear as raw strings. `react-pdf-html` is not installed. |
| 8 | Seed script exists to bootstrap plantillas_texto_presupuesto from PRESUPUESTO_TEMPLATES | FAILED | No seed script exists at `apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs` or any equivalent path. |

**Score:** 3/8 truths verified (Truths 1, 2, 3 pass; Truths 4–8 fail)

---

## Required Artifacts

### Plan 03-01 (Data Layer)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/index.ts` | `PlantillaTextoPresupuesto` interface at ~line 1172 | VERIFIED | Interface present at line 1172 with all 11 fields. Audit fields typed as `string \| null` (no `undefined`). |
| `apps/sistema-modular/src/services/presupuestosService.ts` | `plantillasTextoPresupuestoService` with 6 CRUD methods | VERIFIED | Present at line 2159, all 6 methods implemented, collection name `'plantillas_texto_presupuesto'` consistent throughout. `PlantillaTextoPresupuesto` imported at line 2. |

### Plan 03-02 (RichTextEditor)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/sistema-modular/src/components/ui/RichTextEditor.tsx` | 3 alignment buttons + BtnId extension + active-state tracking | VERIFIED | All three justify* entries in BtnId, TOOLBAR_BUTTONS, and updateActiveFormats. Slice-based divider at line 115. 170 lines total. |

### Missing Artifacts (Never Implemented)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/sistema-modular/src/components/presupuestos/PlantillasTextoModal.tsx` | Management modal for plantillas list + form | MISSING | File does not exist |
| `apps/sistema-modular/src/components/presupuestos/PlantillaTextoForm.tsx` | Form with RichTextEditor for create/edit plantilla | MISSING | File does not exist |
| `apps/sistema-modular/src/components/presupuestos/pdf/PDFRichText.tsx` | HTML→PDF wrapper using react-pdf-html | MISSING | File does not exist; react-pdf-html not installed |
| `apps/sistema-modular/scripts/seed-plantillas-texto-browser.mjs` | One-shot seed script from PRESUPUESTO_TEMPLATES | MISSING | File does not exist |

---

## Key Link Verification

### Plan 03-01

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PlantillaTextoPresupuesto` in `@ags/shared` | `presupuestosService.ts` | `import ... PlantillaTextoPresupuesto ... from '@ags/shared'` | WIRED | Line 2 of presupuestosService.ts confirms the import |
| `plantillasTextoPresupuestoService` | Firestore `plantillas_texto_presupuesto` | `collection(db, 'plantillas_texto_presupuesto')` | WIRED | String literal appears 7 times in service methods |

### Plan 03-02

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Toolbar button click | `document.execCommand('justifyLeft/Center/Right')` | `exec(btn.id)` generic handler | WIRED | `exec` calls `document.execCommand(command, false, val)` at line 61; btn.id values are the execCommand names |
| `updateActiveFormats` | `queryCommandState('justifyLeft/Center/Right')` | 3 `if` checks | WIRED | Lines 74-76 |

### Missing Links (Goal Capability 1, 2, 3, 4)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PresupuestosList.tsx` toolbar | `PlantillasTextoModal` | Button click → modal open | NOT_WIRED | PlantillasTextoModal does not exist |
| `PresupuestoCondicionesEditor` per-section | `plantillasTextoPresupuestoService.getAll()` | Dropdown/button → Firestore | NOT_WIRED | Editor still reads PRESUPUESTO_TEMPLATES hardcoded |
| `useCreatePresupuestoForm` tipo change | `plantillasTextoPresupuestoService.getDefaultsForTipo()` | useEffect on form.tipo | NOT_WIRED | No effect exists in the hook |
| `PDFCondiciones` in PresupuestoPDFEstandar | `PDFRichText` component | `<PDFRichText html={section.content} />` | NOT_WIRED | Still uses `<Text>{section.content}</Text>` |

---

## Requirements Coverage

The PLANs declare three requirement IDs: `SCOPE-PLANTILLA-TYPE`, `SCOPE-PLANTILLA-SERVICE`, `SCOPE-RTE-ALIGN`. These are phase-local scope identifiers — they do **not** appear in `.planning/REQUIREMENTS.md` (the project-level requirements document for the v2.0 milestone). Phase 3 is a v1.0 phase with no traceability row in REQUIREMENTS.md.

| Req ID | Source | Description | Status | Evidence |
|--------|--------|-------------|--------|---------|
| SCOPE-PLANTILLA-TYPE | 03-01-PLAN.md | PlantillaTextoPresupuesto interface in @ags/shared | SATISFIED | Interface at line 1172 |
| SCOPE-PLANTILLA-SERVICE | 03-01-PLAN.md | plantillasTextoPresupuestoService CRUD + getDefaultsForTipo | SATISFIED | Service at line 2159 |
| SCOPE-RTE-ALIGN | 03-02-PLAN.md | RichTextEditor alignment buttons | SATISFIED | All 3 buttons + queryCommandState tracking |

No orphaned requirements detected (REQUIREMENTS.md has no Phase 3 entries — this phase predates the v2.0 requirements catalogue).

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PresupuestoCondicionesEditor.tsx` | 6, 39-51, 142 | Still imports and uses `PRESUPUESTO_TEMPLATES` hardcoded; still uses `<textarea>` | Blocker | The entire purpose of Phase 3 is to replace this with Firestore-backed templates and RichTextEditor — the refactor was never done |
| `PresupuestoPDFEstandar.tsx` | 471 | `<Text style={S.condicionText}>{section.content}</Text>` renders HTML tags as raw strings | Blocker | If rich HTML from RichTextEditor is ever saved to a presupuesto, the PDF will show literal `<b>`, `<ul>`, etc. tags |

---

## Human Verification Required

### 1. PDF Rendering Quality (once PDFRichText is implemented)

**Test:** Create a plantilla with bold, italic, a bullet list, font size 20pt, and centered alignment. Assign it to a presupuesto. Generate the PDF.
**Expected:** bold appears as bold, italic as italic, bullets as bullet points, text centered where alignment was set, font size visually larger.
**Why human:** `@react-pdf/renderer` is visual output; no snapshot test framework exists in this project.

### 2. Conflict Selector UX

**Test:** Create two plantillas for `condicionesComerciales` both with `esDefault=true` and `tipoPresupuestoAplica` including `'servicio'`. Create a new presupuesto tipo `'servicio'`.
**Expected:** A selector appears inline in the `condicionesComerciales` section showing the two candidates with preview, allowing the user to choose one or leave empty.
**Why human:** Conflict resolution UX depends on perceived flow and clarity — not verifiable programmatically.

### 3. No Auto-Apply on Edit

**Test:** Open an existing presupuesto tipo `'servicio'` with edited text in `condicionesComerciales`. Change the tipo to `'contrato'`.
**Expected:** The existing text is preserved — no automatic replacement occurs.
**Why human:** Guards against data-loss regressions; requires a real browser session to confirm.

---

## Gaps Summary

This phase implemented only its first wave (data-layer foundation) and nothing from the remaining capabilities. The ROADMAP itself shows "1/2 plans executed" — but in fact two plan SUMMARYs exist (03-01 and 03-02) covering the type, service, and alignment buttons. The four remaining capabilities from the phase goal were never planned into concrete PLAN files:

**What was done (2/6 verified truths):**
- `PlantillaTextoPresupuesto` interface added to `@ags/shared`
- `plantillasTextoPresupuestoService` with 6 CRUD methods added to `presupuestosService.ts`
- Three alignment buttons added to `RichTextEditor` toolbar

**What is missing (4 blocked capabilities):**

1. **UI management modal** — No `PlantillasTextoModal.tsx` or `PlantillaTextoForm.tsx`. No "Plantillas de textos" button in `PresupuestosList.tsx`. Users have no way to create or manage templates.

2. **Per-section dropdown in the editor** — `PresupuestoCondicionesEditor.tsx` still loads from `PRESUPUESTO_TEMPLATES` hardcoded. The `<textarea>` was never replaced with `<RichTextEditor>`. No Firestore fetch.

3. **Auto-application on creation** — `useCreatePresupuestoForm.ts` has no effect that calls `getDefaultsForTipo`. The hook is unchanged.

4. **HTML rendering in PDF** — `PDFRichText.tsx` does not exist. `react-pdf-html` is not installed. `PresupuestoPDFEstandar.tsx` PDFCondiciones still uses `<Text>{section.content}</Text>`, which will render HTML tags as literal strings if rich HTML is ever stored.

5. **Seed script** — `seed-plantillas-texto-browser.mjs` does not exist. No way to bootstrap initial plantillas from `PRESUPUESTO_TEMPLATES`.

All five missing items are **blockers** — without them the phase goal ("users can manage templates, auto-apply on creation, select per section, and see formatted output in PDF") is not achieved. The data layer is ready but fully unwired from any UI or PDF path.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
