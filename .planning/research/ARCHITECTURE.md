# Architecture Patterns — Circuito Comercial Completo

**Domain:** Commercial pipeline integration on top of existing AGS Plataforma v1.0
**Researched:** 2026-04-18
**Confidence:** HIGH — based on direct codebase inspection

---

## Existing Architecture Baseline (confirmed by reading source)

### Firestore Collections (confirmed active)

| Collection | Service file | Key notes |
|---|---|---|
| `leads` | `leadsService.ts` | Will rename → "tickets" eventually; files stay as-is |
| `presupuestos` | `presupuestosService.ts` | Has `conceptoServicioId` FK on items already |
| `ordenes_compra` | `presupuestosService.ts` | Same file, `ordenesCompraService` |
| `reportes` | `otService.ts` | OT collection, NOT `ordenes_trabajo` |
| `solicitudesFacturacion` | `facturacionService.ts` | Already exists, full CRUD + subscribe |
| `conceptos_servicio` | `presupuestosService.ts` | Already exists; `valorBase * factorActualizacion` price model |
| `tipos_servicio` | `importacionesService.ts` | Simple list, NO price rules yet |
| `requerimientos` | `importacionesService.ts` | Auto-created from presupuesto on stock deficit |
| `stock/articulos` | `stockService.ts` | With `stockMinimo` |
| `stock/unidades` | `stockService.ts` | Per-unit, `estado: disponible|reservado|...` |
| `tiposEquipoPlantillas` | `tiposEquipoService.ts` | Contrato catalog |
| `categorias_presupuesto` | `presupuestosService.ts` | Tax rules per category |
| `establecimientos` | `establecimientosService.ts` | Has `lat`, `lng` already |
| `_counters` | `otService.ts` | Atomic counter pattern for OT numbers |

### Service Patterns (confirmed)

- All services: `createBatch()` + `batchAudit()` pattern — write + audit in one atomic commit.
- `deepCleanForFirestore()` for nested objects; `cleanFirestoreData()` for top-level.
- `Timestamp.now()` on write; `.toDate().toISOString()` on read.
- `onSnapshot()` subscription wrapper for real-time (returns unsubscribe fn).
- `serviceCache.ts`: 2-min TTL in-memory cache, `getCached / setCache / invalidateCache`.
- All list pages: `useUrlFilters` hook (URL-persisted, typed schema).
- Hook pattern: `useXxxForm` for form state, `useXxxActions` for side-effects.

### Existing Auto-trigger Chain (confirmed)

```
presupuestosService.update(estado → 'aceptado')
  → leadsService.syncFromPresupuesto()          [updates lead estado + posta]
  → requerimientosService.create()              [if stock deficit]
  → reservasService.reservar()                  [reserves available units]

otService.update(estadoAdmin)
  → leadsService.syncFromOT()                   [updates lead estado + posta]
```

All triggers fire **client-side** inside the service `.update()` method. No Cloud Functions exist.

### Email Pattern (confirmed)

`gmailService.ts` — browser-side OAuth call to Gmail REST API. Used in contratos already.
Accepts: `to[]`, `cc[]`, `subject`, `htmlBody`, `attachments[]` (base64).
Requires: `useGoogleOAuth` hook to get access token first.

### Excel Export Pattern (confirmed)

`apps/sistema-modular/src/utils/exportVentasInsumosExcel.ts`:
- `xlsx` (SheetJS free tier) — `XLSX.utils.aoa_to_sheet()` → `XLSX.writeFile()`
- Pure function: receives typed rows, returns void (triggers browser download)
- Used from a modal, not a hook — exported from `utils/`

### Distance / Geocoding (confirmed)

`geocodingService.ts` uses Google Maps JS SDK (same key as AddressAutocomplete).
`establecimientos` already has `lat` and `lng` fields.
No distance-matrix calls exist yet — only forward geocoding.

---

## Capability-by-Capability Integration Design

### (a) Catálogo de Servicios con Precios por Contrato + Km

**Decision: extend `conceptos_servicio`, do NOT create `serviciosComerciales`.**

`ConceptoServicio` already has `valorBase`, `factorActualizacion`, `moneda`, `categoriaPresupuestoId`, `codigo`. The type lives in `@ags/shared`. Adding km-range pricing and contract-type overrides is an extension of this same concept, not a new entity.

