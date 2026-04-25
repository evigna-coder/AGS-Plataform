---
name: ags-system-guide
description: >
  Domain knowledge base for the AGS Plataform monorepo: what AGS does, which apps exist,
  how the business flow connects modules, what every Firestore entity represents, and where
  to look for authoritative state. Activate this skill whenever the user (or a fresh agent)
  asks "how does the system work?", "what is AGS?", "explain the architecture", "what
  modules exist?", "how does [module] work?", names a domain entity (Cliente, Sistema, OT,
  Lead/Ticket, Presupuesto, Plantilla, Loaner, Stock, Posta, etc.), is onboarding a new
  contributor, or needs project context before implementing/refactoring a feature. Trigger
  even if the user does not name the skill — undertriggering this skill makes Claude
  invent details that the previous version of this guide once knew but is now stale.
---

# AGS Plataform — System Guide

> **Last verified against codebase:** 2026-04-25 (commit `7e6d7b4`).
> **Skill type:** domain knowledge (per `[ketzal88/claude-code-framework]`: *"domain knowledge that activates contextually"*).
> **Scope:** stable architecture + module map + entity catalog. Volatile module status lives in `memory/`; canonical invariants live in `[.claude/rules/]`.

---

## Stay current — self-clean protocol

This skill rotted once. The previous version lived for ~5 weeks and silently misled callers (it claimed indigo design system after the migration to Editorial Teal, claimed "Quote accepted → OT" after the flow changed to ticket coordinación, etc.). The framework's **Hook 6 — Dead-Code Ratchet** philosophy applies here too: *catch drift the moment it's introduced, not via a nightly cleaner*.

**Before you trust any specific claim in this skill, do this:**

1. **Stable vs volatile** — the rules of thumb:
   - Hard rules → repo `.claude/rules/*.md` is authoritative.
   - Module status / current bug workarounds / recent decisions → `memory/*.md` is authoritative.
   - Type definitions and route wiring → `packages/shared/src/types/index.ts` and `apps/*/src/App.tsx` are authoritative.
   - This skill is a *map*, never the territory.

2. **Freshness checks**:
   - If the user is about to *act* on a claim from this skill (e.g., "the field is `agsVisibleId`"), grep the codebase for the symbol *first*.
   - If `git log --since="2 weeks ago" -- packages/shared/src/types/index.ts` shows recent activity, re-read the relevant section before answering.
   - If a memory file you reference is older than 30 days, treat it as a hint, not a fact.

3. **When you find drift**: don't silently work around it. Update this skill (or the relevant memory file) in the same turn, and bump the "Last verified" date at the top. Drift hidden in this file becomes drift in every future session.

4. **What does NOT belong here**:
   - In-progress work, current tickets, who's working on what → memory.
   - Commit history, who-changed-what → `git log`.
   - Implementation patterns Claude already knows (React, TS, Firebase) → assume general knowledge.
   - Anything that changes weekly.

---

## What is AGS Plataform?

**AGS Analítica** is an Argentine analytical-instrument service company (HPLC, GC, UV-Vis, MSD, Osmometer, Polarimeter). The platform manages the full service lifecycle:

```
Lead/Ticket capture → Presupuesto → Coordinación → OT → Field work → Reporte técnico → PDF → Cierre admin → Facturación
```

The codebase is a **pnpm monorepo** with three React 19 + TypeScript apps and one shared types package, all backed by Firebase (Firestore, Auth, Storage, FCM). No server — all client-side with security rules.

---

## Architecture overview

| Path | Role | Stack notes | Users |
|---|---|---|---|
| `[apps/sistema-modular/]` | Admin back-office (the heavy app). 27 modules. | React 19 + Tailwind + Vite + Electron shell | Admins, soporte, administración |
| `[apps/portal-ingeniero/]` | Field-engineer hub. OT list, agenda, leads, viáticos, QF docs, public QR landing. | React 19 + Tailwind | Ingenieros de soporte |
| `[apps/reportes-ot/]` | **Frozen surface.** Field-technician PWA: fills the OT report and generates the multi-part PDF. See `@.claude/rules/reportes-ot.md`. | React 19 + html2pdf.js + html2canvas + pdf-lib | Técnicos en campo |
| `[packages/shared/]` | TypeScript types + helpers (`@ags/shared`). Single ~3900-line `types/index.ts`. | TS only | All apps |

