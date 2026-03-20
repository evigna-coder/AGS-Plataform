# 🖥️ Configuración de Electron - Sistema Modular

## ✅ Instalación Completada

Electron está configurado y listo para usar. El sistema modular ahora puede ejecutarse como aplicación de escritorio para Windows.

## 🚀 Comandos Disponibles

### Desarrollo Web (navegador)

```bash
pnpm dev
# Abre en http://localhost:3001
```

### Desarrollo Electron (aplicación de escritorio)

```bash
pnpm dev:electron
# Inicia Vite + Electron automáticamente
# Abre la aplicación de escritorio
```

### Solo Electron (si Vite ya está corriendo)

```bash
pnpm electron:dev
```

## 📦 Build de Producción

### Build Web

```bash
pnpm build:web
# Genera archivos estáticos en dist/
```

### Build Aplicación de Escritorio (Instalador .exe)

```bash
pnpm build
# Genera instalador en release/
# Archivo: AGS Sistema Modular Setup x.x.x.exe
```

## 🎯 Características de la Aplicación

- ✅ **Ventana nativa de Windows** (1400x900, mínimo 1200x700)
- ✅ **Auto-recarga** en modo desarrollo
- ✅ **DevTools** integrados (F12 o Ctrl+Shift+I)
- ✅ **Instalador NSIS** con opciones personalizables
- ✅ **Acceso directo en escritorio** y menú inicio
- ✅ **Context isolation** para seguridad

## 📁 Archivos Creados

```
apps/sistema-modular/
├── electron/
│   ├── main.js          # Proceso principal de Electron
│   └── preload.js       # Script de preload (seguridad)
├── tailwind.config.js   # Configuración Tailwind CSS
├── postcss.config.js    # Configuración PostCSS
└── package.json         # Scripts y configuración de build
```

## 🔧 Personalización

### Icono de la Aplicación

1. Crea un archivo `icon.ico` (256x256 recomendado)
2. Colócalo en `apps/sistema-modular/build/icon.ico`
3. El instalador usará este icono automáticamente

### Configuración de la Ventana

Edita `apps/sistema-modular/electron/main.js`:

```javascript
const mainWindow = new BrowserWindow({
  width: 1400,        // Ancho inicial
  height: 900,        // Alto inicial
  minWidth: 1200,     // Ancho mínimo
  minHeight: 700,     // Alto mínimo
  // ... más opciones
});
```

### Configuración del Instalador

Edita `apps/sistema-modular/package.json` en la sección `build`:

```json
{
  "build": {
    "appId": "com.agsanalitica.sistema-modular",
    "productName": "AGS Sistema Modular",
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    }
  }
}
```

## 🐛 Troubleshooting

### Error: "Cannot find module 'electron'"

```bash
cd apps/sistema-modular
pnpm install
```

### La ventana no se muestra

1. Verifica que Vite esté corriendo en puerto 3001
2. Abre DevTools (F12) para ver errores
3. Revisa la consola de Electron

### Error al compilar

```bash
# Limpiar y reinstalar
rm -rf node_modules dist
pnpm install
```

## 📝 Notas Importantes

- **Modo desarrollo**: Electron se conecta a `http://localhost:3001`
- **Modo producción**: Electron carga archivos desde `dist/`
- **Seguridad**: Context isolation está habilitado (preload.js)
- **Node integration**: Deshabilitado por seguridad

## 🎨 Próximos Pasos

1. **Crear icono**: Agrega `build/icon.ico` para personalizar
2. **Desarrollar funcionalidades**: Empieza a construir las features
3. **Testing**: Prueba la app en modo desarrollo y producción
4. **Distribución**: Genera el instalador cuando esté listo

## 📚 Recursos

- [Electron Docs](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Vite + Electron](https://vitejs.dev/guide/)
