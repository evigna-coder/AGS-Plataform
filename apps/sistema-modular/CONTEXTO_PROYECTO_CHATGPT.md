# AGS Sistema Modular - Contexto Completo para Asistente IA

## 1. Resumen Ejecutivo

**AGS Sistema Modular** es una aplicación de gestión administrativa para **AGS Analítica**, empresa de soporte técnico de equipos analíticos de laboratorio (osmómetros, cromatógrafos HPLC/GC, espectrofotómetros, etc.).

### Stack Tecnológico
- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS
- **Routing:** React Router v7
- **Base de datos:** Firebase Firestore
- **Desktop:** Electron (aplicación Windows)
- **Estructura:** Monorepo con pnpm workspaces

### Objetivo del Sistema
Gestionar el ciclo completo: **Lead → Presupuesto → Orden de Trabajo (OT) → Facturación**

---

## 2. Estructura del Proyecto

```
apps/sistema-modular/
├── src/
│   ├── App.tsx                    # Router principal con todas las rutas
│   ├── main.tsx                   # Entry point React
│   ├── index.css                  # Tailwind CSS
│   ├── components/
│   │   ├── Layout.tsx             # Navegación lateral + header
│   │   └── ui/
│   │       ├── Button.tsx         # Botón con variantes
│   │       ├── Card.tsx           # Contenedor tarjeta
│   │       ├── Input.tsx          # Input con estilos
│   │       └── SearchableSelect.tsx # Select con búsqueda
│   ├── pages/
│   │   ├── clientes/              # Módulo Clientes
│   │   │   ├── ClientesList.tsx   # Lista con búsqueda y filtros
│   │   │   ├── ClienteNew.tsx     # Formulario creación
│   │   │   ├── ClienteDetail.tsx  # Detalle + edición + contactos
│   │   │   └── index.tsx          # Exports
│   │   ├── equipos/               # Módulo Equipos/Sistemas
│   │   │   ├── EquiposList.tsx    # Lista con filtros
│   │   │   ├── EquipoNew.tsx      # Formulario creación
│   │   │   ├── EquipoDetail.tsx   # Detalle + módulos
│   │   │   ├── CategoriasEquipo.tsx # CRUD categorías
│   │   │   └── index.tsx
│   │   ├── leads/                 # Módulo Leads
│   │   │   ├── LeadsList.tsx
│   │   │   ├── LeadNew.tsx
│   │   │   ├── LeadDetail.tsx
│   │   │   └── index.tsx
│   │   ├── ordenes-trabajo/       # Módulo OT
│   │   │   ├── OTList.tsx
│   │   │   ├── OTNew.tsx
│   │   │   ├── OTDetail.tsx
│   │   │   ├── TiposServicio.tsx
│   │   │   └── index.ts
│   │   └── presupuestos/          # Módulo Presupuestos
│   │       ├── PresupuestosList.tsx
│   │       ├── PresupuestoNew.tsx
│   │       ├── PresupuestoDetail.tsx
│   │       ├── CategoriasPresupuesto.tsx
│   │       ├── CondicionesPago.tsx
│   │       └── index.ts
│   └── services/
│       └── firebaseService.ts     # TODOS los servicios CRUD
└── electron/                      # Configuración Electron (desktop)
```

---

## 3. Modelo de Datos (Firestore)

### Colecciones Principales

| Colección | Descripción |
|-----------|-------------|
| `clientes` | Clientes con datos fiscales, pagos, tipo servicio |
| `clientes/{id}/contactos` | Subcolección de contactos por cliente |
| `categorias_equipo` | Catálogo: Osmómetros, Cromatógrafos, etc. |
| `categorias_modulo` | Catálogo: Bombas, Detectores, etc. |
| `sistemas` | Equipos/sistemas por cliente |
| `sistemas/{id}/modulos` | Subcolección de módulos por sistema |
| `leads` | Contactos/consultas de clientes |
| `reportes` | Órdenes de trabajo (OT) - colección compartida |
| `presupuestos` | Cotizaciones con items y estados |
| `tipos_servicio` | Tipos de servicio técnico |
| `categorias_presupuesto` | Reglas tributarias (IVA, ganancias, IIBB) |
| `condiciones_pago` | Plazos de pago |
| `ordenes_compra` | OCs vinculadas a presupuestos |

