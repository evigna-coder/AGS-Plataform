# AGS Plataform — Module Deep-Dive

> **Authoritative source:** `[apps/sistema-modular/src/App.tsx]` for routes, `[apps/sistema-modular/src/services/]` for service contracts, `[apps/sistema-modular/src/pages/]` for page components. This file is a navigable summary; verify before *acting*.
> **Last verified:** 2026-04-25.

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

### Leads (= Tickets)
**Route**: `/leads`, `/leads/:id` | **Pages**: LeadsListPage, LeadDetailPage | **Service**: `leadsService.ts`

- **Conceptualmente "Tickets"** (rename UI/types-side; collection sigue siendo `leads/`). Detalle: `memory/project_tickets_refactor.md`.
- Multi-area (`soporte` / `administracion` / `ventas` / `ingenieria`), multi-prioridad, multi-asignación.
- Estados: ~8 estados extendidos incluyendo `en_coordinacion` (post-aceptación de presupuesto ventas).
- Sources: QR scan, portal form, manual, email.
- Componentes: CrearLeadModal, DerivarLeadModal, FinalizarLeadModal, LeadFilters, LeadSidebar, LeadTimeline, ContactosTicketSection.
- Real-time QR notifications via `useQRLeadNotifications` (Electron native notifications).
- Linked a presupuestos vía `presupuestosIds[]` y a OTs vía `otIds[]`.

### Presupuestos (Quotes)
**Route**: `/presupuestos`, `/presupuestos/nuevo`, `/presupuestos/:id` + sub-rutas (`categorias`, `condiciones-pago`, `conceptos-servicio`, `tipos-equipo`) | **Service**: `presupuestosService.ts` (~88KB) | **Estado**: cerrado end-to-end para tipo `contrato` (2026-04-10).

- **Tipos**: `tecnico`, `partes`, `ventas`, `insumos`, `contrato`, `garantia`, `cambio_paridad`, `terminos_condiciones`.
- **Monedas**: `USD` / `ARS` / `EUR` / `MIXTA` (MIXTA solo para contrato, con cuotas asimétricas por moneda).
- **Categorías fiscales** (CategoriaPresupuesto): IVA, Ganancias, IIBB.
- **Condiciones de pago**: catálogo CondicionesPago.
- **Validez**: default 15 días.
- **Flujo contrato**: editor jerárquico Sector → Sistema → Servicios con auto-completado desde catálogo `tiposEquipoPlantillas`. PDF moderno teal con plan de cuotas. Componentes: `apps/sistema-modular/src/components/presupuestos/contrato/` y `apps/sistema-modular/src/components/presupuestos/pdf/contrato/`.
- **Flujo ventas/insumos**: aceptación deja ticket en `en_coordinacion`. *No* dispara OT automática.
- **Flujo técnico**: aceptación dispara creación de OT.
- **Cosecha Item→OT (Fase 6)**: diseñada (`.claude/plans/presupuestos-item-a-ot-design.md`), no implementada.
- **OAuth email envío**: pendiente verificación productiva (Fase 7).

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

### Contratos
**Route**: `/contratos` | **Pages**: ContratosList, ContratoDetail | **Service**: `contratosService.ts` | **Added**: 2026-04-19

- Per-incident vs contrato — granularidad hasta nivel sistema.
- Estados: `borrador` / `vigente` / `vencido` / `cancelado`.
- Originados desde Presupuesto tipo `contrato`.
- Cobertura definida con `ServicioContrato[]` (un registro por sistema).

### Tipos de Equipo (plantillas)
**Route**: `/presupuestos/tipos-equipo` | **Service**: `tiposEquipoService.ts` | **Added**: 2026-04-19

- Catálogo de plantillas para auto-completar líneas de presupuesto contrato.
- Cada plantilla tiene `componentes[]` (S=módulo, L=accesorio) y `servicios[]` (con `precio` default).
- Match por substring en `nombre` (longitud descendente).

### Facturación
**Route**: `/facturacion`, `/facturacion/:id` | **Service**: `facturacionService.ts` | **Added**: 2026-04-22

- Decoupled from OT — controlado desde Presupuestos.
- Integrado con AFIP via `afipService.ts`.
- Bejerman: descartado.
- Genera `SolicitudFacturacion` con items, estado AFIP, número de factura.

