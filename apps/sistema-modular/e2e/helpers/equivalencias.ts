import type { Page } from '@playwright/test';

/**
 * Phase 13 — equivalencias E2E helpers.
 * Wave 0 baseline: stubs only. Plans 13-04/05/06/07 implement real flows.
 */

export async function navigateToArticulosList(page: Page): Promise<void> {
  await page.goto('/stock/articulos');
  await page.waitForSelector('[data-testid="articulos-list"], h1', { timeout: 10000 });
}

export async function openArticuloDetail(page: Page, codigo: string): Promise<void> {
  await page.getByText(codigo).first().click();
}