---

## 4. Tipos TypeScript (Modelo de Datos Completo)

```typescript
// ============ TIPOS AUXILIARES ============

export type CondicionIva =
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento'
  | 'consumidor_final'
  | 'otro';

export type CondicionPago =
  | 'contado'
  | 'pago_anticipado'
  | '30_dias'
  | '60_dias'
  | '90_dias'
  | 'otro';

export type TipoServicioCliente = 'contrato' | 'per_incident';

export type TipoUbicacion = 'cliente' | 'taller' | 'loaner' | 'transito' | 'otro';

export type MotivoLlamado = 'ventas' | 'soporte' | 'insumos' | 'administracion' | 'otros';

export type LeadEstado = 'nuevo' | 'en_revision' | 'derivado' | 'en_proceso' | 'finalizado' | 'perdido';

export type PresupuestoEstado = 
  | 'borrador'
  | 'enviado'
  | 'en_seguimiento'
  | 'pendiente_oc'
  | 'aceptado'
  | 'pendiente_certificacion'
  | 'aguarda';

// ============ MÓDULO CLIENTES ============

export interface ContactoCliente {
  id: string;
  nombre: string;
  cargo: string;
  sector: string;           // laboratorio, control de calidad, compras, etc.
  telefono: string;
  interno?: string;         // Interno del teléfono
  email: string;
  esPrincipal: boolean;
}

export interface Cliente {
  id: string;
  razonSocial: string;
  cuit?: string;
  pais: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal?: string;
  rubro: string;
  // Fiscal
  condicionIva?: CondicionIva;
  ingresosBrutos?: string;
  convenioMultilateral?: boolean;
  // Pagos
  infoPagos?: string;
  pagaEnTiempo?: boolean;
  sueleDemorarse?: boolean;
  condicionPago?: CondicionPago;
  // Servicio
  tipoServicio?: TipoServicioCliente;  // 'contrato' = sin presupuesto, 'per_incident' = requiere presupuesto
  // Otros
  contactos: ContactoCliente[];
  notas?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ============ MÓDULO EQUIPOS ============

export interface CategoriaEquipo {
  id: string;
  nombre: string;           // Osmómetros, Cromatógrafos, etc.
  modelos?: string[];       // Modelos: HPLC 1200, HPLC 1260, etc.
}

export interface ModeloModulo {
  codigo: string;           // G1311A
  descripcion: string;      // Bomba Cuaternaria
}

export interface CategoriaModulo {
  id: string;
  nombre: string;           // Bombas, Detectores, Inyectores
  modelos: ModeloModulo[];
}

export interface Ubicacion {
  id: string;
  lugar: string;            // "Cliente X – Planta", "Taller AGS"
  tipo: TipoUbicacion;
  fechaDesde: string;
  fechaHasta: string | null;
  detalle?: string;
  esActual: boolean;
}

export interface ModuloSistema {
  id: string;
  sistemaId: string;
  nombre: string;           // Bomba, Inyector, Detector
  descripcion?: string;
  serie?: string;           // Número de serie
  firmware?: string;        // Versión firmware
  observaciones?: string;
  ubicaciones: Ubicacion[];
  otIds: string[];          // OTs vinculadas a este módulo
}

export interface Sistema {
  id: string;
  clienteId: string;
  categoriaId: string;
  nombre: string;           // HPLC 1260
  descripcion?: string;
  codigoInternoCliente: string;  // Código asignado por cliente o provisorio
  software?: string;        // Software del sistema
  observaciones?: string;
  activo: boolean;
  ubicaciones: Ubicacion[];
  otIds: string[];          // OTs vinculadas
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ============ MÓDULO LEADS ============

export interface Posta {
  id: string;
  fecha: string;
  deUsuarioId: string;
  deUsuarioNombre: string;
  aUsuarioId: string;
  aUsuarioNombre: string;
  comentario?: string;
  estadoAnterior: LeadEstado;
  estadoNuevo: LeadEstado;
}

export interface Lead {
  id: string;
  clienteId: string | null;
  contactoId: string | null;
  razonSocial: string;
  contacto: string;
  email: string;
  telefono: string;
  motivoLlamado: MotivoLlamado;
  motivoContacto: string;     // Descripción del motivo
  sistemaId: string | null;   // Equipo involucrado si aplica
  estado: LeadEstado;
  postas: Posta[];            // Historial de derivaciones
  asignadoA: string | null;
  derivadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizadoAt?: string | null;
}

// ============ MÓDULO PRESUPUESTOS ============

export interface PresupuestoItem {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;             // 'unidad', 'hora', 'servicio'
  precioUnitario: number;
  categoriaPresupuestoId?: string;
  subtotal: number;
}

export interface CategoriaPresupuesto {
  id: string;
  nombre: string;
  descripcion?: string;
  incluyeIva: boolean;
  porcentajeIva?: number;
  incluyeGanancias: boolean;
  porcentajeGanancias?: number;
  incluyeIIBB: boolean;
  porcentajeIIBB?: number;
  ivaReduccion?: boolean;
  porcentajeIvaReduccion?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CondicionPago {
  id: string;
  nombre: string;
  dias: number;
  descripcion?: string;
  activo: boolean;
}

export interface OrdenCompra {
  id: string;
  numero: string;             // OC-0000
  presupuestoIds: string[];
  archivoUrl?: string;
  archivoNombre?: string;
  fechaRecepcion: string;
  notas?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Presupuesto {
  id: string;
  numero: string;             // PRE-0000
  clienteId: string;
  sistemaId?: string | null;
  contactoId?: string | null;
  estado: PresupuestoEstado;
  items: PresupuestoItem[];
  subtotal: number;
  total: number;
  tipoCambio?: number;
  condicionPagoId?: string;
  ordenesCompraIds: string[];
  notasTecnicas?: string;
  validUntil?: string;
  fechaEnvio?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ============ MÓDULO ÓRDENES DE TRABAJO (OT) ============

export interface Part {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  origen: string;
}

export interface WorkOrder {
  otNumber: string;           // 5 dígitos + opcional .NN (ej: 30001.02)
  status: 'BORRADOR' | 'FINALIZADO';
  budgets: string[];
  tipoServicio: string;
  esFacturable: boolean;
  tieneContrato: boolean;
  esGarantia: boolean;
  // Datos del cliente
  razonSocial: string;
  contacto: string;
  direccion: string;
  localidad: string;
  provincia: string;
  // Datos del equipo
  sistema: string;
  moduloModelo: string;
  moduloDescripcion: string;
  moduloSerie: string;
  codigoInternoCliente: string;
  // Fechas y tiempos
  fechaInicio: string;
  fechaFin: string;
  horasTrabajadas: string;
  tiempoViaje: string;
  // Reporte
  reporteTecnico: string;
  accionesTomar: string;
  articulos: Part[];
  // Contacto
  emailPrincipal: string;
  // Firmas
  signatureEngineer: string | null;
  aclaracionEspecialista: string;
  signatureClient: string | null;
  aclaracionCliente: string;
  updatedAt: string;
  // Campos para integración con Sistema Modular
  clienteId?: string;
  sistemaId?: string;
  moduloId?: string;
  createdAt?: string;
  createdBy?: string;
  fechaAsignacion?: string;
  fechaCierre?: string;
  materialesParaServicio?: string;
  problemaFallaInicial?: string;
}

export interface TipoServicio {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsuarioPosta {
  id: string;
  nombre: string;
  email?: string;
  area?: string;
}
```

