# Phase 1: Stock — Reservas, Movimientos, Requerimientos y OC — Research

**Researched:** 2026-04-03
**Domain:** Stock management — reservation, movements, purchase requirements, purchase orders
**Confidence:** HIGH (all findings verified directly in codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reserva de posición:**
- La regla base es: presupuesto **aprobado** (estado `aceptado`) → se reserva el stock
- Existe también una **acción manual** en el detalle del presupuesto para anticipar la reserva sin aprobar
- La reserva es una **posición física real** llamada "Reservas" — la unidad se mueve a esa posición (no es solo un flag)
- La unidad reservada lleva referencia al presupuestoId + clienteId + número de presupuesto
- La reserva se **libera** cuando: se genera el remito de entrega (consumo real) O cuando el presupuesto se cancela/vence
- La UI de unidades muestra: **Disponible | Reservado | Total** — tres columnas separadas

**Movimientos de stock:**
- **Consumos**: los registra el admin en nombre del ingeniero
- **Ajustes ±**: cualquier admin puede ajustar con justificación obligatoria. Sin aprobación adicional.
- **Transferencias**: cubre cambio de posición física en depósito E inter-ingeniero en el mismo flujo
- **Reposición de minikit**: se origina desde el inventario del ingeniero, botón "Reponer desde depósito"
  - El sistema propone la cantidad por defecto (déficit hasta completar el minikit)
  - La cantidad es **editable**
- **Granularidad**: artículos con número de serie se tracean por unidad individual; consumibles/repuestos se mueven por cantidad

**Requerimientos: trigger automático:**
- Trigger principal: presupuesto pasa a estado **aceptado**
- También disponible como **acción manual desde el presupuesto** (botón "Generar requerimiento de compra")
- **Condición de generación**: `qty_disponible - qty_presupuesto` vs `stock_mínimo` del artículo
- Solo aplica a ítems de presupuesto con `stockArticuloId` seteado
- **Duplicados entre presupuestos**: un requerimiento por presupuesto (no se acumula)

**Grilla de requerimientos:**
- Edición inline: **proveedor + urgencia + cantidad** directamente en la fila
- El resto de campos (artículo, origen, presupuesto) es solo lectura en la grilla
- Roles: **cualquier admin** puede cargar reqs manuales, asignar proveedor y generar OC

**Generar OC:**
- Flujo: usuario selecciona requerimientos (checkboxes) → botón "Generar OC" → **una OC por proveedor distinto**
- La OC se precompone con artículos + cantidades del requerimiento, proveedor preseleccionado
- El usuario **completa los precios unitarios** y condición de pago antes de confirmar
- Al generar la OC, el requerimiento pasa a estado **"en OC"** con link a la OC generada
- El requerimiento pasa a "completado" cuando el alta de stock confirma la recepción

### Claude's Discretion
(ninguno explícito — todas las decisiones de implementación de detalle quedan a criterio del implementador dentro de los patrones del proyecto)

### Deferred Ideas (OUT OF SCOPE)
- **Comex / DUAs / Importaciones**: fase siguiente
- **Portal del proveedor**: backlog futuro
- **Stock por OT**: consumos automáticos vinculados al cierre de OT — backlog futuro
</user_constraints>

---

## Summary

This phase completes the stock operational cycle. The codebase already has significant infrastructure in place: types, services, pages, and components for all four capability areas exist in some form. The work is primarily about extending and connecting existing pieces rather than building from scratch.

The most important discovery is that `PresupuestoEstado` does NOT include an `aprobado` state — the equivalent is `aceptado`. All trigger logic must listen for estado change to `'aceptado'`, not `'aprobado'`. The estado change happens via `handleEstadoChange` in `usePresupuestoEdit.ts` / `usePresupuestoActions.ts`, which calls `presupuestosService.update()`. The right hook point for auto-req generation is inside `presupuestosService.update()` when `data.estado === 'aceptado'`.

The `RequerimientoCompra` type and `requerimientosService` are complete and ready to use. The `RequerimientosList` page exists but needs checkboxes, inline editing (proveedor/urgencia/cantidad), and the "Generar OC" button. The `OCEditor` is a full-page route — to pre-populate it from requirements, the recommended approach is React Router navigation state (`navigate('/stock/ordenes-compra/nuevo', { state: { requerimientos: [...] } })`).

The "Reservas" position needs to be created as a `PosicionStock` document in Firestore (a normal position with a known code/name), and the `UnidadStock.ubicacion` field updated to point to it. The `UnidadesList` needs aggregated columns (Disponible/Reservado/Total) which require client-side grouping by `articuloId` and filtering by `estado`.

**Primary recommendation:** Hook into `presupuestosService.update()` for auto-req generation. Use React Router state to pre-populate OCEditor. Extend `RequerimientosList` with inline editing and multi-select. Add "Reservas" as a standard PosicionStock.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase Firestore | ^12.11.0 | Persistence, real-time subscriptions | Project standard |
| React 19 | ^19.2.3 | UI framework | Project standard |
| React Router DOM | ^7.12.0 | Routing, navigation state for OC pre-population | Project standard |
| TypeScript | ~5.8.2 | Type safety | Project standard |
| Tailwind CSS | ^3.4.14 | Styling | Project standard |

### Supporting (project-internal)
| Pattern | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| `useUrlFilters` hook | `hooks/useUrlFilters.ts` | All list page filter state | ALL list filters — never `useState` |
| `cleanFirestoreData()` | `services/firebase.ts` | Clean top-level undefineds | Top-level fields before Firestore write |
| `deepCleanForFirestore()` | `services/firebase.ts` | Clean nested undefineds | Nested objects (e.g., `ubicacion`) |
| `createBatch()` + `batchAudit()` | `services/firebase.ts` | Atomic writes with audit trail | ALL mutations |
| `getCreateTrace()` / `getUpdateTrace()` | `services/firebase.ts` | Add createdBy/updatedBy traces | ALL creates/updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Navigation state for OC pre-population | New collection `oc_drafts` | Navigation state is simpler, no cleanup needed |
| Separate `reservas_stock` collection | Flag on `UnidadStock` | Moving unit to Reservas position is the locked decision — physical movement required |
| Inline editing with local state | Separate edit modal | Locked decision requires inline editing in grilla |

**No installation needed** — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

```
services/
  stockService.ts          # Add: reservasService, extend unidadesService
  presupuestosService.ts   # Extend: add auto-req trigger in update()

pages/stock/
  RequerimientosList.tsx   # Extend: checkboxes, inline edit, Generar OC button
  UnidadesList.tsx         # Extend: Disponible/Reservado/Total columns
  InventarioIngenieroPage.tsx  # Extend: "Reponer desde depósito" button
  OCEditor.tsx             # Extend: accept pre-populated items via route state

components/stock/
  ReservarStockModal.tsx   # New: triggered from PresupuestoDetail (manual reservation)
  CreateMovimientoModal.tsx # Extend: add 'reserva' and 'liberacion_reserva' types

hooks/
  useRequerimientoInlineEdit.ts  # New: manages inline editing state for RequerimientosList
  useGenerarOC.ts                # New: handles multi-req → OC generation logic
```

### Pattern 1: Auto-Req Trigger (Hook into presupuestosService.update)

**What:** When `presupuestosService.update()` is called with `data.estado === 'aceptado'`, fetch presupuesto items with `stockArticuloId`, calculate stock vs. minimum, and create requerimientos.
**When to use:** Estado change to `aceptado` from any source (floating modal, sidebar, HeaderBar).

```typescript
// Source: verified in apps/sistema-modular/src/services/presupuestosService.ts lines 232-242
// Pattern: Same as existing lead sync in presupuestosService.update()
if (data.estado === 'aceptado') {
  try {
    const pres = await this.getById(id);
    const itemsConStock = pres?.items.filter(i => i.stockArticuloId) ?? [];
    for (const item of itemsConStock) {
      const articulo = await articulosService.getById(item.stockArticuloId!);
      const unidades = await unidadesService.getAll({ articuloId: item.stockArticuloId!, estado: 'disponible' });
      const qtyDisponible = unidades.length;
      const qtyResultante = qtyDisponible - item.cantidad;
      if (qtyResultante < (articulo?.stockMinimo ?? 0)) {
        const qtyReq = (articulo?.stockMinimo ?? 0) - qtyResultante;
        await requerimientosService.create({
          articuloId: item.stockArticuloId,
          articuloCodigo: articulo?.codigo ?? null,
          articuloDescripcion: articulo?.descripcion ?? item.descripcion,
          cantidad: qtyReq,
          unidadMedida: articulo?.unidadMedida ?? 'unidad',
          motivo: `Auto-generado por presupuesto ${pres.numero}`,
          origen: 'presupuesto',
          origenRef: id,
          estado: 'pendiente',
          presupuestoId: id,
          presupuestoNumero: pres.numero,
          proveedorSugeridoId: articulo?.proveedorIds?.[0] ?? null,
          proveedorSugeridoNombre: null,
          ordenCompraId: null,
          ordenCompraNumero: null,
          solicitadoPor: 'Sistema',
          fechaSolicitud: new Date().toISOString(),
          fechaAprobacion: null,
          urgencia: 'media',
          notas: null,
        });
      }
    }
  } catch (err) {
    console.error('[presupuestosService] Error auto-generating requerimientos:', err);
  }
}
```

### Pattern 2: Reserva de Stock (Physical Move to Reservas Position)

**What:** Find the "Reservas" PosicionStock by a well-known code, then update `UnidadStock.ubicacion` and `UnidadStock.estado` in a batch, plus create a `MovimientoStock`.
**When to use:** Manual button in PresupuestoDetail, or triggered alongside estado change to `aceptado`.

```typescript
// Source: verified patterns from stockService.ts and MovimientoStock type
// The Reservas position must exist in Firestore with a known code, e.g., "RES-001"
const posicionReservas = await posicionesStockService.getAll().then(
  ps => ps.find(p => p.codigo === 'RESERVAS')
);
// In batch:
// 1. unidadesService.update(unidadId, { estado: 'reservado', ubicacion: { tipo: 'posicion', referenciaId: posicionReservas.id, referenciaNombre: posicionReservas.nombre }, reservadoParaPresupuestoId, reservadoParaClienteId, reservadoParaNumero })
// 2. movimientosService.create({ tipo: 'transferencia', origenTipo: 'posicion', destinoTipo: 'posicion', destinoId: posicionReservas.id, ... })
```

**CRITICAL:** `UnidadStock` type currently has NO `reservadoParaPresupuestoId` field. This field must be added to the shared type or stored in a separate `reservas_stock` collection. The CONTEXT.md suggests updating the unit directly — the type must be extended.

### Pattern 3: Generar OC from Requerimientos (Navigation State)

**What:** From `RequerimientosList`, user selects requerimientos → clicks "Generar OC" → system groups by `proveedorSugeridoId` → navigates to OCEditor for each group with pre-populated state.

```typescript
// Source: verified OCEditor accepts items via React state (lines 32, 53)
// OCEditor initializes: setItems(oc.items || []) on edit
// For new OC from requirements, use navigate() with state:
const handleGenerarOC = () => {
  const selected = requerimientos.filter(r => selectedIds.has(r.id));
  const porProveedor = groupBy(selected, r => r.proveedorSugeridoId ?? '__sin_proveedor__');
  // For now: navigate to first group, then repeat (or create all in batch)
  for (const [provId, reqs] of Object.entries(porProveedor)) {
    const items: ItemOC[] = reqs.map(r => ({
      id: crypto.randomUUID(),
      articuloId: r.articuloId ?? null,
      articuloCodigo: r.articuloCodigo ?? null,
      descripcion: r.articuloDescripcion,
      cantidad: r.cantidad,
      cantidadRecibida: 0,
      unidadMedida: r.unidadMedida,
      precioUnitario: null,
      moneda: null,
      requerimientoId: r.id,
      notas: null,
    }));
    navigate('/stock/ordenes-compra/nuevo', {
      state: { prefill: { proveedorId: provId, items, requerimientoIds: reqs.map(r => r.id) } }
    });
  }
  // Then update requerimientos to 'en_compra' state after OC creation
};
```

**Note:** OCEditor must be extended to read `location.state.prefill` in its `useEffect`. This is a React Router v7 pattern — `useLocation().state` is typed and safe.

### Pattern 4: Inline Editing in RequerimientosList

**What:** Cells for proveedor, urgencia, cantidad become editable on click. Save on blur/Enter.
**When to use:** Any row in "pendiente" state.

```typescript
// Source: verified RequerimientosList.tsx — currently no inline editing
// Pattern: local editingId state + onBlur save
const [editingCell, setEditingCell] = useState<{ id: string; field: 'cantidad' | 'urgencia' | 'proveedor' } | null>(null);
const [editValue, setEditValue] = useState<string>('');

const handleCellClick = (req: RequerimientoCompra, field: ...) => {
  setEditingCell({ id: req.id, field });
  setEditValue(String(req[field] ?? ''));
};

const handleCellSave = async () => {
  if (!editingCell) return;
  await requerimientosService.update(editingCell.id, { [editingCell.field]: editValue });
  setEditingCell(null);
};
```

### Anti-Patterns to Avoid

- **Using `useState` for filters:** All list page filters MUST use `useUrlFilters`. The existing `RequerimientosList` violates this — it uses `useState` for filters. Fix this while extending the page.
- **Writing `undefined` to Firestore:** Use `null` or omit the field. Always run through `cleanFirestoreData()` or `deepCleanForFirestore()`.
- **Components over 250 lines:** Extract `useRequerimientoInlineEdit` hook and `GenerarOCButton` component to stay under limit.
- **Non-batch Firestore writes:** Always use `createBatch()` for multi-document mutations (reserva = update unidad + create movimiento).
- **Storing reservation data only on UnidadStock:** The `UnidadStock` type needs extending — the reservation reference fields (`reservadoParaPresupuestoId`, etc.) must be added to `@ags/shared` types before implementation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time updates | Manual polling | `onSnapshot` via `service.subscribe()` | Already pattern in all list pages |
| Filter state persistence | `useState` + manual URL sync | `useUrlFilters` hook | Hard rule in project — see MEMORY.md |
| Atomic multi-doc writes | Sequential `await set/update` | `createBatch()` + `batchAudit()` | Audit trail + atomicity |
| Numero sequences (REQ-XXXX, OC-XXXX) | Custom counter | `getNextNumber()` pattern in each service | Already implemented in requerimientosService and ordenesCompraService |
| Proveedor selection | Raw input | `SearchableSelect` component | Existing UI atom, consistent UX |
| Auth traces | Manual uid lookup | `getCreateTrace()` / `getUpdateTrace()` | Adds createdBy/updatedBy automatically |

**Key insight:** The project has a well-established service layer. Every new data operation should follow the `service.methodName()` → `createBatch()` → `batchAudit()` → `batch.commit()` chain.

---

## Common Pitfalls

### Pitfall 1: Wrong Estado Name for "Approved" Presupuesto
**What goes wrong:** Developer looks for `estado === 'aprobado'` but the type is `PresupuestoEstado` with values `borrador | enviado | aceptado | en_ejecucion | anulado | finalizado`. There is NO `aprobado` state.
**Why it happens:** CONTEXT.md uses "presupuesto aprobado" colloquially, but the actual code/type uses `'aceptado'`.
**How to avoid:** Always check `data.estado === 'aceptado'` (not `'aprobado'`) in the trigger.
**Warning signs:** TypeScript error "Type 'aprobado' is not assignable to type PresupuestoEstado".

### Pitfall 2: UnidadStock Type Missing Reservation Fields
**What goes wrong:** Trying to store `reservadoParaPresupuestoId` on `UnidadStock` but TypeScript throws because the field doesn't exist in the shared type.
**Why it happens:** The current `UnidadStock` interface (line 1693 in index.ts) has no reservation reference fields.
**How to avoid:** Add fields to `@ags/shared/types/index.ts` FIRST before any service/component code. Fields needed:
  - `reservadoParaPresupuestoId?: string | null`
  - `reservadoParaPresupuestoNumero?: string | null`
  - `reservadoParaClienteId?: string | null`
**Warning signs:** TypeScript errors on `unidadesService.update()` calls.

### Pitfall 3: RequerimientosList Uses useState for Filters (Existing Bug)
**What goes wrong:** `RequerimientosList.tsx` currently uses `useState` for `filters` (line 35), violating the hard rule that all filters must use `useUrlFilters`.
**Why it happens:** The page was built before `useUrlFilters` was standardized.
**How to avoid:** Migrate to `useUrlFilters` while extending the page. Don't add more `useState` filters on top of the broken pattern.
**Warning signs:** Filter state lost on browser back/forward.

### Pitfall 4: OCEditor Cannot Currently Accept Pre-populated Items via Route State
**What goes wrong:** Navigate to `/stock/ordenes-compra/nuevo` with state, but OCEditor ignores it because `useLocation()` is not read anywhere in the component.
**Why it happens:** OCEditor was built as a standalone create/edit form, not as a destination for programmatic pre-population.
**How to avoid:** Extend `OCEditor.loadInitialData()` to check `location.state?.prefill` on mount (only when `!isEdit`).
**Warning signs:** Items array empty when arriving from Generar OC flow.

### Pitfall 5: Reservas Position Must Exist in Firestore Before Use
**What goes wrong:** Code tries to find the "Reservas" position by code/name but returns `null` if it was never created.
**Why it happens:** PosicionStock documents are created manually through the UI.
**How to avoid:** Either create the Reservas position via a seed/migration step (Wave 0 task), or use `getOrCreate` logic in the reservation service.
**Warning signs:** Silent failures when reserving stock — unit doesn't move because `posicionReservas` is null.

### Pitfall 6: Multiple OC Generation for Multiple Providers (UX Flow)
**What goes wrong:** If selected requirements have 3 different providers, the system needs to create 3 OCs. Navigating to OCEditor 3 times in a loop doesn't work (only the last navigation takes effect).
**Why it happens:** React Router replaces navigation state on each call.
**How to avoid:** Create all OCs directly via `ordenesCompraService.create()` in a loop, then navigate to a list or confirmation. Or: generate one at a time, showing a progress modal.
**Warning signs:** Only one OC created out of expected three.

---

## Code Examples

Verified patterns from existing codebase:

### Service Pattern — Create with Batch and Audit
```typescript
// Source: apps/sistema-modular/src/services/stockService.ts line 675
async create(data: Omit<MovimientoStock, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const payload = deepCleanForFirestore({
    ...data,
    ...getCreateTrace(),
    createdAt: Timestamp.now(),
  });
  const batch = createBatch();
  batch.set(doc(db, 'movimientosStock', id), payload);
  batchAudit(batch, { action: 'create', collection: 'movimientos_stock', documentId: id, after: payload as any });
  await batch.commit();
  return id;
},
```

### Auto-Trigger Hook Point in presupuestosService.update()
```typescript
// Source: apps/sistema-modular/src/services/presupuestosService.ts lines 232-242
// EXISTING pattern for lead sync — replicate for requerimientos:
if (data.estado) {
  try {
    const pres = await this.getById(id);
    if (pres?.origenTipo === 'lead' && pres.origenId) {
      await leadsService.syncFromPresupuesto(pres.origenId, pres.numero, data.estado);
    }
    // ADD: if data.estado === 'aceptado', generate requerimientos
  } catch (err) {
    console.error('[presupuestosService] Error syncing...', err);
  }
}
```

### ItemOC with requerimientoId (already in type)
```typescript
// Source: packages/shared/src/types/index.ts line 827
export interface ItemOC {
  id: string;
  articuloId?: string | null;
  articuloCodigo?: string | null;
  descripcion: string;
  cantidad: number;
  cantidadRecibida: number;
  unidadMedida: string;
  precioUnitario?: number | null;
  moneda?: 'ARS' | 'USD' | 'EUR' | null;
  requerimientoId?: string | null;  // <-- FK already exists for linking
  notas?: string | null;
}
```

### UnidadesList Aggregation (for Disponible/Reservado/Total columns)
```typescript
// Source: current UnidadesList.tsx shows flat list by unit — needs grouping by articuloId
// Derived state (no new service needed):
const aggregated = useMemo(() => {
  const byArticulo = new Map<string, { disponible: number; reservado: number; asignado: number }>();
  unidades.forEach(u => {
    const prev = byArticulo.get(u.articuloId) ?? { disponible: 0, reservado: 0, asignado: 0 };
    if (u.estado === 'disponible') prev.disponible++;
    else if (u.estado === 'reservado') prev.reservado++;
    else if (u.estado === 'asignado') prev.asignado++;
    byArticulo.set(u.articuloId, prev);
  });
  return byArticulo;
}, [unidades]);
```

### EstadoRequerimiento State Machine
```typescript
// Source: packages/shared/src/types/index.ts line 2212
// pendiente → aprobado → en_compra → comprado
// Field 'en_compra' maps to CONTEXT.md's "en OC" concept
export type EstadoRequerimiento = 'pendiente' | 'aprobado' | 'en_compra' | 'comprado' | 'cancelado';
// Note: 'en_compra' is the value to set when OC is generated (not 'en_oc')
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual req creation only | Auto-trigger on presupuesto `aceptado` | Reduces manual work for ops team |
| Flat UnidadesList (estado column) | Aggregated Disponible/Reservado/Total | Better visibility for sales/ops |
| RequerimientosList: no inline edit | Inline edit proveedor/urgencia/cantidad | Faster procurement workflow |
| OC created from scratch | OC pre-populated from requirements | Reduces data entry errors |

**Existing but not connected yet:**
- `ItemOC.requerimientoId` field exists in type but is never set by any code path
- `EstadoRequerimiento.en_compra` exists but the transition to it is never triggered automatically
- `presupuestosService.update()` already has a side-effect pattern for leads — ready for requerimientos

---

## Open Questions

1. **Reserva física: unidades serializadas vs. por cantidad**
   - What we know: `UnidadStock` represents individual units with optional `nroSerie`. For consumables without serial numbers, there may be many units of the same article.
   - What's unclear: When reserving for a presupuesto with `cantidad: 3`, does the system automatically pick 3 available units? Or does the admin select them?
   - Recommendation: Auto-select (FIFO by `createdAt`) for serialized items if quantity = 1; for consumables, just track count via an aggregate. Clarify with user in planning.

2. **Reposición de minikit: which service creates the MovimientoStock?**
   - What we know: `InventarioIngenieroPage` uses `useInventarioIngeniero` hook which has `handleDevolver`, `handleConsumir`, `handleTransferir` — but no `handleReponer`.
   - What's unclear: The "Reponer desde depósito" flow needs to: (a) move units from depósito to minikit, (b) create a MovimientoStock of type `transferencia`, (c) optionally create a Remito.
   - Recommendation: Add `handleReponer` to `useInventarioIngeniero` hook. The planner should create this as a discrete task.

3. **Multi-OC generation UX when requirements span 3+ providers**
   - What we know: The locked decision says "una OC por proveedor" but the UI flow for creating N OCs sequentially is not defined.
   - What's unclear: Does the user confirm each OC separately (edit prices) or are all created as drafts at once?
   - Recommendation: Create all OCs as `borrador` in a single operation, then let the user complete prices from OCList. This avoids the multi-navigation problem.

---

## Validation Architecture

No test infrastructure exists in `apps/sistema-modular` (no jest.config, no vitest.config, no `*.test.*` files found outside reportes-ot). The app is a Vite + Electron app without any test setup. Given this, all verification for this phase is manual UI smoke testing.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test framework configured in apps/sistema-modular |
| Config file | None — needs Wave 0 setup if automated testing is desired |
| Quick run command | `pnpm dev` (manual verification in browser at localhost:3001) |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RES-01 | Presupuesto aceptado → requerimientos auto-generados | manual-only | Open presupuesto, change estado to aceptado, check RequerimientosList | N/A |
| RES-02 | Manual "Reservar stock" button in presupuesto detail | manual-only | Click button, verify unit moves to Reservas position | N/A |
| RES-03 | UnidadesList shows Disponible/Reservado/Total | manual-only | Verify columns in `/stock/unidades` | N/A |
| RES-04 | RequerimientosList inline edit proveedor/urgencia/cantidad | manual-only | Edit a cell, verify Firestore update | N/A |
| RES-05 | "Generar OC" creates one OC per provider from selected reqs | manual-only | Select 2 reqs same provider → 1 OC created | N/A |
| RES-06 | Requerimiento estado → `en_compra` after OC generated | manual-only | Check estado in RequerimientosList after Generar OC | N/A |
| RES-07 | Reposición minikit from InventarioIngenieroPage | manual-only | Click "Reponer", verify MovimientoStock created | N/A |
| RES-08 | Ajuste de stock with mandatory justificación | manual-only | Register ajuste without motivo — should block | N/A |

### Sampling Rate
- **Per task commit:** Run `pnpm dev` and manually verify the specific feature touched
- **Per wave merge:** Full smoke test of all 8 behaviors above
- **Phase gate:** All 8 manual checks green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Create "Reservas" PosicionStock document in Firestore (seed data, not code)
- [ ] Add reservation fields to `UnidadStock` type in `packages/shared/src/types/index.ts`
- [ ] Verify `requerimientosService` is exported from `firebaseService.ts` barrel (currently in `importacionesService.ts`, may need re-export check)

*(No automated test files needed given no test framework is configured — Wave 0 is data/type setup only)*

---

## Sources

### Primary (HIGH confidence — directly verified in codebase)
- `packages/shared/src/types/index.ts` — UnidadStock (line 1693), MovimientoStock (1840), RequerimientoCompra (2238), OrdenCompra (841), ItemOC (827), PresupuestoItem (748), PresupuestoEstado (704), EstadoRequerimiento (2212)
- `apps/sistema-modular/src/services/stockService.ts` — unidadesService (279), movimientosService (629), posicionesStockService (7)
- `apps/sistema-modular/src/services/importacionesService.ts` — requerimientosService (191)
- `apps/sistema-modular/src/services/presupuestosService.ts` — presupuestosService.update() hook point (217), ordenesCompraService (372)
- `apps/sistema-modular/src/pages/stock/RequerimientosList.tsx` — current state, missing features
- `apps/sistema-modular/src/pages/stock/OCEditor.tsx` — structure, items state, navigation
- `apps/sistema-modular/src/pages/stock/UnidadesList.tsx` — current columns, useUrlFilters usage
- `apps/sistema-modular/src/hooks/usePresupuestoEdit.ts` — handleEstadoChange (314)
- `apps/sistema-modular/src/hooks/usePresupuestoActions.ts` — handleSuggestAutorizado triggers aceptado (75)
- `apps/sistema-modular/src/components/stock/CreateRequerimientoModal.tsx` — existing fields, create pattern

### Secondary (MEDIUM confidence)
- MEMORY.md — `useUrlFilters` hard rule, 250-line component limit, `deepCleanForFirestore` usage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly in codebase, no guesswork
- Architecture: HIGH — all integration points verified in source files
- Pitfalls: HIGH — discovered directly by reading existing code, not assumptions
- Type gaps: HIGH — confirmed by reading UnidadStock type (no reservation fields)

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable codebase, no external dependencies changing)
