/**
 * build.mjs — Bundlea render-entry.tsx (que reusa los componentes @react-pdf de
 * sistema-modular) a dist/render.mjs, ejecutable en Node.
 *
 * Resuelve dos cosas que en la app las hace Vite y en Node no existen:
 *  - imports de fuentes `.ttf` → los reemplaza por la RUTA ABSOLUTA del archivo,
 *    que es lo que @react-pdf Font.register acepta en Node.
 *  - alias `@ags/shared` y `@app` → apuntan al código fuente del monorepo.
 *
 * Las libs pesadas de runtime (@react-pdf, react, react-pdf-html) quedan EXTERNAL
 * y se resuelven desde node_modules en tiempo de ejecución (más robusto que
 * bundlearlas).
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..'); // ops/backup/pdf-regen → repo root
const appSrc = path.join(repo, 'apps', 'sistema-modular', 'src');
const sharedIndex = path.join(repo, 'packages', 'shared', 'src', 'index.ts');
const sharedUtils = path.join(repo, 'packages', 'shared', 'src', 'utils', 'index.ts');

/** Reemplaza `import x from '....ttf'` por la ruta absoluta del .ttf (string). */
const ttfAsPathPlugin = {
  name: 'ttf-as-path',
  setup(b) {
    b.onResolve({ filter: /\.ttf$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path),
      namespace: 'ttf-path',
    }));
    b.onLoad({ filter: /.*/, namespace: 'ttf-path' }, (args) => ({
      contents: `export default ${JSON.stringify(args.path)};`,
      loader: 'js',
    }));
  },
};

await build({
  entryPoints: [path.join(here, 'src', 'render-entry.tsx')],
  outfile: path.join(here, 'dist', 'render.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  jsx: 'automatic',
  logLevel: 'info',
  external: ['@react-pdf/renderer', 'react', 'react-dom', 'react/jsx-runtime', 'react-pdf-html'],
  alias: {
    // Orden importa: la entrada más específica primero.
    '@ags/shared/utils': sharedUtils,
    '@ags/shared': sharedIndex,
    '@app': appSrc,
  },
  plugins: [ttfAsPathPlugin],
});

console.log('OK → dist/render.mjs');
