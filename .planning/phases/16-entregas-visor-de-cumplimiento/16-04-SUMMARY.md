---
phase: 16-entregas-visor-de-cumplimiento
plan: "04"
subsystem: entregas-visor
tags: [ui, wave-2, presupuestos, disponibilidad, atp, inline-edit]
dependency_graph:
  requires:
    - "16-01: @ags/shared Disponibilidad union + DISPONIBILIDAD_LABELS"
    - "16-03: entregasResolver.ts GREEN (pure functions ready)"
  provides:
    - "PresupuestoDisponibilidadFields: reusable select+input atom (modal+row variant)"
    - "AddItemModal: disponibilidad+etaDiasEstimados fields with ATP auto-default"
    - "PresupuestoItemRow: inline disclosure editing for disponibilidad+eta"
    - "BulkAplicarDisponibilidadButton: confirm modal to set disp+eta on all items"
    - "PresupuestoItemsTable: bulk-apply toolbar + new fields propagated to Firestore"
  affects:
    - "apps/sistema-modular (editor de presupuestos, todos los tipos)"
tech_stack:
  added: []
  patterns:
    - "prevArticuloId useRef guard — avoids re-firing ATP effect on unrelated state changes"
    - "disponibilidadTouched flag — operator manual override blocks auto-default"
    - "Module-level TaxPreview extraction — keeps AddItemModal within 250 LOC budget"
    - "Disclosure row pattern (showDisp useState) — per-row expandable sub-row"
key_files:
  created:
    - path: "apps/sistema-modular/src/components/presupuestos/PresupuestoDisponibilidadFields.tsx"
      role: "Shared atom: select Disponibilidad (4 options) + input ETA; variant modal/row; atpHint caption"
    - path: "apps/sistema-modular/src/components/presupuestos/BulkAplicarDisponibilidadButton.tsx"
      role: "Toolbar button + confirm modal to apply disp+eta to all N items at once"
  modified:
    - path: "apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx"
      role: "Phase 16 fields + useEffect ATP auto-default; TaxPreview extracted; stays at 250 LOC"
    - path: "apps/sistema-modular/src/components/presupuestos/PresupuestoItemRow.tsx"
      role: "Disclosure sub-row for inline disponibilidad/eta editing; was 62 → 110 LOC"
    - path: "apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx"
      role: "BulkAplicarDisponibilidadButton in toolbar; handleAdd emits new fields to Firestore"
decisions:
  - "ATP auto-default uses useRef guard (prevArticuloId) not direct dependency on articuloId to avoid stale-closure re-fires"
  - "disponibilidadTouched flag preserved in local state only (resets on modal remount) — intentional, user gets fresh defaults each open"
  - "BulkApply: null value = skip (preserve per-item values); only non-null overrides are applied"
  - "PresupuestoItemRow disclosure: starts expanded if item already has disp/eta to avoid invisible data"
  - "TaxPreview extracted to module-level component (not file) — same file, avoids adding a new artifact"
metrics:
  duration: "~7 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 3
---

# Phase 16 Plan 04: Editor de Presupuestos — Campos Disponibilidad + ETA Summary

**One-liner:** Extended presupuesto item editor with disponibilidad+ETA fields (ATP auto-default via computeStockAmplio, inline row editing, bulk-apply modal) — items now carry delivery data to Firestore via deepCleanForFirestore in the parent service.

## What Was Built

### PresupuestoDisponibilidadFields (new, 92 LOC)

Shared atom used in 3 places:
- `AddItemModal` — variant="modal" (stacked, full-width)
- `PresupuestoItemRow` disclosure — variant="row" (2-col compact inline)
- `BulkAplicarDisponibilidadButton` confirm modal — variant="modal"

Props: `disponibilidad`, `etaDiasEstimados`, `onChange`, `variant`, `atpHint`, `disabled`.

Labels: uppercase mono `text-[10px] tracking-wide` (Editorial Teal convention).

### AddItemModal — ATP Auto-Default (Phase 16 integration)

```typescript
useEffect(() => {
  // Guard: only fires when stockArticuloId actually changes
  if (artId === prevArticuloId.current) return;
  prevArticuloId.current = artId;
  if (disponibilidadTouched) return; // operator override — don't clobber
  if (!artId) { setNewItem({ ...newItem, disponibilidad: 'post_facturacion', etaDiasEstimados: null }); return; }
  // call computeStockAmplio(artId) → ATP>0: stock+0d, ATP=0: a_importar+30d
}, [newItem.stockArticuloId]);
```

Auto-default logic (locked in CONTEXT.md):
| Condition | disponibilidad | etaDiasEstimados |
|---|---|---|
| `stockArticuloId` + ATP > 0 | `stock` | `0` |
| `stockArticuloId` + ATP = 0 | `a_importar` | `30` |
| No `stockArticuloId` (servicio) | `post_facturacion` | `null` |
| computeStockAmplio throws | `a_importar` | `30` |

Operator can always override — `disponibilidadTouched` flag prevents re-default on subsequent article changes.

### PresupuestoItemRow — Inline Disclosure (110 LOC)

