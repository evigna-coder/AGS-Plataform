# 🚀 Guía de Migración al Monorepo

## ✅ Cambios Realizados

### Estructura Nueva

```
ags-platform/
├── apps/
│   ├── reportes-ot/          # Tu proyecto original (movido aquí)
│   └── sistema-modular/      # Nuevo proyecto independiente
├── packages/
│   └── shared/               # Código compartido
└── package.json              # Workspace root
```

### Archivos Movidos

Todos los archivos del proyecto original fueron movidos a `apps/reportes-ot/`:
- ✅ `App.tsx` → `apps/reportes-ot/App.tsx`
- ✅ `components/` → `apps/reportes-ot/components/`
- ✅ `services/` → `apps/reportes-ot/services/`
- ✅ `public/` → `apps/reportes-ot/public/`
- ✅ `package.json` → `apps/reportes-ot/package.json`
- ✅ `vite.config.ts` → `apps/reportes-ot/vite.config.ts`
- ✅ `firebase.json` → `apps/reportes-ot/firebase.json`
- ✅ Y todos los demás archivos de configuración

## 📦 Instalación

### 1. Instalar pnpm (si no lo tienes)

```bash
npm install -g pnpm
```

### 2. Instalar dependencias

```bash
# Desde la raíz del proyecto
pnpm install
```

Esto instalará las dependencias de todos los workspaces automáticamente.

## 🎯 Uso

### Desarrollo

```bash
# Solo reportes OT (puerto 3000)
pnpm dev:reportes

# Solo sistema modular (puerto 3001)
pnpm dev:modular

# Ambos en paralelo
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

## ⚠️ Notas Importantes

### 1. Rutas de Importación

Si usabas rutas absolutas con `@/`, ahora funcionan igual:
```typescript
import { something } from '@/services/firebaseService';
```

También puedes importar desde `@shared`:
```typescript
import { WorkOrder } from '@shared/types';
```

### 2. Firebase

El archivo `.firebaserc` y `firebase.json` están en `apps/reportes-ot/`. Para deployar:

```bash
cd apps/reportes-ot
firebase deploy
```

### 3. Variables de Entorno

Si usas `.env`, créalo en `apps/reportes-ot/.env` (no en la raíz).

### 4. Node Modules

Con pnpm workspaces, las dependencias se instalan en la raíz y se linkean a cada workspace. No necesitas `node_modules` en cada app.

## 🔄 Próximos Pasos

1. **Verificar que reportes-ot funciona:**
   ```bash
   pnpm dev:reportes
   ```

2. **Desarrollar sistema-modular:**
   ```bash
   pnpm dev:modular
   ```

3. **Extraer código común a `packages/shared/`:**
   - Tipos compartidos (ya creados)
   - Servicios Firebase comunes
   - Utilidades compartidas

4. **Integrar módulos (futuro):**
   - Router único
   - Estado compartido
   - Navegación entre módulos

## 🐛 Troubleshooting

### Error: "Cannot find module"

1. Asegúrate de haber ejecutado `pnpm install` desde la raíz
2. Verifica que los nombres en `package.json` coincidan con los filtros

### Error: "Port already in use"

- Reportes OT usa puerto 3000
- Sistema modular usa puerto 3001
- Si hay conflicto, cambia el puerto en `vite.config.ts`

### Error: "Workspace not found"

Verifica que `pnpm-workspace.yaml` esté en la raíz y tenga:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## 📚 Recursos

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