**New fields on `ConceptoServicio`** (extend shared type):
```typescript
kmRangos?: Array<{
  desde: number;    // km mínimo inclusive
  hasta: number;    // km máximo (null = sin límite)
  factor: number;   // multiplicador sobre valorBase
}> | null;

preciosContrato?: Array<{
  tipoContrato: 'anual' | 'mensual' | 'visita';
  factor: number;   // multiplicador sobre valorBase para contratos
}> | null;
```

**Price computation function** (pure, in `packages/shared/src/utils.ts`):
```typescript
computePrecioServicio(
  concepto: ConceptoServicio,
  distanciaKm: number,
  tipoContrato?: string,
): number
// = valorBase * factorActualizacion * kmFactor(distanciaKm) * contratoFactor
```

**Where km distance comes from:**
- `establecimientos.lat` + `establecimientos.lng` already stored.
- AGS HQ coordinates stored as env var `VITE_AGS_LAT` / `VITE_AGS_LNG`.
- `haversineDistanceKm(lat1, lng1, lat2, lng2)` pure function in `utils.ts` — no API call needed for driving approximation at the quote stage. If exact driving distance is needed later, Google Distance Matrix API can be added to `geocodingService.ts`.
- Distance is computed **client-side at quote time** in `usePresupuestoEdit` or a new `usePrecioConcepto` hook — not stored permanently on the concepto doc.

**New UI:**
- `pages/conceptos-servicio/` — CRUD list + form modal (sistema-modular only)
- `components/presupuestos/ConceptoServicioPicker.tsx` — selector in presupuesto item editor showing computed price for the target establecimiento

**Modified services:**
- `conceptosServicioService` in `presupuestosService.ts` — add `kmRangos` / `preciosContrato` fields to create/update
- `@ags/shared` types — extend `ConceptoServicio` interface

**Collections: MODIFY `conceptos_servicio`, no new collection.**

---

### (b) Flujo Automático de Derivación

**Design principle: keep client-side, extend existing service chain.**

No Cloud Functions — the existing pattern (presupuestosService → leadsService chain) already works and is simpler to debug and deploy. Cloud Functions would add deployment complexity, cold starts, and a separate deploy step.

**New states required:**

`TicketEstado` already has `esperando_oc`, `espera_importacion`, `en_coordinacion`. The full pipeline is already modeled. No new states needed in the type — the mapping tables just need to be filled in.

`PresupuestoEstado` already has `en_ejecucion`. For "awaiting OC from client" we use `enviado` (already exists).

**New auto-ticket when presupuesto has no ticket origin:**

```typescript
// In presupuestosService.create():
if (!presupuestoData.origenId || presupuestoData.origenTipo !== 'lead') {
  const ticketId = await leadsService.create({
    razonSocial: presupuestoData.clienteNombre,
    motivoLlamado: inferMotivoFromPresupuesto(presupuestoData.tipo),
    estado: 'presupuesto_pendiente',
    presupuestosIds: [presRef.id],
    ...
  });
  // Link back
  await presupuestosService._linkTicket(presRef.id, ticketId);
}
```

This is a new private method `_autoCreateTicket()` inside `presupuestosService`, calling `leadsService.create()`. Same pattern as `_generarRequerimientosAutomaticos()` that already exists.

**OC received → derive to create OT:**

When `ordenesCompraService.update(estado → 'aprobada')` is called:
- Existing `presupuesto.ordenesCompraIds` links OC to presupuesto.
- New: fire `leadsService.update(leadId, { estado: 'esperando_oc' })` on OC create, then `{ estado: 'en_coordinacion' }` when OC is approved.
- The coordinator then creates the OT manually (prefill from presupuesto — already partially supported via `presupuestoOrigenId` on OT).

**Importación detection:**

When `_generarRequerimientosAutomaticos()` creates reqs pointing to imported articles:
- Check `articulo.proveedorIds` — if provider is foreign (new flag `esImportacion: boolean` on `Articulo`), also update ticket to `espera_importacion`.
- No new collection needed; it's a conditional inside the existing auto-req method.

**New auto-ticket + OT link fields:**

`Presupuesto` already has `origenTipo / origenId`. Add:
```typescript
autoTicketId?: string | null;   // if presupuesto was created without ticket and one was auto-generated
```

