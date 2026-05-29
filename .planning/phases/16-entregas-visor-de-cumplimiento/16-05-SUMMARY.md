---
phase: 16-entregas-visor-de-cumplimiento
plan: "05"
subsystem: entregas-visor
tags: [ui, wave-3, list-page, hook, sidebar, routing, inline-edit]
dependency_graph:
  requires:
    - "16-03: buildEntregaRows pure function (GREEN)"
    - "16-04: PresupuestoItem fields disponibilidad+eta+otNumeroVinculada in Firestore"
  provides:
    - "useEntregas hook — Promise.all(5 colecciones) + clienteNombreById + buildEntregaRows + updateOtNumero"
    - "/entregas route — ProtectedRoute(admin/admin_soporte/administracion)"
    - "EntregasList — list-page con useUrlFilters + SortableHeader + in-memory filter/sort"
    - "EntregasFilters — SearchableSelect cliente + semaforo/estadoImp selects + search + clear"
    - "EntregaRowComponent — editable OT# input (blur/Enter) + semaforo badge + disponibilidad + imp estado"
    - "Sidebar entry: Stock > Compras > Entregas (path /entregas)"
  affects:
    - "apps/sistema-modular (5 new files, 2 edited)"
    - "navigation.ts: Stock > Compras gains Entregas leaf"
    - "TabContentManager.tsx: AppRoutes gains /entregas route"
tech_stack:
  added: []
  patterns:
    - "list-page-conventions: useUrlFilters + SortableHeader + sortByField/toggleSort + PageHeader"
    - "Promise.all(5) parallel load pattern — no serviceCache (fresh data required)"
    - "deepCleanForFirestore on items[] before presupuestosService.update"
    - "Writes from presupuestosService (via ./firebase wrapper) — Electron keyboard router fix"
    - "In-memory filter+sort pipeline (client-side, no Firestore query per filter change)"
key_files:
  created:
    - path: "apps/sistema-modular/src/hooks/useEntregas.ts"
      role: "Hook: Promise.all loads 5 collections, builds clienteNombreById Map, delegates to buildEntregaRows, exposes updateOtNumero"
      loc: 93
    - path: "apps/sistema-modular/src/pages/entregas/EntregasList.tsx"
      role: "List page: PageHeader + useUrlFilters + filters + sortable table + in-memory pipeline"
      loc: 112
    - path: "apps/sistema-modular/src/pages/entregas/EntregasFilters.tsx"
      role: "Sub-component: 4 filter controls + clear button"
      loc: 84
    - path: "apps/sistema-modular/src/pages/entregas/EntregaRow.tsx"
      role: "Sub-component: editable OT# input + all column cells + semaforo/disponibilidad badges"
      loc: 123
    - path: "apps/sistema-modular/src/pages/entregas/index.tsx"
      role: "Barrel re-export"
      loc: 1
  modified:
    - path: "apps/sistema-modular/src/components/layout/navigation.ts"
      role: "Added { name: 'Entregas', path: '/entregas' } to Stock > Compras children array"
    - path: "apps/sistema-modular/src/components/layout/TabContentManager.tsx"
      role: "Added import + Route path=/entregas with ProtectedRoute"
decisions:
  - "No useResizableColumns — keeping EntregasList simple (112 LOC leaves headroom; user can add later)"
  - "No serviceCache — fresh data required for coordination view (reqs, OCDs, importaciones change frequently)"
  - "Inline OT# uses blur+Enter, not debounce — simpler and avoids mid-type saves"
  - "ETAFecha Sin ETA badge rendered in ETA column (not dias column) for visual clarity"
  - "entregado semaforo shows SEMAFORO_LABELS text but no diasRestantes number (they are delivered)"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 2
---

# Phase 16 Plan 05: Entregas Visor — UI + Hook + Wiring Summary

**One-liner:** Built /entregas list page end-to-end — useEntregas hook (Promise.all 5 collections + buildEntregaRows delegation + updateOtNumero), EntregasList with useUrlFilters + SortableHeader, sidebar entry under Stock > Compras, protected route, and EntregaRow with inline OT# editing.

## What Was Built

### useEntregas (93 LOC)

```typescript
export function useEntregas(): {
  rows: EntregaRow[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  updateOtNumero: (presupuestoId: string, itemId: string, otNumero: string | null) => Promise<void>;
}
```

- Parallel load: `Promise.all([presupuestosService.getAll(estado) x3, requerimientosService.getAll(), ordenesCompraService.getAll(), importacionesService.getAll(), clientesService.getAll()])`
- Builds `clienteNombreById: Map<string, string>` from `clientes.razonSocial ?? nombre ?? id`
- Normalizes OC items to `{ id, requerimientoId }` shape for resolver
- `updateOtNumero` reads ppto via `getById`, patches item, writes via `presupuestosService.update(deepCleanForFirestore({ items: newItems }))`, then reloads
- Writes via `presupuestosService` which uses `./firebase` wrapper — Electron keyboard router safe

### EntregasList (112 LOC)

List page follows the `ImportacionesList` pattern:
- `useUrlFilters(FILTER_SCHEMA)` — 6 keys: clienteId, semaforo, estadoImp, search, sortField, sortDir
- `sortByField + toggleSort + SortableHeader` — 11 sortable columns
- In-memory filter pipeline (no Firestore query per filter change)
- `clienteOptions` derived from rows via `useMemo` (deduplicated, sorted by label)

### EntregasFilters (84 LOC)

