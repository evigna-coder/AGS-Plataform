# Migration Plan (Client CUIT + Establishments)

The data model is transitioning from a flat `clienteId`-based model (where `clienteId` was used for fiscal data, physical location of equipments, and contacts) to a structured model separating fiscal entities (`clientes`) from physical locations (`establecimientos`).

## Current Status & Mismatches
- **normalizeCuit:** Implemented in `firebaseService.ts`. Strips all non-digit characters.
- **Client IDs:** New clients are created with their normalized CUIT as `id`, and legacy clients use `LEGACY-uuid`.
- **Contactos:** Are still partially in `clientes/{id}/contactos` and need to be fully moved to `establecimientos`.
- **Sistemas:** Still referencing `clienteId` in many places though `establecimientoId` is added. Both coexist.

## Phased Migration Plan

### Phase 1: Types & Services Alignment (Non-breaking) ✅ / 🔄
* Types already updated in `@ags/shared/src/types/index.ts`.
* `firebaseService.ts` already handles the new signature for `clientesService.create()` generating `LEGACY-` IDs if `cuit` is missing.
* Service logic has been updated to support `establecimientoId` on `sistemas` and `presupuestos`.
* *Action:* Ensure all React components use the new types and don't fail if `establecimientoId` is missing (fallback to `clienteId`).

### Phase 2: Minimal UI Support for Establishments 🔄
* Create/Select Establishment UI in the Work Order and Quote creation flows.
* Automatically fallback to a "Default" or "Principal" establishment for legacy clients.
* Update Sistema (Equipment) forms to enforce selecting an `establecimientoId` rather than just a `clienteId`.

### Phase 3: Node Migration Scripts (Dry-run & Execution) 🔄
* The script `apps/sistema-modular/scripts/migrate-establecimientos.js` is implemented.
* **Step 1:** Run `node scripts/migrate-establecimientos.js --dry-run`
* **Step 2:** Validate `mapping.json` and `errors.csv` produced by the dry-run. Check for orphaned systems or contacts.
* **Step 3:** Take a Firestore backup (via GCP Console).
* **Step 4:** Run the live migration script `node ... --run`.
  - Creates the "Principal" establishment per client.
  - Moves `clientes/{id}/contactos` ➔ `establecimientos/{estId}/contactos`.
  - Updates `sistemas` with their new `establecimientoId`.

### Phase 4: Cleanup & Hardening ⏳
* Remove `clienteId` from `Sistema` type in `@ags/shared`.
* Remove fallback logic that queries `sistemas` by `clienteId` in `firebaseService.ts`.
* Update Firestore Security Rules (if any) to enforce `establecimientoId` existence on systems and budgets.
* Delete the `contactos` subcollections from `clientes` (the script copies them but doesn't delete the originals to be safe).

## Data Validation Checklist
- [ ] Ensure all systems have an `establecimientoId` assigned.
- [ ] Ensure `clientes` collection has 0 documents with subcollection `contactos` actively used.
- [ ] Check that `reportes` (OTs) and `presupuestos` correctly fetch the client from `establecimientoId -> clienteCuit`.
- [ ] Verify that `cuit` fields across the DB contain exactly 11 digits when populated.
