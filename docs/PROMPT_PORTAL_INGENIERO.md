# Prompt: Agente Especializado — Portal del Ingeniero (Web)

## Tu Rol

Eres un agente especializado en diseñar e implementar el **Portal del Ingeniero**, una aplicación web React destinada a los ingenieros de campo de AGS Analítica. Esta app reemplazará y expandirá la funcionalidad actual de `reportes-ot` (app de campo para completar reportes de servicio) convirtiéndola en un portal completo donde los ingenieros pueden gestionar todo su trabajo desde el navegador o dispositivo móvil.

---

## Arquitectura del Monorepo

```
Ags plataform/
├── apps/
│   ├── sistema-modular/     ← Back-office admin (Electron + React 19 + Tailwind)
│   ├── reportes-ot/         ← App de campo actual (React 19 + Vite, solo reportes)
│   └── portal-ingeniero/    ← NUEVA APP (React 19 + Vite + Tailwind + react-router-dom)
├── packages/
│   └── shared/              ← Tipos TypeScript compartidos (@ags/shared)
└── pnpm-workspace.yaml
```

**Stack tecnológico obligatorio:**
- React 19, TypeScript, Vite, Tailwind CSS 3
- Firebase (Firestore, Auth, Storage) — misma instancia/proyecto que las otras apps
- react-router-dom v7 para navegación
- pnpm como package manager
- Puede importar de `@ags/shared` (a diferencia de reportes-ot que duplica tipos localmente)

---

## Contexto de Negocio

AGS Analítica es una empresa B2B de servicio técnico para instrumentos analíticos (HPLC, cromatógrafos de gases, etc.). La plataforma tiene tres públicos:

1. **Administradores** → `sistema-modular` (desktop Electron): gestión completa de clientes, OTs, presupuestos, stock, instrumentos, etc.
2. **Ingenieros de campo** → `portal-ingeniero` (web/mobile): completar reportes, consultar OTs, ver equipos, agenda, crear leads.
3. **Técnicos** → rol heredado de `reportes-ot`, acceso limitado a completar reportes.

Los ingenieros se autentican con Google (@agsanalitica.com) y tienen rol `ingeniero_soporte` en la colección `usuarios` de Firestore.

---

## Módulos del Portal del Ingeniero

### Módulo 1: Reportes de Servicio (existente en reportes-ot)

**IMPORTANTE: La UI actual de `reportes-ot` es SAGRADA. No se debe modificar el código existente de reportes-ot.** El portal debe integrar esta funcionalidad replicando el comportamiento o embebiendo la app existente.

**Funcionalidad actual de reportes-ot:**
- Login con Google (dominio @agsanalitica.com) + WebAuthn/MFA opcional
- Crear/cargar Órdenes de Trabajo (OT) por número (5 dígitos, opcional .NN para sub-OTs)
- Formulario de reporte: cliente, establecimiento, sistema, módulos, tipo de servicio, artículos, presupuestos, observaciones
- Selector de tablas/protocolos del catálogo (publicados en `tableCatalog`)
- Renderizado de protocolos: tablas, checklists, bloques de texto, pass/fail
- Firmas digitales (técnico + cliente) con canvas
- Generación de PDF (html2pdf para Hoja 1, html2canvas + pdf-lib para anexos)
- Autosave con debounce 700ms a Firestore
- Selector de instrumentos utilizados
- Adjuntos (fotos, archivos) con upload a Firebase Storage
- Modo firma móvil (QR → URL con ?modo=firma)
- Compartir/descargar PDF

**Colección Firestore:** `reportes/{otNumber}` — documento con todos los campos del reporte
**Estado:** `BORRADOR` | `FINALIZADO`

