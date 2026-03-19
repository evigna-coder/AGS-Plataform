# 🚀 Quick Start - AGS Platform Monorepo

## ✅ Instalación Completada

El monorepo está configurado y las dependencias están instaladas.

## 🎯 Comandos Principales

### Desarrollo

```bash
# Iniciar solo reportes OT (puerto 3000)
pnpm dev:reportes

# Iniciar solo sistema modular (puerto 3001)
pnpm dev:modular

# Iniciar ambos en paralelo
pnpm dev:all
```

### Build

```bash
# Build de producción
pnpm build:reportes
pnpm build:modular
pnpm build:all
```

## 📁 Estructura

```
ags-platform/
├── apps/
│   ├── reportes-ot/          # ✅ Funcional - Puerto 3000
│   └── sistema-modular/      # 🚧 En desarrollo - Puerto 3001
├── packages/
│   └── shared/               # Tipos y código compartido
└── package.json              # Workspace root
```

## 🔗 URLs

- **Reportes OT:** http://localhost:3000
- **Sistema Modular:** http://localhost:3001

## 📝 Próximos Pasos

1. **Verificar que reportes-ot funciona:**
   ```bash
   pnpm dev:reportes
   ```

2. **Desarrollar sistema-modular:**
   - El proyecto base ya está creado en `apps/sistema-modular/`
   - Puedes empezar a desarrollar las funcionalidades

3. **Usar código compartido:**
   ```typescript
   // Importar tipos desde shared
   import { WorkOrder, Quote } from '@shared/types';
   ```

## ⚠️ Notas

- Las dependencias están instaladas en la raíz del monorepo
- Cada app tiene su propio `package.json` pero comparten dependencias comunes
- Los tipos compartidos están en `packages/shared/src/types/`

## 🐛 Si algo no funciona

1. Verifica que estés en la raíz del proyecto
2. Asegúrate de haber ejecutado `pnpm install`
3. Revisa `MIGRACION_MONOREPO.md` para troubleshooting
