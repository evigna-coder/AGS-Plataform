# Diseño de Módulos: Clientes, Equipos, Leads y Postas

**Versión:** 1.0  
**Fecha:** 2026-01  
**Estado:** Definición – pendiente implementación

---

## 1. Resumen Ejecutivo

El sistema modular debe priorizar **Clientes** y **Equipos** como base maestra. Los **Leads** representan **contactos de clientes** (existentes o no) con motivo de llamado, descripción, equipo involucrado si aplica, y un **sistema de postas** (derivaciones entre usuarios) hasta estado finalizado. Todo debe integrarse con **Presupuestos** y **Orden de Trabajo (OT)** para complementar el reporte de servicio.

---

## 2. Módulo Clientes (Base Maestra)

### 2.1 Propósito
Almacenar la información de **clientes** que se reutiliza en Leads, Presupuestos, OT y Facturación. **Usuarios:** Administración de soporte técnico e ingenieros/as de soporte técnico.

### 2.2 Entidad Principal: `Clientes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID documento Firestore |
| `razonSocial` | string | Nombre / razón social |
| `cuit` | string | CUIT (opcional) |
| `pais` | string | País (ej. Argentina) |
| `direccion` | string | Dirección fiscal |
| `localidad` | string | |
| `provincia` | string | |
| `codigoPostal` | string | |
| `rubro` | string | Rubro / actividad económica |
| `telefono` | string | Teléfono principal |
| `email` | string | Email principal |
| **Fiscal / IVA** | | |
| `condicionIva` | string | Condición frente al IVA (monotributo, RI, etc.) |
| `ingresosBrutos` | string | Ingresos brutos |
| `convenioMultilateral` | boolean | Convenio multilateral |
| **Pagos** | | |
| `infoPagos` | string | Información sobre pagos (texto libre) |
| `pagaEnTiempo` | boolean | Paga en tiempo |
| `sueleDemorarse` | boolean | Suele demorarse |
| `condicionPago` | string | Condición de pago: 60 días, 30, pago anticipado, contado, etc. |
| **Tipo de Servicio** | | |
| `tipoServicio` | string | 'contrato' \| 'per_incident' - Afecta tiempo de respuesta y si OT requiere aceptación de presupuesto |
| **Contactos** | | |
| `contactos` | array \| subcolección | Lista de contactos (ver 2.3). Subcolección `clientes/{id}/contactos` si pueden ser >20. |
| `notas` | string | Notas internas |
| `activo` | boolean | Baja lógica (solo inactivo, no eliminación física) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `createdBy` | string | uid usuario |

**Búsqueda:** por razón social, CUIT y nombres de contacto. **Vistas:** tabla y tarjetas.

### 2.3 Sub-entidad: Contacto de Cliente

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | uid |
| `nombre` | string | Nombre completo |
| `cargo` | string | Puesto / cargo |
| `sector` | string | Sector del contacto (laboratorio, control de calidad, compras, etc.) |
| `telefono` | string | |
| `email` | string | |
| `esPrincipal` | boolean | Contacto principal |

**Colección Firestore:** `clientes`. Contactos: subcolección `clientes/{id}/contactos` (permite >20 por cliente).

---

## 3. Módulo Equipos / Sistemas (Base Maestra)

### 3.1 Propósito
Registrar **sistemas** (equipos) por cliente, cada uno con **módulos** (bomba, inyector, detector, etc.). Se usa en Leads, Presupuestos, OT, **módulo loaner** y **ficha propiedad de cliente**. **Usuarios:** Administración de soporte e ingenieros/as de soporte.

### 3.2 Estructura jerárquica

1. **Categoría** (catálogo): Osmómetros, Cromatógrafos, etc.
2. **Sistema** (ej. HPLC 1260): nombre + descripción (ej. “Cromatógrafo líquido”). Pertenece a un cliente y a una categoría.
3. **Módulos** del sistema: Bomba, Inyector, Detector, etc. Cada uno: número de serie, descripción, **versión de firmware**.

### 3.3 Código interno del cliente
- Lo asigna el **cliente** al equipo. Si no tiene, se puede asignar un **provisorio** con posibilidad de cambiarlo después.