**New/modified services:**

| Service | Change |
|---|---|
| `presupuestosService.create()` | Add `_autoCreateTicket()` call when no origenId |
| `ordenesCompraService.update()` | Add ticket estado sync on OC state change |
| `leadsService` | No structural change; just new estado transitions mapped |

**Collections: NO new collections. All state lives in `leads`, `presupuestos`, `ordenes_compra`.**

---

### (c) Planificación de Stock Extendida

**Decision: compute on-demand with multi-query aggregation. Do NOT denormalize `qty_disponible_amplio` on `articulos`.**

Rationale: denormalization on `articulos` would require updating that field on every reserva, OC item receive, and requerimiento change — creating a fan-out write problem and risk of drift. The current `_generarRequerimientosAutomaticos()` already does the right calculation (disponible + reservado + tránsito) in memory from three queries. This pattern should become a reusable function.

**New utility: `stockService.computeStockAmplio(articuloId)`**

```typescript
interface StockAmplio {
  disponible: number;      // estado === 'disponible' in unidades
  reservado: number;       // estado === 'reservado'
  enTransito: number;      // sum of pendiente across active OC items
  requeridoPorPresupuestos: number; // sum from active requerimientos for this articulo
  proyectado: number;      // disponible - reservado + enTransito
  alertaBajo: boolean;     // proyectado < stockMinimo
  debeImportar: boolean;   // proyectado < requerido AND articulo.esImportacion
}
```

This function replaces the inline computation that already exists in `_generarRequerimientosAutomaticos()`. It does 3 parallel `Promise.all()` queries:
1. `unidadesService.getAll({ articuloId })` — filter by estado client-side
2. `ordenesCompraService.getAll()` — filter active OCs for this article
3. `requerimientosService.getAll({ articuloId })` — filter pending reqs

Performance: acceptable for individual-item views. For list views showing stock for all items, batch the OC query once and build a map (same approach as existing `_generarRequerimientosAutomaticos`).

**Impact on existing reservas:** None — no schema change on `articulos` or `unidades`.

**New UI:**
- `StockAmplioIndicator` component — badge showing disponible/tránsito/reservado breakdown
- Used in `PresupuestoItemRow` and stock list pages

**Modified:**
- `stockService.ts` — add `computeStockAmplio()` export
- `presupuestosService._generarRequerimientosAutomaticos()` — refactor to call `computeStockAmplio()` instead of inline calculation
- `Articulo` type in shared — add optional `esImportacion?: boolean` flag

**Collections: NO new collections. Purely computational.**

---

### (d) Aviso a Facturación

**Decision: use existing `solicitudesFacturacion` collection (already operational), add mail trigger.**

`facturacionService.ts` with collection `solicitudesFacturacion` already exists, full CRUD + subscribe. `SolicitudFacturacion` type exists in shared. The service already has `registrarFactura()` and `registrarCobro()`.

The "aviso" flow is:
1. OT reaches `CIERRE_ADMINISTRATIVO` → existing `otService.update()` already handles this state.
2. Create `solicitudesFacturacion` doc (already works via `facturacionService.create()`).
3. NEW: fire email via `gmailService` after creating the solicitud.

**New trigger in `otService.update(estadoAdmin → 'CIERRE_ADMINISTRATIVO')`:**

```typescript
// After existing leadsService.syncFromOT() call:
const solicitudId = await facturacionService.create({
  otNumber: id,
  presupuestoId: ot.presupuestoOrigenId,
  clienteId: ot.clienteId,
  estado: 'pendiente',
  // ... other fields from OT
});
await sendAvisoFacturacionEmail(solicitudId, ot, presupuesto);
```

**Mail template:** HTML template function `buildAvisoFacturacionHtml(ot, presupuesto, solicitudId)` in `utils/mailTemplates.ts` (new file). Uses same `gmailService.sendGmail()` pattern. Recipients: `administracion` role users fetched from `personalService.getByRole('administracion')`.

**No new collection needed.** `solicitudesFacturacion` IS the aviso mechanism. Add a `otNumber` field if not already on `SolicitudFacturacion` type.

**Modified:**
- `otService.ts` — add auto-solicitud creation on `CIERRE_ADMINISTRATIVO`
- `SolicitudFacturacion` type — add `otNumber` field if missing
- New: `utils/mailTemplates.ts` — `buildAvisoFacturacionHtml()`

