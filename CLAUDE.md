# AGS Plataform

Monorepo pnpm con tres apps y un paquete compartido. Este archivo es el punto de entrada para Claude y para cualquier colaborador nuevo. Cosas **estables** van acá; estado de módulos en progreso y decisiones recientes quedan en `C:\Users\Evigna\.claude\projects\.../memory/` (auto-memory, no versionado).

## Stack

- **Gestión**: pnpm workspaces (`pnpm@9.15.4`), Node ≥18
- **Lenguaje**: TypeScript 5.8
- **Frontend**: React 19 + Tailwind CSS
- **Backend-as-a-Service**: Firebase (Firestore, Auth, Storage, FCM)
- **Empaque Desktop** (solo `sistema-modular`): Electron
- **PDF**: html2pdf.js + html2canvas + pdf-lib (solo `reportes-ot`)

## Apps

| Path | Rol |
|---|---|
| [apps/sistema-modular/](apps/sistema-modular/) | Back-office administrativo. CRUD de clientes, OTs, presupuestos, stock, agenda. Corre en browser y en Electron. |
| [apps/reportes-ot/](apps/reportes-ot/) | PWA para técnicos en campo. Genera el PDF del informe de OT. **Superficie congelada** — ver [.claude/rules/reportes-ot.md](.claude/rules/reportes-ot.md). |
| [apps/portal-ingeniero/](apps/portal-ingeniero/) | Portal para ingenieros de soporte. Más nuevo, en evolución activa. |
| [packages/shared/](packages/shared/) | Tipos TS compartidos entre apps (`@ags/shared`). |

## Scripts (root)

```bash
pnpm dev:modular          # sistema-modular en dev (Vite)
pnpm dev:modular:electron # sistema-modular con Electron
pnpm dev:reportes         # reportes-ot en dev
pnpm dev:portal           # portal-ingeniero en dev
pnpm dev:all              # todas en paralelo

pnpm build:modular        # build sistema-modular
pnpm build:reportes       # build reportes-ot
pnpm build:portal         # build portal-ingeniero
pnpm build:all            # build todas

pnpm type-check           # typecheck de packages/*
```

Cada app tiene sus propios scripts (`lint`, `test` donde aplica) en su `package.json`.

## Hard rules — leer antes de editar

Estas reglas son invariantes del proyecto. Cada archivo explica *por qué* y *cómo aplicar*:

- @.claude/rules/reportes-ot.md — la app de técnico es superficie congelada
- @.claude/rules/firestore.md — nunca `undefined` en writes; usar helpers `cleanFirestoreData` / `deepCleanForFirestore`
- @.claude/rules/components.md — componentes React ≤250 líneas; extraer hook o subcomponente antes de crecer más

## Convenciones principales (sistema-modular)

### Servicios Firestore

Todos en [apps/sistema-modular/src/services/](apps/sistema-modular/src/services/). Un archivo por colección. Exporta un objeto con métodos CRUD (`leadsService.create(...)`, `.list(...)`, etc.). Los componentes **no** llaman a Firestore directo.

Helpers clave en [apps/sistema-modular/src/services/firebase.ts](apps/sistema-modular/src/services/firebase.ts): `db`, `cleanFirestoreData`, `deepCleanForFirestore`, `getCreateTrace`, `getUpdateTrace`, `createBatch`, `batchAudit`.

### Caché

`serviceCache.ts` (TTL 2 min) envuelve lecturas frecuentes. Si una lista va a mostrarse en varios lugares, pasá por el caché.

### UI atoms

`components/ui/` — `Button`, `Card`, `Input`, `SearchableSelect`. Reusá antes de recrear. Si necesitás una variante, extendela en lugar de duplicar.

### Páginas

Una carpeta por módulo en `pages/[modulo]/` con `index.tsx` como barrel. Listas siguen el patrón documentado en el skill `list-page-conventions` (filtros persistidos vía `useUrlFilters`, nunca `useState` para filtros).

### Routing

`App.tsx` con `react-router-dom` v7. Sidebar `bg-slate-900` con borde izquierdo `teal-500` activo. Layout único con auth gate.

### Design system

Editorial Teal. Detalle completo en [memory/design_system.md](memory/design_system.md) (local) y en el skill `list-page-conventions`.

- Primario: `teal-700` (#0D6E6E)
- Fuentes: Inter (body), Newsreader (títulos de modal), JetBrains Mono (labels/métricas)
- Labels de campo: uppercase, monospace, `tracking-wide`, `text-[10px]`

## Donde está cada cosa

| Necesito… | Mirar en… |
|---|---|
| Acceso a datos (CRUD) | `apps/sistema-modular/src/services/` |
| Tipos compartidos | `packages/shared/` |
| Atoms UI | `apps/sistema-modular/src/components/ui/` |
| Patrón de lista | Skill `list-page-conventions` |
| Patrón de modal | `components/` — mirar `ClienteModal`, `LeadModal` |
| Pipeline PDF técnico | `apps/reportes-ot/components/` (leer la regla antes de tocar) |

## Tooling de Claude

- **Auto-memory**: `C:\Users\Evigna\.claude\projects\.../memory/` — estado volátil, decisiones recientes, estados de módulos.
- **Hooks** (`.claude/hooks/`):
  - `guard-reportes-ot.js` — bloquea edits en `apps/reportes-ot/` salvo `CLAUDE_ALLOW_REPORTES_OT=1`.
  - `check-firestore-undefined.js` — warn soft si un edit introduce `: undefined` cerca de un write Firestore.
  - `check-component-size.js` — warn soft si un `.tsx` editado queda >250 líneas.
- **AST rules** (`.claude/ast-rules/`): escaneables con `pnpm lint:ast`. Regla actual: `no-firestore-undefined`.
- **Skills**: `list-page-conventions`, `ags-system-guide` ya documentan patrones; reusar antes de reinventar.

## Lo que NO va en este archivo

- Estado en progreso de módulos → `memory/`
- Plans activos → `.claude/plans/`
- Tutoriales / explicaciones de features → carpeta `memory/` o PR descriptions
- Cualquier cosa que cambie semanalmente
