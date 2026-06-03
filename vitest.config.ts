import { defineConfig } from 'vitest/config';

// Config raíz: solo para los tests de reglas de Firestore (tests/**).
// Cada app tiene su propia config de vitest en su carpeta.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