### App relationships

```
        sistema-modular (admin) ──writes── ┐
                                            ▼
        portal-ingeniero ────reads/writes──► Firestore ◄── reportes-ot (reads + writes OT)
              │                                                    ▲
              └────────── opens BORRADOR OT in new tab ────────────┘
```

- `sistema-modular` is the source of truth for clientes, sistemas, presupuestos, OTs, stock, etc.
- `portal-ingeniero` is **not** "lightweight only" anymore — it has its own pages for leads, agenda, viáticos, QF docs, perfil, plus a **public, no-auth route** `/equipo/:agsVisibleId` for the QR landing.
- `reportes-ot` is the only app that may be developed *and used* on a tablet without supervision; that's why its surface is frozen.

---

## Business flow (current — verify against memory before quoting)

1. **Lead/Ticket** arrives via QR scan, portal form, manual entry, or sales call. (Module `leads` — collection still named `leads`, see Tickets refactor below.)
2. **Ticket triaged** by area (`soporte`, `administracion`, `ventas`, `ingenieria`) and prioridad. Multi-area/multi-rol supported.
3. **Presupuesto** generated from the ticket (`presupuestos` module) — types: `tecnico`, `contrato`, `ventas`, `garantia`, etc.
4. **Aceptación**:
   - **Tipo `tecnico`** → presupuesto aprobado dispara creación de OT(s).
   - **Tipo `ventas` / `insumos`** → crea **ticket en estado `en_coordinacion`**, *no* OT directa. La coordinadora arma 0, 1 o N OTs manualmente. (Confirmar en `memory/feedback_auto_ot_to_ticket.md`.)
   - **Tipo `contrato`** → flujo cerrado end-to-end (2026-04-10): editor jerárquico Sector → Sistema → Servicios, plantillas en `tiposEquipoPlantillas`, PDF moderno teal con cuotas asimétricas MIXTA.
5. **OT scheduled** in `agenda` and assigned to ingeniero(s).
6. **Engineer opens OT** → `portal-ingeniero` → tab a `reportes-ot` para completar el reporte técnico (protocolos, tablas, instrumentos firmados, fotos).
7. **OT finalizada** (técnicamente) → multi-part PDF generado y stored in Storage; status técnico → `FINALIZADO`.
8. **Cierre administrativo** (módulo en construcción — ver `memory/project_ot_lifecycle.md`).
9. **Facturación** — módulo `/facturacion` (Apr-23) controla la generación de comprobantes; AFIP integrado vía `afipService.ts`. Bejerman descartado.

---

## Modules in sistema-modular (current)

For service files, hooks, and per-module conventions, read `references/modules.md`. Here is the **route → entity → service** index:

| Module | Route | Entity (shared type) | Service | Notes |
|---|---|---|---|---|
| Clientes | `/clientes` | `Cliente` | `clientesService.ts` | CUIT-based ID; `LEGACY-{uuid}` for pre-migration |
| Establecimientos | `/establecimientos` | `Establecimiento` | `establecimientosService.ts` | per-cliente, con lat/lng |
| Equipos | `/equipos`, `/categorias-equipo` | `Sistema`, `ModuloSistema`, `CategoriaEquipo` | `equiposService.ts` | GC ports activos cuando `esGaseoso(nombre)` |
| Tipos de Equipo | `/presupuestos/tipos-equipo` | `TipoEquipoPlantilla` | `tiposEquipoService.ts` | Catálogo de plantillas con `componentes[]` (S/L) y `servicios[]` |
| OT | `/ordenes-trabajo`, `/ordenes-trabajo/nuevo`, `/ordenes-trabajo/:otNumber` | `WorkOrder` | `otService.ts` | `otNumber` = 5 dígitos + opcional `.NN` |
| Leads (= Tickets) | `/leads`, `/leads/:id` | `Lead` / `Ticket` | `leadsService.ts` | Renombrado conceptualmente a Ticket; colección Firestore sigue `leads/` |
| Presupuestos | `/presupuestos`, `/presupuestos/nuevo`, `/presupuestos/:id` + sub-routes | `Presupuesto`, `PresupuestoItem` | `presupuestosService.ts` (~88KB) | Cerrado end-to-end para `contrato`; cosecha Item→OT diferida |
| Contratos | `/contratos` | `Contrato`, `ServicioContrato` | `contratosService.ts` | Granularidad hasta sistema (Apr-19) |
| Facturación | `/facturacion` | `SolicitudFacturacion`, `FacturaItem` | `facturacionService.ts` | AFIP integrado |
| Biblioteca de Tablas | `/table-catalog`, `/table-catalog/:tableId/edit` | `TableCatalogEntry` | `catalogService.ts` | Cada tabla = doc en `/tableCatalog/{id}`; sólo `published` visible a técnicos |
| QF Documentos | `/qf-documentos` | `QFDocumento` | `qfDocumentosService.ts` | Familias QF/QI/QD/QP; versionado con historial (Apr-22) |
| Instrumentos & Patrones | `/instrumentos`, `/patrones`, `/columnas` | `InstrumentoPatron`, `Patron`, `Columna` | `patronesService.ts`, `columnasService.ts` | Solo instrumentos llevan trazabilidad |
| Fichas | `/fichas` | `FichaPropiedad` | `fichasService.ts` | Equipos de cliente bajo reparación |
| Loaners | `/loaners` | `Loaner` | `loanersService.ts` | Préstamo / extracción / venta |
| Stock | `/stock/*` (~18 sub-rutas) | `Articulo`, `UnidadStock`, `Minikit`, `Remito`, `MovimientoStock`, `OrdenCompra`, `Importacion`, `RequerimientoCompra` | `stockService.ts`, `stockAmplioService.ts`, `importacionesService.ts` | Plan de evolución en 5 fases (memory) |
| Agenda | `/agenda` | `AgendaEntry` | `agendaService.ts` | Calendario asignaciones |
| Pendientes | `/pendientes` | `Pendiente` | `pendientesService.ts` | Cola de acciones |
| Vehículos | `/vehiculos` | `Vehiculo` | `vehiculosService.ts` | Flota + servicios + km |
| Dispositivos | `/dispositivos` | `Dispositivo` | `dispositivosService.ts` | Tablets, equipos asignados |
| Calificación Proveedores | `/calificacion-proveedores` | `Proveedor` | `calificacionesService.ts` | Ratings |
| Ingreso Empresas | `/ingreso-empresas` | `IngresoEmpresa` | `ingresoEmpresasService.ts` | Onboarding documentación |
| Usuarios | `/usuarios` | `UsuarioAGS` | (auth/admin services) | Solo `admin` |
| Admin utils | `/admin/*` (8 rutas) | — | `adminConfigService.ts` | Imports, backfill, relink |

---

## Core entity hierarchy

```
Cliente (CUIT)
  └── Establecimiento (planta/local)
        └── Sistema (instrumento, p.ej. HPLC 1260)
              └── ModuloSistema (subcomponente: detector, bomba, columna)
                    └── WorkOrder (OT)
```

Para definiciones de tipos completas (campos, enums, labels, helpers), leer `references/entities.md`. Resumen rápido:

| Entity | ID format | Firestore collection | Highlights |
|---|---|---|---|
| `Cliente` | CUIT o `LEGACY-{uuid}` | `clientes` | `condicionIva`, `requiereTrazabilidad`, contactos[] |
| `Establecimiento` | auto | `establecimientos` | `clienteCuit`, `direccion`, `lat`/`lng` |
| `Sistema` | auto | `sistemas` | `agsVisibleId` (para QR), `categoriaId`, `configuracionGC` si gaseoso |
| `WorkOrder` | `otNumber` (5 dígitos + opc `.NN`) | `workorders` | `status` admin/técnico, `articulos`, signatures |
| `Lead` (Ticket) | auto | `leads` | `area`, `prioridad`, `estado`, `motivoLlamado`, `source` (qr/portal/manual) |
| `Presupuesto` | `PRE-XXXX` | `presupuestos` | `tipo`, `moneda` (incl MIXTA para contrato), `items[]`, `cantidadCuotasPorMoneda` |
| `Contrato` | auto | `contratos` | servicios por sistema, fechas inicio/fin |
| `TableCatalogEntry` | auto | `tableCatalog` | `tableType`, `columns[]`, `validationRules[]`, `status` (`published`/`draft`) |
| `TipoEquipoPlantilla` | auto | `tiposEquipoPlantillas` | `componentes[]` (S/L), `servicios[]` (precio default) |
| `QFDocumento` | auto | `qfDocumentos` | `familia` (QF/QI/QD/QP), `version`, `historial[]` |
| `InstrumentoPatron` | auto | `instrumentos` | `tipo` (instrumento/patron), `certificadoVencimiento` |

### Reglas de format críticas

- **OT number**: 5 dígitos + opcional `.NN` (`25660`, `25660.02`). **Nunca migrar a UID** — el formato es business-significant.
- **GC ports** (`configuracionGC`): se activa cuando `Sistema.nombre` contiene "gaseoso" (helper `esGaseoso(nombre)` en `@ags/shared`). Inlets: SSL/COC/PTV (Front/Back). Detectores: FID/NCD/FPD/ECD/SCD (Front/Back).
- **agsVisibleId**: identificador público de un Sistema. Se usa en QR y en la URL `portal.agsanalitica.com/equipo/{agsVisibleId}` (ruta pública en `portal-ingeniero`).

---

## RBAC — modelo híbrido

6 roles + per-user overrides en Firestore. Lectura completa: `memory/project_rbac.md`.

| Role | Acceso típico | Apps |
|---|---|---|
| `admin` | Todo | sistema-modular, portal-ingeniero |
| `admin_soporte` | Operaciones de soporte (sin usuarios) | sistema-modular, portal-ingeniero |
| `admin_ing_soporte` | Soporte + contratos + pendientes | sistema-modular, portal-ingeniero |
| `ingeniero_soporte` | OT, agenda, stock, viáticos | portal-ingeniero, reportes-ot |
| `administracion` | Tickets, presupuestos, stock, facturación | sistema-modular |
| `pendiente` | Solo `/pending-approval` hasta que admin asigne rol | — |

**Regla de auth**: Google OAuth restringido a dominio `@agsanalitica.com`.
**Helpers de permiso** (en `@ags/shared/utils.ts`): `userHasRole`, `canAccessApp`, `canAccessModulo`, `getUserPermissions`, `getModuloFromPath`. Override granular: `UserPermissionsOverride`.

Pendientes de implementar: roles externos (`cliente`, `proveedor`, `admin_contable`).

---

## Sistema de tablas / protocolos

Las tablas dinámicas (protocolos, checklists, instrumentos referenciados) viven en `/tableCatalog/{tableId}`. Cada tabla es **un documento independiente** — la colección legacy `/protocolCatalog` existe sólo por compatibilidad.

| `tableType` | Para qué |
|---|---|
| `validation` | Tabla de datos con reglas pass/fail |
| `informational` | Tabla de referencia, sin validación |
| `instruments` | Lookup de instrumentos |
| `checklist` | Items Yes/No/NA con anidamiento (depth 0-3) |
| `text` | Texto libre (RichTextEditor) |
| `signatures` | Placeholders de firmas |

**Column types**: `text_input`, `number_input`, `checkbox`, `fixed_text`, `date_input`, `pass_fail`, `select_input`.

**Validation rules**: auto-cálculo PASS/FAIL via `vs_spec`, operadores NMT/NLT, rangos numéricos.

Solo `status: 'published'` se sirve a técnicos. Admins gestionan en `/table-catalog` (sistema-modular).

---

## reportes-ot — pipeline PDF (frozen surface)

Pipeline multi-parte mergeada con `pdf-lib`. **Frozen** — leer `@.claude/rules/reportes-ot.md` antes de tocar nada y `memory/reportes-ot-pdf.md` para detalle técnico.

