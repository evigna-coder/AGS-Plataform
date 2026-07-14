import { test as base, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.join(__dirname, '..', '.auth-profile');

export const TEST_PREFIX = '[E2E]';
export const timestamp = () => Date.now().toString(36);

// ─── Shared persistent context ───────────────────────────────

let sharedContext: BrowserContext | null = null;
let sharedPage: Page | null = null;

async function getSharedPage(): Promise<Page> {
  if (!sharedContext) {
    const isHeaded = !!process.env.HEADED || process.argv.includes('--headed');
    // Chromium standalone no tiene los certs del proxy corporate del .auth-profile
    // del usuario — sin ignore-certificate-errors, Firestore HTTPS queda colgado en
    // TLS handshake y la UI se queda en "Cargando..." indefinidamente.
    sharedContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: !isHeaded,
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
      ],
    });
    sharedPage = sharedContext.pages()[0] || await sharedContext.newPage();
  }
  return sharedPage!;
}

export const test = base.extend<{
  app: Page;
  nav: NavHelpers;
  forms: FormHelpers;
  table: TableHelpers;
  modal: ModalHelpers;
}>({
  app: async ({}, use) => { await use(await getSharedPage()); },
  nav: async ({ app }, use) => { await use(new NavHelpers(app)); },
  forms: async ({ app }, use) => { await use(new FormHelpers(app)); },
  table: async ({ app }, use) => { await use(new TableHelpers(app)); },
  modal: async ({ app }, use) => { await use(new ModalHelpers(app)); },
});

export { expect };

// ─── Navigation Helpers ───────────────────────────────────────

/**
 * Mapa label → ruta. El sidebar ahora es un árbol con grupos colapsados
 * (Comercial / Operaciones / Stock / Personas / Admin — ver navigation.ts),
 * así que navegamos por URL directa en lugar de clickear textos del nav.
 * Acepta las variantes con y sin acento que usan los specs.
 */
const ROUTE_MAP: Record<string, string> = {
  'Dashboard': '/dashboard',
  'Clientes': '/clientes',
  'Ingreso Empresas': '/ingreso-empresas',
  'Tickets': '/leads',
  'Presupuestos': '/presupuestos',
  'Contratos': '/contratos',
  'Facturacion': '/facturacion',
  'Facturación': '/facturacion',
  'Ordenes de Trabajo': '/ordenes-trabajo',
  'Órdenes de Trabajo': '/ordenes-trabajo',
  'Equipos': '/equipos',
  'Agenda': '/agenda',
  'Pendientes': '/pendientes',
  'Instrumentos': '/instrumentos',
  'Patrones': '/patrones',
  'Columnas': '/columnas',
  'Dispositivos': '/dispositivos',
  'Vehículos': '/vehiculos',
  'Vehiculos': '/vehiculos',
  'Fichas': '/fichas',
  'Fichas Propiedad': '/fichas',
  'Loaners': '/loaners',
  'Usuarios': '/usuarios',
  'Biblioteca Tablas': '/table-catalog',
  'Documentos QF': '/qf-documentos',
  'Entregas': '/entregas',
};

const STOCK_ROUTE_MAP: Record<string, string> = {
  'Unidades': '/stock/unidades',
  'Minikits': '/stock/minikits',
  'Faltantes en minikits': '/stock/minikits/faltantes',
  'Asignaciones': '/stock/asignaciones',
  'Remitos': '/stock/remitos',
  'Movimientos': '/stock/movimientos',
  'Alertas': '/stock/alertas',
  'Requerimientos': '/stock/requerimientos',
  'Planificacion': '/stock/planificacion',
  'Planificación': '/stock/planificacion',
  'Ordenes de Compra': '/stock/ordenes-compra',
  'Órdenes de Compra': '/stock/ordenes-compra',
  'Importaciones': '/stock/importaciones',
  'Entregas': '/entregas',
  'Articulos': '/stock/articulos',
  'Artículos': '/stock/articulos',
  'Proveedores': '/stock/proveedores',
  'Posiciones': '/stock/posiciones',
  'Marcas': '/stock/marcas',
};

class NavHelpers {
  constructor(private page: Page) {}