### 3.4 Entidad: `Sistemas` (equipo “padre”)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID documento |
| `clienteId` | string | FK → clientes |
| `categoriaId` | string | FK → categorias_equipo (Osmómetros, Cromatógrafos, etc.) |
| `nombre` | string | Ej. HPLC 1260 |
| `descripcion` | string | Ej. Cromatógrafo líquido |
| `codigoInternoCliente` | string | Código que asigna el cliente; si no tiene, provisorio editable |
| `observaciones` | string | Observaciones por sistema (ej. “usa sellos de fase normal”) |
| `activo` | boolean | Baja lógica |
| **Ubicaciones** | | Múltiples; historial para loaner, derivaciones, ficha propiedad |
| `ubicaciones` | array | Ver 3.7. Actual(es) + historial |
| **OT** | | |
| `otIds` | array | IDs de OTs vinculadas a este sistema (consultar historial) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `createdBy` | string | |

**Colección Firestore:** `sistemas` (o `equipos` manteniendo lógica Sistema+Módulos).

### 3.5 Entidad: `Módulos` (subcolección por sistema)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | uid |
| `sistemaId` | string | FK sistema padre |
| `nombre` | string | Ej. Bomba, Inyector, Detector |
| `descripcion` | string | |
| `serie` | string | Número de serie |
| `firmware` | string | Versión de firmware |
| `observaciones` | string | Ej. “bomba tiene canal c anulado” |
| **Ubicaciones** | | Múltiples; historial (reparación, loaner, derivaciones) |
| `ubicaciones` | array | Ver 3.7 |
| **OT** | | |
| `otIds` | array | OTs asignadas a este módulo |

**Subcolección:** `sistemas/{id}/modulos`.

### 3.6 Catálogo: `Categorias equipo`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | |
| `nombre` | string | Osmómetros, Cromatógrafos, etc. |

**Colección Firestore:** `categorias_equipo`.

### 3.7 Ubicaciones (múltiples + historial)

Tanto **sistema** como **módulo** pueden tener **varias ubicaciones** e **historial** de movimientos. Fundamental para:
- **Módulo loaner**: préstamos en lugar de equipo en reparación, derivaciones.
- **Ficha propiedad de cliente**: módulos recibidos para reparar, en taller, en tránsito, etc.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | uid |
| `lugar` | string | Ej. “Cliente X – Planta”, “Taller AGS”, “En tránsito a Y” |
| `tipo` | string | cliente \| taller \| loaner \| transito \| otro |
| `fechaDesde` | string | ISO |
| `fechaHasta` | string \| null | Si sigue ahí, null |
| `detalle` | string | Opcional |
| `esActual` | boolean | Si es la ubicación vigente |

Se guarda **historial** de cambios (no se borran ubicaciones antiguas).

### 3.8 Historial y relación con OT
- Cada **sistema** muestra todas las **OT** vinculadas (`otIds` o query por `sistemaId`).
- Cada **módulo** muestra las **OT** asignadas a ese módulo (`otIds`).
- La **OT** (reporte de servicio) referencia `sistemaId` y opcionalmente `moduloIds[]`.

### 3.9 Navegación
- **Desde Clientes:** ficha de cliente → ver **sistemas/equipos** de ese cliente (tab o sección).
- **Módulo Equipos** separado en menú: listado global de sistemas (con filtro por cliente, categoría, etc.).

---

## 4. Módulo Leads (Refinado)

### 4.1 Propósito
Registrar **contactos de clientes** (existentes o no). Si el cliente existe → seleccionable desde BD (Clientes + Contactos). Si no → carga manual o “Agregar cliente” en el sistema. Incluir **motivo del llamado**, **motivo del contacto** (descripción), **equipo** si aplica, y **sistema de postas**.

### 4.2 Origen del contacto
- **Cliente existente:**  
  - Seleccionar **Cliente** (desde `clientes`).  
  - Seleccionar **Contacto** (desde `clientes.contactos`).  
  - Mail, teléfono, etc. se **precargan** desde Cliente/Contacto (editables si hace falta).
- **Cliente nuevo:**  
  - Opción A: Ingresar **Razón social** (y datos básicos) en el propio formulario del lead.  
  - Opción B: Botón **“Agregar cliente”** que abre alta en módulo Clientes; al guardar, se vuelve al Lead y se puede asignar ese cliente.

