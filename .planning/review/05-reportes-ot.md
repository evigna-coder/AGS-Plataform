# reportes-ot — Read-only audit

Scope: latent bugs, type-coupling risk, workaround rot, dead code, brittleness in the PDF pipeline. **No edits proposed** — this app is frozen surface (see `.claude/rules/reportes-ot.md`). Findings are observations for the user to triage.

Confirmed still in place (memory `reportes-ot-pdf.md` is current):
- html2canvas overflow workaround → `usePDFGeneration.ts:266-268`
- RichTextEditor `<font size>` neutralizer → `public/index.css:344-349`
- Manual clone-into-body capture (no `onclone`) → `usePDFGeneration.ts:259-315`

---

### [P0] Hard-coded ticket assignee user-id in field-tech app
**File:** `apps/reportes-ot/services/firebaseService.ts:836-837`
**What:** Tickets auto-created from "Acciones a tomar" hard-code `asignadoA: 'pHDkcnzLEdX93APkPcf3ebqyOJL2'` and `asignadoNombre: 'Esteban Vigna'`. No fallback if that user is deactivated, renamed, or leaves the company.
**Risk:** Day Esteban's user gets disabled, every reporte finalizado in the field silently creates an orphan ticket assigned to a dead uid. RBAC may then drop those tickets from default views.
**OBSERVATION:** Confirm whether this should read from `adminConfig/flujos` (the same pattern `_syncTicketFromOTInline` already uses for `usuarioMaterialesId` at `firebaseService.ts:166-188`). Cross-check: sistema-modular `leadsService` likely has a single source of truth for "Soporte" routing.

### [P0] Non-atomic ticket numero generator vulnerable to concurrent finalizations
**File:** `apps/reportes-ot/services/firebaseService.ts:805-820` (inside `createTicketFromAcciones`)
**What:** Reads ALL `leads` docs, picks max `TKT-XXXXX`, increments. Two technicians finalizing at the same instant get the same number. Comment acknowledges this and points to a backfill job for cleanup.
**Risk:** Duplicate ticket numbers in production until backfill runs; uniqueness assumptions in sistema-modular may break (URL collisions, dedupe queries). Also reads the entire leads collection on every finalization (cost + latency grows linearly with leads volume).
**OBSERVATION:** Investigate whether sistema-modular exposes a transactional counter (e.g., `counters/tickets` doc with FieldValue.increment in a transaction) and if reportes-ot can call it instead.

### [P0] PDF protocol-page wait loop can give up while pages still settle
**File:** `apps/reportes-ot/hooks/usePDFGeneration.ts:220-229`
**What:** Polls `[data-protocol-page]` 20× × 250ms = 5s max. Pagination in `ProtocolPaginatedPreview` itself uses a `setTimeout(300)` for measurement (line 568). On a slow tablet with a heavy protocol (50+ pages, embedded images), 5s might not be enough — the loop falls through to the `html2pdf` fallback at line 324.
**Risk:** Silent layout regression: protocol pages are rendered by the legacy `html2pdf` path instead of the per-page html2canvas path, meaning headers/footers and pagination differ subtly and clipping bugs the team thought were fixed re-appear in field PDFs.
**OBSERVATION:** Add telemetry (which path produced each output) before any tuning. The "20 attempts ok" branch silently swallows the fallback case.

### [P1] Component-size hotspots — what is in them
**Files (with rough internal split lines):**
- `components/CatalogTableView.tsx` (2212 lines) — three responsibilities glued together: (a) `computeConclusion` + `resolveSpecExpression` pure-fn block (lines 1-200), (b) two portal-based dropdowns `MultiSelectHeaderDropdown` + `ColumnVisibilityMenu` (200-470), (c) the actual table renderer with mobile/desktop dual paths and accordion chrome.
- `utils/protocolNormalizers.ts` (1790) — exports only two public fns (`normalizeProtocolTemplate`, `normalizeCompositeConclusionesSection`); the rest is per-protocol-section heuristics for the hard-coded HPLC/composite-conclusiones template.
- `components/ProtocolTable.tsx` (1171) — large render path inside the protocol Word-style template (separate from CatalogTableView).
- `hooks/useAppLogic.ts` (1062) — extracts ~30 setters into a single mega-hook return; if inspected, ~250 lines are pure handlers that could be a `useProtocolEditing` hook.
- `hooks/usePDFGeneration.ts` (976) — the PDF orchestrator; clear seams already exist (`generateReportBlob`, `generateProtocolPagesBlob`, `generateFotoPagesBlob`, `downloadAndRenderCerts`, plus 4 cert-source-specific wrappers).
- `services/firebaseService.ts` (864) — single class spanning reportes + tableCatalog + clientes + sistemas + adjuntos + leads + storage + ticket sync.
**OBSERVATION:** Documenting only — do not refactor. If future work *does* touch any of these files, the seams above are the natural ones.

