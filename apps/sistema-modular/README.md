# AGS Sistema Modular - Aplicación de Escritorio

Aplicación de escritorio para Windows para gestión administrativa de AGS Analítica.

## 🚀 Desarrollo

### Modo Web (desarrollo rápido)

```bash
pnpm dev
# Abre en http://localhost:3001
```

### Modo Electron (aplicación de escritorio)

```bash
pnpm dev:electron
# Inicia Vite + Electron automáticamente
```

### Solo Electron (si Vite ya está corriendo)

```bash
pnpm electron:dev
```

## 📦 Build

### Build Web

```bash
pnpm build:web
# Genera archivos estáticos en dist/
```

### Build Aplicación de Escritorio

```bash
pnpm build
# Genera instalador .exe en release/
```

El instalador se creará en `apps/sistema-modular/release/` con el nombre:
- `AGS Sistema Modular Setup x.x.x.exe` (instalador)
- `AGS Sistema Modular x.x.x.exe` (portable)

## 🖥️ Características de la Aplicación

- **Ventana nativa de Windows** con tamaño mínimo 1200x700
- **Auto-actualización** cuando se detectan cambios (modo dev)
- **DevTools** disponibles en modo desarrollo
- **Icono personalizado** (configurar en `build/icon.ico`)
- **Instalador NSIS** con opciones de instalación personalizables

## 📁 Estructura

```
sistema-modular/
├── electron/
│   ├── main.js          # Proceso principal de Electron
│   └── preload.js       # Script de preload (contexto aislado)
├── src/
│   ├── App.tsx          # Componente principal
│   ├── main.tsx         # Entry point React
│   └── index.css        # Estilos globales
├── build/
│   └── icon.ico         # Icono de la aplicación (crear)
└── release/             # Archivos generados por electron-builder
```

## 🔧 Configuración

### Icono de la Aplicación

Coloca un archivo `icon.ico` en `apps/sistema-modular/build/icon.ico` para personalizar el icono de la aplicación.

### Configuración de Electron

Edita `apps/sistema-modular/package.json` en la sección `build` para personalizar:
- Nombre de la aplicación
- Tamaño de la ventana
- Opciones del instalador
- Etc.

## 🐛 Troubleshooting

### Error: "Cannot find module 'electron'"

```bash
pnpm install
```

### Error: "Vite server not running"

Asegúrate de que el servidor Vite esté corriendo en el puerto 3001 antes de iniciar Electron.

### La ventana no se muestra

- Verifica la consola de Electron (DevTools)
- Revisa que el puerto 3001 esté disponible
- En modo producción, verifica que `dist/index.html` exista

## 📝 Notas

- En modo desarrollo, Electron se conecta a `http://localhost:3001`
- En modo producción, Electron carga los archivos desde `dist/`
- El preload script permite comunicación segura entre Electron y React
