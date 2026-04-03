---
plan: 02-06
phase: 02-comex-importaciones-y-despachos
status: completed
commit: 7e3f762
---

# Plan 02-06 Summary — useIngresarStock + ImportacionIngresarStockModal

## What Was Done

### Task 1 — useIngresarStock hook (`apps/sistema-modular/src/hooks/useIngresarStock.ts`)
- Created `RecepcionItem` interface: item, posicionId, posicionNombre, nrosSerie[], cantidadReal
- `ingresarStock(imp, recepciones)` returns `Promise<boolean>`
- Derives `monedaOC` from `imp.items?.[0]?.moneda` (Importacion has no `.moneda` field)
- Computes `valorTotalImportacion` and `totalGastosEnMonedaOC` for prorrateo
- Per item, per serial (or null × cantidadReal if no serials):
  - Creates `UnidadStock` in `unidades` collection with correct `UbicacionStock` shape
  - Creates `MovimientoStock` (tipo='ingreso') in `movimientosStock` collection
  - Both include `batchAudit` entries
- Auto-closes `requerimientos_compra` docs when `cantidadReal >= cantidadPedida`
- Updates `importaciones` doc: `stockIngresado=true` + `cantidadRecibida` per item
- All ops in single `createBatch()` → atomic commit

### Task 2 — ImportacionIngresarStockModal (`apps/sistema-modular/src/components/stock/ImportacionIngresarStockModal.tsx`)
- Per-item rows: cantidad real (editable, defaults to cantidadPedida), posición destino (SearchableSelect excluding RESERVAS), seriales textarea (optional)
- Loads posiciones on mount from `posicionesStockService.getAll(true)`
- Footer shows error message and "Confirmar ingreso" / "Cancelar" buttons
- Calls `ingresarStock(imp, recepciones)` and closes on success

### Task 3 — ImportacionDetail wired (`apps/sistema-modular/src/pages/stock/ImportacionDetail.tsx`)
- Added `ImportacionItemsSection` to detail layout (first section in main column)
- Added "Ingresar al stock" button in header, visible when `estado === 'recibido' && !stockIngresado`
- Modal mounted conditionally; `onSuccess` calls `loadData()` to re-fetch updated importacion

## Deviations From Plan
- Plan's `<interfaces>` block had wrong field names (`unidadStockId`, `nota`, `unidades_stock`, `movimientos_stock`). Used actual codebase names: `unidadId`, `motivo`, `unidades`, `movimientosStock`
- `Importacion` has no `moneda` field — derived from `items[0].moneda`
- `monedaCosto` is `'ARS' | 'USD' | null` — EUR items get `null`
- Used `observaciones` field on UnidadStock to record importacion reference (no `importacionId` field in type)

## Verification
- TypeScript: zero errors in new files; pre-existing errors in unrelated modules unchanged
- COMEX-06: button visible on recibido state, modal creates stock atomically
- COMEX-07: requerimientos auto-closed when qty fulfilled
- stockIngresado=true prevents re-ingestion
