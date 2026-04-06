/**
 * Login manual con Google OAuth — guarda sesión persistente.
 *
 * Uso: pnpm e2e:setup
 *
 * Abre Chrome con un perfil persistente. Loguearse con cuenta
 * @agsanalitica.com. Una vez dentro del sistema, cerrar el browser.
 * La sesión queda guardada en e2e/.auth-profile/ para los tests.
 */

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.join(__dirname, '.auth-profile');

async function globalSetup() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  ACCIÓN MANUAL REQUERIDA                         ║');
  console.log('║                                                   ║');
  console.log('║  1. Click en "Iniciar sesión con Google"          ║');
  console.log('║  2. Loguearse con cuenta @agsanalitica.com        ║');
  console.log('║  3. Esperar a que cargue el sistema               ║');
  console.log('║  4. El test detecta el login y cierra solo        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('http://localhost:3001');

  // Esperar hasta que el sidebar aparezca (login exitoso)
  try {
    await page.waitForSelector('nav, [class*="sidebar"], [class*="Sidebar"]', {
      timeout: 300_000, // 5 min para login manual
    });
    console.log('\n✅ Login exitoso — sesión guardada en e2e/.auth-profile/\n');
  } catch {
    console.log('\n❌ Timeout — no se detectó login exitoso\n');
  }

  await context.close();
}

globalSetup().catch(console.error);
