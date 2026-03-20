# AGS Plataform — Module Deep-Dive

## Table of Contents
1. [sistema-modular Modules](#sistema-modular-modules)
2. [reportes-ot Components](#reportes-ot-components)
3. [portal-ingeniero Pages](#portal-ingeniero-pages)
4. [Firebase Services](#firebase-services)
5. [Hooks Reference](#hooks-reference)

---

## sistema-modular Modules

### Clientes
**Route**: `/clientes` | **Pages**: ClientesList, ClienteDetail, ClienteNew (modal)

- CUIT-based identification (normalized: no dashes)
- Legacy clients without CUIT get `LEGACY-{uuid}` ID
- `normalizeCuit(cuit)` utility in firebaseService
- Detail page: 2-column layout with establishments listed

### Establecimientos
**Route**: `/establecimientos` | **Pages**: EstablecimientosList, EstablecimientoDetail, EstablecimientoNew

- Linked to Cliente via `clienteCuit`
- Types: planta, sucursal, oficina, laboratorio, otro
- Google Places integration for address autocomplete (AddressAutocomplete component)
- Contacts subcollection with per-establishment contacts

### Equipos (Sistemas)
**Route**: `/equipos` | **Pages**: EquiposList, EquipoDetail, EquipoNew, CategoriasEquipo

- Linked to Establecimiento (not directly to Cliente)
- Category system with models
- GC-specific: `configuracionGC` auto-activates when name contains "gaseoso"
- `GCPortsGrid.tsx` component for port visualization (readOnly + edit mode)
- QR code generation with `agsVisibleId` (AGS-EQ-XXXX)
- `QREquipoModal.tsx` with print sticker feature (80mm x 60mm)

### Ordenes de Trabajo (OT)
**Route**: `/ordenes-trabajo` | **Pages**: OTList, OTDetail, OTNew, TiposServicio

- Central entity linking Client → Equipment → Service
- Status: BORRADOR → FINALIZADO
- OT number: 5 digits + optional .NN suffix
- `tipoServicio` determines which protocols apply
- Parts (articulos) with optional stock linking

### Leads
**Route**: `/leads` | **Pages**: LeadsList, LeadDetail (modal creation)

- Sales pipeline: nuevo → en_revision → derivado → en_proceso → finalizado/perdido
- Sources: QR scan (equipment labels), portal form, manual entry
- Posta (handoff) workflow for internal routing
- Links to presupuestos and OTs
- Real-time QR notifications via `useQRLeadNotifications` hook

### Presupuestos (Quotes)
**Route**: `/presupuestos` | **Pages**: PresupuestosList, PresupuestoDetail, PresupuestoNew

- Types: servicio, partes, ventas, contrato, mixto
- Multi-currency: USD, ARS, EUR with exchange rate
- Tax categories (CategoriaPresupuesto): IVA, Ganancias, IIBB rules
- Payment terms (CondicionesPago catalog)
- Validity tracking (default 15 days)
- Status workflow with 10 possible states

### Biblioteca de Tablas (Table Catalog)
**Route**: `/table-catalog` | **Pages**: ProtocolCatalogPage, ProtocolCatalogEditorPage

- Dynamic protocol/table definitions for technician use
- Editor with tabs: Columnas, Filas, Reglas
- JSON import from Word-to-protocol converter
- Table preview component
- Publish/Archive/Clone workflow
- Project grouping (TableProjects)

### Instrumentos
**Route**: `/instrumentos` | **Pages**: InstrumentosListPage, InstrumentoEditorPage

- Reference instruments & standards (patrones)
- Certificate tracking with expiry alerts
- Categories: termometro, manometro, flujimetro_gases, etc.
- Replacement chain: reemplazaA ↔ reemplazadoPor
- Certificate PDFs stored in Firebase Storage

### Fichas de Propiedad
**Route**: `/fichas` | **Pages**: FichasList, FichaDetail, FichaEditor

- Track customer-owned equipment brought in for repair
- Status: recibido → en_diagnostico → en_reparacion → listo_para_entrega → entregado
- Provider derivations, pending spare parts
- Loaner equipment assignment
- Photo documentation (Google Drive links)

### Loaners
**Route**: `/loaners` | **Pages**: LoanersList, LoanerDetail, LoanerEditor

- Equipment loaned to clients during repairs
- Track: en_base, en_cliente, en_transito, vendido, baja
- Linked to Fichas (when loaner replaces client equipment)
- Loan history (prestamos) and extraction logs

### Stock
**Route**: `/stock` | **13+ subpages**

Comprehensive inventory management:

| Subpage | Purpose |
|---------|---------|
| Articulos | SKU master catalog |
| Unidades | Physical unit instances |
| Minikits | Grouped sets of units |
| Remitos | Digital dispatch orders |
| Movimientos | Immutable movement log |
| Alertas | Stock level alerts |
| Requerimientos | Purchase requisitions |
| OC (Ordenes Compra) | Purchase orders |
| Importaciones | International trade |
| Ingenieros | Field engineers catalog |
| Proveedores | Supplier management |
| Posiciones | Stock locations (drawers, shelves) |
| Posiciones Arancelarias | Tariff positions |
| Marcas | Brand/manufacturer catalog |

### Agenda
**Route**: `/agenda` | **Page**: AgendaPage

- Calendar view for scheduling engineer visits
- Quarter-based time slots (4 quarters per day)
- Linked to OTs and engineers
- Keyboard shortcuts via `useAgendaKeyboard` hook

### Postas
**Route**: `/postas` | **Pages**: PostasVisor, PostaDetail

- Workflow handoff tracking between users
- Categories: administracion, soporte_tecnico
- Priority levels: baja, normal, alta, urgente
- Applies to: OC, importaciones, presupuestos, requerimientos, agenda

### Usuarios
**Route**: `/usuarios` | **Page**: UsuariosList (admin only)

- Role assignment: admin, ingeniero_soporte, admin_soporte, administracion
- Status management: pendiente → activo / deshabilitado
- Google OAuth accounts (@agsanalitica.com)

---

## reportes-ot Components

### Main Flow (App.tsx — monolithic 2800+ lines)
- OT number input → Load/Create
- Full form: client data, equipment, service type, dates, report, parts
- Protocol table selector (from tableCatalog)
- Instrument selector
- Attachments (photos/files)
- Signature pads (engineer + client)
- Finalize → PDF generation

### Key Components
| Component | Purpose |
|-----------|---------|
| ProtocolPaginatedPreview | A4-paginated protocol tables |
| CatalogTableView | Single table renderer with auto-conclusion |
| CatalogChecklistView | Checklist renderer (Yes/No/NA) |
| CatalogTextView | Free-text protocol section |
| CatalogSignaturesView | Signature rendering |
| AdjuntosSection | Photo/file attachment manager |
| InstrumentoSelectorPanel | Multi-select instrument picker |
| SignaturePad | Canvas-based signature capture |
| RichTextEditor | Contenteditable with toolbar |

### Key Hooks
| Hook | Purpose |
|------|---------|
| useReportForm | Central form state (40+ fields) |
| useOTManagement | Load/create/duplicate OTs |
| usePDFGeneration | Multi-part PDF pipeline |
| useAutosave | 700ms debounced auto-save |
| useEntitySelectors | Lazy-load Firestore entities |

### Query Parameters
| Param | Effect |
|-------|--------|
| `?reportId=25660` | Auto-load OT |
| `?modo=firma` | Mobile signature mode |
| `?share=true` | Auto-trigger PDF share |
| `?data=BASE64` | Pre-fill OT data |

---

## portal-ingeniero Pages

### Implemented
| Page | Route | Purpose |
|------|-------|---------|
| LoginPage | `/login` | Google OAuth |
| OTListPage | `/ordenes-trabajo` | All OTs with filters |
| OTDetailPage | `/ordenes-trabajo/:otNumber` | Tabbed OT detail (read-only for FINALIZADO) |
| ReportesPage | `/reportes` | Finalized OT list |
| PerfilPage | `/perfil` | User profile + sign out |
| EquipoPublicPage | `/equipo/:agsId` | QR landing page (public, no auth) |

### Placeholder (Coming Soon)
EquiposPage, AgendaPage, LeadsPage, ClientesPage

### Key Behavior
- **BORRADOR** OTs → open reportes-ot in new tab (`REPORTES_OT_URL?reportId=OT-XXXX`)
- **FINALIZADO** OTs → open read-only detail page
- Mobile-first with BottomNav (4 tabs + "Mas" menu)

---

## Firebase Services

### sistema-modular (firebaseService.ts — 3300+ lines)

**37+ service objects** with CRUD methods:

| Service | Collection | Key Methods |
|---------|-----------|-------------|
| clientesService | clientes | getAll, getById, save, delete |
| establecimientosService | establecimientos | getByCliente, save |
| sistemasService | sistemas | getByEstablecimiento, save |
| modulosService | modulos (sub) | getBySistema, save |
| ordenesTrabajoService | workorders | getAll, getByOtNumber, save |
| leadsService | leads | getAll, save, updateEstado |
| presupuestosService | presupuestos | getAll, save |
| tableCatalogService | tableCatalog | getAll, save, publish, archive, clone |
| instrumentosService | instrumentos | getAll, save |
| articulosService | articulos | getAll, save |
| unidadesService | unidades | getAll, save |
| remitosService | remitos | getAll, save |
| fichasService | fichas | getAll, save |
| loanersService | loaners | getAll, save |
| agendaService | agenda | getAll, save |
| postasService | postas | getAll, save |
| usuariosService | usuarios | getAll, save, updateRole |

**Utilities**:
- `cleanFirestoreData(obj)` — remove top-level undefined values
- `deepCleanForFirestore(obj)` — JSON round-trip for nested objects
- `normalizeCuit(cuit)` — strip CUIT formatting
- `generateLegacyClientId()` — create LEGACY-{uuid}
- `logAudit(params)` — fire-and-forget audit log

---

## Hooks Reference

### sistema-modular Hooks

| Hook | Purpose |
|------|---------|
| useTableCatalog | CRUD for table catalog entries |
| useOTDetail | Single OT loading with related data |
| useStock | Articulos + Unidades + Movimientos |
| useImportaciones | Import workflow management |
| useInstrumentos | Instruments & patterns CRUD |
| useFichas | Service record management |
| useLoaners | Loaner equipment tracking |
| useRemitos | Dispatch order management |
| useRequerimientos | Purchase requisitions |
| useOrdenesCompra | PO management |
| useAgenda | Calendar entries |
| useAgendaKeyboard | Keyboard shortcuts for agenda |
| usePostas | Workflow handoff tracking |
| useQRLeadNotifications | Real-time QR lead listener |
| useTableProjects | Project grouping for tables |

### portal-ingeniero Hooks

| Hook | Purpose |
|------|---------|
| useOTList | OT list with status/search filters |
| useOTForm | Single OT form state + autosave |