**Collections: `solicitudesFacturacion` (existing). No new collection.**

---

### (e) Exportables Excel

**Decision: same `utils/` pure-function pattern as `exportVentasInsumosExcel.ts`.**

New files in `apps/sistema-modular/src/utils/`:

| File | Export | Triggered from |
|---|---|---|
| `exportPresupuestosExcel.ts` | `exportPresupuestosExcel(rows, filters)` | PresupuestosListPage action button |
| `exportPipelineComercialExcel.ts` | `exportPipelineComercialExcel(rows)` | Dashboard comercial or tickets page |
| `exportStockReservasExcel.ts` | `exportStockReservasExcel(rows)` | Stock page |

All follow the same pattern: receive typed rows array, call `XLSX.utils.aoa_to_sheet()`, `XLSX.writeFile()`. No hooks needed — pure function called from component onClick.

---

## Multi-App Considerations

| Capability | sistema-modular | portal-ingeniero | reportes-ot |
|---|---|---|---|
| Catálogo servicios + km | Full CRUD + picker en editor | Read-only (ver precio de OT) | NO TOCAR |
| Auto-derivación (ticket auto) | Full UI + triggers | Ticket visible si asignado | NO TOCAR |
| Stock amplio | Full UI + computeStockAmplio() | Ver inventario propio (ya existe) | NO TOCAR |
| Aviso facturación | Trigger en OT + UI módulo facturación | No aplica | NO TOCAR |
| Exportables Excel | Utility + botón en list pages | No aplica | NO TOCAR |

`portal-ingeniero` touches: OT detail and stock view. `computeStockAmplio()` could be called from portal if it needs extended view — but it lives in a service file that portal doesn't import yet. If needed, move the function to `packages/shared/src/utils.ts` (pure, no Firebase dep) and have each app call Firebase independently.

`reportes-ot` is not touched by any of these capabilities.

---

## Build Order (by technical dependency)

### Phase 1 — Data layer foundation (no UI blockers)
1. **Extend `ConceptoServicio` type** in `@ags/shared` (add `kmRangos`, `preciosContrato`).
2. **Add `computePrecioServicio()` + `haversineDistanceKm()`** to `packages/shared/src/utils.ts`.
3. **Add `computeStockAmplio()`** to `stockService.ts` — refactor existing inline logic.
4. **Extend `Articulo` type** with `esImportacion?: boolean`.
5. **Add `autoTicketId`** field to `Presupuesto` type.
These are pure type/function changes. No UI, no breaking changes on existing data.

### Phase 2 — Service triggers (client-side chain extensions)
6. **`presupuestosService.create()` — auto-ticket** when `origenTipo !== 'lead'`.
7. **`ordenesCompraService.update()` — ticket sync** on OC state changes.
8. **`otService.update()` — auto `solicitudesFacturacion` + mail** on `CIERRE_ADMINISTRATIVO`.
9. **`_generarRequerimientosAutomaticos()` — refactor** to use `computeStockAmplio()` + detect `esImportacion`.
These extend existing methods; each is independently testable.

### Phase 3 — Catalog UI (no deps on Phase 2)
10. **`pages/conceptos-servicio/`** — CRUD pages for concepto catalog with km-range editor.
11. **`ConceptoServicioPicker`** component in presupuesto item editor with live price preview.

### Phase 4 — Stock UI extension
12. **`StockAmplioIndicator`** component — reuse `computeStockAmplio()`.
13. Integrate into stock list and presupuesto item rows.

### Phase 5 — Facturación UI + mail
14. **`utils/mailTemplates.ts`** — HTML builder for aviso email.
15. Facturación list page improvements (filter by estado, link to OT/presupuesto).
16. Manual "send aviso" button as fallback for cases auto-send missed.

### Phase 6 — Excel exports
17. `exportPresupuestosExcel.ts` + button in presupuestos list.
18. `exportPipelineComercialExcel.ts` + button in tickets/comercial view.

---

## Component Boundaries

### New service additions

