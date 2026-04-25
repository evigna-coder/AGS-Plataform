# AGS Plataform — Complete Entity Reference

> **Authoritative source:** `[packages/shared/src/types/index.ts]` (~3900 lines) and `[packages/shared/src/utils.ts]`. This file is a navigable summary; before *acting* on a specific field name, grep the type file to confirm. See the self-clean protocol in [SKILL.md](../SKILL.md).
> **Last verified:** 2026-04-25.

## Table of Contents
1. [Cliente](#cliente)
2. [Establecimiento](#establecimiento)
3. [Sistema (Equipo)](#sistema)
4. [ModuloSistema](#modulosistema)
5. [WorkOrder (OT)](#workorder)
6. [Lead / Ticket](#lead)
7. [Presupuesto](#presupuesto)
8. [Contrato](#contrato)
9. [TipoEquipoPlantilla](#tipoequipoplantilla)
10. [SolicitudFacturacion](#solicitudfacturacion)
11. [QFDocumento](#qfdocumento)
12. [OrdenCompra](#ordencompra)
13. [Importacion](#importacion)
14. [TableCatalogEntry](#tablecatalogentry)
15. [ProtocolSelection](#protocolselection)
16. [InstrumentoPatron](#instrumentopatron)
17. [Articulo (Stock)](#articulo)
18. [UnidadStock](#unidadstock)
19. [Remito](#remito)
20. [FichaPropiedad](#fichapropiedad)
21. [Loaner](#loaner)
22. [AgendaEntry](#agendaentry)
23. [Posta (workflow concept)](#postaworkflow)
24. [UsuarioAGS](#usuarioags)

---

## Cliente
**Collection**: `clientes`
**ID**: Normalized CUIT or `LEGACY-{uuid}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | CUIT normalized (no dashes) or LEGACY-uuid |
| razonSocial | string | Legal business name |
| cuit | string | Tax ID (XX-XXXXXXXX-X format) |
| pais | string | Country |
| direccionFiscal | string | Fiscal address |
| localidadFiscal | string | City |
| provinciaFiscal | string | Province |
| rubro | string | Industry sector |
| condicionIva | string | Tax condition |
| ingresosBrutos | string | Gross income tax ID |
| requiereTrazabilidad | boolean | Requires traceability |
| activo | boolean | Active status |
| createdAt, updatedAt | string (ISO) | Timestamps |
| createdBy, createdByName | string | Audit trail |

---

## Establecimiento
**Collection**: `establecimientos`
**FK**: `clienteCuit`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| clienteCuit | string | FK to Cliente |
| nombre | string | Facility name |
| direccion | string | Street address |
| localidad | string | City |
| provincia | string | Province |
| codigoPostal | string | Zip code |
| tipo | enum | `planta` / `sucursal` / `oficina` / `laboratorio` / `otro` |
| lat, lng | number | Geolocation |
| placeId | string | Google Places ID |
| condicionPagoId | string | Payment terms FK |
| tipoServicio | string | Default service type |
| pagaEnTiempo | boolean | Payment reliability flag |
| contactos | ContactoEstablecimiento[] | Subcollection |

---

## Sistema
**Collection**: `sistemas`
**FK**: `establecimientoId`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| establecimientoId | string | FK to Establecimiento |
| categoriaId | string | Equipment category FK |
| nombre | string | Equipment name (from category) |
| codigoInternoCliente | string | Client's internal code |
| agsVisibleId | string | Human-readable ID (AGS-EQ-XXXX) |
| configuracionGC | ConfiguracionGC / null | GC ports (only when `esGaseoso(nombre)`) |
| ubicaciones | string[] | Physical locations |
| otIds | string[] | Related OT numbers |

### ConfiguracionGC
| Field | Type | Values |
|-------|------|--------|
| puertoInyeccionFront | InletType / null | SSL, COC, PTV |
| puertoInyeccionBack | InletType / null | SSL, COC, PTV |
| detectorFront | DetectorType / null | FID, NCD, FPD, ECD, SCD |
| detectorBack | DetectorType / null | FID, NCD, FPD, ECD, SCD |

---

## ModuloSistema
**Collection**: `modulos` (or subcollection of sistemas)
**FK**: `sistemaId`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| sistemaId | string | FK to Sistema |
| nombre | string | Module name |
| serie | string | Serial number |
| firmware | string | Firmware version |
| observaciones | string | Notes |

---

## WorkOrder
**Collection**: `workorders`
**ID**: `otNumber`

| Field | Type | Description |
|-------|------|-------------|
| otNumber | string | 5-digit + optional .NN (e.g., 25660.02) |
| status | enum | `BORRADOR` / `FINALIZADO` |
| clienteId | string | FK to Cliente |
| establecimientoId | string | FK to Establecimiento |
| sistemaId | string | FK to Sistema |
| moduloId | string | FK to ModuloSistema |
| razonSocial | string | Denormalized client name |
| tipoServicio | string | Service type |
| esFacturable | boolean | Billable flag |
| tieneContrato | boolean | Has service contract |
| esGarantia | boolean | Under warranty |
| fechaInicio, fechaFin | string (ISO) | Service dates |
| horasTrabajadas | string | Hours worked |
| tiempoViaje | string | Travel time |
| reporteTecnico | string | Technical report (HTML) |
| accionesTomar | string | Actions to take |
| materialesParaServicio | string | Materials needed |
| articulos | Part[] | Parts used |
| signatureEngineer | string / null | Base64 signature |
| signatureClient | string / null | Base64 signature |
| aclaracionEspecialista | string | Engineer name clarification |
| aclaracionCliente | string | Client name clarification |
| ingenieroAsignadoId | string | Assigned engineer UID |

### Part
| Field | Type |
|-------|------|
| codigo | string |
| descripcion | string |
| cantidad | number |
| origen | string |
| stockArticuloId | string (optional) |
| stockUnidadId | string (optional) |

---

## Lead
**Collection**: `leads`
**Conceptual rename**: tratado como "Ticket" en UI y types — la colección Firestore sigue siendo `leads/` por compatibilidad. Tipo TS principal: `Ticket` (alias `Lead`). Refactor documentado en `memory/project_tickets_refactor.md`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| razonSocial | string | Company name (denormalizado) |
| contactos | ContactoTicket[] | Contactos principales y secundarios |
| motivoLlamado | enum | `ventas` / `soporte` / `insumos` / `administracion` / `otros` (con labels y colors) |
| area | TicketArea | `soporte` / `administracion` / `ventas` / `ingenieria` |
| prioridad | TicketPrioridad | calculada por proximidad de próxima acción |
| estado | TicketEstado | set extendido (~8 estados) — incluye `en_coordinacion` para flujo ventas |
| clienteId | string | FK opcional |
| sistemaId | string | FK opcional |
| source | enum | `qr` / `portal` / `manual` / `email` / null |
| asignadoA | string[] | Multi-user assignment (ticket multi-rol) |
| postas | UsuarioPosta[] | Handoff entre usuarios |
| presupuestosIds | string[] | Quotes relacionados |
| otIds | string[] | OTs relacionadas |
| adjuntos | AdjuntoTicket[] | Files/photos |

**Helpers** (en `@ags/shared`): `getContactoPrincipal`, `getSimplifiedEstado`, `getSimplifiedEstadoLabel`, `getSimplifiedEstadoColor`, `canUserModifyTicket`, `getUserTicketAreas`.

**Flujo ventas crítico**: aceptar un presupuesto tipo `ventas` o `insumos` deja el ticket en `estado: 'en_coordinacion'` — *no* crea OT automáticamente. La coordinadora arma 0/1/N OTs manualmente. (Memory: `feedback_auto_ot_to_ticket.md`.)

---

## Presupuesto
**Collection**: `presupuestos`
**ID**: `PRE-XXXX`
**Estado del módulo**: cerrado end-to-end para tipo `contrato` (2026-04-10). Cosecha Item→OT diferida. Detalle: `[.claude/plans/presupuestos-cierre.md]` y `[.claude/plans/presupuestos-item-a-ot-design.md]`.

| Field | Type | Description |
|-------|------|-------------|
| numero | string | PRE-0001 format |
| tipo | TipoPresupuesto | `tecnico` / `partes` / `ventas` / `insumos` / `contrato` / `garantia` / `cambio_paridad` / `terminos_condiciones` |
| moneda | MonedaPresupuesto | `USD` / `ARS` / `EUR` / `MIXTA` (MIXTA solo para contrato) |
| origen | OrigenPresupuesto | `manual` / `lead` / `revision` / `clonado` |
| estado | PresupuestoEstado | `borrador` → `enviado` → `pendiente_oc` → `aceptado` → `autorizado` → `rechazado` / `vencido` |
| clienteId | string | FK to Cliente |
| leadId | string | FK opcional al ticket origen |
| items | PresupuestoItem[] | Line items (ver abajo) |
| subtotal, total | number | Cálculos |
| tipoCambio | number | Para `MIXTA` y conversiones |
| validezDias | number | Default 15 |
| condicionPagoId | string | FK CondicionPago |
| seccionesVisibles | PresupuestoSeccionesVisibles | Toggles de secciones del PDF |
| ventasMetadata | VentasMetadata | Datos extra para tipo ventas/insumos |
| **Contrato-only fields** | | |
| contratoFechaInicio | string ISO | Inicio de cobertura |
| contratoFechaFin | string ISO | Fin de cobertura |
| cantidadCuotasPorMoneda | Record\<moneda, number\> | Cuotas asimétricas por moneda en MIXTA |
| cuotas | PresupuestoCuota[] | Plan de cuotas calculado |
| otsVinculadasNumbers | string[] | OTs cosechadas desde items contrato (cuando se ejecute Fase 6) |

### PresupuestoItem (campos clave)
| Field | Type | Notes |
|-------|------|-------|
| sectorNombre | string | Para agrupar en editor jerárquico |
| sistemaId | string | FK Sistema (opcional) |
| sistemaNombre | string | Denormalizado |
| moduloSerie | string | Serie del módulo cuando aplica |
| servicioCode | string | Código de servicio (tipoServicio) |
| grupo, subItem | string | `subItem` con formato `"G.S"` para sub-numeración |
| esSinCargo | boolean | No suma al total |
| esBonificacion | boolean | Línea de bonificación |
| itemNotasAdicionales | string | Notas inline |
| moneda | MonedaPresupuesto | Para MIXTA por item |
| cantidad, precioUnitario, total | number | Cálculos |

**Helper de matching**: `findPlantillaForSistema()` busca substring por longitud descendente (HPLC 1260 Infinity antes que HPLC 1260).

**Híbrido componentes contrato**: si el sistema del cliente tiene módulos reales en Firestore, los usa; si no, usa los componentes de la plantilla.

---

## Contrato
**Collection**: `contratos`
**Module route**: `/contratos`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| clienteId | string | FK Cliente |
| estado | EstadoContrato | `borrador` / `vigente` / `vencido` / `cancelado` |
| fechaInicio, fechaFin | string ISO | Cobertura |
| servicios | ServicioContrato[] | Granular hasta sistema |
| tipoLimite | TipoLimiteContrato | Limita por horas/visitas/sin-límite |
| presupuestoOrigenId | string | Quote tipo `contrato` que lo originó |

Detalle: `memory/project_contratos.md`. Granularidad: cliente → establecimiento → sistema (cada `ServicioContrato` apunta a un sistema concreto).

---

## TipoEquipoPlantilla
**Collection**: `tiposEquipoPlantillas`
**Module route**: `/presupuestos/tipos-equipo`

Catálogo de plantillas usado para auto-completar líneas de presupuesto contrato.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| nombre | string | Match por substring (ver `findPlantillaForSistema`) |
| componentes | TipoEquipoComponente[] | Lista (S=módulo, L=accesorio) con default |
| servicios | TipoEquipoServicio[] | Servicios con `precio` default y `tipoServicio` |

**Helper**: `findPlantillaForSistema(sistemaNombre, plantillas)` — busca substring por longitud descendente para evitar match incorrecto (HPLC 1260 Infinity > HPLC 1260).

---

## SolicitudFacturacion
**Collection**: `solicitudesFacturacion`
**Module route**: `/facturacion`

Disparada desde Presupuesto al confirmar emisión de factura. Integrada con AFIP via `afipService.ts`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| presupuestoId | string | FK origen |
| clienteId | string | FK Cliente |
| estado | SolicitudFacturacionEstado | `pendiente` / `emitida` / `anulada` (con labels y colors) |
| items | FacturaItem[] | Líneas a facturar |
| numeroFactura, tipoFactura | string | Datos AFIP cuando emitida |
| total, moneda | number, string | Importe |
| createdAt, updatedAt | string ISO | Audit |

---

## QFDocumento
**Collection**: `qfDocumentos`
**Module route**: `/qf-documentos` (sistema-modular y portal-ingeniero `admin`/`admin_ing_soporte`)

Documentos de calidad y formulación con versionado e historial.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| familia | QFTipo | `QF` / `QI` / `QD` / `QP` |
| numero | string | Número del documento |
| version | string | Semver-like (`1.0`, `1.1`, `2.0`) |
| estado | QFEstado | `borrador` / `vigente` / `obsoleto` |
| titulo, descripcion | string | Metadata |
| historial | QFHistorialEntry[] | Cambios versionados |
| archivoUrl | string | PDF o doc en Storage |

**Helpers**: `formatQFNumeroCompleto`, `formatQFNumeroConVersion`, `incrementQFVersion`. Detalle: `memory/project_qf_documentos.md`.

---

## OrdenCompra
**Collection**: `ordenescompra`
**ID**: `OC-XXXX`

| Field | Type | Description |
|-------|------|-------------|
| numero | string | OC-0001 format |
| tipo | enum | `nacional` / `importacion` |
| estado | enum | `borrador` → `aprobada` → `enviada_proveedor` → `confirmada` → `recibida` |
| proveedorId | string | FK to Proveedor |
| items | ItemOC[] | Ordered items |
| importacionId | string | FK to Importacion (optional) |

---

## Importacion
**Collection**: `importaciones`
**ID**: `IMP-XXXX`

| Field | Type | Description |
|-------|------|-------------|
| numero | string | IMP-0001 format |
| estado | enum | `preparacion` → `embarcado` → `en_transito` → `en_aduana` → `despachado` → `recibido` |
| puertoOrigen, puertoDestino | string | Shipping ports |
| naviera, booking, contenedor | string | Shipping details |
| gastos | GastoImportacion[] | Import costs |

---

## TableCatalogEntry
**Collection**: `tableCatalog`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| name | string | Table name |
| description | string | Description |
| sysType | string | Equipment type (HPLC, GC, etc.) |
| tableType | enum | `validation` / `informational` / `instruments` / `checklist` / `text` / `signatures` |
| columns | TableCatalogColumn[] | Column definitions |
| templateRows | TableCatalogRow[] | Template row data |
| validationRules | TableCatalogRule[] | Auto-conclusion rules |
| allowClientSpec | boolean | Enable client spec mode |
| allowExtraRows | boolean | Allow adding rows |
| tipoServicio | string[] | Applicable service types |
| modelos | string[] | Applicable models |
| orden | number | Sort position |
| checklistItems | ChecklistItem[] | For checklist type |
| textContent | string | For text type |
| headerFields | TableHeaderField[] | Pre-table selectors |
| signatureMode | enum | `both` / `client` / `engineer` |
| status | enum | `draft` / `published` / `archived` |

### TableCatalogColumn
| Field | Type | Values |
|-------|------|--------|
| key | string | Column identifier |
| label | string | Display label |
| type | enum | `text_input` / `number_input` / `checkbox` / `fixed_text` / `date_input` / `pass_fail` / `select_input` |
| unit | string | Unit of measurement |
| required | boolean | Required field |
| expectedValue | string | For validation |
| fixedValue | string | For fixed_text columns |
| options | string[] | For select_input |
| width | string | Column width |

---

## ProtocolSelection
**Stored inside**: `/reportes/{otNumber}.protocolSelections[]`

| Field | Type | Description |
|-------|------|-------------|
| tableId | string | FK to TableCatalogEntry |
| tableSnapshot | TableCatalogEntry | Denormalized copy |
| filledData | Record<rowId, Record<colKey, value>> | User-filled data |
| resultado | enum | `CONFORME` / `NO_CONFORME` / `PENDIENTE` |
| clientSpecEnabled | boolean | Using client spec mode |
| checklistData | Record<itemId, answer> | For checklist tables |
| headerData | Record<fieldKey, value> | Header field values |

---

## InstrumentoPatron
**Collection**: `instrumentos`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| nombre | string | Name |
| tipo | enum | `instrumento` / `patron` |
| marca, modelo, serie | string | Identification |
| categorias | string[] | Category tags |
| certificadoUrl | string | Certificate PDF URL |
| certificadoVencimiento | string (ISO) | Certificate expiry |
| trazabilidadUrl | string | Traceability cert URL |
| reemplazaA | string | Replaces instrument ID |
| reemplazadoPor | string | Replaced by ID |

Helper: `calcularEstadoCertificado(vencimiento)` → `vigente` / `por_vencer` / `vencido` / `sin_certificado`

---

## Articulo
**Collection**: `articulos`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| codigo | string | Part number |
| descripcion | string | Description |
| tipo | enum | `repuesto` / `consumible` / `equipo` / `columna` / `accesorio` / `muestra` / `otro` |
| categoriaEquipoStock | enum | `HPLC` / `GC` / `MSD` / `UV` / `OSMOMETRO` / `GENERAL` |
| marcaId | string | FK to Marca |
| proveedorIds | string[] | FK to Proveedor |
| stockMinimo | number | Reorder point |
| precioReferencia | number | Reference price |
| posicionArancelaria | string | Tariff position |

---

## UnidadStock
**Collection**: `unidades`
**FK**: `articuloId`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| articuloId | string | FK to Articulo |
| nroSerie | string | Serial number |
| nroLote | string | Lot number |
| condicion | enum | `nuevo` / `bien_de_uso` / `reacondicionado` / `vendible` / `scrap` |
| estado | enum | `disponible` / `reservado` / `asignado` / `en_transito` / `consumido` / `vendido` / `baja` |
| ubicacion | UbicacionStock | Location object |

### UbicacionStock.tipo
`posicion` / `minikit` / `ingeniero` / `cliente` / `proveedor` / `transito`

---

## Remito
**Collection**: `remitos`
**ID**: `REM-XXXX`

| Field | Type | Description |
|-------|------|-------------|
| numero | string | REM-0001 format |
| tipo | enum | `salida_campo` / `entrega_cliente` / `devolucion` / `interno` / `derivacion_proveedor` / `loaner_salida` |
| estado | enum | `borrador` → `confirmado` → `en_transito` → `completado` |
| ingenieroId | string | FK to Ingeniero |
| items | RemitoItem[] | Dispatched units |

---

## FichaPropiedad
**Collection**: `fichas`
**ID**: `FPC-XXXX`

| Field | Type | Description |
|-------|------|-------------|
| numero | string | FPC-0001 format |
| sistemaId | string | FK to Sistema |
| clienteId | string | FK to Cliente |
| estado | enum | `recibido` → `en_diagnostico` → `en_reparacion` → `listo_para_entrega` → `entregado` |
| viaIngreso | enum | `ingeniero` / `envio` / `cliente_directo` |
| derivaciones | DerivacionProveedor[] | Provider derivations |
| loanerId | string | FK to Loaner (if assigned) |

---

## Loaner
**Collection**: `loaners`
**ID**: `LNR-XXXX`

| Field | Type | Description |
|-------|------|-------------|
| codigo | string | LNR-0001 format |
| articuloId | string | FK to Articulo |
| serie | string | Serial number |
| estado | enum | `en_base` / `en_cliente` / `en_transito` / `vendido` / `baja` |
| prestamos | PrestamoLoaner[] | Loan history |

---

## AgendaEntry
**Collection**: `agenda`

| Field | Type | Description |
|-------|------|-------------|
| fechaInicio, fechaFin | string (YYYY-MM-DD) | Date range |
| quarterStart, quarterEnd | 1-4 | Quarter of day |
| ingenieroId | string | FK to Ingeniero |
| otNumber | string | Related OT |
| estadoAgenda | enum | `pendiente` / `tentativo` / `confirmado` / `en_progreso` / `completado` / `cancelado` |

---

## Posta (workflow concept)
**No es un módulo top-level** — `Posta` es un patrón embebido dentro de Tickets, OC, Importaciones, Requerimientos, Agenda y Presupuestos para trackear handoffs entre usuarios.

| Field | Type | Description |
|-------|------|-------------|
| usuarioFromId, usuarioToId | string | Quién deriva a quién |
| categoria | enum | `administracion` / `soporte_tecnico` |
| estado | enum | `pendiente` / `en_proceso` / `completada` / `cancelada` |
| prioridad | enum | `baja` / `normal` / `alta` / `urgente` |
| timestamp | ISO string | Cuándo |
| comentario | string | Razón del handoff |

Tipo TS: `Posta`, `UsuarioPosta`, `PostaHandoff` (variantes según contexto).

---

## UsuarioAGS
**Collection**: `usuarios`
**ID**: Firebase UID

| Field | Type | Description |
|-------|------|-------------|
| email | string | Google email (`@agsanalitica.com` only) |
| displayName | string | Full name |
| role | UserRole | `admin` / `admin_soporte` / `admin_ing_soporte` / `ingeniero_soporte` / `administracion` / null |
| status | UserStatus | `pendiente` / `activo` / `deshabilitado` |
| permissionsOverride | UserPermissionsOverride | Per-user grants/revokes sobre defaults del rol (modelo híbrido) |
| areas | TicketArea[] | Áreas a las que pertenece (para tickets multi-rol) |
| lastLoginAt | string ISO | Last login |

**Helpers** (`@ags/shared/utils.ts`): `userHasRole`, `getUserPermissions`, `canAccessApp`, `canAccessModulo`, `getModuloFromPath`, `getUserTicketAreas`, `canUserModifyTicket`.

**Roles pendientes** (no implementados): `cliente`, `proveedor`, `admin_contable`. Detalle del modelo: `memory/project_rbac.md`.
