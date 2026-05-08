const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { join, extname } = require('path');
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
const crypto = require('crypto');
const http = require('http');
const os = require('os');

// Configuración de la ventana
const isDev = process.argv.includes('--dev') || !app.isPackaged;
const devPort = 3001;

// Puerto del servidor estático interno en producción (asignado dinámicamente).
// Necesario porque Firebase Auth rechaza file:// (auth/unauthorized-domain).
let prodPort = null;

function getAppOrigin() {
  return isDev ? `http://localhost:${devPort}` : `http://localhost:${prodPort}`;
}

// Servidor estático mínimo para servir el bundle de Vite en producción.
// Soporta SPA fallback (cualquier ruta no-archivo devuelve index.html).
function startStaticServer(distPath) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
    '.map': 'application/json',
    '.webmanifest': 'application/manifest+json',
  };
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        let filePath = join(distPath, urlPath);
        if (!filePath.startsWith(distPath)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        if (!existsSync(filePath)) {
          // SPA fallback: rutas tipo /clientes/123 -> index.html
          filePath = join(distPath, 'index.html');
        }
        const mime = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
        res.end(content);
      } catch (err) {
        console.error('[StaticServer]', err.message);
        res.writeHead(500); res.end('Server error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[StaticServer] Serving ${distPath} on http://localhost:${port}`);
      resolve(port);
    });
  });
}

