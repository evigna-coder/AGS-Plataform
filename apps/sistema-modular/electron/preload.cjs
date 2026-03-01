// Preload script para Electron
// Este archivo se ejecuta en el contexto aislado antes de que se cargue la página

const { contextBridge, shell, ipcRenderer } = require('electron');

try {
  // Exponer APIs seguras al renderer process
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron
    },
    // API para abrir URLs en el navegador del sistema
    openExternal: (url) => {
      shell.openExternal(url);
    },
    // API para abrir una nueva ventana de Electron con una URL
    openWindow: (url) => {
      ipcRenderer.send('open-reportes-window', url);
    }
  });

  // API de Google Drive (auth via service account en main process)
  contextBridge.exposeInMainWorld('driveAPI', {
    isConfigured: () => ipcRenderer.invoke('drive:is-configured'),
    getToken: () => ipcRenderer.invoke('drive:get-token'),
    getConfig: () => ipcRenderer.invoke('drive:get-config'),
    saveConfig: (config) => ipcRenderer.invoke('drive:save-config', config),
  });
  
  console.log('[Preload] Electron API expuesta correctamente');
} catch (error) {
  console.error('[Preload] Error al exponer API:', error);
}