  async ensureLoaded() {
    const sidebar = this.page.locator('aside').first();
    if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) return;
    await this.page.goto('http://localhost:3001');
    await this.page.locator('aside nav').waitFor({ timeout: 30_000 });
  }

  private async gotoRoute(route: string) {
    await this.page.goto(`http://localhost:3001${route}`);
    await this.page.locator('aside nav').waitFor({ timeout: 30_000 });
    await this.page.waitForTimeout(1500);
  }

  async goTo(label: string) {
    await this.ensureLoaded();
    const route = ROUTE_MAP[label];
    if (route) {
      await this.gotoRoute(route);
      return;
    }
    // Fallback: click en el sidebar (labels no mapeados)
    const item = this.page.locator('aside nav').getByText(label, { exact: false }).first();
    await item.waitFor({ timeout: 10_000 });
    await item.scrollIntoViewIfNeeded();
    await item.click({ force: true });
    await this.page.waitForTimeout(1500);
  }

  /**
   * Navega forzando un cambio de ruta real: pasa por /equipos primero y
   * después va al destino, así la vista destino se monta de cero.
   */
  async goToFresh(label: string) {
    await this.ensureLoaded();
    const route = ROUTE_MAP[label];
    if (route && route !== '/equipos') {
      await this.gotoRoute('/equipos');
    }
    await this.goTo(label);
  }

  /** Igual que goToFresh pero para sub-items de Stock */
  async goToStockFresh(submenu: string) {
    await this.ensureLoaded();
    await this.gotoRoute('/equipos');
    await this.goToStock(submenu);
  }

  async goToStock(submenu: string) {
    await this.ensureLoaded();
    const route = STOCK_ROUTE_MAP[submenu];
    if (!route) throw new Error(`goToStock: submenu "${submenu}" no está en STOCK_ROUTE_MAP — agregarlo (ver navigation.ts)`);
    await this.gotoRoute(route);
  }

  async expectPageTitle(title: string) {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: new RegExp(title, 'i') }).first()
    ).toBeVisible({ timeout: 10_000 });
  }
}

// ─── Form Helpers ─────────────────────────────────────────────

class FormHelpers {
  constructor(private page: Page) {}

  /**
   * Llena un input buscando el label por texto y luego el input dentro del mismo div padre.
   * Funciona con el componente Input de AGS que tiene: div > label + input (sin htmlFor).
   */
  async fillField(labelText: string, value: string, container?: Locator) {
    const ctx = container || this.page;
    // Buscar el label, subir al div padre, buscar el input hijo
    const label = ctx.locator('label').filter({ hasText: labelText }).first();
    await label.waitFor({ timeout: 5_000 });
    const wrapper = label.locator('..');  // parent div
    const input = wrapper.locator('input, textarea').first();
    await input.fill(value);
  }

  /** Selecciona opción en <select> buscando el label hermano */
  async selectField(labelText: string, optionIndex: number, container?: Locator) {
    const ctx = container || this.page;
    const label = ctx.locator('label').filter({ hasText: labelText }).first();
    await label.waitFor({ timeout: 5_000 });
    const wrapper = label.locator('..');
    const select = wrapper.locator('select').first();
    await select.selectOption({ index: optionIndex });
  }

  /** Click en SearchableSelect (por placeholder) y selecciona la primera opción */
  async searchableSelectFirst(placeholder: string, container?: Locator) {
    const ctx = container || this.page;
    // Buscar el div[role=combobox] que contiene un span con el placeholder text
    // (cuando cerrado, el placeholder aparece como <span>)
    const combobox = ctx.locator('[role="combobox"]')
      .filter({ hasText: placeholder }).first();
    await combobox.waitFor({ timeout: 5_000 });
    // Click para abrir
    await combobox.click();
    await this.page.waitForTimeout(600);
    // Ahora el input de búsqueda está visible
    const input = combobox.locator('input').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('');
      await this.page.waitForTimeout(600);
    }
    // Primera opción del listbox del SearchableSelect (no de <select> nativos)
    const firstOpt = this.page.locator('[role="listbox"] [role="option"]')
      .filter({ hasNotText: /^crear|^sin /i }).first();
    if (await firstOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstOpt.click();
      await this.page.waitForTimeout(500);
    }
  }

  async clickButton(text: string | RegExp) {
    const btn = this.page.getByRole('button', { name: text }).first();
    await btn.waitFor({ timeout: 10_000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ force: true });
  }
}

// ─── Table Helpers ────────────────────────────────────────────

class TableHelpers {
  constructor(private page: Page) {}

  async expectMinRows(n: number) {
    expect(await this.page.locator('tbody tr').count()).toBeGreaterThanOrEqual(n);
  }

  async search(text: string) {
    await this.page.getByPlaceholder(/buscar/i).first().fill(text);
    await this.page.waitForTimeout(1000);
  }

  async expectRowWithText(text: string) {
    await expect(
      this.page.locator('tbody tr').filter({ hasText: text }).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async clickRow(text: string) {
    await this.page.locator('tbody tr').filter({ hasText: text }).first().click();
    await this.page.waitForTimeout(500);
  }
}

// ─── Modal Helpers ────────────────────────────────────────────

class ModalHelpers {
  constructor(private page: Page) {}

  get el() {
    return this.page.locator('[class*="modal"], [role="dialog"]').last();
  }

  async expectOpen(title?: string) {
    const loc = title ? this.el.filter({ hasText: title }) : this.el;
    await expect(loc).toBeVisible({ timeout: 10_000 });
  }

  async expectClosed() {
    await expect(this.page.locator('[class*="bg-black/50"]')).toBeHidden({ timeout: 10_000 });
  }

  async clickButton(text: string) {
    await this.el.getByRole('button', { name: text }).first().click();
  }
}