---

## 5. Rutas de la Aplicación

```typescript
// App.tsx - Rutas configuradas
<Routes>
  <Route path="/" element={<Navigate to="/clientes" replace />} />
  
  {/* Clientes */}
  <Route path="/clientes" element={<ClientesList />} />
  <Route path="/clientes/nuevo" element={<ClienteNew />} />
  <Route path="/clientes/:id" element={<ClienteDetail />} />
  
  {/* Equipos */}
  <Route path="/equipos" element={<EquiposList />} />
  <Route path="/equipos/nuevo" element={<EquipoNew />} />
  <Route path="/equipos/:id" element={<EquipoDetail />} />
  <Route path="/categorias-equipo" element={<CategoriasEquipo />} />
  
  {/* Órdenes de Trabajo */}
  <Route path="/ordenes-trabajo" element={<OTList />} />
  <Route path="/ordenes-trabajo/nuevo" element={<OTNew />} />
  <Route path="/ordenes-trabajo/:otNumber" element={<OTDetail />} />
  <Route path="/tipos-servicio" element={<TiposServicio />} />
  
  {/* Leads */}
  <Route path="/leads" element={<LeadsList />} />
  <Route path="/leads/nuevo" element={<LeadNew />} />
  <Route path="/leads/:id" element={<LeadDetail />} />
  
  {/* Presupuestos */}
  <Route path="/presupuestos" element={<PresupuestosList />} />
  <Route path="/presupuestos/nuevo" element={<PresupuestoNew />} />
  <Route path="/presupuestos/:id" element={<PresupuestoDetail />} />
  <Route path="/presupuestos/categorias" element={<CategoriasPresupuesto />} />
  <Route path="/presupuestos/condiciones-pago" element={<CondicionesPago />} />
  
  {/* Próximamente */}
  <Route path="/stock" element={<Placeholder />} />
  <Route path="/agenda" element={<Placeholder />} />
  <Route path="/facturacion" element={<Placeholder />} />
</Routes>
```

