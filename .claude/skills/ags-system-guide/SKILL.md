---
name: ags-system-guide
description: >
  Comprehensive knowledge base for understanding the AGS Plataform system architecture,
  business domain, and codebase. Use this skill whenever someone asks "how does the system work?",
  "what is AGS?", "explain the architecture", "what modules exist?", "how does [module] work?",
  "what is the business flow?", or needs context about the AGS domain, entities, Firebase structure,
  or relationships between the 3 apps. Also trigger when onboarding a new developer or when
  context about the platform is needed before implementing a feature.
---

# AGS Plataform — System Guide

## What is AGS Plataform?

AGS Analitica is an Argentine company specializing in **analytical instrument services** (HPLC, GC, UV-Vis, MSD, Osmometer, Polarimeter). The platform manages the complete service lifecycle:

```
Lead capture → Quoting → Scheduling → Field work → Report completion → PDF generation → Billing
```

## Architecture Overview

**Monorepo** with pnpm workspaces, 3 apps sharing a common type package:

| App | Purpose | Stack | Port | Users |
|-----|---------|-------|------|-------|
| `apps/sistema-modular` | Admin back-office | React 19 + Tailwind + Electron | 3001 | Office staff, admins |
| `apps/reportes-ot` | Field report completion | React 19 + html2pdf.js + pdf-lib | 3000 | Field technicians |
| `apps/portal-ingeniero` | Engineer hub/dashboard | React 19 + Tailwind | 3002 | Field engineers |
| `packages/shared` | TypeScript types (@ags/shared) | TypeScript only | — | All apps |

**Backend**: Firebase (Firestore + Storage + Auth). No server — all client-side with security rules.

### App Relationships

```
                    ┌─────────────────────┐
                    │   sistema-modular    │
                    │   (Admin panel)      │
                    │   Manages all data   │
                    └──────────┬───────────┘
                               │ writes to Firestore
                    ┌──────────▼───────────┐
                    │      Firestore       │
                    │   (shared database)  │
                    └──┬───────────────┬───┘
                       │ reads          │ reads + writes OT
          ┌────────────▼──┐    ┌───────▼──────────┐
          │ portal-        │    │   reportes-ot    │
          │ ingeniero      │───►│ (report app)     │
          │ (engineer hub) │    │ Fills OT + PDF   │
          └────────────────┘    └──────────────────┘
              opens in new tab ──►
```

- **portal-ingeniero** is a lightweight hub. BORRADOR OTs open reportes-ot in a new tab.
- **reportes-ot** handles all report completion (protocols, signatures, photos, PDF).
- **sistema-modular** is the admin powerhouse managing all entities.

## Business Flow

1. **Lead arrives** — via QR scan on equipment, portal form, or manual entry
2. **Lead qualified** → Presupuesto (Quote) created with items, tax rules, payment terms
3. **Quote accepted** → OT (Work Order) created with status `BORRADOR`
4. **OT scheduled** → Agenda entry assigned to an engineer
5. **Engineer opens OT** → portal-ingeniero redirects to reportes-ot
6. **Report completed** → Technical report, protocol tables, instruments, signatures, photos
7. **OT finalized** → Multi-part PDF generated, status → `FINALIZADO`
8. **Billing** → Facturacion module (placeholder, future)

## Core Business Entities

For complete type definitions, read `references/entities.md`.

### Entity Hierarchy

```
Cliente (CUIT)
  └── Establecimiento (location/plant)
        └── Sistema (equipment)
              └── ModuloSistema (subcomponent)
                    └── WorkOrder (OT)
```

### Key Entities Summary

| Entity | ID Format | Key Fields | Firebase Collection |
|--------|-----------|------------|-------------------|
| Cliente | CUIT or LEGACY-{uuid} | razonSocial, condicionIva, requiereTrazabilidad | `clientes` |
| Establecimiento | auto | clienteCuit, tipo, direccion, lat/lng | `establecimientos` |
| Sistema | auto | establecimientoId, categoriaId, agsVisibleId, configuracionGC | `sistemas` |
| WorkOrder | otNumber (5 digits) | status (BORRADOR/FINALIZADO), signatures, articulos | `workorders` |
| Lead | auto | estado workflow, motivoLlamado, source (qr/portal/manual) | `leads` |
| Presupuesto | PRE-XXXX | tipo, moneda, items, validezDias, estado | `presupuestos` |
| TableCatalogEntry | auto | tableType, columns, validationRules, status | `tableCatalog` |
| InstrumentoPatron | auto | tipo (instrumento/patron), certificadoVencimiento | `instrumentos` |

