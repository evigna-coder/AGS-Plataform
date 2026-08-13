import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const rootDir = __dirname;
  const env = loadEnv(mode, rootDir, 'VITE_');
  // Versión visible en la UI (2026-08-06): saber qué versión corre cada PC
  // dejó de ser adivinanza ("PCs clavadas" + reportes de features fantasma).
  const pkgVersion = JSON.parse(readFileSync(path.resolve(rootDir, 'package.json'), 'utf8')).version as string;

  console.log('[VITE ENV CHECK]', {
    rootDir,
    mode,
    hasGoogleKey: !!env.VITE_GOOGLE_MAPS_API_KEY
  });

  return {
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY ?? ''),
      __APP_VERSION__: JSON.stringify(pkgVersion),
      // Buffer polyfill for @react-pdf/renderer (uses Buffer internally)
      'global': 'globalThis',
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      strictPort: true,
    },
    base: './', // Importante para Electron: rutas relativas
    plugins: [react()],
    optimizeDeps: {
      force: true, // Forzar re-optimización de dependencias
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../../packages/shared/src'),
        '@ags/shared': path.resolve(__dirname, '../../packages/shared/src'),
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          /**
           * Separar las librerías pesadas del chunk principal (2026-08-12).
           *
           * POR QUÉ, y no es cosmético: todo salía en UN chunk de ~8,32 MB y el
           * parser nativo de rollup revienta pasando los 8 MiB (8.388.608 B) con
           * `[vite:build-import-analysis] Parse error @:1:1` — un error que no
           * dice nada y aparece al agregar CUALQUIER módulo nuevo, aunque el
           * type-check esté verde. Ya nos comió dos veces en el mismo día.
           * Partiendo los vendors el principal baja de golpe y queda margen.
           *
           * Solo librerías de node_modules sin dependencias cruzadas con el
           * código de la app — el orden de inicialización no cambia.
           */
          manualChunks(id: string) {
            const p = id.replace(/\\/g, '/');
            if (!p.includes('node_modules')) return;
            if (p.includes('@react-pdf') || p.includes('/fontkit') || p.includes('/yoga')) return 'vendor-react-pdf';
            if (p.includes('/firebase/') || p.includes('/@firebase/')) return 'vendor-firebase';
            if (p.includes('/xlsx')) return 'vendor-xlsx';
            if (p.includes('/html2canvas') || p.includes('/html2pdf') || p.includes('/pdf-lib')) return 'vendor-pdf-tools';
            if (p.includes('/date-fns')) return 'vendor-date-fns';
            if (p.includes('/@dnd-kit')) return 'vendor-dnd';
            if (p.includes('/react-dom/') || p.includes('/scheduler/')) return 'vendor-react';
            return;
          },
        },
      },
    }
  };
});