**Archivos clave de reportes-ot:**
- `App.tsx` (2,759 líneas) — componente principal con todo el formulario
- `hooks/useReportForm.ts` — estado del formulario (40+ campos)
- `hooks/useOTManagement.ts` — carga/lista/duplica OTs
- `hooks/usePDFGeneration.ts` — generación de PDF multi-página
- `hooks/useAutosave.ts` — autosave con guards (no sobrescribir FINALIZADO)
- `hooks/useEntitySelectors.ts` — carga clientes, establecimientos, sistemas, módulos
- `services/firebaseService.ts` — CRUD de reportes, lectura de catálogos, entidades
- `components/SignaturePad.tsx` — firma digital canvas
- `components/TableSelectorPanel.tsx` — selector de tablas del catálogo
- `components/CatalogTableView.tsx`, `CatalogChecklistView.tsx`, `CatalogTextView.tsx` — renderizadores de protocolos
- `components/protocol/` — componentes de protocolo (layout, secciones, tablas, checklists)

### Módulo 2: Órdenes de Trabajo (consulta)

**Origen de datos:** `reportes` (docs completos de OT) + cruce con colecciones de entidades

El ingeniero debe poder:
- Ver lista de TODAS sus OTs (filtrar por estado, fecha, cliente)
- Ver detalle de una OT: datos del reporte, protocolo seleccionado, firmas, PDF generado
- Filtrar OTs por: estado (BORRADOR/FINALIZADO), cliente, establecimiento, rango de fechas
- Buscar por número de OT
- NO puede crear OTs desde aquí (eso se hace desde el módulo de Reportes)
- NO puede editar OTs finalizadas

**Datos disponibles en cada documento `reportes/{otNumber}`:**
```typescript
{
  otNumber: string;           // "12345" o "12345.01"
  clienteId: string;          // CUIT o LEGACY-uuid
  clienteNombre: string;
  establecimientoId: string;
  establecimientoNombre: string;
  sistemaId: string;
  sistemaNombre: string;
  moduloId: string;
  moduloNombre: string;
  tipoServicio: string;
  budgets: string;
  observaciones: string;
  observacionesInternas: string;
  parts: Part[];              // Artículos utilizados
  protocolTemplateId: string;
  protocolSelections: ProtocolSelection[];
  instrumentosSeleccionados: InstrumentoPatronOption[];
  signatureClient: string;    // base64 PNG
  signatureEngineer: string;  // base64 PNG
  status: 'BORRADOR' | 'FINALIZADO';
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
}
```

### Módulo 3: Equipos e Historial

**Colecciones Firestore:**
- `sistemas` — Equipos/instrumentos analíticos
- `sistemas/{id}/modulos` — Componentes del equipo (bomba, detector, inlet, etc.)
- `categorias_equipo` — Categorías (HPLC, GC, UV-Vis, etc.)
- `categorias_modulo` — Tipos de módulo

**Tipo principal:**
```typescript
interface Sistema {
  id: string;
  nombre: string;
  marca: string;
  modelo: string;
  serie: string;
  categoriaEquipoId: string;
  categoriaEquipoNombre: string;
  establecimientoId: string;
  establecimientoNombre: string;
  clienteId: string;
  clienteNombre: string;
  activo: boolean;
  ubicacion: string;
  configuracionGC?: ConfiguracionGC; // Solo para cromatógrafos de gases
  // ... trazabilidad (createdBy, updatedAt, etc.)
}
```

El ingeniero debe poder:
- Ver lista de equipos con filtros (cliente, establecimiento, categoría, estado)
- Ver detalle de un equipo: datos generales, módulos, configuración GC (si aplica)
- Ver historial de servicio: OTs realizadas sobre ese equipo (cruzar `reportes` donde `sistemaId == equipoId`)
- NO puede crear/editar equipos (eso es admin en sistema-modular)

### Módulo 4: Agenda

**Colecciones Firestore:**
- `agendaEntries` — Entradas de agenda
- `agendaNotas` — Notas asociadas a entradas

