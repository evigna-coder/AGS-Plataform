// Preload script para Electron
// Este archivo se ejecuta en el contexto aislado antes de que se cargue la página

const { contextBridge } = require('electron');

try {
  // Exponer APIs seguras al renderer process
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron
    }
  });
  
  console.log('[Preload] Electron API expuesta correctamente');
} catch (error) {
  console.error('[Preload] Error al exponer API:', error);
}
