# Audit: Components, Hooks, Pages (sistema-modular + portal-ingeniero)

Scope: `apps/sistema-modular/src/{components,pages,hooks}` and `apps/portal-ingeniero/src/{components,pages,hooks}`. `apps/reportes-ot/` excluded per frozen-surface rule.

---

## 1. Direct Firestore from components / hooks (P0)

### [P0] Hook subscribes to Firestore directly, bypassing service
**File(s):** `apps/portal-ingeniero/src/hooks/useLeadDetail.ts:1-3,28-29`
**What:** `useLeadDetail` imports `doc`, `onSnapshot` from `firebase/firestore` and subscribes to `leads/{id}` directly. There is a `leadsService` in this app already — this is the only hook that bypasses it.
**Why:** Violates the "no Firestore from components/hooks" rule (CLAUDE.md > Servicios Firestore). Drift risk: timestamp-parsing logic is reimplemented inline (`parseLead`) and will diverge from `leadsService` mappings.
**Fix:** Add `leadsService.subscribeOne(id, cb)` (mirror sistema-modular) and have the hook consume it.

### [P0] Component subscribes to Firestore directly
**File(s):** `apps/sistema-modular/src/components/pendientes/TicketPendientesChips.tsx:4-5,20-22`
**What:** Component imports `collection, query, where, onSnapshot` and reads `pendientes` collection directly.
**Why:** Same rule. Re-implements ts → ISO conversion that already exists in `pendientesService`.
**Fix:** Add `pendientesService.subscribeByTicketId(id, cb)` and consume it.

### [P0] Modal reaches into Firestore for `doc()`/`collection()` refs
**File(s):** `apps/sistema-modular/src/components/presupuestos/CargarOCModal.tsx:3,8`
**What:** Imports `doc, collection` from `firebase/firestore` and `db` from services. The actual writes go through the service, but creating refs is still a leak of the data layer into UI.
**Why:** Opens the door for ad-hoc reads/writes to creep in; the service should expose the IDs/refs it needs.
**Fix:** Move ref creation into `ordenesCompraClienteService` (e.g., `service.newOcRef()` returning the id) and remove the import.

### [P1] Admin page does mass Firestore CRUD outside services
**File(s):** `apps/sistema-modular/src/pages/admin/ImportacionDatos.tsx:2,270,280,325,467,484,496,563,714,729,771,846-869`
**What:** 1,123-line admin page with ~14 raw `getDocs/addDoc/updateDoc/deleteDoc` calls across `sistemas`, `establecimientos`, `clientes`.
**Why:** Risk is lower (admin-only one-shots) but it bypasses services AND the `cleanFirestoreData/deepCleanForFirestore` invariant. Single source of truth violated.
**Fix:** Extract a `migrationsService` (or inline calls into existing services) and route through it.

---

## 2. List pages using `useState` for filters instead of `useUrlFilters` (P1)

Documented violation per `feedback_filter_persistence.md` — filters MUST persist to the URL.

### [P1] Nine list pages still hold filter state in `useState`
**File(s):**
- `apps/sistema-modular/src/pages/loaners/LoanersList.tsx:32-37`
- `apps/sistema-modular/src/pages/columnas/ColumnasListPage.tsx:32-37`
- `apps/sistema-modular/src/pages/patrones/PatronesListPage.tsx:54-59`
- `apps/sistema-modular/src/pages/instrumentos/InstrumentosListPage.tsx:57-64`
- `apps/sistema-modular/src/pages/calificacion-proveedores/CalificacionesList.tsx:39-41`
- `apps/sistema-modular/src/pages/stock/AsignacionesList.tsx:20-21`
- `apps/sistema-modular/src/pages/stock/OCList.tsx:22-26`
- `apps/sistema-modular/src/pages/tipos-equipo/TiposEquipoList.tsx:36-37` (sort only)
- `apps/sistema-modular/src/pages/usuarios/UsuariosList.tsx:27-28` (sort only)
**What:** Filter / sort state held in `useState`, lost when user navigates away and back.
**Why:** UX regression already flagged; documented in skill `list-page-conventions`.
**Fix:** Migrate each to `useUrlFilters({ ... })` — the schema pattern exists in `LeadsList`/`OTList`/`PresupuestosList`. Sort fields can also live in URL.

### [P2] Local debounced search uses `useState` then writes to URL filter
**File(s):** `apps/sistema-modular/src/pages/clientes/ClientesList.tsx:51`, `apps/sistema-modular/src/pages/establecimientos/EstablecimientosList.tsx:34`
**What:** `localSearch` `useState` mirrored into `filters.search` for debounce.
**Why:** Acceptable but creates two sources of truth; consider `useDebounce(filters.search, 300)` like `LeadsList:67` does.
**Fix:** Drop `localSearch`, debounce the URL value directly.