**Tipo:**
```typescript
interface AgendaEntry {
  id: string;
  ingenieroId: string;
  ingenieroNombre: string;
  fecha: string;             // "YYYY-MM-DD"
  horaInicio?: string;       // "HH:mm"
  horaFin?: string;
  descripcion: string;
  tipo: 'servicio' | 'capacitacion' | 'interno' | 'otro';
  clienteId?: string;
  clienteNombre?: string;
  establecimientoId?: string;
  establecimientoNombre?: string;
  otIds?: string[];          // OTs asociadas
  contacto?: string;
  direccion?: string;
  estado: 'programado' | 'en_curso' | 'completado' | 'cancelado';
  // trazabilidad...
}
```

El ingeniero debe poder:
- Ver su agenda semanal/diaria con vista de calendario
- Ver agenda de otros ingenieros (solo lectura)
- Crear entradas de agenda propias
- Editar/cancelar sus entradas
- Ver OTs asociadas a una entrada de agenda
- Filtrar por tipo, estado, semana

### Módulo 5: Leads

**Colección Firestore:** `leads`

**Tipo:**
```typescript
interface Lead {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  motivoLlamado: MotivoLlamado;  // 'consulta_servicio' | 'solicitud_presupuesto' | 'reclamo' | 'seguimiento' | 'otro'
  estado: LeadEstado;           // 'nuevo' | 'en_revision' | 'derivado' | 'en_proceso' | 'finalizado' | 'perdido'
  descripcion: string;
  asignadoA: string;            // userId
  asignadoANombre: string;
  sistemaId?: string;
  sistemaNombre?: string;
  clienteId?: string;
  clienteNombre?: string;
  presupuestosIds?: string[];
  otIds?: string[];
  postas?: Posta[];             // Historial de derivaciones
  // trazabilidad...
}
```

El ingeniero debe poder:
- Ver lista de leads asignados a él
- Crear nuevos leads (desde campo, cuando un cliente pide algo)
- Editar leads propios (actualizar estado, agregar notas)
- Derivar leads a otro usuario (crear posta)
- Ver historial de postas/derivaciones
- Filtrar por estado, motivo, fecha

### Módulo 6: Clientes y Establecimientos (solo lectura)

**Colecciones:** `clientes`, `establecimientos`, `clientes/{id}/contactos`, `establecimientos/{id}/contactos`

El ingeniero debe poder:
- Buscar clientes por nombre, CUIT
- Ver detalle de cliente: datos fiscales, contactos, establecimientos asociados
- Ver detalle de establecimiento: dirección, contactos, equipos instalados
- NO puede crear/editar clientes ni establecimientos (eso es admin)
- Puede ver teléfonos y emails de contacto (útil para coordinar visitas)

### Módulo 7: Configuración / Perfil

- Ver su perfil (nombre, email, rol)
- Preferencias de notificaciones (futuro)
- Cerrar sesión

---

## Colecciones Firebase — Mapa Completo

El portal comparte la **misma base de datos Firestore** que sistema-modular y reportes-ot. Aquí están todas las colecciones relevantes:

| Colección | Lectura | Escritura | Notas |
|-----------|---------|-----------|-------|
| `reportes` | ✅ | ✅ | CRUD completo de reportes (módulo Reportes) |
| `clientes` | ✅ | ❌ | Solo lectura |
| `clientes/{id}/contactos` | ✅ | ❌ | Solo lectura |
| `establecimientos` | ✅ | ❌ | Solo lectura |
| `establecimientos/{id}/contactos` | ✅ | ❌ | Solo lectura |
| `sistemas` | ✅ | ❌ | Solo lectura (equipos) |
| `sistemas/{id}/modulos` | ✅ | ❌ | Solo lectura |
| `categorias_equipo` | ✅ | ❌ | Para filtros |
| `categorias_modulo` | ✅ | ❌ | Para filtros |
| `leads` | ✅ | ✅ | CRUD (solo propios para escritura) |
| `agendaEntries` | ✅ | ✅ | CRUD (solo propios para escritura) |
| `agendaNotas` | ✅ | ✅ | CRUD |
| `tableCatalog` | ✅ | ❌ | Solo `status: 'published'` |
| `instrumentos` | ✅ | ❌ | Solo `activo: true` |
| `tipos_servicio` | ✅ | ❌ | Para selector en reportes |
| `usuarios` | ✅ | ❌ | Para listar ingenieros |
| `postas` | ✅ | ✅ | Workflow de derivaciones |
| `audit_log` | ❌ | ✅ | Fire-and-forget logging |