---

## 6. Servicios Disponibles (firebaseService.ts)

```typescript
// Servicios implementados y exportados:

// Clientes
clientesService.create(data)
clientesService.getAll(activosOnly?)
clientesService.getById(id)
clientesService.search(term)
clientesService.update(id, data)
clientesService.deactivate(id)
clientesService.activate(id)

// Contactos (subcolección)
contactosService.create(clienteId, data)
contactosService.getByCliente(clienteId)
contactosService.update(clienteId, contactoId, data)
contactosService.delete(clienteId, contactoId)

// Categorías Equipo
categoriasEquipoService.create(data)
categoriasEquipoService.getAll()
categoriasEquipoService.getById(id)
categoriasEquipoService.update(id, data)
categoriasEquipoService.delete(id)

// Categorías Módulo
categoriasModuloService.create(data)
categoriasModuloService.getAll()
categoriasModuloService.getById(id)
categoriasModuloService.update(id, data)
categoriasModuloService.delete(id)

// Sistemas
sistemasService.create(data)
sistemasService.getAll(filters?: { clienteId?, activosOnly? })
sistemasService.getById(id)
sistemasService.update(id, data)
sistemasService.deactivate(id)
sistemasService.delete(id)

// Módulos (subcolección)
modulosService.create(sistemaId, data)
modulosService.getBySistema(sistemaId)
modulosService.getById(sistemaId, moduloId)
modulosService.update(sistemaId, moduloId, data)
modulosService.delete(sistemaId, moduloId)

// Leads
leadsService.create(data)
leadsService.getAll()
leadsService.getById(id)
leadsService.update(id, data)
leadsService.delete(id)

// Órdenes de Trabajo
ordenesTrabajoService.getNextOtNumber()
ordenesTrabajoService.getNextItemNumber(otPadre)
ordenesTrabajoService.getAll(filters?)
ordenesTrabajoService.getByOtNumber(otNumber)
ordenesTrabajoService.getItemsByOtPadre(otPadre)
ordenesTrabajoService.create(data)
ordenesTrabajoService.update(otNumber, data)
ordenesTrabajoService.delete(otNumber)

// Tipos de Servicio
tiposServicioService.create(data)
tiposServicioService.getAll()
tiposServicioService.getById(id)
tiposServicioService.update(id, data)
tiposServicioService.delete(id)

// Presupuestos
presupuestosService.getNextPresupuestoNumber()
presupuestosService.create(data)
presupuestosService.getAll(filters?)
presupuestosService.getById(id)
presupuestosService.update(id, data)
presupuestosService.delete(id)

// Órdenes de Compra
ordenesCompraService.getNextOCNumber()
ordenesCompraService.create(data)
ordenesCompraService.getAll()
ordenesCompraService.getById(id)
ordenesCompraService.update(id, data)
ordenesCompraService.delete(id)

// Categorías Presupuesto
categoriasPresupuestoService.create(data)
categoriasPresupuestoService.getAll()
categoriasPresupuestoService.getById(id)
categoriasPresupuestoService.update(id, data)
categoriasPresupuestoService.delete(id)

// Condiciones de Pago
condicionesPagoService.create(data)
condicionesPagoService.getAll()
condicionesPagoService.getById(id)
condicionesPagoService.update(id, data)
condicionesPagoService.delete(id)
```

