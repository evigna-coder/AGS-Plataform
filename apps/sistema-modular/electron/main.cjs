const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
const os = require('os');

// Configuración de la ventana
const isDev = process.argv.includes('--dev') || !app.isPackaged;
const port = 3001;

// ===== Google Drive Auth (Service Account) =====
const AGS_DIR = join(os.homedir(), '.ags');
const CREDENTIALS_PATH = join(AGS_DIR, 'service-account.json');
const DRIVE_CONFIG_PATH = join(AGS_DIR, 'drive-config.json');

let driveAuth = null;

function initDriveAuth() {
  if (driveAuth) return true;
  if (!existsSync(CREDENTIALS_PATH)) return false;
  try {
    const { GoogleAuth } = require('google-auth-library');
    driveAuth = new GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    console.log('[Drive] Auth inicializado con service account');
    return true;
  } catch (err) {
    console.error('[Drive] Error inicializando auth:', err.message);
    return false;
  }
}

function getDriveConfig() {
  if (existsSync(DRIVE_CONFIG_PATH)) {
    try { return JSON.parse(readFileSync(DRIVE_CONFIG_PATH, 'utf-8')); }
    catch { return {}; }
  }
  return {};
}

function saveDriveConfig(config) {
  if (!existsSync(AGS_DIR)) mkdirSync(AGS_DIR, { recursive: true });
  writeFileSync(DRIVE_CONFIG_PATH, JSON.stringify(config, null, 2));
}

// IPC: Check if Drive is configured
ipcMain.handle('drive:is-configured', () => {
  return initDriveAuth();
});

// IPC: Get access token for Drive API calls
ipcMain.handle('drive:get-token', async () => {
  if (!initDriveAuth()) return { error: 'Google Drive no configurado. Coloque service-account.json en ~/.ags/' };
  try {
    const client = await driveAuth.getClient();
    const tokenResp = await client.getAccessToken();
    return { token: tokenResp.token };
  } catch (err) {
    console.error('[Drive] Error obteniendo token:', err.message);
    return { error: err.message };
  }
});

// IPC: Read Drive config (rootFolderId, etc.)
ipcMain.handle('drive:get-config', () => getDriveConfig());

// IPC: Save Drive config
ipcMain.handle('drive:save-config', (_event, config) => {
  const existing = getDriveConfig();
  saveDriveConfig({ ...existing, ...config });
  return true;
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    x: undefined, // Dejar que el sistema posicione la ventana
    y: undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.cjs')
    },
    icon: join(__dirname, '../build/icon.ico'),
    titleBarStyle: 'default',
    show: true, // Mostrar inmediatamente
    backgroundColor: '#f1f5f9', // Color de fondo mientras carga
    alwaysOnTop: false, // No mantener siempre al frente
    skipTaskbar: false // Mostrar en la barra de tareas
  });

  // Configurar Content Security Policy en el header de respuesta
  // En desarrollo, necesitamos 'unsafe-eval' para Vite HMR y React Fast Refresh
  // Esta advertencia es normal en desarrollo y no aparecerá en producción
  if (isDev) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* wss://localhost:* https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com data: blob:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://*.firebaseio.com https://*.googleapis.com; " +
            "style-src 'self' 'unsafe-inline' http://localhost:*; " +
            "img-src 'self' data: blob: http://localhost:* https:; " +
            "font-src 'self' data: http://localhost:* https:; " +
            "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com;"
          ]
        }
      });
    });
  } else {
    // En producción, usar CSP más estricta sin unsafe-eval
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com;"
          ]
        }
      });
    });
  }

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
            mainWindow.webContents.executeJavaScript(`
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

  // Asegurar que la ventana esté visible y al frente
  const ensureVisible = () => {
    if (!mainWindow.isVisible()) {
      console.log('Ventana no visible, forzando mostrar...');
      mainWindow.show();
    }
    if (mainWindow.isMinimized()) {
      console.log('Ventana minimizada, restaurando...');
      mainWindow.restore();
    }
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
    setTimeout(() => mainWindow.setAlwaysOnTop(false), 100);
  };

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    console.log('Ventana lista para mostrar');
    ensureVisible();
  });
  
  // También mostrar cuando la página termine de cargar
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Página terminó de cargar, mostrando ventana');
    ensureVisible();
  });
  
  // Forzar mostrar después de un tiempo si aún no se ha mostrado
  setTimeout(() => {
    console.log('Verificando visibilidad de ventana después del timeout');
    ensureVisible();
  }, 3000);

  // Manejar errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Error al cargar:', {
      errorCode,
      errorDescription,
      url: validatedURL
    });
    
    if (isDev) {
      // Mostrar mensaje de error en la ventana
      mainWindow.webContents.executeJavaScript(`
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

  return mainWindow;
}

// Manejar solicitud de abrir ventana de reportes-ot
ipcMain.on('open-reportes-window', (event, url) => {
  console.log('[IPC] Recibida solicitud para abrir ventana:', url);
  
  const reportesWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    title: 'Editor de Reportes OT',
    show: false,
    backgroundColor: '#f1f5f9'
  });

  console.log('[IPC] Cargando URL en nueva ventana:', url);
  reportesWindow.loadURL(url);
  
  reportesWindow.once('ready-to-show', () => {
    console.log('[IPC] Ventana lista, mostrando...');
    reportesWindow.show();
    reportesWindow.focus();
  });

  reportesWindow.on('closed', () => {
    console.log('[IPC] Ventana de reportes cerrada');
  });
  
  reportesWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[IPC] Error al cargar ventana de reportes:', {
      errorCode,
      errorDescription,
      url: validatedURL
    });
  });
});

// Prevenir múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Otra instancia ya está corriendo, cerrando...');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Si alguien intenta abrir otra instancia, enfocar la ventana existente
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore();
      existingWindow.focus();
      existingWindow.moveTop();
    }
  });

  // Cuando Electron esté listo
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      // En macOS, recrear ventana cuando se hace clic en el dock
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        // En Windows/Linux, enfocar la ventana existente
        const existingWindow = BrowserWindow.getAllWindows()[0];
        if (existingWindow) {
          if (existingWindow.isMinimized()) existingWindow.restore();
          existingWindow.focus();
          existingWindow.moveTop();
        }
      }
    });
  });
}

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
