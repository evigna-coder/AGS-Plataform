import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3002,
    host: '0.0.0.0',
    strictPort: true,
  },
  // Sello de build visible en la UI (banner de la cola de fotos): permite
  // verificar desde el teléfono qué bundle está corriendo (2026-08-06: no
  // había forma de saber si un dispositivo tenía la versión deployada).
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ags/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