| Service | Location | Scope |
|---|---|---|
| `computeStockAmplio()` | `stockService.ts` | sistema-modular |
| `_autoCreateTicket()` | `presupuestosService.ts` (private method) | sistema-modular |
| `sendAvisoFacturacionEmail()` | `utils/mailTemplates.ts` (or `facturacionService.ts`) | sistema-modular |
| `haversineDistanceKm()` | `packages/shared/src/utils.ts` | all apps |
| `computePrecioServicio()` | `packages/shared/src/utils.ts` | all apps |

### New hooks

| Hook | Purpose | Size target |
|---|---|---|
| `usePrecioConcepto` | Compute live price from concepto + establecimiento lat/lng | <80 lines |
| `useConceptosServicio` | Cached list load for picker | <60 lines |
| `useStockAmplio(articuloId)` | Wraps `computeStockAmplio()` with loading state | <60 lines |

### New pages (sistema-modular only)

| Page | Route | Pattern |
|---|---|---|
| `pages/conceptos-servicio/` | `/conceptos-servicio` | Standard list + modal (simple entity) |

### No new pages needed for:
- Aviso facturación: extends existing `/facturacion` page
- Stock extendido: extends existing `/stock` page with new component
- Auto-ticket: no UI — fires silently on presupuesto create

---

## Data Flow Summary

```
[Presupuesto creado sin ticket]
  → presupuestosService.create()
  → _autoCreateTicket()              [NEW] → leads doc created
  → _generarRequerimientosAutomaticos()
       → computeStockAmplio()        [NEW refactor]
       → if debeImportar → ticket.estado = 'espera_importacion'

[OC cliente recibida]
  → ordenesCompraService.update(aprobada)
  → leadsService.update(estado = 'en_coordinacion')  [NEW trigger]

[OT → CIERRE_ADMINISTRATIVO]
  → otService.update()
  → leadsService.syncFromOT()        [existing]
  → facturacionService.create()      [existing, now auto-triggered]
  → sendAvisoFacturacionEmail()      [NEW mail via gmailService]

[Presupuesto estado → aceptado]
  → presupuestosService.update()     [existing]
  → leadsService.syncFromPresupuesto()  [existing]
  → reservasService.reservar()       [existing]
  → requerimientosService.create()   [existing]
```

---

## Pattern Consistency Checklist

- All new Firestore writes: `createBatch() + batchAudit()` before `await batch.commit()`
- All new nested objects: `deepCleanForFirestore()` before write
- All new list pages: `useUrlFilters` with typed schema
- All new service methods: follow `async getAll / getById / create / update / delete / subscribe` naming
- All new timestamps: `Timestamp.now()` on write, `.toDate().toISOString()` in parser
- All new utility functions: placed in `apps/sistema-modular/src/utils/` (app-specific) or `packages/shared/src/utils.ts` (cross-app pure functions)
- New components: max 250 lines; extract hooks if form logic exceeds ~80 lines

---

## Gaps and Risks

### Gap 1 — `SolicitudFacturacion` type completeness
`facturacionService.ts` reads and writes but the `SolicitudFacturacion` interface was not fully inspected. Before Phase 5, verify the type has `otNumber`, `presupuestoNumero`, and `montoTotal` fields, or add them.

### Gap 2 — Google Distance Matrix vs Haversine
Haversine gives straight-line km, not driving distance. For most AGS use cases (Mendoza / AMBA region visits) the error is 10-20%. Sufficient for pricing tiers. If exact road distance is required later, add `google.maps.DistanceMatrixService` call to `geocodingService.ts` — same SDK, no extra key, but async call per quote.

### Gap 3 — Mail recipients for aviso facturación
`personalService.getByRole('administracion')` is the suggested source but that method may not exist or the role names may differ. Verify `personalService.ts` supports role-based filtering before Phase 5.

### Gap 4 — Auto-ticket when presupuesto has `origenTipo === 'directo'`
The `_autoCreateTicket()` method needs to handle the case where the user intentionally creates a presupuesto without a ticket (commercial proactive quotes). Add an explicit flag `skipAutoTicket?: boolean` to `presupuestosService.create()` params to allow opt-out.

### Gap 5 — portal-ingeniero and computeStockAmplio
If portal-ingeniero needs extended stock view, `computeStockAmplio()` requires Firestore access from three collections. Confirm portal-ingeniero's Firebase config has read access to `ordenes_compra` and `requerimientos` (currently likely read-only to `reportes` + `stock`).
