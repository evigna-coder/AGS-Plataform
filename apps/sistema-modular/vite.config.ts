import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const rootDir = __dirname;
  const env = loadEnv(mode, rootDir, 'VITE_');

  console.log('[VITE ENV CHECK]', {
    rootDir,
    mode,
    hasGoogleKey: !!env.VITE_GOOGLE_MAPS_API_KEY
  });

  return {
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY ?? ''),
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
      },
    }
  };
});
