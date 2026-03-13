---
name: list-page-conventions
description: >
  Standardized conventions for building list/table pages in sistema-modular.
  Use this skill when creating or refactoring any module's list page (e.g., Presupuestos,
  Fichas, Loaners, Stock, Leads, Clientes, etc.) to ensure consistent UX across the platform.
  Trigger when: building a new list page, refactoring an existing one, or when the user asks
  to "normalize" or "standardize" a module's list view.
---

# List Page Conventions — sistema-modular

Reference implementation: `apps/sistema-modular/src/pages/ordenes-trabajo/OTList.tsx`

## Page Structure

Every list page follows this skeleton:

```tsx
<div className="h-full flex flex-col bg-slate-50">
  <PageHeader title="..." subtitle="..." count={filtered.length} actions={<buttons>}>
    {/* Inline filters */}
  </PageHeader>

  <div className="flex-1 min-h-0 px-5 pb-4">
    {/* Empty state OR table card — card IS the scroll container for sticky to work */}
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
      <table ref={tableRef} className="w-full table-fixed">
        <colgroup>{/* Column widths — tune per module, or from useResizableColumns */}</colgroup>
        <thead className="sticky top-0 z-10">...</thead>
        <tbody className="divide-y divide-slate-100">...</tbody>
      </table>
    </div>
  </div>

  {/* Modals at bottom */}
</div>
```

## PageHeader

- `title`: `text-lg font-semibold tracking-tight` (auto from PageHeader component)
- `subtitle`: `text-xs text-slate-400`
- `count`: total filtered rows
- `actions` slot: top-right buttons (+ Nuevo, links to config pages)
- **Children**: inline filter bar

## Filter Bar

Order matters — always follow this sequence:

