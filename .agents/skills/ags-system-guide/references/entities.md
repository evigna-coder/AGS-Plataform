# AGS Plataform — Complete Entity Reference

## Table of Contents
1. [Cliente](#cliente)
2. [Establecimiento](#establecimiento)
3. [Sistema (Equipo)](#sistema)
4. [ModuloSistema](#modulosistema)
5. [WorkOrder (OT)](#workorder)
6. [Lead](#lead)
7. [Presupuesto](#presupuesto)
8. [OrdenCompra](#ordencompra)
9. [Importacion](#importacion)
10. [TableCatalogEntry](#tablecatalogentry)
11. [ProtocolSelection](#protocolselection)
12. [InstrumentoPatron](#instrumentopatron)
13. [Articulo (Stock)](#articulo)
14. [UnidadStock](#unidadstock)
15. [Remito](#remito)
16. [FichaPropiedad](#fichapropiedad)
17. [Loaner](#loaner)
18. [AgendaEntry](#agendaentry)
19. [PostaWorkflow](#postaworkflow)
20. [UsuarioAGS](#usuarioags)

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

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated |
| razonSocial | string | Company name |
| contacto | string | Contact person |
| email, telefono | string | Contact info |
| motivoLlamado | enum | `ventas` / `soporte` / `insumos` / `administracion` / `otros` |
| estado | enum | `nuevo` → `en_revision` → `derivado` → `en_proceso` → `finalizado` / `perdido` |
| clienteId | string | FK to Cliente (optional) |
| sistemaId | string | FK to Sistema (optional) |
| source | enum | `qr` / `portal` / `manual` / null |
| asignadoA | string | Assigned user |
| postas | Posta[] | Handoff history |
| presupuestosIds | string[] | Related quotes |
| otIds | string[] | Related OTs |

---

## Presupuesto
**Collection**: `presupuestos`
**ID**: `PRE-XXXX`

| Field | Type | Description |
|-------|------|-------------|
| numero | string | PRE-0001 format |
| tipo | enum | `servicio` / `partes` / `ventas` / `contrato` / `mixto` |
| moneda | enum | `USD` / `ARS` / `EUR` |
| estado | enum | `borrador` → `enviado` → `pendiente_oc` → `aceptado` → `autorizado` → `rechazado` / `vencido` |
| clienteId | string | FK to Cliente |
| items | PresupuestoItem[] | Line items |
| subtotal, total | number | Calculated amounts |
| tipoCambio | number | Exchange rate |
| validezDias | number | Validity days (default 15) |
| condicionPagoId | string | Payment terms FK |

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

## PostaWorkflow
**Collection**: `postas`

| Field | Type | Description |
|-------|------|-------------|
| tipoEntidad | enum | `orden_compra` / `importacion` / `presupuesto` / `requerimiento` / `agenda` |
| categoria | enum | `administracion` / `soporte_tecnico` |
| estado | enum | `pendiente` / `en_proceso` / `completada` / `cancelada` |
| prioridad | enum | `baja` / `normal` / `alta` / `urgente` |
| responsableId | string | Current responsible user |
| historial | PostaHandoff[] | Handoff history |

---

## UsuarioAGS
**Collection**: `usuarios`
**ID**: Firebase UID

| Field | Type | Description |
|-------|------|-------------|
| email | string | Google email |
| displayName | string | Full name |
| role | enum | `admin` / `ingeniero_soporte` / `admin_soporte` / `administracion` / null |
| status | enum | `pendiente` / `activo` / `deshabilitado` |
| lastLoginAt | string (ISO) | Last login |