### QF Documentos
**Route**: `/qf-documentos` | **Service**: `qfDocumentosService.ts` | **Added**: 2026-04-22

- Documentos de calidad/formulación con versionado (`1.0` → `1.1` → `2.0`).
- Familias: QF, QI, QD, QP.
- Visible en sistema-modular para todos; en portal-ingeniero solo `admin` y `admin_ing_soporte`.
- Historial completo de versiones por documento.

### Stock
**Route**: `/stock/*` (~18 sub-rutas) | **Services**: `stockService.ts`, `stockAmplioService.ts`, `importacionesService.ts`

Plan de evolución en 5 fases (memory `project_stock_evolution.md`).

| Subpage | Purpose |
|---------|---------|
| Articulos | SKU master catalog |
| Unidades | Physical unit instances |
| Minikits + MinikitTemplate | Grouped sets, templates reutilizables |
| Remitos | Órdenes digitales de despacho (salida_campo, devolucion, etc.) |
| Movimientos | Log inmutable |
| Alertas | Stock level alerts |
| Requerimientos | Purchase requisitions |
| OC | Purchase orders (nacional / importacion) |
| Importaciones | International trade + customs tracking |
| Ingenieros | Field engineers catalog |
| Proveedores | Supplier management |
| Posiciones | Stock locations (drawers, shelves) |
| Posiciones Arancelarias | Tariff positions |
| Marcas | Brand/manufacturer catalog |
| Asignación Rápida | Bulk assignment UI |
| Inventario Ingeniero | Per-engineer view |
| Planificación | Scheduling stock dispatch |

### Agenda
**Route**: `/agenda` | **Page**: AgendaPage | **Service**: `agendaService.ts`

- Calendar view for scheduling engineer visits.
- Quarter-based time slots (4 quarters per day).
- Linked to OTs and engineers.
- Keyboard shortcuts via `useAgendaKeyboard` hook.

### Pendientes
**Route**: `/pendientes` | **Page**: PendientesList | **Service**: `pendientesService.ts`

- Cola de acciones pendientes por usuario.
- Tipos y estados con labels y colors.
- Resolución asociada a documentos (presupuesto, OT, etc.).

### Vehículos & Dispositivos
**Routes**: `/vehiculos`, `/dispositivos` | **Services**: `vehiculosService.ts`, `dispositivosService.ts`

- Vehículos: flota con servicios, vencimientos, registro de km, visitas a taller.
- Dispositivos: tablets, equipos asignados a usuarios.

### Calificación Proveedores
**Route**: `/calificacion-proveedores` | **Service**: `calificacionesService.ts`

- Ratings y métricas por proveedor.

### Ingreso Empresas
**Route**: `/ingreso-empresas` | **Service**: `ingresoEmpresasService.ts`

- Onboarding de nuevos clientes/proveedores con checklist documental.

### Usuarios
**Route**: `/usuarios` | **Page**: UsuariosList (admin only)

- Roles: `admin`, `admin_soporte`, `admin_ing_soporte`, `ingeniero_soporte`, `administracion`, `pendiente`.
- Status: `pendiente` → `activo` / `deshabilitado`.
- `permissionsOverride` per-user (modelo híbrido — defaults del rol + grants/revokes individuales).
- Google OAuth accounts (`@agsanalitica.com`).
- Detalle: `memory/project_rbac.md`.

### Posta (workflow concept, NO module)

Posta no tiene ruta propia. Es un patrón embebido dentro de Tickets, OC, Importaciones, Requerimientos, Agenda y Presupuestos para handoffs entre usuarios. Cada entidad guarda su propio array `postas[]`/`historial[]`.

### Admin utilities
**Route**: `/admin/*` (8 rutas) | **Service**: `adminConfigService.ts`

- Imports masivos, backfill, relink de entidades, revisión de IDs, configuración de flags.
- Acceso solo `admin`.

---

## reportes-ot Components

> **Frozen surface** — leer `@.claude/rules/reportes-ot.md` antes de tocar nada. Hook `guard-reportes-ot.js` bloquea edits salvo `CLAUDE_ALLOW_REPORTES_OT=1`.

### Main flow
App.tsx hoy es **~600 líneas modularizadas** (no el monolito de 2800+ del pasado). La lógica está distribuida en hooks: `useAppLogic`, `useReportForm`, `usePDFGeneration`, `useOTManagement`, `useAutosave`, `useEntitySelectors`, `useIsMobile`, `useModal`, `useAccordionCard`, `useAssetPreloader`.

