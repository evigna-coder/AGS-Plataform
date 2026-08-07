// Preload script para Electron
// Este archivo se ejecuta en el contexto aislado antes de que se cargue la página

// OJO: `shell` NO se puede requerir acá — con sandbox activo (default desde
// Electron 20) el preload solo ve contextBridge/ipcRenderer/webFrame. Todo lo
// que necesite shell va por ipcRenderer.invoke a un handler del main.
const { contextBridge, ipcRenderer } = require('electron');

try {
  // Exponer APIs seguras al renderer process
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron
    },
    // API para abrir URLs en el navegador del sistema.
    // Vía IPC, NO `shell` directo: con sandbox activo (default desde Electron 20)
    // el preload no tiene acceso a `shell` y la llamada rompía con
    // "Cannot read properties of undefined (reading 'openExternal')".
    openExternal: (url) => {
      return ipcRenderer.invoke('shell:open-external', url);
    },
    // API para abrir un archivo local con la aplicación por defecto del sistema
    openPath: (filePath) => {
      return ipcRenderer.invoke('shell:open-path', filePath);
    },
    // API para guardar un blob como archivo temporal y abrirlo
    saveTempAndOpen: (buffer, filename) => {
      return ipcRenderer.invoke('file:save-temp-and-open', buffer, filename);
    },
    // API para imprimir un PDF EN SILENCIO a la impresora predeterminada.
    // Devuelve { success, failureReason }.
    printPdfSilent: (buffer) => {
      return ipcRenderer.invoke('print:pdf-silent', buffer);
    },
    // Imprimir HTML en silencio, SIEMPRE 1 copia (listado de minikit).
    printHtmlSilent: (html) => {
      return ipcRenderer.invoke('print:html-silent', html);
    },
    // Guardar un archivo en una carpeta del escritorio (PDF del presupuesto).
    saveToDesktopFolder: (folderName, fileName, buffer) => {
      return ipcRenderer.invoke('file:save-to-desktop-folder', folderName, fileName, buffer);
    },
    // API para abrir una nueva ventana de Electron con una URL
    openWindow: (url) => {
      ipcRenderer.send('open-reportes-window', url);
    },
    // Abrir un módulo de sistema-modular en nueva ventana Electron (con preload)
    openModuleWindow: (route) => {
      ipcRenderer.send('open-module-window', route);
    },
    // Destraba el keyboard router de Chromium tras un write a Firestore.
    // Ver memory/project_search_inputs_disabled_after_write.md
    flashFocus: () => {
      ipcRenderer.send('window:flash-focus');
    },
    flashDiagnostics: () => ipcRenderer.invoke('window:flash-diagnostics'),
  });

  // API de Google Drive (auth via service account en main process)
  contextBridge.exposeInMainWorld('driveAPI', {
    isConfigured: () => ipcRenderer.invoke('drive:is-configured'),
    getToken: () => ipcRenderer.invoke('drive:get-token'),
    getConfig: () => ipcRenderer.invoke('drive:get-config'),
    saveConfig: (config) => ipcRenderer.invoke('drive:save-config', config),
  });

  // API de Auth: OAuth manual de Google para Electron.
  // signInWithPopup de Firebase no funciona en Electron (window.opener se pierde
  // en cross-origin nav). Usamos esta API en lugar del popup en main process.
  contextBridge.exposeInMainWorld('authAPI', {
    signInWithGoogle: (opts) => ipcRenderer.invoke('auth:google-signin', opts),
  });

  // API de Auto-Update: el main envía eventos cuando hay una actualización,
  // y el renderer muestra un banner no-modal con "Reiniciar". Si el user
  // confirma, se invoca quit-and-install.
  // Los `on*` devuelven una función para desuscribirse.
  const subscribe = (channel, cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
  contextBridge.exposeInMainWorld('updateAPI', {
    onAvailable: (cb) => subscribe('update:available', cb),
    onProgress: (cb) => subscribe('update:progress', cb),
    onDownloaded: (cb) => subscribe('update:downloaded', cb),
    quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  });

  console.log('[Preload] Electron API expuesta correctamente');
} catch (error) {
  console.error('[Preload] Error al exponer API:', error);
}