### [P1] Two stale duplicate files in the source tree
**File:** `apps/reportes-ot/components/ProtocolView - copia.tsx` and `apps/reportes-ot/App.tsx.backup`
**What:** Neither is imported anywhere (verified via Grep across the app). Both still contain `CATALOG_SERVICE_TYPES`, `declare const QRCode`, etc. — they will drift from the live versions on every change.
**Risk:** Low — they don't ship. But they show up in Grep results when refactoring (e.g., the `CATALOG_SERVICE_TYPES` audit had to filter the backup file out manually) and bias diff-based reviews. A future grep-and-replace could touch the backup and produce confusing PR diffs.
**OBSERVATION:** Worth deleting once at a clear cut-point.

### [P1] Two app/shared type alias paths exist in parallel — `@ags/shared` AND `@shared`
**Files:** `vite.config.ts:36-37`, `tsconfig.json:26-31`, then mixed usage:
- `services/firebaseService.ts:7` → `import { deepCleanForFirestore } from '@ags/shared'`
- `types.ts:11`, `types/instrumentos.ts:12`, `types/entities.ts:9`, `types/tableCatalog.ts:13` → `from '@shared/types/index'`
- `components/CatalogTableView.tsx:479,750`, `components/ProtocolPaginatedPreview.tsx:124` → `import('@ags/shared')` inline type imports
**What:** Same package reachable via two aliases. Some files use the namespaced barrel, others reach into `@shared/types/index` directly.
**Risk:** Renaming a type in `packages/shared/src/types/index.ts` requires deciding which alias paths still export it; circular re-export bugs are easy to miss because the bundler resolves both. A future cross-cutting type rename touching reportes-ot is in scope of the rule's "explicit confirmation" clause — relevant here.
**OBSERVATION:** Catalogue all `@shared/`/`@ags/shared` import sites before any rename. The two-alias setup is intentional in vite/tsconfig but undocumented.

### [P1] `firebaseService.ts` mixes timestamp shapes
**File:** `apps/reportes-ot/services/firebaseService.ts`
**What:** Writes use a mix: `updatedAt: new Date()` (line 213, inside `_syncTicketFromOTInline`), `signedAt: Date.now()` (line 344, `updateSignature`), `now = new Date().toISOString()` for new ticket docs (line 822). Reads from sistema-modular collections deal with both Firestore Timestamp (`.toDate?.()?.toISOString()` at lines 572-573, 595-596) and ISO strings.
**Risk:** Mismatch with `.claude/rules/firestore.md` which mandates `Timestamp.now()` for writes and `.toDate().toISOString()` for reads. Currently three different shapes for the same conceptual "updatedAt" field across the codebase. Sorting and querying by date can silently mis-order if Firestore Timestamps and JS Date are mixed in the same field across reads/writes.
**OBSERVATION:** Audit which fields are consumed by sistema-modular queries — those are where mismatch bites. Not a bug per se, but the rule says "never mix" and this file does.

### [P1] `protocolSelector.ts` is now an empty stub for service-type→template lookup
**File:** `apps/reportes-ot/utils/protocolSelector.ts:28-32`
**What:** `getProtocolTemplateForServiceType()` returns `null` unconditionally. Callers in `App.tsx:52` and `useAppLogic.ts:75` still invoke it — dead branches.
**Risk:** Reading the code suggests there's a working template fallback when the catalog table doesn't match. There isn't. The catch-all fallback in `useAppLogic:74` is `getProtocolTemplateById(protocolTemplateId) ?? null` (the `??` chain to `getProtocolTemplateForServiceType` always resolves to null). When debugging "why didn't a template load for tipoServicio X?", the path leads to a dead function.
**OBSERVATION:** Not blocking; just confusing during debugging. Worth a comment if not removal.

### [P1] CATALOG_SERVICE_TYPES is a hand-maintained string set
**File:** `apps/reportes-ot/hooks/useAppLogic.ts:25-35`
**What:** Hard-coded set of 9 Spanish strings ("Calibración", "Mantenimiento preventivo con consumibles", etc.). Used to gate whether the catalog/protocol tab renders. If a coordinator adds a new tipo de servicio in sistema-modular (say "Capacitación"), reportes-ot won't show the protocol selector for it until this set is updated and re-deployed.
**Risk:** Silent feature gap — the field tech sees no protocols for the new service type and assumes there are none, instead of the (correct) "this service type is not catalog-enabled".
**OBSERVATION:** Investigate whether tipoServicio strings are now sourced from a Firestore config doc; if so, this set should read from there. If kept hard-coded, at minimum it should match a constant in `@ags/shared` shared with sistema-modular's tipoServicio dropdown.