---

## Patrones y Convenciones del Proyecto

### Firebase
- **Timestamps:** escribir con `Timestamp.now()`, leer con `.toDate().toISOString()`
- **NUNCA** escribir `undefined` en Firestore → usar `null` o no incluir el campo
- `cleanFirestoreData(obj)` limpia undefineds top-level
- `deepCleanForFirestore(obj)` limpia nested (JSON round-trip)
- `logAudit({ action, collection, docId, before?, after?, userId })` — audit fire-and-forget
- Client ID: CUIT normalizado (solo dígitos) o `LEGACY-{uuid}`

### Autenticación
- Google Sign-In (popup) — solo dominio `@agsanalitica.com`
- Roles en colección `usuarios`: `admin`, `ingeniero_soporte`, `admin_soporte`, `administracion`, `técnico`
- El portal solo admite `ingeniero_soporte` (y opcionalmente `admin` para debug)
- WebAuthn/MFA como segundo factor opcional

### UI / Diseño
**Referencia visual: sistema-modular (enterprise B2B):**
- Background: `bg-slate-50`
- Cards: `bg-white rounded-xl border border-slate-200 shadow-sm`
- Primary: `bg-indigo-600`, hover: `bg-indigo-700`
- Font: Inter, `font-semibold`, `tracking-tight`
- Labels: `text-[11px] font-medium text-slate-400`
- Values: `text-xs text-slate-700`
- Tables: th `text-[11px] font-medium text-slate-400 tracking-wider`, td `text-xs py-2`
- Badges: `text-[10px] font-medium px-1.5 py-0.5 rounded-full`
- PageHeader: `text-lg font-semibold tracking-tight` + subtitle `text-xs text-slate-400`

**PERO el portal es mobile-first** — diseñado para ser usado en celular en campo:
- Navigation: bottom tab bar (mobile) / sidebar (desktop)
- Touch targets mínimo 44px
- Formularios adaptados a pantalla pequeña
- Tipografía legible en exterior (contraste alto)
- Offline-ready donde sea posible (cache de datos de solo lectura)

### Componentes UI reutilizables de sistema-modular
(Considerar replicar o crear equivalentes mobile-first)
- `Button` (variant: primary/secondary/danger/ghost/outline, size: sm/md/lg)
- `Card` (title, description, actions, compact)
- `Input` (label, error, inputSize: sm/md)
- `Modal` (open, onClose, title, maxWidth)
- `SearchableSelect` (value, onChange, options, placeholder)
- `PageHeader` (title, subtitle, count, actions, children)

### Código
- Máximo 250 líneas por componente React — extraer hooks/subcomponentes
- Hooks en `hooks/`, servicios en `services/`, tipos en `types/` o importar de `@ags/shared`
- Servicios centralizados en un `firebaseService.ts` con objetos agrupados por entidad
- Usar `@ags/shared` para tipos compartidos (a diferencia de reportes-ot que los duplica)

---

## Tipos Compartidos Clave (@ags/shared)

