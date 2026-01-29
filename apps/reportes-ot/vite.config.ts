import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const projectId = env.VITE_FIREBASE_PROJECT_ID ?? 'agssop-e7353';
    const webauthnTarget = `https://us-central1-${projectId}.cloudfunctions.net`;
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // En desarrollo, evitar CORS: /api/webauthn/* → Cloud Function /webauthn/*
          '/api/webauthn': {
            target: webauthnTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/webauthn/, '/webauthn'),
          },
        },
      },
      plugins: [react()],
      test: {
        environment: 'jsdom',
        globals: true,
        include: ['**/*.test.{ts,tsx}'],
        exclude: ['node_modules', 'dist', 'functions'],
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@shared': path.resolve(__dirname, '../../packages/shared/src'),
        }
      }
    };
});
