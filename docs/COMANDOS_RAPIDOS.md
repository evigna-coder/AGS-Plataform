# 🚀 Comandos Rápidos - AGS Platform

## Desde la Raíz del Proyecto

### Desarrollo

```bash
# Reportes OT (puerto 3000)
pnpm dev:reportes

# Sistema Modular - Web (puerto 3001)
pnpm dev:modular

# Sistema Modular - Electron (aplicación de escritorio)
pnpm dev:modular:electron

# Ambos módulos en paralelo
pnpm dev:all
```

### Build

```bash
# Build individual
pnpm build:reportes
pnpm build:modular

# Build todos
pnpm build:all
```

## Desde Cada App Individual

### Reportes OT

```bash
cd apps/reportes-ot
pnpm dev          # Desarrollo
pnpm build        # Build
```

### Sistema Modular

```bash
cd apps/sistema-modular
pnpm dev                    # Desarrollo web
pnpm dev:electron          # Desarrollo Electron
pnpm electron:dev          # Solo Electron (si Vite ya corre)
pnpm build                 # Build instalador .exe
```

## ⚠️ Nota Importante

**NO uses `npm run dev` desde la raíz** - El monorepo usa `pnpm` con workspaces.

Usa siempre:
- `pnpm dev:reportes` (desde la raíz)
- `pnpm dev:modular` (desde la raíz)
- O `cd apps/[nombre-app] && pnpm dev` (desde cada app)