---

## 7. Estado de Implementación

| Módulo | Estado | Notas |
|--------|--------|-------|
| **Clientes** | ✅ Completo | CRUD + contactos + búsqueda |
| **Equipos/Sistemas** | ✅ Completo | CRUD + módulos + categorías |
| **Leads** | ⚠️ Básico | Falta: postas, derivaciones, grilla |
| **Órdenes de Trabajo** | ✅ Funcional | Numeración automática, estados |
| **Presupuestos** | ✅ Funcional | Items, estados, categorías tributarias |
| **Stock** | ❌ Pendiente | Placeholder |
| **Agenda** | ❌ Pendiente | Placeholder |
| **Facturación** | ❌ Pendiente | Placeholder |

---

## 8. Plan de Fases Futuras

### Fase 2: Leads Refinado
- Selector de cliente/contacto existente
- Agregar "motivo llamado" (catálogo) y "motivo contacto" (descripción)
- Selector de sistema si aplica
- Migrar leads actuales

### Fase 3: Postas y Grilla
- Catálogo de usuarios para derivaciones
- Sistema de postas (derivar de usuario a usuario)
- Historial de derivaciones
- Grilla de seguimiento con filtros

### Fase 4: Integración
- Crear presupuesto desde lead
- Crear OT desde presupuesto aceptado
- Precarga de datos cliente/sistema en OT
- Vincular Lead → Presupuesto → OT

---

## 9. Comandos Útiles

```bash
# Desarrollo web (puerto 3001)
pnpm dev:modular

# Desarrollo Electron (desktop)
pnpm dev:modular:electron

# Build producción
pnpm build:modular

# Instalar dependencias
pnpm install
```

---

## 10. Notas Importantes

1. **Subcolecciones**: Contactos (`clientes/{id}/contactos`) y Módulos (`sistemas/{id}/modulos`) usan subcolecciones de Firestore para escalar mejor.

2. **Baja lógica**: Clientes y sistemas no se eliminan físicamente, solo se marcan como `activo: false`.

3. **Numeración automática**:
   - OT: 5 dígitos desde 30000 (ej: 30001, 30002.01)
   - Presupuestos: PRE-0001, PRE-0002
   - OC: OC-0001, OC-0002

4. **Tipo de servicio cliente**:
   - `contrato`: No requiere aceptación de presupuesto para crear OT
   - `per_incident`: Requiere presupuesto aceptado antes de OT

5. **Relación con reportes-ot**: El Sistema Modular comparte la colección `reportes` con la app legacy `reportes-ot`. Ambas apps pueden leer/escribir OTs.

---

**Archivo generado para compartir contexto con asistentes IA.**