// ===== Google OAuth manual (Electron) =====
// Abre una ventana, deja al user logear en Google, intercepta el redirect al
// handler de Firebase y extrae el id_token del fragment. Devuelve los tokens
// para que el renderer los use con signInWithCredential.
function runGoogleOAuthFlow({ clientId, authDomain, hd }) {
  return new Promise((resolve, reject) => {
    const redirectUri = `https://${authDomain}/__/auth/handler`;
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'id_token token');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('prompt', 'select_account');
    if (hd) authUrl.searchParams.set('hd', hd);

    // Log de la URL OAuth completa al main process. Útil cuando algo falla con
    // 400 desde Google: pegando esto desde la consola del .exe se ve el
    // client_id y redirect_uri exactos que se están enviando.
    console.log('[OAuth] auth URL:', authUrl.toString());
    console.log('[OAuth] clientId:', clientId);
    console.log('[OAuth] redirectUri:', redirectUri);

    const win = new BrowserWindow({
      width: 500,
      height: 700,
      autoHideMenuBar: false, // Dejamos la barra visible para poder ver la URL
                              // si Google rechaza con 400 (diagnóstico).
      title: 'Iniciar sesión con Google',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let resolved = false;

    const handleNavigation = (event, url) => {
      if (!url || !url.startsWith(redirectUri)) return;

      // Implicit flow devuelve los tokens en el fragment (#)
      const fragment = url.includes('#') ? url.split('#')[1] : '';
      const params = new URLSearchParams(fragment);
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const returnedState = params.get('state');

      try { event.preventDefault(); } catch {}
      resolved = true;
      try { win.close(); } catch {}

      if (error) {
        return reject(new Error(`OAuth error: ${error}${errorDescription ? ' - ' + errorDescription : ''}`));
      }
      if (returnedState !== state) {
        return reject(new Error('OAuth state mismatch — posible ataque CSRF'));
      }
      if (!idToken) {
        return reject(new Error('Google no devolvió id_token'));
      }

      resolve({ idToken, accessToken, nonce });
    };

    win.webContents.on('will-redirect', handleNavigation);
    win.webContents.on('will-navigate', handleNavigation);

    win.on('closed', () => {
      if (!resolved) reject(new Error('User cancelled sign-in'));
    });

    win.loadURL(authUrl.toString()).catch(err => {
      if (!resolved) reject(new Error(`No se pudo abrir Google OAuth: ${err.message}`));
    });
  });
}

// ===== Auto-updater =====
// Skip en dev: electron-updater requiere app empaquetada y un latest.yml accesible.
function setupAutoUpdater(targetWindow) {
  if (isDev) {
    console.log('[AutoUpdater] Skipping in dev mode');
    return;
  }

  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (err) {
    console.error('[AutoUpdater] electron-updater not available:', err.message);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err?.message || err);
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info?.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Downloading: ${Math.round(progress.percent)}% (${Math.round(progress.bytesPerSecond / 1024)} KB/s)`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Downloaded:', info?.version);
    const choice = dialog.showMessageBoxSync(targetWindow, {
      type: 'info',
      buttons: ['Reiniciar ahora', 'Después'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización disponible',
      message: `AGS Sistema Modular v${info?.version} está lista para instalar.`,
      detail: 'Reinicie la aplicación para aplicar la actualización. Los cambios sin guardar se perderán.',
    });
    if (choice === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Primera verificación 10s después del arranque (no bloquea el primer render)
  setTimeout(() => autoUpdater.checkForUpdates().catch(err => console.error('[AutoUpdater]', err?.message)), 10_000);
  // Re-check cada 4 horas
  setInterval(() => autoUpdater.checkForUpdates().catch(err => console.error('[AutoUpdater]', err?.message)), 4 * 60 * 60 * 1000);
}

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

function registerIpcHandlers() {
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

  // IPC: Google Sign-In via OAuth manual.
  // signInWithPopup de Firebase rompe en Electron porque la nav cross-origin
  // del popup pierde window.opener -> el handler de Firebase no puede postMessage
  // al parent y devuelve auth/popup-closed-by-user.
  // Acá hacemos el OAuth implicit flow nosotros: abrimos una ventana, escuchamos
  // el redirect a `https://<authDomain>/__/auth/handler`, extraemos id_token del
  // fragment y lo devolvemos. El renderer hace signInWithCredential con eso.
  ipcMain.handle('auth:google-signin', async (_event, opts) => {
    const { clientId, authDomain, hd } = opts || {};
    if (!clientId || !authDomain) {
      return { error: 'Falta clientId o authDomain' };
    }
    try {
      const result = await runGoogleOAuthFlow({ clientId, authDomain, hd });
      return { ok: true, ...result };
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  });

  // Shell: abrir archivo con app por defecto del sistema
  ipcMain.handle('shell:open-path', async (_event, filePath) => {
    const { shell } = require('electron');
    return shell.openPath(filePath);
  });

  // File: guardar buffer como archivo temporal y abrirlo con app por defecto
  ipcMain.handle('file:save-temp-and-open', async (_event, buffer, filename) => {
    const { shell } = require('electron');
    const tmpDir = join(os.tmpdir(), 'ags-pdfs');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, filename);
    writeFileSync(filePath, Buffer.from(buffer));
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
    return filePath;
  });

  // Abrir módulo en nueva ventana (misma app, con preload completo)
  ipcMain.on('open-module-window', (event, route) => {
    console.log('[IPC] Abriendo módulo en nueva ventana:', route);
    const mainWin = BrowserWindow.getAllWindows()[0];
    const bounds = mainWin ? mainWin.getBounds() : {};

    const moduleWindow = new BrowserWindow({
      width: bounds.width || 1400,
      height: bounds.height || 900,
      minWidth: 1200,
      minHeight: 700,
      x: (bounds.x || 100) + 30,
      y: (bounds.y || 100) + 30,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: join(__dirname, 'preload.cjs'),
      },
      title: `AGS — ${route}`,
      show: false,
      backgroundColor: '#f1f5f9',
    });

    moduleWindow.loadURL(`${getAppOrigin()}${route}`);

    moduleWindow.once('ready-to-show', () => {
      moduleWindow.show();
      moduleWindow.focus();
    });
  });

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
}

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
      preload: join(__dirname, 'preload.cjs'),
      backgroundThrottling: false, // Prevent Electron from throttling timers/rendering
    },
    icon: join(__dirname, '../build/icon.ico'),
    titleBarStyle: 'default',
    show: true, // Mostrar inmediatamente
    backgroundColor: '#f1f5f9', // Color de fondo mientras carga
    alwaysOnTop: false, // No mantener siempre al frente
    skipTaskbar: false // Mostrar en la barra de tareas
  });

  // Content Security Policy: solo aplica a URLs propias.
  // No pisamos los headers de sitios externos (accounts.google.com, etc.) porque
  // eso rompe el popup de Firebase Auth — la CSP nuestra es más restrictiva
  // que la de Google y bloquea sus scripts.
  const ourCsp = isDev
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* wss://localhost:* https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.run.app data: blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob: http://localhost:* https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' http://localhost:* https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: http://localhost:* https:; " +
      "font-src 'self' data: http://localhost:* https://fonts.gstatic.com; " +
      "connect-src 'self' data: blob: http://localhost:* ws://localhost:* wss://localhost:* https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.run.app;"
    : "default-src 'self'; " +
      "script-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' data: blob: https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.run.app;";

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || '';
    const isOurOrigin = url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:') || url.startsWith('devtools://');
    if (!isOurOrigin) {
      // Sitio externo (auth de Google, etc.) — dejá pasar sus headers tal cual
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [ourCsp],
      },
    });
  });

  // Cargar la aplicación
  if (isDev) {
    // Modo desarrollo: cargar desde Vite dev server
    console.log(`Intentando cargar desde http://localhost:${devPort}`);

    // Función para intentar cargar con retry
    const loadApp = (retries = 5) => {
      mainWindow.loadURL(`http://localhost:${devPort}`)
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
                    <p style="color: #64748b; margin-bottom: 1rem;">Asegúrate de que el servidor esté corriendo en el puerto ${devPort}</p>
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
    // Modo producción: cargar desde el servidor estático interno (localhost).
    // Necesario para Firebase Auth — file:// dispara auth/unauthorized-domain.
    if (!prodPort) {
      console.error('Servidor estático no inicializado antes de createWindow');
      return mainWindow;
    }
    mainWindow.loadURL(`http://localhost:${prodPort}/`);
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
              <p style="color: #64748b; margin-bottom: 1rem;">Asegúrate de que el servidor esté corriendo en el puerto ${devPort}</p>
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

  // Log de errores de consola del renderer (solo errores)
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) console.log(`[Renderer ${level}]:`, message);
  });


  // Manejar ventanas emergentes (popups)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Permitir popup de Firebase/Google Auth como ventana hija de Electron
    if (url.includes('accounts.google.com') ||
        url.includes('firebaseapp.com/__/auth') ||
        url.includes('googleapis.com/identitytoolkit')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 700,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }
    // URLs de la misma app (localhost en dev) → abrir como ventana Electron con preload
    const appOrigin = getAppOrigin();
    if (url.startsWith(appOrigin)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1400,
          height: 900,
          minWidth: 1200,
          minHeight: 700,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: join(__dirname, 'preload.cjs'),
          },
          backgroundColor: '#f1f5f9',
        },
      };
    }
    // Todo lo demas se abre en el navegador externo
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