```
1. Hoja 1 (html2pdf.js)         → reporte principal
2. Protocolos (html2canvas)      → cada [data-protocol-page] → PNG → PDF
3. Certificados de instrumentos  → descarga de Storage → pdfjs-dist → embed
4. Adjuntos PDF                  → idem certificados
5. Fotos                         → html2canvas por foto → embed
   ─────────────────────────────
   MERGE → un único PDF descargable (split en 2 cuando hay protocolo adjunto)
```

**Bugs históricos que NO debés re-introducir** (siguen mitigados por workarounds en el código):
- `html2canvas` recorta títulos cuando el clon tiene `overflow: hidden` + `border-radius`. Workaround: clon, remover overflow, capturar, descartar clon.
- `RichTextEditor` emite `<font size="X">` que renderea agrandado. Workaround: CSS `font-size: inherit !important` aplicado al contenedor de captura.

App.tsx en reportes-ot **ya no es monolítico** (~600 líneas hoy, modularizado en hooks `useAppLogic`, `useReportForm`, `usePDFGeneration`, `useOTManagement`, etc.). La regla "frozen" sigue vigente: el riesgo es ruptura visual + PDF, no tamaño de archivo.

---

## Stock — visión rápida

Inventario completo. Plan de evolución en 5 fases (memory `project_stock_evolution.md`):

- **Articulos** — catálogo SKU (part numbers, categorías, aranceles)
- **Unidades** — instancias físicas (serial, condición, ubicación)
- **Minikits** + **MinikitTemplate** — sets agrupados, plantillas reutilizables
- **Remitos** — órdenes digitales de despacho (`salida_campo`, `devolucion`, etc.)
- **Movimientos** — log inmutable de movimientos
- **Órdenes de Compra** (`nacional` / `importacion`)
- **Importaciones** — comercio internacional con tracking aduana
- **Requerimientos** — solicitudes de compra

---

## Hard rules (la pirámide de enforcement)

Siguiendo la estructura del framework (`CLAUDE.md` → Rules → Commands → AST Rules → Hooks):

| Capa | Archivo | Qué garantiza |
|---|---|---|
| Rule | `@.claude/rules/firestore.md` | Nunca `undefined` en writes a Firestore. Helpers `cleanFirestoreData` / `deepCleanForFirestore`. |
| Rule | `@.claude/rules/components.md` | Componentes React ≤ 250 líneas en sistema-modular y portal-ingeniero. |
| Rule | `@.claude/rules/reportes-ot.md` | `apps/reportes-ot/` es superficie congelada salvo tareas explícitas en esa app. |
| AST | `.claude/ast-rules/no-firestore-undefined.yml` | Scan estructural: detecta `setDoc/updateDoc/addDoc` con literales `undefined`. Run: `pnpm lint:ast`. |
| Hook | `.claude/hooks/check-firestore-undefined.js` | PostToolUse soft-warn cuando un edit toca un service e introduce `: undefined` adyacente a un write. |
| Hook | `.claude/hooks/check-component-size.js` | PostToolUse soft-warn si un `.tsx` queda > 250 líneas. |
| Hook | `.claude/hooks/guard-reportes-ot.js` | PreToolUse blocking — bloquea edits en `apps/reportes-ot/` salvo `CLAUDE_ALLOW_REPORTES_OT=1`. |

**Self-clean del código** (Hook 6 del framework, *aún no adoptado* en este monorepo): el `Stop hook` con `knip` + `.dead-code-baseline.json` que bloquea el cierre de turno si crecen los orphans. Si el equipo decide adoptarlo, el setup está documentado en `[ketzal88/claude-code-framework]` README, sección "Hook 6: Dead-Code Ratchet". Pattern aplicable cuando el monorepo deje de tener dead code natural por la fase de iteración rápida.

**Reglas no codificadas en hooks pero igual de duras:**

