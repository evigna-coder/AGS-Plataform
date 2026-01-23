const { app, BrowserWindow } = require('electron');
const { join } = require('path');
const { existsSync } = require('fs');

// Configuración de la ventana
const isDev = process.argv.includes('--dev') || !app.isPackaged;
const port = 3001;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.cjs')
    },
    icon: join(__dirname, '../build/icon.ico'),
    titleBarStyle: 'default',
    show: false, // No mostrar hasta que esté listo
    backgroundColor: '#f1f5f9' // Color de fondo mientras carga
  });

  // Cargar la aplicación
  if (isDev) {
    // Modo desarrollo: cargar desde Vite dev server
    console.log(`Intentando cargar desde http://localhost:${port}`);
    
    // Función para intentar cargar con retry
    const loadApp = (retries = 5) => {
      mainWindow.loadURL(`http://localhost:${port}`)
        .then(() => {
          console.log('Página cargada exitosamente');
          mainWindow.webContents.openDevTools();
        })
        .catch(err => {
          console.error(`Error al cargar (intentos restantes: ${retries}):`, err);
          if (retries > 0) {
            setTimeout(() => loadApp(retries - 1), 1000);
          } else {
            // Mostrar error después de todos los intentos
            mainWindow.webContents.executeScript(`
              document.body.innerHTML = \`
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; background: #f1f5f9;">
                  <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px;">
                    <h1 style="color: #dc2626; margin-bottom: 1rem;">⚠️ Error de Conexión</h1>
                    <p style="color: #64748b; margin-bottom: 0.5rem;">No se pudo conectar al servidor Vite.</p>
                    <p style="color: #64748b; margin-bottom: 1rem;">Asegúrate de que el servidor esté corriendo en el puerto ${port}</p>
                    <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 1rem;">Abre DevTools (F12) para más detalles</p>
                  </div>
                </div>
              \`;
            `).catch(console.error);
            mainWindow.webContents.openDevTools();
          }
        });
    };
    
    // Esperar un momento antes de intentar cargar
    setTimeout(() => loadApp(), 2000);
    
    // Abrir DevTools inmediatamente para debugging
    mainWindow.webContents.openDevTools();
  } else {
    // Modo producción: cargar desde archivos estáticos
    const indexPath = join(__dirname, '../dist/index.html');
    if (existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('No se encontró el archivo index.html en dist/');
    }
  }

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    console.log('Ventana lista para mostrar');
    mainWindow.show();
    mainWindow.focus();
  });
  
  // También mostrar cuando la página termine de cargar
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Página terminó de cargar, mostrando ventana');
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Manejar errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Error al cargar:', {
      errorCode,
      errorDescription,
      url: validatedURL
    });
    
    if (isDev) {
      // Mostrar mensaje de error en la ventana
      mainWindow.webContents.executeScript(`
        document.body.innerHTML = \`
          <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; background: #f1f5f9;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h1 style="color: #dc2626; margin-bottom: 1rem;">⚠️ Error de Conexión</h1>
              <p style="color: #64748b; margin-bottom: 0.5rem;">No se pudo conectar al servidor Vite.</p>
              <p style="color: #64748b; margin-bottom: 1rem;">Asegúrate de que el servidor esté corriendo en el puerto ${port}</p>
              <p style="color: #94a3b8; font-size: 0.875rem;">Error: ${errorDescription}</p>
            </div>
          </div>
        \`;
      `).catch(console.error);
    }
  });

  // Log cuando la página se carga correctamente
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Página cargada correctamente');
  });

  // Log de errores de consola del renderer
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer ${level}]:`, message);
  });

  // Prevenir navegación externa
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Permitir abrir en navegador externo
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Cuando Electron esté listo
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // En macOS, recrear ventana cuando se hace clic en el dock
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cerrar cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Manejar actualizaciones y otros eventos
app.on('ready', () => {
  console.log('AGS Sistema Modular - Aplicación iniciada');
});
