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
    plugins: [
      react(),
      // Lecturas de Firestore instrumentadas (2026-09-11, fase 0 de
      // .claude/plans/performance.md): todo `import 'firebase/firestore'` de la
      // app y de packages/shared va al shim, que re-exporta el SDK y cuenta
      // getDoc/getDocs/onSnapshot. Solo el shim importa el SDK real.
      {
        name: 'ags-firestore-instrumentado',
        enforce: 'pre' as const,
        resolveId(id: string, importer?: string) {
          if (id !== 'firebase/firestore' || !importer) return null;
          if (importer.replace(/\\/g, '/').includes('/services/firestoreInstrumented')) return null;
          return path.resolve(__dirname, 'src/services/firestoreInstrumented.ts');
        },
      },
    ],
    optimizeDeps: {
      force: true, // Forzar re-optimización de dependencias
      // Con las páginas a demanda (lazy, 2026-09-11) Vite descubría dependencias
      // nuevas recién al abrir un módulo y hacía un RELOAD completo de la app
      // ("optimized dependencies changed. reloading" → vuelve a "AGS cargando").
      // Escanear todas las páginas al arrancar evita el descubrimiento tardío.
      entries: ['index.html', 'src/pages/**/*.tsx', 'src/components/**/*.tsx'],
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
            // `react` y su jsx-runtime también acá (2026-09-11): sin asignarlos,
            // Rollup los dejaba caer DENTRO del chunk de react-pdf, y como todo
            // el app importa React, el chunk de 2,1 MB se precargaba al arranque
            // aunque ninguna pantalla lo usara todavía.
            if (p.includes('/node_modules/react/') || p.includes('/react-dom/') || p.includes('/scheduler/')) return 'vendor-react';
            return;
          },
        },
      },
    }
  };
});