- **OT number format**: 5 dígitos + opc. `.NN`. Nunca migrar a UID.
- **Servicios primero**: los componentes **no** llaman a Firestore directo. Todo CRUD pasa por `apps/sistema-modular/src/services/[modulo]Service.ts` (o el equivalente en portal-ingeniero). Un service por colección.
- **Filtros de listas**: usar siempre el hook `useUrlFilters` para persistencia, nunca `useState` (memory `feedback_filter_persistence.md`).
- **Caché de servicios**: 2 min TTL via `serviceCache.ts` para listas frecuentes.
- **Timestamps**: `Timestamp.now()` en writes; `.toDate().toISOString()` al leer en UI.
- **Campos eliminados**: usar `FieldValue.delete()`, no `null` (a menos que el dominio quiera "vacío conocido").

---

## Design system — Editorial Teal

Detalles completos: `memory/design_system.md` y skill `list-page-conventions`.

- **Primario**: `teal-700` (#0D6E6E). Migrado desde indigo (Mar-2026).
- **Sidebar**: `bg-slate-900` con borde izquierdo `border-l-2 border-teal-500` activo.
- **Fuentes** (Google Fonts): Inter (body), Newsreader serif (títulos de modal), JetBrains Mono (labels, métricas).
- **Labels de campo**: uppercase, monospace, `tracking-wide`, `text-[10px]`. (Esto contradice la advertencia "no uppercase" del skill anterior — la actualización de tema lo permite específicamente para field labels.)
- **Modal**: header teal, body `#FAFAFA`, footer `#F0F0F0`, draggable, auto-focus, título serif.
- **Atoms reusables** en `apps/sistema-modular/src/components/ui/`: `Button`, `Card`, `Input`, `Modal`, `SearchableSelect`, `PageHeader`, `ConfirmDialog`, `RichTextEditor`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorBoundary`, `ColMenu`, `SortableHeader`. Reusar antes de recrear; extender antes de duplicar.

**Create flows**: entidades simples → modal desde la lista. Entidades complejas (OT, Equipo, Presupuesto) → página dedicada.

---

## Where to look — canonical sources

| Necesito… | Verdad canónica en… |
|---|---|
| Tipos compartidos | `[packages/shared/src/types/index.ts]` (~3900 líneas) + `[packages/shared/src/utils.ts]` |
| Routing sistema-modular | `[apps/sistema-modular/src/App.tsx]` |
| Routing portal-ingeniero | `[apps/portal-ingeniero/src/App.tsx]` (incluye `/equipo/:agsId` público) |
| Servicios (CRUD por colección) | `[apps/sistema-modular/src/services/]` |
| UI atoms | `[apps/sistema-modular/src/components/ui/]` |
| Hooks | `[apps/sistema-modular/src/hooks/]` |
| Patrón de listas | skill `list-page-conventions` |
| Helpers Firebase | `[apps/sistema-modular/src/services/firebase.ts]` (`db`, `cleanFirestoreData`, `deepCleanForFirestore`, `getCreateTrace`, `getUpdateTrace`, `createBatch`, `batchAudit`) |
| PDF reportes-ot | `[apps/reportes-ot/hooks/usePDFGeneration.ts]` (después de leer la regla y `memory/reportes-ot-pdf.md`) |
| Estado actual de un módulo | `memory/project_*.md` o `memory/feedback_*.md` |
| Decisiones recientes con fecha | `memory/MEMORY.md` (índice) |

---

## For more depth

- **Type catalog completo** (Cliente, Sistema, OT, Lead, Presupuesto, etc. con campos): `references/entities.md`
- **Module deep-dive** (servicios, hooks, componentes por módulo): `references/modules.md`
- **PDF technical**: `memory/reportes-ot-pdf.md`
- **Table catalog implementation**: `memory/protocol-catalog.md`
- **Plans en curso/diferidos**: `[.claude/plans/]`

---

## When in doubt

Si el usuario te pide que actues sobre algo específico (un campo, un servicio, una regla), no cites este skill como fuente final — abrí el archivo canónico, confirmá que la afirmación sigue válida, y *después* respondé. Este skill existe para **orientarte rápido**, no para **reemplazar la lectura del código**.

Si encontrás una afirmación de este skill que está mal, arreglala en el mismo turno y bumpeá la fecha "Last verified" arriba. Es parte del trabajo, no un side quest.