- OT number input → Load/Create
- Full form: client data, equipment, service type, dates, report, parts
- Protocol table selector (from tableCatalog)
- Instrument selector con trazabilidad ordering
- Attachments (photos/files)
- Signature pads (engineer + client)
- Finalize → PDF generation (multi-stage)

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

> Hub para ingenieros de soporte. Ya **no es lightweight only** — tiene módulos propios además de re-usar OTs.

### Routes (current)
| Page | Route | Purpose |
|------|-------|---------|
| LoginPage | `/login` | Google OAuth |
| OTListPage | `/ordenes-trabajo` | All OTs with filters |
| OTDetailPage | `/ordenes-trabajo/:otNumber` | Tabbed OT detail (read-only for FINALIZADO) |
| HistorialPage | `/historial` | Historial técnico |
| AgendaPage | `/agenda` | Calendario del ingeniero |
| LeadsPage | `/leads` | Tickets asignados / del área |
| LeadDetailPage | `/leads/:leadId` | Detalle de ticket |
| ReportesPage | `/reportes` | OTs finalizadas |
| ViaticosPage | `/viaticos` | Periodos y gastos de viáticos |
| QFDocumentosPage | `/qf-documentos` | Solo `admin` y `admin_ing_soporte` |
| PerfilPage | `/perfil` | Perfil + sign out |
| **EquipoPublicPage** | `/equipo/:agsId` | **Pública** — QR landing, sin auth. Punto de entrada para clientes que escanean el QR del equipo. |

### Key behavior
- `/` redirige a `/leads` post-login.
- **BORRADOR** OTs → abren `reportes-ot` en nueva pestaña (`REPORTES_OT_URL?reportId=OT-XXXX`).
- **FINALIZADO** OTs → abren detail page read-only.
- Mobile-first con BottomNav (tabs + menú "Más").
- Auth gate con role-based access (`canAccessApp(usuario, 'portal-ingeniero')`).

---

## Firebase Services

### sistema-modular — modular (no monolithic file anymore)

Una **service por colección** en `apps/sistema-modular/src/services/[modulo]Service.ts`. Convención: cada archivo exporta un objeto con métodos CRUD (`leadsService.create(...)`, `.list(...)`, `.update(...)`, `.delete(...)` y los específicos del dominio). **Los componentes no llaman a Firestore directo** — todo pasa por la capa de servicios.

| Service | Collection | Notes |
|---------|-----------|-------|
| `clientesService` | `clientes` | CUIT-based ID + LEGACY-{uuid} |
| `establecimientosService` | `establecimientos` | Per-cliente |
| `equiposService` | `sistemas`, `modulos` | Sistemas + módulos |
| `tiposEquipoService` | `tiposEquipoPlantillas` | Plantillas para presupuesto contrato |
| `otService` | `workorders` | OT lifecycle, signatures |
| `leadsService` | `leads` | Tickets — multi-area, postas |
| `presupuestosService` | `presupuestos` | ~88KB — incluye contrato flow |
| `contratosService` | `contratos` | Contratos vigentes |
| `facturacionService` | `solicitudesFacturacion` | + AFIP via `afipService.ts` |
| `qfDocumentosService` | `qfDocumentos` | Versionado |
| `catalogService` | `tableCatalog` | Biblioteca de Tablas |
| `patronesService`, `columnasService` | `patrones`, `columnas` | Para protocolos |
| `fichasService` | `fichas` | Equipos en reparación |
| `loanersService` | `loaners` | Préstamos |
| `stockService`, `stockAmplioService`, `importacionesService` | varios | Inventario completo |
| `agendaService` | `agenda` | Calendar |
| `pendientesService` | `pendientes` | Cola de tareas |
| `vehiculosService`, `dispositivosService` | `vehiculos`, `dispositivos` | Recursos |
| `calificacionesService` | `proveedores` (ratings) | Supplier ratings |
| `personalService` | `personal` | Staff/ingenieros |
| `ingresoEmpresasService` | `ingresoEmpresas` | Onboarding |
| `ordenesCompraClienteService` | `ordenescompra` | OC al cliente |
| `asignacionesService` | `asignaciones` | Asignación de stock |

### Infrastructure helpers

