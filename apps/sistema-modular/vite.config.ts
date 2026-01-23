import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
  },
});
