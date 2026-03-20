# Sistema Modular - Project Overview

## 1. Project Architecture & Workspace
This repository is a `pnpm` monorepo containing multiple applications and shared packages.
The primary structure for `sistema-modular` and shared dependencies is:

```
/
├── apps/
│   ├── sistema-modular/    # Desktop app (Electron + Vite + React)
│   └── reportes-ot/        # Web app for Work Orders
├── packages/
│   └── shared/             # Shared TypeScript types (@ags/shared)
├── pnpm-workspace.yaml     # Monorepo configuration
└── package.json            # Root configuration and scripts
```

`sistema-modular` is a desktop application built with React, Vite, Tailwind CSS, and Electron. It connects directly to Firebase (Firestore).

## 2. How to Run / Build

### Development (Web / Vite)
Run from the root of the monorepo:
```bash
pnpm --filter @ags/sistema-modular dev
```
*(Runs Vite on port 3001)*

### Development (Desktop / Electron)
Run from the root of the monorepo:
```bash
pnpm --filter @ags/sistema-modular dev:electron
```
*(Runs Vite and waits for it to be ready before launching Electron via `scripts/wait-and-start-electron.cjs`)*

### Build for Production
Run from the root of the monorepo:
```bash
pnpm --filter @ags/sistema-modular build
```
*(Runs Vite build and packages with electron-builder, outputting to `apps/sistema-modular/release/`)*

### Environment Variables
Firebase configuration is strictly required. Create a `.env.local` file in the root or `apps/sistema-modular/` using the following template:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## 3. Domain Model Overview

The business domain flows around the acquisition, quoting, execution, and billing of technical services for clients' establishments and equipment.

**Primary Flow:**
`Lead` → `Presupuesto` (Quote) → `OT` (Work Order) → `Facturación` (Billing/Invoicing)

**Entities & Relationships:**
1. **Cliente:** The legal/fiscal entity. Associated with a CUIT.
2. **Establecimiento:** A physical location belonging to a client (e.g., Plant, Lab, Branch).
3. **Contacto:** Individuals associated with a specific Establishment.
4. **Sistema (Equipo):** A main piece of equipment (e.g., HPLC, GC) located at an Establishment.
5. **Módulo:** Sub-components or parts belonging to a Sistema (e.g., Pump, Detector).
6. **Lead:** A prospective technical service or sales inquiry.
7. **Presupuesto:** A formal quote generated for a client/establishment.
8. **Orden de Trabajo (OT):** The execution report for a service performed on a system.

*For detailed schema definitions, see `FIRESTORE_SCHEMA.md`.*