---

## 3. Components > 250 lines (P1)

Per `.claude/rules/components.md` — extract hook or subcomponent before exceeding 250.

### [P1] Top offenders — extraction proposals

| File | Lines | Proposed extraction |
|---|---|---|
| `components/protocol-catalog/TableEditor.tsx` | 1258 | Split into `TableHeaderRow`, `TableBodyRow`, `RuleEditor` (already partially exists), and a `useTableEditorState` hook. Fragmented `RowFormPanel`/`ChecklistEditor` exist but body is still huge. |
| `pages/admin/ImportacionDatos.tsx` | 1123 | One file per import flow (sistemas/establecimientos/clientes); each tab a subcomponent. Move CRUD to a `migrationsService`. |
| `pages/ordenes-trabajo/OTList.tsx` | 821 | Extract `OTTableRow`, `OTFiltersBar`, and `useOTListData` hook. CSV export already extracted at top — keep going. |
| `pages/agenda/AgendaPage.tsx` | 793 | Page is the orchestrator for Agenda{Header,InfoBar,Grid,PendingSidebar} but still hosts DnD modifier, sensors, mapping table, and lifecycle. Extract `useAgendaDnd` hook + move `AGENDA_TO_OT_ESTADO`/`OT_ESTADO_ORDER` to a util. |
| `components/protocol-catalog/ImportJsonDialog.tsx` | 688 | Wizard steps as subcomponents (`StepUpload`, `StepReview`, `StepConfirm`) + `useImportJson` hook. |
| `components/protocol-catalog/ChecklistEditor.tsx` | 662 | Extract `ChecklistRow`, `ChecklistGroupHeader`, plus `useChecklistEditor` for state. |
| `pages/presupuestos/PresupuestosList.tsx` | 610 | Extract `PresupuestoTableRow`, `PresupuestoFiltersBar`. |
| `pages/equipos/EquipoNew.tsx` | 605 | Extract per-step subcomponent (`EquipoBasicForm`, `EquipoModulosForm`, `EquipoSistemaForm`). |
| `apps/portal-ingeniero/.../LeadsPage.tsx` | 506 | Mirror sistema-modular: extract `LeadTableRow`, the inline `SortIcon`, and a `useLeadFilters` adapter. |
| `components/presupuestos/EditPresupuestoModal.tsx` | 530 | Extract tabs (`PresupuestoItemsTab`, `PresupuestoMontosTab`) and a `usePresupuestoEdit` hook (already exists — move the residual logic). |
| `components/leads/CrearLeadModal.tsx` (portal) | 547 | Mirror sistema-modular's slimmer CrearLeadModal (205 lines). The portal version reimplements features instead of consuming `LeadClienteField`/`LeadAdjuntosField`. |

(Full list: 23 files exceed 250 in sistema-modular and 4 in portal-ingeniero.)

---

## 4. Cross-app duplication (P1)

### [P1] Lead UI re-implemented in both apps
**File(s):** `apps/{portal-ingeniero,sistema-modular}/src/components/leads/{ContactosTicketSection,LeadAdjuntosSection,LeadFilters,LeadSidebar,LeadTimeline,LeadQuickNoteModal,FinalizarLeadModal,DerivarLeadModal,CrearLeadModal}.tsx`
**What:** Nine Lead components exist in both apps with non-trivial differences (`diff -q` shows all 7 compared files differ; in some cases 197 vs 129 lines of mostly the same logic).
**Why:** Bug fixes diverge (e.g., `LeadTimeline.tsx` portal uses `localeCompare` on dates while sistema-modular uses `[].reverse()` — produces different orderings for same data). Roles, labels, and filter schemas drift independently.
**Fix:** Promote to a `@ags/leads-ui` shared package (or inside `@ags/shared/components/leads`). Pages import from the shared module and pass app-specific props (auth, services).

### [P1] UI atoms diverged across apps
**File(s):** `apps/{portal,sistema-modular}/src/components/ui/{Modal,Button,SearchableSelect,Card,Input,ColMenu,PageHeader}.tsx`
**What:** Every UI atom exists in both apps with diffs (e.g., teal-500 vs teal-700 in `QFFilterBar`, divergent prop signatures in `Modal`).
**Why:** The whole point of the design system rule is *not* to recreate atoms. New variant in one app silently breaks the other's visual consistency.
**Fix:** Move `ui/` to `packages/ui` (already contemplated by monorepo). Keep app-specific extensions only.