### OT Number Format

Always 5 digits + optional `.NN` suffix: `25660` or `25660.02`. **Never migrate to UID.**

### GC Port Configuration

When a Sistema's name contains "gaseoso", it activates `configuracionGC`:
- Inlet ports: SSL, COC, PTV (Front/Back)
- Detector ports: FID, NCD, FPD, ECD, SCD (Front/Back)
- Helper: `esGaseoso(nombre)` from `@ags/shared`

## Modules in sistema-modular

For detailed module descriptions, read `references/modules.md`.

| Module | Route | Entity | Purpose |
|--------|-------|--------|---------|
| Clientes | `/clientes` | Cliente | Client management (CUIT-based) |
| Establecimientos | `/establecimientos` | Establecimiento | Client facilities/locations |
| Equipos | `/equipos` | Sistema, Modulo | Analytical instruments + GC ports |
| OT | `/ordenes-trabajo` | WorkOrder | Work order lifecycle |
| Leads | `/leads` | Lead | Sales pipeline + posta workflow |
| Presupuestos | `/presupuestos` | Presupuesto | Quoting with tax categories |
| Biblioteca Tablas | `/table-catalog` | TableCatalogEntry | Dynamic protocol/table definitions |
| Instrumentos | `/instrumentos` | InstrumentoPatron | Reference instruments & standards |
| Fichas | `/fichas` | FichaPropiedad | Customer equipment under repair |
| Loaners | `/loaners` | Loaner | Equipment loan tracking |
| Stock | `/stock` | Articulo, UnidadStock | Full inventory management |
| Agenda | `/agenda` | AgendaEntry | Calendar scheduling |
| Postas | `/postas` | PostaWorkflow | Workflow handoff tracking |
| Usuarios | `/usuarios` | UsuarioAGS | User management (admin only) |
| Facturacion | `/facturacion` | — | Billing (placeholder) |

## Authentication & Roles

| Role | Access | Apps |
|------|--------|------|
| `admin` | Full access to everything | sistema-modular, portal-ingeniero |
| `ingeniero_soporte` | Field work (OTs, protocols, stock) | portal-ingeniero, reportes-ot |
| `admin_soporte` | Support administration | sistema-modular |
| `administracion` | Back office (leads, quotes, stock) | sistema-modular |

Auth: Google OAuth restricted to `@agsanalitica.com` domain. Users start as `pendiente` until admin assigns role.

## Protocol / Table System

Dynamic tables stored in `/tableCatalog/{tableId}`:

| Table Type | Purpose |
|-----------|---------|
| `validation` | Data table with pass/fail conclusion rules |
| `informational` | Read-only reference table |
| `instruments` | Instrument lookup table |
| `checklist` | Yes/No/NA items with nesting (depth 0-3) |
| `text` | Free-form notes (RichTextEditor) |
| `signatures` | Signature placeholders |

**Column types**: text_input, number_input, checkbox, fixed_text, date_input, pass_fail, select_input

**Validation rules**: Auto-calculate PASS/FAIL using vs_spec, NMT/NLT operators, numeric ranges.

Only `status: 'published'` tables visible to technicians. Managed by admins in sistema-modular.

## PDF Generation (reportes-ot)

Multi-part pipeline merged via pdf-lib:

```
1. Hoja 1 (html2pdf.js)         → Main report form
2. Protocol pages (html2canvas)  → Each [data-protocol-page] → PNG → PDF
3. Instrument certificates       → Download from Storage → pdfjs-dist → embed
4. Attachment PDFs               → Same as certificates
5. Photos                        → html2canvas per photo → embed
   ─────────────────────────────
   MERGE → Single PDF download
```

**Known bugs**: html2canvas + overflow:hidden + border-radius clips titles. Fix: clone, remove overflow, capture, remove clone.

## Stock Module

