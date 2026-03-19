/**
 * Lanza el binario de Electron directamente, sin el shim de pnpm.
 * pnpm setea ELECTRON_RUN_AS_NODE=1 en el shim, lo cual hace que
 * Electron se comporte como Node.js y require('electron') no funcione.
 */
const { spawn } = require('child_process');
const path = require('path');

const appDir = path.join(__dirname, '..');
const electronBinary = require(path.join(appDir, 'node_modules', 'electron'));
const args = ['.', ...process.argv.slice(2)];

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log('Starting Electron:', electronBinary);
console.log('Args:', args.join(' '));

const child = spawn(electronBinary, args, {
  stdio: 'inherit',
  cwd: appDir,
  env,
});

child.on('error', (err) => {
  console.error('Error starting Electron:', err.message);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code || 0);
});