### [P1] `useUrlFilters` duplicated and diverged
**File(s):** `apps/portal-ingeniero/src/hooks/useUrlFilters.ts` (84 lines) vs `apps/sistema-modular/src/hooks/useUrlFilters.ts` (107 lines)
**What:** Two implementations of the same hook; portal version has fewer features (e.g., return tuple shape differs — sistema returns 4-tuple, portal returns 3-tuple).
**Why:** The cornerstone of the filter-persistence rule has TWO sources of truth.
**Fix:** Move the canonical (sistema-modular) version to `@ags/shared/hooks` (or a new `@ags/hooks` package) and import from both apps.

### [P2] `useResizableColumns` duplicated identically
**File(s):** `apps/portal-ingeniero/src/hooks/useResizableColumns.ts` ↔ `apps/sistema-modular/src/hooks/useResizableColumns.ts`
**What:** Files are byte-identical (`diff -q` reports no difference).
**Why:** Pure copy-paste; will drift the moment one is touched.
**Fix:** Promote to shared.

### [P1] QF documentos UI duplicated
**File(s):** `apps/{portal,sistema-modular}/src/components/qf-documentos/{EditarQFModal,HistorialDrawer,NuevaVersionModal,NuevoQFModal,QFFilterBar}.tsx`
**What:** All 5 components exist in both apps; diff reveals only color tokens / minor sizing differ.
**Why:** Single source of truth violated.
**Fix:** Same shared-package strategy as Leads.

---

## 5. Modal API misuse (P1)

### [P1] Three modals pass deprecated `size` prop
**File(s):**
- `apps/sistema-modular/src/components/columnas/CreateColumnaModal.tsx:74`
- `apps/sistema-modular/src/components/patrones/CreatePatronModal.tsx:74`
- `apps/sistema-modular/src/components/patrones/MigracionPatronesModal.tsx:57`
**What:** `<Modal ... size="md">` / `size="lg"`. The Modal API only supports `maxWidth`; the `size` prop is silently ignored, defaulting to `maxWidth='md'`.
**Why:** `MigracionPatronesModal` intends `lg` (max-w-2xl) but renders at `md` (max-w-lg) → tighter than designed. Visual regression.
**Fix:** Rename `size=` → `maxWidth=` in all three.

---

## 6. Pattern divergence (P2)

### [P2] List pages don't follow barrel-`index.tsx` rule
**File(s):** 12 of 26 page folders missing `index.tsx`: `admin`, `agenda`, `auth`, `columnas`, `contratos`, `establecimientos`, `facturacion`, `ordenes-trabajo`, `patrones`, `pendientes`, `presupuestos`, `tipos-equipo`, `usuarios`.
**What:** CLAUDE.md says "una carpeta por módulo en `pages/[modulo]/` con `index.tsx` como barrel". Missing barrels mean each page is imported by its file name from `App.tsx`.
**Fix:** Add `index.tsx` re-exporting the page; update `App.tsx` imports.

### [P2] `TiposEquipoList` lacks `PageHeader`
**File(s):** `apps/sistema-modular/src/pages/tipos-equipo/TiposEquipoList.tsx`
**What:** Only list page in the codebase that does NOT use the shared `PageHeader` atom (28/29 do).
**Fix:** Wrap with `<PageHeader title="Tipos de equipo" ...>`.

### [P2] Mixed naming: `*List.tsx` vs `*ListPage.tsx`
**File(s):** `ColumnasListPage.tsx`, `InstrumentosListPage.tsx`, `PatronesListPage.tsx` use `…ListPage.tsx`; the other 26 use `…List.tsx`.
**Fix:** Rename for consistency (drop `Page` suffix) — combined with the barrel-index migration above.

---

## 7. Dead components (P2)

### [P2] `LeadCard.tsx` only referenced by itself
**File(s):** `apps/portal-ingeniero/src/components/leads/LeadCard.tsx`
**What:** Grep finds only the file itself — no importer.
**Fix:** Delete (or wire it back into `LeadsPage` if intended for mobile card view).

---

## TOP 5 to fix first

1. **Promote duplicated cross-app code to shared packages** (Section 4) — Lead components, UI atoms, `useUrlFilters`, `useResizableColumns`, QF documentos. Biggest leverage; everything else gets cheaper after this. Diverged behavior in `LeadTimeline` is a real bug today.
2. **Remove direct Firestore access from `useLeadDetail`, `TicketPendientesChips`, `CargarOCModal`** (Section 1, P0). Quick wins. ImportacionDatos can follow.
3. **Migrate the 9 list pages to `useUrlFilters`** (Section 2). Documented user-visible feedback; mechanical refactor with an existing template (`LeadsList`).
4. **Rename `size` → `maxWidth` in the 3 broken modals** (Section 5). One-line fix, fixes a visual regression.
5. **Decompose the top-3 monsters: `TableEditor.tsx` (1258), `ImportacionDatos.tsx` (1123), `OTList.tsx` (821)** (Section 3). Concentrate refactor effort where the policy violation is most extreme.
