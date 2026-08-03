/**
 * E2E Test Helpers for Playwright
 */
import { Page, expect } from '@playwright/test';

export const ADMIN_EMAIL    = process.env.PLAYWRIGHT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@divinittys.cl';
export const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
export const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/** Login as admin and wait for redirect to /admin */
export async function loginAsAdmin(page: Page) {
  await page.goto('/cuenta/login');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15_000 });
}

/** Logout current user */
export async function logout(page: Page) {
  await page.goto('/');
  // Clear Zustand persisted state
  await page.evaluate(() => localStorage.removeItem('divinittys-auth'));
  await page.context().clearCookies();
}

/** Wait for toast notification */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-sonner-toast], .go2072408551, .Toastify__toast, [role="status"]');
  await expect(toast.filter({ hasText: text })).toBeVisible({ timeout: 5_000 });
}

/** Assert admin page loaded correctly */
export async function assertAdminPage(page: Page, title: string) {
  await expect(page.locator('h1')).toContainText(title, { timeout: 10_000 });
  await expect(page.locator('aside')).toBeVisible(); // sidebar
}

/** Fill the product form with valid test data */
export async function fillProductForm(page: Page, overrides: Record<string, string> = {}) {
  const data = {
    name:        'E2E Test Shampoo',
    description: 'Producto creado por test E2E',
    basePrice:   '9990',
    stock:       '25',
    ...overrides,
  };

  await page.fill('input[placeholder*="Ej: Shampoo"]', data.name);
  await page.fill('textarea', data.description);
  await page.fill('input[min="1"][type="number"]', data.basePrice);  // basePrice
  await page.fill('input[value="0"]', data.stock);

  // Select first category if dropdown present
  const categorySelect = page.locator('select').first();
  if (await categorySelect.count() > 0) {
    await categorySelect.selectOption({ index: 1 });
  }

  return data;
}