| File | Exports |
|---|---|
| `services/firebase.ts` | `db`, `auth`, `storage`, `cleanFirestoreData`, `deepCleanForFirestore`, `getCreateTrace`, `getUpdateTrace`, `createBatch`, `batchAudit` |
| `services/authService.ts` | Auth context, sign-in/out, role check |
| `services/serviceCache.ts` | TTL-2min wrapper para listas frecuentes |
| `services/featureFlagsService.ts` | Toggles por env / por user |
| `services/notificationService.ts`, `fcmService.ts` | Push notifications, FCM token |
| `services/afipService.ts` | Integración AFIP para facturación |
| `services/gmailService.ts`, `googleDriveService.ts` | OAuth-based external |
| `services/geocodingService.ts` | Address lookup (Google Places) |
| `services/adminConfigService.ts` | Config admin (flujos, defaults) |

### portal-ingeniero

`apps/portal-ingeniero/src/services/firebaseService.ts` — análogo, usa el mismo `@ags/shared` types pero con scope acotado (OT, leads, agenda, viaticos, qf-documentos).

---

## Hooks Reference

### sistema-modular hooks (selección — son ~50 archivos)

**Form / data hooks:**
| Hook | Purpose |
|---|---|
| `useCrearLeadForm` | Lead/ticket creation form state |
| `useCreatePresupuestoForm` | Quote creation con items |
| `usePresupuestoEdit` | Quote edit con revisiones |
| `useCreateOTForm` / `useEditOTForm` | OT forms |
| `useCreateContratoForm` | Contract form |
| `useCreateMovimientoForm` | Inventory movement |

**Business logic:**
| Hook | Purpose |
|---|---|
| `usePresupuestoActions` | Quote send/approve/finalize |
| `useOTActions` / `useOTDetail` / `useOTFieldHandlers` / `useOTFormState` | OT lifecycle |
| `useEnviarPresupuesto` | Email quote |
| `useGenerarOC` / `useGenerarRequerimientos` | Auto-gen documents |

**Inventory/stock:**
| Hook | Purpose |
|---|---|
| `useStock` / `useStockAmplio` | Stock CRUD |
| `useIngresarStock` / `useReservaStock` / `useStockMigration` | Stock flows |
| `useEditArticuloForm` / `useMigracionPatrones` | Form-level |
| `useInventarioIngeniero` | Per-engineer view |
| `useAsignacionRapida` | Bulk assign UI |

**UI / Navigation:**
| Hook | Purpose |
|---|---|
| `useUrlFilters` | **All list filters** (memory regla — never `useState`) |
| `useNavigateBack` | History nav with cross-module memory |
| `useResizableColumns` | Persistent column widths |
| `useColumnas` | Column definition CRUD |
| `useAgenda` / `useAgendaKeyboard` | Calendar data + shortcuts |
| `useDebounce` | Generic debounce |

**Notifications & external:**
| Hook | Purpose |
|---|---|
| `useQRLeadNotifications` | QR-generated lead listener (Electron native) |
| `useLeadNotifications` | Lead/ticket change notifications |
| `useGoogleOAuth` | Gmail OAuth flow |
| `useBulkAddressValidation` | Address verification batch |

**Domain hooks:**
| Hook | Purpose |
|---|---|
| `useTableCatalog` / `useTableProjects` | Tabla library CRUD |
| `useFichas` / `useLoaners` | Equipment records / loans |
| `useImportaciones` / `useInstrumentos` | Import workflow / patterns |
| `useOrdenesCompra` / `useRemitos` / `useRequerimientos` | Procurement |
| `usePendientes` / `usePatrones` | Tasks / templates |
| `useExcelMigration` (~22KB) | Excel import wizard |

### portal-ingeniero hooks
| Hook | Purpose |
|---|---|
| `useOTList` | OT list + filters |
| `useOTForm` | Single OT form + autosave |
| `useViaticosPeriodos` | Viaticos data |
| `useLeadsPortal` | Tickets visible al ingeniero |

### reportes-ot hooks
`useAppLogic`, `useReportForm`, `usePDFGeneration`, `useOTManagement`, `useAutosave`, `useEntitySelectors`, `useIsMobile`, `useModal`, `useAccordionCard`, `useAssetPreloader`. Detalle: leer la regla y `memory/reportes-ot-pdf.md` antes de tocar.