// Logging de eventos críticos del main para debug del cierre post-update.
// Aparece en stderr del binario; en producción solo se ve si el user abre cmd
// y corre el .exe desde ahí, o si conecta DevTools al main.
app.on('before-quit', (e) => console.log('[App] before-quit', e));
app.on('will-quit', (e) => console.log('[App] will-quit', e));
app.on('quit', (_e, code) => console.log('[App] quit code=', code));
app.on('render-process-gone', (_e, wc, det) => console.error('[App] render-process-gone:', det));
app.on('child-process-gone', (_e, det) => console.error('[App] child-process-gone:', det));
process.on('uncaughtException', (err) => console.error('[Main] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[Main] unhandledRejection:', err));

// Prevenir múltiples instancias.
// IMPORTANTE: el primer launch post-instalación/update suele fallar este check
// porque el proceso anterior (el que se reemplazó) todavía retiene el lock unos
// segundos. En lugar de quit (que dejaba la app cerrada hasta que el user la
// volviera a abrir manualmente), relaunch — la nueva instancia arranca después
// de que el SO libera el lock.
const gotTheLock = app.requestSingleInstanceLock();
console.log('[App] requestSingleInstanceLock →', gotTheLock);

if (!gotTheLock) {
  console.log('[App] Lock ocupado (probable transición post-update). Relanzando en 1.5s...');
  setTimeout(() => {
    console.log('[App] Ejecutando relaunch + exit');
    app.relaunch();
    app.exit(0);
  }, 1500);
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
  app.whenReady().then(async () => {
    registerIpcHandlers();
    if (!isDev) {
      const distPath = join(__dirname, '..', 'dist');
      try {
        prodPort = await startStaticServer(distPath);
      } catch (err) {
        console.error('No se pudo arrancar el servidor estático:', err);
        app.quit();
        return;
      }
    }
    const mainWindow = createWindow();
    setupAutoUpdater(mainWindow);

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