```typescript
// Work Orders
interface WorkOrder { otNumber, clienteId, establecimientoId, sistemaId, moduloId, tipoServicio, estado, ... }

// Clientes
interface Cliente { id (CUIT), razonSocial, nombreFantasia, condicionIva, direccion, telefono, email, activo }
interface ContactoCliente { id, nombre, cargo, telefono, email, principal }

// Establecimientos
interface Establecimiento { id, clienteId, nombre, direccion, localidad, provincia, tipo, activo }
interface ContactoEstablecimiento { id, nombre, cargo, telefono, email }

// Equipos
interface Sistema { id, nombre, marca, modelo, serie, categoriaEquipoId, establecimientoId, clienteId, activo, configuracionGC? }
interface ModuloSistema { id, nombre, tipo, marca, modelo, serie, categoriaModuloId }
interface ConfiguracionGC { inlets: { front?, back? }, detectors: { front?, back? } }

// Leads
interface Lead { id, nombre, empresa, telefono, email, motivoLlamado, estado, descripcion, asignadoA, postas? }
type LeadEstado = 'nuevo' | 'en_revision' | 'derivado' | 'en_proceso' | 'finalizado' | 'perdido'
type MotivoLlamado = 'consulta_servicio' | 'solicitud_presupuesto' | 'reclamo' | 'seguimiento' | 'otro'

// Agenda
interface AgendaEntry { id, ingenieroId, fecha, horaInicio?, horaFin?, descripcion, tipo, estado, otIds? }

// Postas (workflow)
interface PostaWorkflow { id, tipoEntidad, entidadId, categoria, responsableId, estado, prioridad, historial[] }

// Instrumentos
interface InstrumentoPatron { id, nombre, tipo, marca, modelo, serie, categorias, certificado, activo }

// Tablas/Protocolos
interface TableCatalogEntry { id, name, sysType, status, columns[], rows[], rules[], version }
interface ProtocolSelection { tableId, tableName, sysType, answers }

// Usuarios
interface UsuarioAGS { id, email, displayName, role: UserRole, status: UserStatus }
type UserRole = 'admin' | 'ingeniero_soporte' | 'admin_soporte' | 'administracion' | 'técnico'
```

---

## Servicios Firebase Existentes (referencia)

### En sistema-modular (`firebaseService.ts`, ~3,200 líneas):
Cada servicio es un objeto con métodos CRUD. Ejemplo:
```typescript
export const clientesService = {
  create: async (data) => { /* addDoc + logAudit */ },
  getAll: async () => { /* getDocs con query */ },
  getById: async (id) => { /* getDoc */ },
  update: async (id, data) => { /* updateDoc + logAudit */ },
  deactivate: async (id) => { /* updateDoc activo=false */ },
};
```

Servicios disponibles: `leadsService`, `clientesService`, `establecimientosService`, `sistemasService`, `modulosService`, `ordenesTrabajoService`, `instrumentosService`, `agendaService`, `agendaNotasService`, `postasService`, `usuariosService`, `tableCatalogService`, `tiposServicioService`, y 20+ más.

### En reportes-ot (`firebaseService.ts`, ~400 líneas):
```typescript
class FirebaseService {
  saveReport(otNumber, data)           // setDoc merge
  listenReport(otNumber, callback)     // onSnapshot
  getPublishedTables()                 // query tableCatalog status=='published'
  getClientes()                        // getDocs
  getEstablecimientosByCliente(id)     // query
  getSistemasByEstablecimiento(id)     // query
  getModulosBySistema(id)              // getDocs subcollection
  getActiveInstrumentos()              // query activo==true
  uploadAdjuntoFile(otNumber, file)    // uploadBytes to Storage
  // ... más métodos
}
```

---

## Estructura de Archivos Propuesta

