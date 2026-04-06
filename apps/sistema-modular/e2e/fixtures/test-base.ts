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
    sharedContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: !isHeaded,
      viewport: { width: 1440, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
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

class NavHelpers {
  constructor(private page: Page) {}

  async ensureLoaded() {
    const sidebar = this.page.locator('aside').first();
    if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) return;
    await this.page.goto('http://localhost:3001');
    await this.page.locator('aside nav').waitFor({ timeout: 30_000 });
  }

  async goTo(label: string) {
    await this.ensureLoaded();
    // exact:false para tolerar "Calif. Proveedores" y similares
    const item = this.page.locator('aside nav').getByText(label, { exact: false }).first();
    await item.waitFor({ timeout: 10_000 });
    await item.click();
    await this.page.waitForTimeout(1500);
  }

  async goToStock(submenu: string) {
    await this.ensureLoaded();
    // Expandir Stock si los sub-items no son visibles
    const subItem = this.page.locator('aside nav').getByText(submenu, { exact: true }).first();
    if (!await subItem.isVisible({ timeout: 1000 }).catch(() => false)) {
      const stockBtn = this.page.locator('aside nav').getByText('Stock', { exact: true }).first();
      await stockBtn.click();
      await this.page.waitForTimeout(500);
    }
    await subItem.waitFor({ timeout: 5_000 });
    await subItem.click();
    await this.page.waitForTimeout(1500);
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
    const input = ctx.getByPlaceholder(placeholder).first();
    await input.waitFor({ timeout: 5_000 });
    // Forzar click (algunos tienen tabindex=-1)
    await input.evaluate((el: HTMLElement) => el.click());
    await this.page.waitForTimeout(500);
    // Disparar input para mostrar opciones
    await input.evaluate((el: HTMLInputElement) => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await this.page.waitForTimeout(800);
    // Primera opción (excluir "crear", "sin")
    const firstOpt = this.page.locator('li, [role="option"]')
      .filter({ hasNotText: /^crear|^sin /i }).first();
    if (await firstOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstOpt.click();
      await this.page.waitForTimeout(500);
    }
  }

  async clickButton(text: string | RegExp) {
    const btn = this.page.getByRole('button', { name: text }).first();
    await btn.waitFor({ timeout: 10_000 });
    await btn.click();
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