1. **SearchableSelect dropdowns** (entity filters: Cliente, Sistema, Estado, etc.)
2. **Text inputs** (search fields: OT #, Módulo/Serie, nombre, etc.)
3. **"Limpiar" button** (resets all filters)

### SearchableSelect filters
```tsx
<div className="min-w-[150px]">
  <SearchableSelect
    value={filters.campo}
    onChange={(value) => setFilters({ ...filters, campo: value })}
    options={[{ value: '', label: 'Todos' }, ...data.map(d => ({ value: d.id, label: d.nombre }))]}
    placeholder="Campo"
  />
</div>
```

### Text input filters
```tsx
<input
  type="text"
  value={filters.busqueda}
  onChange={e => setFilters({ ...filters, busqueda: e.target.value })}
  placeholder="Buscar..."
  className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
/>
```

- Width: `w-28` for short fields, `w-36` for longer ones
- All filters in a flex row: `<div className="flex items-center gap-3 flex-wrap">`

### Clear button
```tsx
<Button size="sm" variant="ghost" onClick={() => setFilters({ /* all empty */ })}>
  Limpiar
</Button>
```

## Table Layout

### HARD RULE: No multi-line rows

**BAJO NINGÚN CONCEPTO las filas de tabla pueden mostrarse en 2 renglones.** Toda celda debe ser single-line:
- **Text columns** (nombres, descripciones): usar `truncate` (incluye whitespace-nowrap + overflow-hidden + text-ellipsis). El texto se corta con "..." si no entra.
- **Short content** (fechas, badges, acciones): usar `whitespace-nowrap` — estos nunca se truncan.

### Column sizing strategy

Use `table-fixed` with `<colgroup>` to control proportions. Each table must be tuned per módulo — **ajustar anchos columna por columna según el contenido real del módulo**.

| Column type | Width | Examples |
|------------|-------|---------|
| ID / short code | `70-80px` | OT number, código |
| Date | `75-80px` | Creada, F.Servicio |
| Status badge | `80-90px` | Estado |
| Actions | `100-160px` | Button group (según cant. de botones) |
| Entity name | `10%–14%` | Cliente, Sistema, Módulo |
| Description / flex | `(no width)` | Absorbe todo el espacio restante |

```tsx
<table className="w-full table-fixed">
  <colgroup>
    <col style={{ width: 75 }} />      {/* ID */}
    <col style={{ width: '12%' }} />   {/* Entity 1 */}
    <col style={{ width: '10%' }} />   {/* Entity 2 */}
    <col />                            {/* Description — absorbe el resto */}
    <col style={{ width: 78 }} />      {/* Date */}
    <col style={{ width: 85 }} />      {/* Estado */}
    <col style={{ width: 140 }} />     {/* Acciones */}
  </colgroup>
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

**Rule**: exactly ONE column has no width set — it absorbs all remaining space. This should be the most informative text column (description, notes, etc.).

### Table header (thead)

```tsx
const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';

<thead className="sticky top-0 z-10">
  <tr className="bg-slate-50 border-b border-slate-200">
    <SortableHeader label="..." field="..." ... className={thClass} />
    <th className={thClass}>Non-sortable column</th>
    <th className={`${thClass} text-right`}>Acciones</th>
  </tr>
</thead>
```

### Table cells (tbody)

```tsx
<tbody className="divide-y divide-slate-100">
  <tr className="hover:bg-slate-50 transition-colors cursor-pointer">
    {/* Text columns: truncate (single-line with ellipsis) */}
    <td className="px-2 py-2 text-xs text-slate-700 truncate" title={fullText}>
      {displayText}
    </td>
    {/* Short content: whitespace-nowrap */}
    <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">
      {date}
    </td>
  </tr>
</tbody>
```

- All text: `text-xs`
- Primary ID: `font-semibold text-indigo-600 text-xs`
- Secondary text: `text-slate-600` or `text-slate-500`
- Empty values: `<span className="text-slate-300">—</span>`
- Always add `truncate` + `title={fullValue}` for columns that may overflow

### Resizable columns

Use `useResizableColumns` hook from `hooks/useResizableColumns.ts` to let users drag column borders:

```tsx
import { useResizableColumns } from '../../hooks/useResizableColumns';

const { tableRef, colWidths, onResizeStart } = useResizableColumns();

<table ref={tableRef} className="w-full table-fixed">
  {colWidths ? (
    <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
  ) : (
    <colgroup>{/* default widths */}</colgroup>
  )}
  <thead>
    <tr>
      <SortableHeader ... className={`${thClass} relative`}>
        <div onMouseDown={e => onResizeStart(colIndex, e)}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-400/40" />
      </SortableHeader>
      {/* Last column (Acciones) has no resize handle */}
    </tr>
  </thead>
</table>
```

### Sticky header

**CRITICAL**: The card wrapper must use `overflow-y-auto h-full` (NOT `overflow-hidden`). The outer container uses `min-h-0` (NOT `overflow-y-auto`). `overflow-hidden` breaks `position: sticky`.

### Status badges

```tsx
<span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${colorClass}`}>
  {label}
</span>
```

Color convention: use semantic colors per status (emerald=success, amber=warning, red=error, blue=info, slate=neutral).

### Action buttons

```tsx
<td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
  <div className="flex items-center justify-end gap-0.5">
    <button className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1 py-0.5 rounded hover:bg-emerald-50">
      Ver
    </button>
    <button className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded hover:bg-slate-100">
      Editar
    </button>
    <button className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1 py-0.5 rounded hover:bg-red-50">
      Eliminar
    </button>
  </div>
</td>
```

- `e.stopPropagation()` on the actions cell to prevent row click
- Color coding: emerald = primary action (view/open), indigo = create, slate = edit, red = delete

## Empty State

```tsx
<Card>
  <div className="text-center py-12">
    <p className="text-slate-400">No se encontraron {entity plural}</p>
    <button onClick={() => setShowCreate(true)}
      className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
      Crear primer {entity}
    </button>
  </div>
</Card>
```

## Loading State

```tsx
if (loading && items.length === 0) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-slate-400">Cargando {entity plural}...</p>
    </div>
  );
}
```

## Sorting

Use `SortableHeader` component + `sortByField`/`toggleSort` from `components/ui/SortableHeader`:

```tsx
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';

const [sortField, setSortField] = useState('createdAt');
const [sortDir, setSortDir] = useState<SortDir>('desc');

const handleSort = (f: string) => {
  const s = toggleSort(f, sortField, sortDir);
  setSortField(s.field);
  setSortDir(s.dir);
};
```

## Modal Pattern (CRUD)

- **Simple entities** (Lead, Cliente, Presupuesto): Create/Edit via Modal from the list page
- **Complex entities** (OT, Equipo): Separate detail pages
- Delete: `window.confirm()` inline, no modal needed

```tsx
{/* Bottom of component */}
<CreateXModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadData} />
{editId && (
  <EditXModal open={!!editId} id={editId} onClose={() => setEditId(null)} onSaved={reload} />
)}
```

## Date Formatting

```tsx
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '—';
  try { return new Date(dateString).toLocaleDateString('es-AR'); } catch { return dateString; }
};
```

## Key Imports

```tsx
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { SortableHeader, sortByField, toggleSort, type SortDir } from '../../components/ui/SortableHeader';
```

## UX Conventions

### Keyboard Navigation (SearchableSelect)
- **Tab / Shift+Tab**: Navegar entre opciones del dropdown (wrapping circular)
- **Enter**: Confirmar selección (o abrir dropdown si cerrado)
- **Space**: Confirmar selección de opción resaltada
- **Escape**: Cerrar dropdown
- **Arrow Up/Down**: También navegar opciones (alternativa a Tab)

### Modal Behavior
- Modales NO se cierran al hacer click en el backdrop (prop `closeOnBackdropClick` default `false`)
- Esc y botón X sí cierran el modal
- Siempre incluir botón "Cancelar" explícito en el footer

### Multi-ventana
- Ctrl+click o middle-click en links del sidebar abre en nueva ventana
- Implementado en `Layout.tsx` con `handleNavClick` + `window.open()`

## Checklist for New List Pages

- [ ] `h-full flex flex-col bg-slate-50` root container
- [ ] `PageHeader` with title, subtitle, count, actions, inline filters
- [ ] Filter order: dropdowns → text inputs → Limpiar
- [ ] Card wrapper: `overflow-y-auto h-full` (NOT `overflow-hidden`), outer: `flex-1 min-h-0`
- [ ] `table-fixed` with `colgroup` — one flex column (no width) absorbs remaining space
- [ ] ALL cells single-line: `truncate` for text, `whitespace-nowrap` for dates/badges/actions — NEVER 2-line rows
- [ ] `sticky top-0 z-10` thead with `SortableHeader`
- [ ] `useResizableColumns` hook + drag handles on all headers except last
- [ ] All cells `text-xs`
- [ ] Status badges `text-[10px] rounded-full`
- [ ] Action buttons `text-[10px] font-medium` with color coding
- [ ] `stopPropagation` on actions cell
- [ ] Empty state with create link
- [ ] Loading state
- [ ] Modals at bottom of component
- [ ] Max 250 lines — extract subcomponents/hooks if needed