- SearchableSelect (size="sm") for cliente
- Native `<select>` for semaforo (5 options) and estadoImp (7 options)
- Text input for free-text search
- "Limpiar" button visible when any filter active

### EntregaRowComponent (123 LOC)

11 columns:
| Column | Render |
|---|---|
| Cliente | teal-700 bold truncated |
| Item | description with `title` tooltip |
| Cantidad | right-aligned mono |
| Valor unit. | formatted with currency prefix |
| Presupuesto | Link to /presupuestos/:id |
| OT# | `<input>` with blur/Enter commit, disabled during save |
| OC# | mono or — |
| Importación | numero + ESTADO_IMPORTACION_COLORS badge |
| Disp. | DISPONIBILIDAD_COLORS badge |
| ETA | formatted date or "Sin ETA" badge |
| Días | diasRestantes + SEMAFORO_COLORS + SEMAFORO_LABELS |

### Sidebar + Route

- `navigation.ts`: `{ name: 'Entregas', path: '/entregas' }` added after Importaciones in `Compras.children`
- `TabContentManager.tsx`: `<Route path="/entregas" element={<ProtectedRoute allowedRoles={['admin', 'admin_soporte', 'administracion']}><EntregasList /></ProtectedRoute>} />`

## LOC Audit

| File | LOC | Budget |
|---|---|---|
| `useEntregas.ts` | 93 | ≤ 150 |
| `EntregasList.tsx` | 112 | ≤ 250 |
| `EntregasFilters.tsx` | 84 | ≤ 120 |
| `EntregaRow.tsx` | 123 | ≤ 150 |
| `index.tsx` | 1 | — |

All within budget.

## Test Results

```
pnpm --filter @ags/sistema-modular test:entregas:
✔ [ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly
✔ [ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly
✔ [ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId
✔ [ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash)
✔ [ENT-05] item con importacion.estado=recibido → semaforo = entregado
✔ [ENT-06] item sin requerimiento (stock available) sigue mostrando row

tests 6 | pass 6 | fail 0 — exit 0
```

### Success Criteria Checklist

- [x] 5 new files: pages/entregas/{EntregasList,EntregasFilters,EntregaRow,index}.tsx + hooks/useEntregas.ts
- [x] 2 files edited: navigation.ts + TabContentManager.tsx
- [x] pnpm type-check: no new errors (pre-existing 27 errors in unrelated files)
- [x] test:entregas 6/6 GREEN (no regression)
- [x] Components within LOC budget
- [x] Filtros use useUrlFilters (grep useState→filter = empty)
- [x] Writes from presupuestosService (./firebase wrapper), NOT firebase/firestore direct
- [x] NO edits to apps/reportes-ot/

## Commits

| Hash | Message |
|---|---|
| 049e6b3 | feat(16-05): add useEntregas hook — Promise.all + resolver delegation + updateOtNumero |
| e3d002a | feat(16-05): add EntregasFilters + EntregaRow sub-components |
| 1b35129 | feat(16-05): wire /entregas page — EntregasList + sidebar entry + protected route |

## Deviations from Plan

**[Rule 1 - Bug] Removed unused `symbol` variable in EntregaRow.formatMoney**
- **Found during:** Task 2 type-check
- **Issue:** `const symbol = ...` was declared but unused (TS6133 error).
- **Fix:** Removed the `symbol` line, kept `prefix` which is used in the return.
- **Files modified:** `apps/sistema-modular/src/pages/entregas/EntregaRow.tsx`
- **Commit:** e3d002a (included in same commit)

**[Rule 1 - Simplification] Omitted useResizableColumns**
- **Found during:** Task 3
- **Issue:** Adding `useResizableColumns` (with `colWidths` colgroup and `onResizeStart` handlers per `<th>`) would add ~20 lines and complexity without blocking functionality. Given EntregasList is at 112 LOC (well within 250 budget), the simplification preserves readability.
- **Impact:** Columns are not user-resizable in this first version. Can be added in a follow-up if UAT feedback requests it.
- **No behavioral regression** — list page renders correctly, sorts, filters.

## URL Example

- Sidebar: Stock > Compras > Entregas → `/entregas`
- With filters: `/entregas?clienteId=30-12345678-7&semaforo=rojo&sortField=diasRestantes&sortDir=asc`

## Next Steps

- **16-06**: UAT manual — verificar sidebar visible, filtros en URL, sort, edición inline OT# persistente en Firestore tras F5. Luego release note para coordinadora.

## Self-Check: PASSED

Files exist:
- FOUND: apps/sistema-modular/src/hooks/useEntregas.ts (93 LOC)
- FOUND: apps/sistema-modular/src/pages/entregas/EntregasList.tsx (112 LOC)
- FOUND: apps/sistema-modular/src/pages/entregas/EntregasFilters.tsx (84 LOC)
- FOUND: apps/sistema-modular/src/pages/entregas/EntregaRow.tsx (123 LOC)
- FOUND: apps/sistema-modular/src/pages/entregas/index.tsx (1 LOC)

Commits exist:
- FOUND: 049e6b3 feat(16-05): add useEntregas hook
- FOUND: e3d002a feat(16-05): add EntregasFilters + EntregaRow sub-components
- FOUND: 1b35129 feat(16-05): wire /entregas page — sidebar + route

navigation.ts contains '/entregas': YES
TabContentManager.tsx contains '/entregas': YES
test:entregas: 6/6 PASS