Full inventory management with:
- **Articulos** — SKU master catalog (part numbers, categories, tariffs)
- **Unidades** — Physical stock unit instances (serial, condition, location)
- **Minikits** — Grouped sets of units
- **Remitos** — Digital dispatch orders (salida_campo, devolucion, etc.)
- **Movimientos** — Immutable stock movement log
- **Ordenes de Compra** — Purchase orders (nacional/importacion)
- **Importaciones** — International trade with customs tracking
- **Requerimientos** — Purchase requisitions

## Key File Paths

| What | Path |
|------|------|
| Type system (1926 lines) | `packages/shared/src/types/index.ts` |
| Firebase services (3300+ lines) | `apps/sistema-modular/src/services/firebaseService.ts` |
| Routing | `apps/sistema-modular/src/App.tsx` |
| UI components | `apps/sistema-modular/src/components/ui/` |
| Hooks | `apps/sistema-modular/src/hooks/` |
| Technical docs | `docs/DOCUMENTACION_TECNICA_AGS.md` |
| Business docs | `docs/DOCUMENTACION_NEGOCIO_AGS.md` |
| Reportes-OT main | `apps/reportes-ot/App.tsx` (monolithic, 2800+ lines) |
| PDF generation | `apps/reportes-ot/hooks/usePDFGeneration.ts` |
| Portal services | `apps/portal-ingeniero/src/services/firebaseService.ts` |

## Hard Rules

1. **NEVER modify reportes-ot UI/visuals** — PDF dimensions break
2. **NEVER write `undefined` to Firestore** — use `null` or omit the field
3. **Max 250 lines per React component** in sistema-modular — extract hooks/subcomponents
4. **OT number format**: 5 digits + optional .NN — NEVER migrate to UID
5. **cleanFirestoreData()** for top-level, **deepCleanForFirestore()** for nested objects
6. **Design system**: Inter font, indigo-600 primary, slate-900 sidebar, compact B2B style
7. **No uppercase, no font-black** in UI text
8. **Navigation memory**: ALL cross-module `<Link>` elements MUST include `state={{ from: pathname }}` — see "Navigation Memory Pattern" below

## Design System (sistema-modular)

- **Palette**: bg-slate-50 surface, bg-white cards, text-slate-900, bg-indigo-600 primary
- **Sidebar**: bg-slate-900, active: border-l-2 border-indigo-500
- **Font**: Inter, font-semibold, tracking-tight
- **Tables**: th `text-[11px] text-slate-400 tracking-wider`, td `text-xs py-2`
- **Badges**: `text-[10px] font-medium px-1.5 py-0.5 rounded-full`
- **Detail pages**: 2-column (sidebar w-72 + main flex-1)
- **UI atoms**: Button, Card, Input, Modal, PageHeader, SearchableSelect

## Navigation Memory Pattern

**Rule**: When navigating from Module A's detail page to Module B's detail page (cross-module), pressing Escape or the back button must return to Module A, NOT to Module B's list page.

**Implementation**:

1. **Every cross-module `<Link>`** must pass the current path via router state:
   ```tsx
   const { pathname } = useLocation();
   <Link to={`/equipos/${id}`} state={{ from: pathname }}>Ver sistema</Link>
   ```

2. **`useNavigateBack` hook** checks `location.state.from` before falling back to module root:
   ```tsx
   if (state?.from && typeof state.from === 'string') {
     navigate(state.from);
     return;
   }
   // fallback: navigate to module root
   ```

3. **Layout.tsx Escape handler** also checks `state.from` before using `getParentPath`.

4. **What counts as cross-module**: Any `<Link>` whose `to` target is in a different top-level route (e.g., from `/clientes/X` to `/equipos/Y`, from `/fichas/X` to `/ordenes-trabajo/Y`). Links within the same module (e.g., `/clientes/X` to `/clientes/Y`) do NOT need state.

5. **programmatic navigation** (`navigate()`) that goes cross-module must also pass state:
   ```tsx
   navigate(`/equipos/${id}`, { state: { from: pathname } });
   ```

## For More Details

- **Complete entity type definitions**: Read `references/entities.md`
- **Module deep-dive with services**: Read `references/modules.md`
- **PDF generation technical details**: Read the memory file `reportes-ot-pdf.md`
- **Table catalog implementation**: Read the memory file `protocol-catalog.md`