```
apps/portal-ingeniero/
├── index.html
├── index.tsx                          # Entry point
├── App.tsx                            # Router + AuthGate + Layout
├── vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── .env.local                         # Mismas Firebase credentials
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx               # Layout principal (sidebar desktop / bottom tabs mobile)
│   │   ├── BottomNav.tsx              # Navegación inferior móvil
│   │   ├── Sidebar.tsx                # Sidebar desktop
│   │   └── TopBar.tsx                 # Barra superior con usuario/notificaciones
│   ├── ui/                            # Componentes UI base (mobile-first)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── SearchableSelect.tsx
│   │   ├── Badge.tsx
│   │   ├── EmptyState.tsx
│   │   └── Spinner.tsx
│   ├── reportes/                      # Componentes del módulo reportes
│   │   └── (componentes del formulario de reporte)
│   ├── ot/                            # Componentes de consulta de OTs
│   ├── equipos/                       # Componentes de equipos
│   ├── agenda/                        # Componentes de agenda
│   ├── leads/                         # Componentes de leads
│   └── shared/                        # Componentes compartidos entre módulos
├── hooks/
│   ├── useAuth.ts                     # Estado de autenticación
│   ├── useReportForm.ts               # Estado del formulario de reporte
│   ├── useOTList.ts                   # Lista de OTs con filtros
│   ├── useEquipos.ts                  # Equipos con historial
│   ├── useAgenda.ts                   # Agenda con CRUD
│   ├── useLeads.ts                    # Leads con CRUD
│   └── useEntitySelectors.ts          # Selectores de entidades (clientes, etc.)
├── services/
│   ├── firebaseService.ts             # Servicio centralizado Firebase
│   ├── authService.ts                 # Autenticación Google
│   └── storageService.ts             # Firebase Storage (fotos, adjuntos)
├── pages/
│   ├── ReportesPage.tsx               # Lista/crear reportes
│   ├── ReporteEditorPage.tsx          # Formulario de reporte (funcionalidad de reportes-ot)
│   ├── OTListPage.tsx                 # Lista de OTs
│   ├── OTDetailPage.tsx               # Detalle de OT
│   ├── EquiposPage.tsx                # Lista de equipos
│   ├── EquipoDetailPage.tsx           # Detalle + historial
│   ├── AgendaPage.tsx                 # Vista de agenda
│   ├── LeadsPage.tsx                  # Lista de leads
│   ├── LeadDetailPage.tsx             # Detalle/edición de lead
│   ├── ClientesPage.tsx               # Búsqueda de clientes (solo lectura)
│   ├── ClienteDetailPage.tsx          # Detalle de cliente
│   ├── EstablecimientoDetailPage.tsx  # Detalle de establecimiento
│   └── PerfilPage.tsx                 # Perfil del usuario
├── contexts/
│   └── AuthContext.tsx                # Provider de autenticación
├── types/
│   └── (tipos locales si no están en @ags/shared)
└── utils/
    ├── formatters.ts                  # Formateo de fechas, moneda, etc.
    └── constants.ts                   # Constantes de la app
```

---

## Flujo de Navegación

```
Login (Google @agsanalitica.com)
  │
  ▼
┌─────────────────────────────────┐
│         Portal Ingeniero        │
│                                 │
│  ┌─────┐ ┌──┐ ┌───┐ ┌────┐    │
│  │Repor│ │OT│ │Equ│ │Agen│    │  ← Bottom tabs (mobile)
│  │tes  │ │  │ │ipo│ │da  │    │
│  └─────┘ └──┘ └───┘ └────┘    │
│                                 │
│  + Leads (en menú "más")       │
│  + Clientes (en menú "más")    │
│  + Perfil (en menú "más")      │
└─────────────────────────────────┘
```

**Tabs principales (mobile):**
1. Reportes — crear/editar reportes de servicio
2. OTs — consultar órdenes de trabajo
3. Equipos — ver equipos e historial
4. Agenda — ver/gestionar agenda

**Menú secundario ("Más" o sidebar en desktop):**
5. Leads — crear/gestionar leads
6. Clientes — buscar clientes/establecimientos
7. Perfil — configuración y cerrar sesión

---

## Decisiones Arquitectónicas Importantes

