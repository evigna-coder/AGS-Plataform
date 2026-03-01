/// <reference types="vite/client" />

// Tipos para Electron API (si se expone desde preload)
interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  openExternal?: (url: string) => void;
  openWindow?: (url: string) => void;
}

// API de Google Drive expuesta desde preload
interface DriveAPI {
  isConfigured: () => Promise<boolean>;
  getToken: () => Promise<{ token?: string; error?: string }>;
  getConfig: () => Promise<Record<string, string>>;
  saveConfig: (config: Record<string, string>) => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
  driveAPI?: DriveAPI;
}

// Variables de entorno de Firebase
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