### [P2] Service architecture mismatch with sistema-modular convention
**File:** `apps/reportes-ot/services/firebaseService.ts` (entire file)
**What:** sistema-modular (per CLAUDE.md "Servicios Firestore" section) uses one-collection-per-file: `leadsService.ts`, `clientesService.ts`, etc. reportes-ot uses one giant `FirebaseService` class spanning `reportes`, `tableCatalog`, `tableProjects`, `clientes`, `establecimientos`, `sistemas`, `instrumentos`, `patrones`, `columnas`, `ingenieros`, `certificadosIngeniero`, `adjuntos`, `usuarios`, `articulos`, `leads`, plus storage. Plus a top-level `_syncTicketFromOTInline` helper that duplicates `leadsService.syncFromOT` from sistema-modular (comment at line 158-161 acknowledges this).
**Risk:** The duplicated ticket-sync logic at lines 115-228 must be kept in lockstep with sistema-modular's `OT_TO_LEAD_ESTADO` mapping (line 105 mentions this). Any ticket-state machine change to sistema-modular silently desyncs the technician path. The comment at line 161 says "duplicación intencional porque reportes-ot escribe directo a Firestore vía setDoc y bypasea el service de sistema-modular" — fair, but no automated check enforces it.
**OBSERVATION:** Just observe — file structure unification is out of scope for "frozen". But the duplicated `OT_TO_TICKET_ESTADO` map is high-value for a static cross-check tool to validate.

### [P2] PDF pipeline brittleness: `pdf-generating` body class is a CSS extension hook
**File:** `usePDFGeneration.ts:539, 616`
**What:** Adds `pdf-generating` to `document.body` during generation. Only checked if some CSS rule keys off it (would be in `public/index.css` — needs verification). Removed in `finally` block.
**Risk:** If a future Tailwind purge or CSS reorganization drops the rule that responds to `.pdf-generating`, hidden containers may render visible mid-generation. Conversely if the helper is removed but rules remain, hidden containers stay hidden in normal mode.
**OBSERVATION:** Low priority. Worth grepping `.pdf-generating` once during any CSS refactor.

### [P2] CONTENT_HEIGHT_PX uses fixed `MM_TO_PX = 3.7795` (96 dpi assumption)
**File:** `components/ProtocolPaginatedPreview.tsx:16-17`
**What:** Page-height calculation assumes browser renders 1mm = 3.7795px. On HiDPI tablets where layout-px differs from CSS-px, or when the user has set a non-default browser zoom, content fits inconsistently per-page.
**Risk:** Content may overflow page bottom or leave excessive whitespace. The `data-measurement-div` measures real heights, but the BUDGET (`CONTENT_HEIGHT_PX = 994`) is a fixed constant — measurement only adapts the *items*, not the *page capacity*.
**OBSERVATION:** Not new — has been running this way. Surface only if technicians report new pagination glitches after a tablet OS update.

### [P2] `html2pdf` and `QRCode` loaded from CDN, declared as globals
**File:** `index.html:12-13`, `usePDFGeneration.ts:15`, `useAppLogic.ts:20`
**What:** Production depends on cdnjs availability for both libraries (no local fallback, no `subresource-integrity` hash). Field tablets are often on flaky 4G; if CDN is blocked or slow, the entire PDF pipeline (`html2pdf`) and the remote-sign QR (`QRCode`) just won't load.
**Risk:** A field session with no internet at start can never generate a PDF in that session. Service worker (this is a PWA) likely caches them after first load — but first-ever load on a new tablet, or after cache-bust, fails hard.
**OBSERVATION:** Confirm whether the PWA service worker pre-caches these CDN URLs. If not, vendoring them to `/public/` is the typical fix.

### [P2] `ProtocolView` PROTOCOL_FOOTNOTES hard-coded for HPLC series
**File:** `components/ProtocolView.tsx:29-34`
**What:** Footnotes literally say "series 1100/1120/1200/1220/1260" — the HPLC family. Rendered for *every* protocol that goes through `ProtocolView` regardless of tipoServicio or sistema.
**Risk:** When the catalog template path is bypassed and the legacy `califOperacionHplcTemplate` renders for a non-HPLC system (e.g., GC or HTA), a footnote about HPLC instructivos appears on a non-HPLC protocol. Confusing for the customer who reads the PDF.
**OBSERVATION:** Tied to the ProtocolSelector dead-stub above. If the legacy template path can no longer be reached for non-HPLC, this is moot. Worth verifying the path is dead.

---

## TOP 3 risks to investigate

1. **Hard-coded `asignadoA` uid in `firebaseService.ts:836`** — single point of brittleness when the user changes. High blast radius (every field-finalized OT creates a ticket), invisible failure mode (ticket assigned to dead uid).

2. **Non-atomic `TKT-XXXXX` correlative generator (`firebaseService.ts:805-820`)** — duplicated ticket numbers under concurrent finalization. Comment acknowledges and routes to a backfill, which is a tell that this has bitten before.

3. **`OT_TO_TICKET_ESTADO` map duplicated from sistema-modular (`firebaseService.ts:105-113`)** — only thing keeping the cross-app state machine consistent is human discipline. A change to sistema-modular's `OT_TO_LEAD_ESTADO` mapping silently breaks the field-to-ticket lifecycle without any compile/test signal in either app.