### 4.3 Campos Esenciales del Lead

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID documento |
| `clienteId` | string \| null | Si existe cliente → FK `clientes`. Si no, null. |
| `contactoId` | string \| null | Si existe contacto → id en `clientes.contactos`. Si no, null. |
| `razonSocial` | string | Siempre. Si cliente existe → precargado, sino manual. |
| `contacto` | string | Nombre persona que contacta |
| `email` | string | |
| `telefono` | string | |
| **`motivoLlamado`** | enum | **Ventas \| Soporte \| Insumos \| Administración \| Otros** |
| **`motivoContacto`** | string | **Descripción del motivo** (texto libre). Ej.: “Falla en equipo X”, “Consulta por repuesto”, etc. |
| **`sistemaId`** | string \| null | Si aplica (ej. problema en equipo) → FK `sistemas`. Opcional. |
| `estado` | enum | Ver 4.5 |
| `postas` | array | Historial de postas (ver 5) |
| `asignadoA` | string \| null | Usuario actual responsable (uid) |
| `derivadoPor` | string \| null | Último usuario que derivó |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `createdBy` | string | |
| `finalizadoAt` | timestamp \| null | Cuando estado = finalizado |

### 4.4 Motivo del llamado (catálogo)

- `ventas`
- `soporte`
- `insumos`
- `administracion`
- `otros`

*(Definir si “otros” permite texto adicional o solo descripción en motivo contacto.)*

### 4.5 Estados del Lead (para postas y grilla)

- `nuevo` – Recién creado
- `en_revision` – Alguien lo está viendo
- `derivado` – Derivado a otro usuario/área
- `en_proceso` – En gestión
- `finalizado` – Cerrado (resuelto, perdido, etc.)
- `perdido` – (opcional) Caso perdido

**Colección Firestore:** `leads`

---

## 5. Sistema de Postas (Derivaciones)

### 5.1 Concepto
Una **posta** es una derivación del lead de un usuario/área a otro. Ejemplo:  
**Administración de soporte** (recibe) → **Esteban Vigna** (revisa) → **Ingeniería de soporte** → **Fanely Blain** o **Aldana Di Marco** → … hasta **finalizado**.

### 5.2 Entidad: Posta (item en `leads.postas`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | uid |
| `fecha` | timestamp | Cuándo se derivó |
| `deUsuarioId` | string | Quién derivó |
| `deUsuarioNombre` | string | Ej. "Esteban Vigna" |
| `aUsuarioId` | string | A quién se deriva |
| `aUsuarioNombre` | string | Ej. "Fanely Blain" |
| `comentario` | string | Motivo de la derivación / nota |
| `estadoAnterior` | string | Estado antes de derivar |
| `estadoNuevo` | string | Estado después (ej. `derivado`, `en_proceso`) |

### 5.3 Flujo
1. Usuario A recibe o tiene el lead asignado.
2. Usuario A **deriva** a Usuario B (opcional: comentario).
3. Se agrega una **posta** en `leads.postas`.
4. `asignadoA` = Usuario B, `derivadoPor` = Usuario A, `estado` según regla (ej. `derivado`).
5. Se repite hasta que alguien **finaliza** el lead.

### 5.4 Usuarios / Áreas
- Definir **lista de usuarios** que pueden recibir postas (ej. Esteban Vigna, Fanely Blain, Aldana Di Marco, etc.).
- Podría ser colección `usuarios` o `equipos` (áreas) + `usuarios`.  
- Por ahora: catálogo sencillo (nombre, uid, área) suficiente para la grilla de seguimiento.

---

## 6. Grilla de Seguimiento (Leads)

### 6.1 Vista principal
- **Grilla (tabla)** de leads con al menos:
  - Fecha creación
  - Razón social / Cliente
  - Contacto
  - **Motivo llamado**
  - **Motivo contacto** (resumen o tooltip)
  - **Sistema** (si aplica)
  - **Estado**
  - **Usuario asignado**
  - **Última posta** (quién derivó, a quién, fecha)
  - Acciones: Ver detalle, Derivar, Finalizar

### 6.2 Filtros útiles
- Por estado
- Por usuario asignado
- Por motivo de llamado
- Por cliente
- Rango de fechas

### 6.3 Detalle del lead
- Todos los datos del lead.
- **Historial de postas** (timeline o lista).
- Acciones: **Derivar** (seleccionar usuario destino, comentario), **Finalizar**, **Editar**.

---

## 7. Integración con Presupuestos y OT

### 7.1 Lead → Presupuesto
- Desde un lead **finalizado** o **en proceso** se puede **“Crear presupuesto”**.
- El presupuesto hereda: Cliente, Contacto, Sistema (si aplica).
- Se mantiene referencia `leadId` en el presupuesto.