- Toggle button (▼/▲) in the last cell opens a `<tr>` sub-row spanning all 9 columns
- Sub-row renders `PresupuestoDisponibilidadFields variant="row"` wired to `onUpdateItem`
- Starts expanded if `item.disponibilidad != null || item.etaDiasEstimados != null`

### BulkAplicarDisponibilidadButton (93 LOC)

- Toolbar button: "Aplicar a todos (N)" — hidden when N=0
- Opens confirm modal with `PresupuestoDisponibilidadFields` + Cancelar/Aplicar
- On confirm: `onApplyAll({ disponibilidad, etaDiasEstimados })` — caller applies
- `null` value = leave existing per-item value untouched (idempotent skip)

### PresupuestoItemsTable — Wiring (250 LOC)

```typescript
// handleAdd now includes:
disponibilidad: newItem.disponibilidad ?? null,
etaDiasEstimados: newItem.etaDiasEstimados ?? null,
otNumeroVinculada: null,

// BulkApply: only non-null overrides applied
items.forEach(it => {
  if (disponibilidad !== null) onUpdateItem(it.id, 'disponibilidad', disponibilidad);
  if (etaDiasEstimados !== null) onUpdateItem(it.id, 'etaDiasEstimados', etaDiasEstimados);
});
```

## LOC Audit

| File | Before | After | Budget |
|---|---|---|---|
| `PresupuestoDisponibilidadFields.tsx` | new | 92 | ≤100 |
| `BulkAplicarDisponibilidadButton.tsx` | new | 93 | ≤250 |
| `AddItemModal.tsx` | 213 | 250 | ≤250 |
| `PresupuestoItemRow.tsx` | 62 | 110 | ≤250 |
| `PresupuestoItemsTable.tsx` | 236 | 250 | ≤250 |

All files at or within budget.

## Test Results

```
pnpm type-check → GREEN (packages/shared tsc --noEmit clean)

pnpm --filter @ags/sistema-modular test:entregas:
✔ [ENT-01] computeSemaforo classifies verde/amarillo/rojo/sin_eta correctly
✔ [ENT-02] computeEtaFecha computes fechaAceptacion + etaDiasEstimados correctly
✔ [ENT-03] buildEntregaRows resolves ppto→req→oc→imp chain via presupuestoItemId
✔ [ENT-04] items sin etaDiasEstimados → semaforo = sin_eta (no crash)
✔ [ENT-05] item con importacion.estado=recibido → semaforo = entregado
✔ [ENT-06] item sin requerimiento (stock available) sigue mostrando row

tests 6 | pass 6 | fail 0 — exit 0
```

## Commits

| Hash | Message |
|---|---|
| 09d2612 | feat(16-04): create PresupuestoDisponibilidadFields sub-component |
| 8e8b5ea | feat(16-04): integrate PresupuestoDisponibilidadFields in AddItemModal + ATP auto-default |
| 6fc9ab7 | feat(16-04): inline disponibilidad editing in ItemRow + BulkAplicarDisponibilidadButton |

## Deviations from Plan

**[Rule 1 - Refactor] Extracted TaxPreview to module-level component**
- **Found during:** Task 2
- **Issue:** Adding the ~50 lines of Phase 16 code pushed AddItemModal to 280 LOC. The `taxPreview` inline function was identical in functionality to a proper named component.
- **Fix:** Extracted `TaxPreview` as a module-level `function TaxPreview({ categoria, subtotal, sym })` in the same file. No behavior change.
- **Files modified:** `apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx`
- **Commit:** 8e8b5ea

Otherwise — plan executed exactly as specified. TDD flag noted in plan but no dedicated test file was specified for Wave 2 UI components; the verification requirement was `pnpm type-check` GREEN + `test:entregas` no-regression, both confirmed.

## Next Steps

- **16-05** (Wave 3 — hook + page): `useEntregas` hook (loads Firestore presupuestos/reqs/OCs/importaciones, delegates to `buildEntregaRows`) + `EntregasList.tsx` visor de cumplimiento page + sidebar entry at `/entregas`.

## Self-Check: PASSED

Files exist:
- FOUND: apps/sistema-modular/src/components/presupuestos/PresupuestoDisponibilidadFields.tsx (92 LOC)
- FOUND: apps/sistema-modular/src/components/presupuestos/BulkAplicarDisponibilidadButton.tsx (93 LOC)
- FOUND: apps/sistema-modular/src/components/presupuestos/AddItemModal.tsx (250 LOC)
- FOUND: apps/sistema-modular/src/components/presupuestos/PresupuestoItemRow.tsx (110 LOC)
- FOUND: apps/sistema-modular/src/components/presupuestos/PresupuestoItemsTable.tsx (250 LOC)

Commits exist:
- FOUND: 09d2612 feat(16-04): create PresupuestoDisponibilidadFields sub-component
- FOUND: 8e8b5ea feat(16-04): integrate PresupuestoDisponibilidadFields in AddItemModal + ATP auto-default
- FOUND: 6fc9ab7 feat(16-04): inline disponibilidad editing in ItemRow + BulkAplicarDisponibilidadButton
