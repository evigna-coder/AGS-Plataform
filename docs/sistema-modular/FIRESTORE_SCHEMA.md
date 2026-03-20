# Firestore Data Model Schema (Sistema Modular & Reportes-OT)

The source of truth for the data model relies on `@ags/shared` and the `firebaseService.ts` wrappers.
All collections use Firestore.

## Collections Mapping

### 1. `clientes/`
* **Doc ID:** Normalized CUIT (11 digits) or `LEGACY-{uuid}` if missing.
* **Fields:** `razonSocial`, `cuit`, `condicionIva`, `activo`, `createdAt`, `updatedAt`, etc. (Fiscal info).
* **Notes:** Contactos are being migrated out of the `clientes/{id}/contactos` subcollection to `establecimientos`.

### 2. `establecimientos/`
* **Doc ID:** Auto-generated.
* **Fields:** `clienteCuit` (FK to `clientes`), `nombre`, `direccion`, `localidad`, `provincia`, `activo`, `createdAt`, `updatedAt`.
* **Relations:** Belongs to a single client via `clienteCuit`.

### 3. `establecimientos/{id}/contactos/` (Subcollection)
* **Doc ID:** Auto-generated.
* **Fields:** `nombre`, `email`, `telefono`, `cargo`, `esPrincipal`, `establecimientoId`.

### 4. `sistemas/` (Equipos)
* **Doc ID:** Auto-generated.
* **Fields:** `establecimientoId` (FK to `establecimientos`), `clienteId` (Legacy, being phased out), `categoriaId`, `nombre` (Model name), `codigoInternoCliente`, `activo`, `ubicaciones` (Array), `createdAt`, `updatedAt`.
* **Relations:** References where the system currently is installed.

### 5. `sistemas/{id}/modulos/` (Subcollection)
* **Doc ID:** Auto-generated.
* **Fields:** `sistemaId`, `nombre`, `descripcion`, `serie`, `ubicaciones`, `otIds`.

### 6. `reportes/` (Órdenes de Trabajo - OT)
* **Doc ID:** `otNumber` (e.g., "25660" or "25660.02" for items).
* **Fields:** `status` ('BORRADOR' | 'FINALIZADO'), `clienteId`, `establecimientoId`, `sistemaId`, `moduloSerie`, `reporteTecnico`, `articulos`, `signatureClient`, `signatureEngineer`, `updatedAt`.
* **Notes:** Whole document is persisted via `setDoc({merge: true})`. Contains base64 signatures.

### 7. `presupuestos/`
* **Doc ID:** Auto-generated.
* **Fields:** `numero` (e.g. PRE-0000), `clienteId`, `establecimientoId`, `estado`, `items` (Array), `subtotal`, `total`, `condicionPagoId`, `createdAt`, `validUntil`.

### 8. `leads/`
* **Doc ID:** Auto-generated.
* **Fields:** `clienteId`, `razonSocial`, `contacto`, `motivoLlamado`, `estado`, `postas` (Array for derivations), `createdAt`.

### 9. Catalogs
* `categorias_equipo/`: ID, `nombre`, `modelos` (Array of strings).
* `categorias_modulo/`: ID, `nombre`, `modelos` (Array of objects).
* `tipos_servicio/`: ID, `nombre`.
* `condiciones_pago/`: ID, `nombre`, `dias`.
* `categorias_presupuesto/`: ID, `nombre`, tax configuration flags/percentages.

## Legacy Debt & Migration Status
* **`clientes.cuit` vs `clientes.id`**: The `id` is transitioning to equal the normalized CUIT. Legacy data without CUIT uses `LEGACY-{uuid}` as `id`.
* **`clienteId` vs `establecimientoId`**: Several collections (e.g., `sistemas`, `presupuestos`, `reportes`) previously bound directly to `clienteId`. The new architecture introduces `establecimientoId` as the primary grouping for physical entities, maintaining `clienteId` purely for fiscal grouping. Both fields may coexist temporarily during migration.