### 7.2 Presupuesto → OT
- Cuando el presupuesto se **acepta**:
  - Crear **OT** (número según formato 5 dígitos + .NN).
  - Precargar en la OT: Cliente, Contacto, Sistema/Módulos, dirección, etc., desde Clientes/Sistemas (y si viene de lead, desde lead → cliente → sistema).
  - Vincular OT con `presupuestoId` y opcionalmente `leadId`.

### 7.3 Reporte de Servicio (actual)
- El **reporte de servicio** (módulo ya existente) sigue siendo la OT.
- La OT se alimenta de **Clientes** y **Sistemas/Módulos** (y de Lead/Presupuesto cuando aplica).
- No se modifica el layout del PDF ni las reglas de impresión actuales; solo el **origen de los datos** (maestros Clientes/Sistemas + Presupuesto/Lead).

---

## 8. Plan de Implementación por Fases

### Fase 1: Base maestra (prioridad máxima)
1. **Clientes**  
   - CRUD completo con campos fiscal/IVA, pagos, sector, rubro, país.  
   - Contactos como **subcolección** `clientes/{id}/contactos`.  
   - Búsqueda por razón social, CUIT, nombres de contacto. Vistas tabla y tarjetas.  
   - Solo baja lógica (`activo`).
2. **Categorías equipo**  
   - Catálogo (Osmómetros, Cromatógrafos, etc.).
3. **Sistemas (equipos)**  
   - CRUD por cliente; categoría; nombre, descripción, código interno (provisorio editable).  
   - Observaciones por sistema.  
   - Ubicaciones múltiples + historial (estructura definida; loaner/derivaciones en fases posteriores).  
   - Vista “Sistemas por cliente” desde ficha de cliente.
4. **Módulos por sistema**  
   - CRUD en subcolección `sistemas/{id}/modulos`. Serie, descripción, firmware, observaciones.  
   - Ubicaciones múltiples + historial por módulo.
5. **Módulo Equipos** en menú  
   - Listado global de sistemas con filtros (cliente, categoría).  
   - Vinculación con OT e historial OT por sistema/módulo: definida en modelo; implementación completa en fase de integración.

### Fase 2: Leads refinado
6. **Leads**  
   - Cliente existente: selector de Cliente + Contacto, precarga de datos.  
   - Cliente nuevo: carga manual + “Agregar cliente”.  
   - **Motivo llamado** (catálogo).  
   - **Motivo contacto** (descripción).  
   - **Sistema** seleccionable si aplica.  
   - Ajustar estados y campos actuales.

### Fase 3: Postas y grilla
7. **Usuarios** (catálogo mínimo para derivaciones).  
8. **Sistema de postas**: derivar, historial, `asignadoA`, `derivadoPor`.  
9. **Grilla de seguimiento** con estados, usuario asignado, última posta, filtros.

### Fase 4: Integración
10. **Presupuestos**: crear desde lead, vincular cliente/sistema.  
11. **OT**: crear desde presupuesto aceptado, precargar desde Clientes/Sistemas/Módulos.  
12. Integración opcional con reporte de servicio (datos precargados en formulario OT).

---

## 9. Colecciones Firestore Resumidas

| Colección | Uso |
|-----------|-----|
| `clientes` | Maestro de clientes (fiscal, pagos, sector, rubro, país) |
| `clientes/{id}/contactos` | Subcolección de contactos por cliente |
| `categorias_equipo` | Catálogo: Osmómetros, Cromatógrafos, etc. |
| `sistemas` | Sistemas (equipos) por cliente; categoría; ubicaciones + historial |
| `sistemas/{id}/modulos` | Módulos por sistema (serie, firmware, observaciones, ubicaciones) |
| `leads` | Contactos (existentes o no), motivo llamado/contacto, sistema, postas |
| `usuarios` | Catálogo para postas (derivaciones) |
| `presupuestos` | Futuro; vinculados a leads/clientes/sistemas |
| `reportes` / OT | Ya existente; se alimenta de clientes/sistemas/módulos/presupuesto |

---

## 10. Próximos Pasos Recomendados

1. **Validar** este diseño (nombres de campos, enums, flujo de postas).  
2. **Implementar Fase 1:** Clientes + Equipos.  
3. **Refactorizar Leads** según Fase 2 (cliente/contacto/equipo, motivo llamado/contacto).  
4. **Implementar Fase 3:** Postas + grilla de seguimiento.  
5. **Definir** formato exacto de Presupuestos y vínculo OT (Fase 4).

Si se aprueba este diseño, el siguiente paso técnico es **Fase 1: módulos Clientes y Equipos** y, en paralelo, ajustar el modelo de datos de Leads en código según lo anterior.
