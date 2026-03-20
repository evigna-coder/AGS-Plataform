---
name: list-page-conventions
description: >
  Standardized conventions for building list/table pages in sistema-modular AND portal-ingeniero.
  Use this skill when creating or refactoring any module's list page (e.g., Presupuestos,
  Fichas, Loaners, Stock, Leads, Clientes, etc.) to ensure consistent UX across the platform.
  Trigger when: building a new list page, refactoring an existing one, or when the user asks
  to "normalize" or "standardize" a module's list view.
---

# List Page Conventions — AGS Platform (Unified)

Applies to both `sistema-modular` and `portal-ingeniero`.

## Page Structure

```tsx
<div className="h-full flex flex-col bg-slate-50">
  <PageHeader title="..." count={filtered.length} actions={<Button size="sm">+ Nuevo X</Button>}>
    {/* Row 1: Search + Estado tabs + Mis items checkbox */}
    {/* Row 2 (optional): Advanced filters (SearchableSelect dropdowns) */}
  </PageHeader>

  <div className="flex-1 min-h-0 px-5 pb-4">
    {empty ? <EmptyCard /> : <TableCard />}
  </div>

  {/* Modals at bottom */}
</div>
```

## Filter System (2 rows)

### Row 1: Primary — Search + Tabs + Mis items

```tsx
<div className="flex items-center gap-3 flex-wrap">
  {/* Search */}
  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
    placeholder="Buscar por razón social, contacto..."
    className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />

  {/* Estado tabs */}
  <div className="flex items-center gap-1.5">
    {ESTADO_TABS.map(tab => (
      <button key={tab.value} onClick={() => setEstadoFilter(tab.value)}
        className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
          estadoFilter === tab.value
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}>
        {tab.label}
      </button>
    ))}
  </div>

  {/* Right-aligned checkbox */}
  <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-auto">
    <input type="checkbox" checked={soloMios} onChange={e => setSoloMios(e.target.checked)}
      className="rounded border-slate-300" />
    Mis {entity}
  </label>
</div>
```

### Row 2: Advanced — SearchableSelect dropdowns (sistema-modular only)

Only show when module has 2+ filter dimensions beyond estado/search.

```tsx
<div className="flex items-center gap-3 flex-wrap mt-2">
  <div className="min-w-[130px]">
    <SearchableSelect value={filters.campo}
      onChange={(v) => setFilters({ ...filters, campo: v })}
      options={[{ value: '', label: 'Campo: Todos' }, ...options]}
      placeholder="Campo" />
  </div>
  {hasAdvancedFilters && (
    <Button size="sm" variant="ghost" onClick={clearAdvancedFilters}>Limpiar</Button>
  )}
</div>
```

### portal-ingeniero simplification

Portal uses `px-4 pb-3` padding, search as full-width block above tabs:

```tsx
<div className="px-4 pb-3 shrink-0 space-y-2">
  <input ... className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs ..." />
  <div className="flex items-center gap-2 overflow-x-auto">
    {tabs}
    <label className="ml-auto">{checkbox}</label>
  </div>
</div>
```

## Table Tokens

### Standard classes

```tsx
// Reuse across all list pages
const thClass = 'px-3 py-2 text-left text-[11px] font-medium text-slate-400 tracking-wider whitespace-nowrap';
```

### Table wrapper
```tsx
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto h-full">
  <table className="w-full">
    <thead className="sticky top-0 z-10">
      <tr className="bg-slate-50 border-b border-slate-200">
```

### Cell types

| Type | Classes | Example |
|------|---------|---------|
| **Link (primary)** | `px-3 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 truncate max-w-[160px] block` | Cliente name |
| **Text** | `px-3 py-2 text-xs text-slate-600 truncate max-w-[120px]` | Contacto |
| **Badge** | `text-[10px] font-medium px-1.5 py-0.5 rounded-full ${COLOR_MAP[value]}` | Estado, Motivo, Área |
| **Description** | `px-3 py-2 text-[10px] text-slate-400 truncate max-w-[180px] italic` | Motivo contacto |
| **Date** | `px-3 py-2 text-[10px] text-slate-400 whitespace-nowrap` | Fecha creación |
| **Assignee** | `px-3 py-2 text-xs text-slate-500 truncate max-w-[100px] whitespace-nowrap` | Asignado |
| **Empty value** | `text-[10px] text-slate-300` → `—` | Cuando no hay dato |

### Action buttons

```tsx
<td className="px-3 py-2 text-right whitespace-nowrap">
  <div className="flex items-center justify-end gap-1">
    <button className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50">
      Derivar
    </button>
    <button className="text-[10px] font-medium text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50">
      Finalizar
    </button>
    <button className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50">
      Ver
    </button>
  </div>
</td>
```

**Action color coding:**
- **indigo** = workflow action (Derivar, Asignar)
- **red** = destructive/final (Finalizar, Eliminar)
- **emerald** = primary read (Ver)
- **slate** = secondary (Editar)

## Standard Column Names

Use these names consistently across ALL list pages:

| Column | When to use |
|--------|-------------|
| Cliente | Entity name (link to detail) |
| Contacto | Person name |
| Motivo | Badge — `MOTIVO_LLAMADO_COLORS` |
| Descripción | Italic preview, 60 chars + ellipsis |
| Área | Badge — `LEAD_AREA_COLORS` |
| Estado | Badge — entity-specific `*_ESTADO_COLORS` |
| Asignado | Person assigned |
| Fecha | Creation date, `dd/short-month` format |
| Acciones | Right-aligned action buttons |

## Date Formatting

```tsx
const formatDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); } catch { return d; }
};
```

## Empty State

```tsx
<Card><div className="text-center py-12">
  <p className="text-slate-400">No se encontraron {entity plural}</p>
  <button onClick={() => setShowCreate(true)}
    className="text-indigo-600 hover:underline mt-2 inline-block text-xs">
    Crear primer {entity}
  </button>
</div></Card>
```

## Loading State

```tsx
if (loading && items.length === 0) {
  return <div className="flex items-center justify-center py-12">
    <p className="text-slate-400">Cargando {entity plural}...</p>
  </div>;
}
```

## HARD RULES

1. **No multi-line rows**: ALL cells `truncate` (text) or `whitespace-nowrap` (dates/badges/actions)
2. **Max 250 lines per component** — extract hooks/subcomponents if needed
3. **Modals at bottom** of component, not inline
4. **Actions cell**: always `stopPropagation` if row is clickable
5. **`overflow-y-auto h-full`** on table wrapper (NOT `overflow-hidden` — breaks sticky)
6. **One flex column** (no width set) absorbs remaining space

## Checklist for New List Pages

- [ ] Root: `h-full flex flex-col bg-slate-50`
- [ ] PageHeader with title, count, actions, filter rows
- [ ] Row 1: Search + Estado tabs + Mis items checkbox
- [ ] Row 2 (optional): SearchableSelect advanced filters + Limpiar
- [ ] Table wrapper: `overflow-y-auto h-full`, outer `flex-1 min-h-0`
- [ ] `thClass` constant reused for all headers
- [ ] `sticky top-0 z-10` thead
- [ ] All cells single-line (truncate / whitespace-nowrap)
- [ ] Badges: `text-[10px] font-medium px-1.5 py-0.5 rounded-full`
- [ ] Actions: `text-[10px] font-medium` with color coding
- [ ] Empty state with create link
- [ ] Loading state
- [ ] Modals at bottom
- [ ] Max 250 lines