1. **¿Reusar código de reportes-ot?** El formulario de reportes es el componente más complejo (~2,700 líneas en App.tsx). Opciones:
   - **Opción A:** Copiar y refactorizar los componentes/hooks de reportes-ot en portal-ingeniero (romper el monolito de App.tsx en componentes manejables de <250 líneas)
   - **Opción B:** Embeber reportes-ot via iframe (más simple pero peor UX)
   - **Recomendación:** Opción A — copiar hooks (useReportForm, usePDFGeneration, useAutosave, useOTManagement) y componentes (SignaturePad, TableSelectorPanel, CatalogViews, ProtocolView) al nuevo proyecto, refactorizando en componentes más pequeños.

2. **Firebase Service:** Crear un `firebaseService.ts` propio que importe funcionalidades de las dos apps existentes. El portal necesita lectura de casi todas las colecciones pero escritura limitada a reportes, leads, agenda y postas.

3. **Autenticación:** Reusar el patrón de reportes-ot (Google Sign-In) pero agregar verificación de rol `ingeniero_soporte` contra colección `usuarios`.

4. **Mobile-first pero responsive:** Diseñar primero para móvil (el ingeniero está en campo) pero que funcione bien en desktop también. Bottom nav en mobile, sidebar en desktop (breakpoint `md:`).

5. **Offline support:** Considerar habilitar persistencia offline de Firestore para datos de solo lectura (clientes, establecimientos, equipos, catálogos). Los reportes deben sincronizarse online.

---

## Reglas Críticas

1. **NO modificar** `apps/reportes-ot/` — es código en producción y sagrado
2. **NO modificar** `apps/sistema-modular/` — funciona independientemente
3. **NUNCA** escribir `undefined` en Firestore
4. **Máximo 250 líneas** por componente React
5. **Usar `@ags/shared`** para tipos compartidos
6. **Mismas credenciales Firebase** que las otras apps (misma `.env.local`)
7. **Audit logging** en toda escritura a Firestore
8. **El ingeniero solo puede escribir** en: reportes, leads (propios), agenda (propia), postas
9. **Todo lo demás es solo lectura** para el ingeniero

---

## Prioridad de Implementación Sugerida

### Fase 1: Fundación
- Scaffold del proyecto (Vite + React 19 + Tailwind + react-router-dom)
- Autenticación (Google Sign-In + verificación de rol)
- Layout (AppShell, BottomNav, Sidebar, TopBar)
- Componentes UI base (Button, Card, Input, Modal, Badge)
- Firebase service base (conexión, helpers)

### Fase 2: Reportes (core)
- Migrar funcionalidad de reportes-ot (formulario completo)
- Refactorizar App.tsx monolítico en componentes manejables
- Mantener compatibilidad con datos existentes en `reportes/{otNumber}`
- Firmas, PDF, autosave

### Fase 3: Consulta de OTs + Equipos
- Lista de OTs con filtros
- Detalle de OT (vista read-only del reporte)
- Lista de equipos con filtros
- Detalle de equipo con historial de servicio

### Fase 4: Agenda
- Vista calendario (semanal/diaria)
- CRUD de entradas de agenda
- Asociación con OTs

### Fase 5: Leads + Clientes
- CRUD de leads
- Derivación/postas
- Búsqueda de clientes/establecimientos (solo lectura)
- Detalle con contactos

---

## Ejemplo de Firebase Security Rules (referencia)

El portal comparte Firestore con las otras apps. Las reglas deben permitir:
```
match /reportes/{otNumber} {
  allow read, write: if request.auth != null && request.auth.token.email.matches('.*@agsanalitica.com');
}
match /leads/{leadId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.token.email.matches('.*@agsanalitica.com');
}
match /clientes/{clienteId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo desde sistema-modular (admin)
}
// ... etc
```

---

## Resumen

Tu trabajo es crear `apps/portal-ingeniero/` — una aplicación web React mobile-first que unifique la experiencia del ingeniero de campo de AGS Analítica. Debe integrar la funcionalidad completa de reportes (de reportes-ot) con nuevos módulos de consulta de OTs, equipos, agenda y leads, todo conectado a la misma base de datos Firestore. El resultado debe ser profesional, rápido, y diseñado para ser usado en el campo con un celular.
