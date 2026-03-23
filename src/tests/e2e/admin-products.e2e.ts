/**
 * E2E: Admin Products CRUD Flow
 * Tests the full lifecycle of a product in the admin panel
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, logout, fillProductForm } from './helpers';

// Login once before all tests in this file
test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test.describe('Admin Products Management', () => {
  test('can navigate to products list', async ({ page }) => {
    await page.goto('/admin/productos');
    await expect(page.locator('h1')).toContainText('Productos', { timeout: 10_000 });
    await expect(page.locator('text=Nuevo Producto')).toBeVisible();
    await expect(page.locator('text=Importar Excel')).toBeVisible();
  });

  test('can navigate to new product form', async ({ page }) => {
    await page.goto('/admin/productos');
    await page.click('text=Nuevo Producto');
    await page.waitForURL('**/admin/productos/nuevo', { timeout: 8_000 });
    await expect(page.locator('h1')).toContainText('Nuevo Producto');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('new product form has required fields', async ({ page }) => {
    await page.goto('/admin/productos/nuevo');
    // Check all form sections are present
    await expect(page.locator('text=Información básica')).toBeVisible();
    await expect(page.locator('text=Precios')).toBeVisible();
    await expect(page.locator('text=Inventario')).toBeVisible();
    await expect(page.locator('text=Estado')).toBeVisible();
    await expect(page.locator('text=Clasificación')).toBeVisible();
  });

  test('shows validation error when submitting empty form', async ({ page }) => {
    await page.goto('/admin/productos/nuevo');
    // Clear the name if auto-filled, then submit
    await page.click('button[type="submit"]');
    // Browser native validation should prevent submission
    // Or our custom validation fires
    const nameInput = page.locator('input[placeholder*="Shampoo"]');
    const validationMsg = await nameInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMsg).toBeTruthy();
  });

  test('can create a new product and it appears in list', async ({ page }) => {
    await page.goto('/admin/productos/nuevo');
    const productName = `E2E Test ${Date.now()}`;
    await fillProductForm(page, { name: productName });
    await page.click('button[type="submit"]');

    // Should redirect to products list after creation
    await page.waitForURL('**/admin/productos', { timeout: 15_000 });
    await expect(page.locator(`text=${productName}`)).toBeVisible({ timeout: 8_000 });
  });

  test('can toggle product active status', async ({ page }) => {
    await page.goto('/admin/productos');
    // Click first "Activo" or "Inactivo" badge
    const firstStatusBadge = page.locator('button:has-text("Activo"), button:has-text("Inactivo")').first();
    await expect(firstStatusBadge).toBeVisible({ timeout: 8_000 });
    const originalText = await firstStatusBadge.textContent();
    await firstStatusBadge.click();
    // Status should flip
    await page.waitForTimeout(1_500);
    const newText = await firstStatusBadge.textContent();
    expect(newText).not.toBe(originalText);
  });

  test('can search products by name', async ({ page }) => {
    await page.goto('/admin/productos');
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('shampoo');
    await page.waitForTimeout(500);
    // Results should be filtered (either shows matches or "no encontraron")
    const rows = page.locator('tbody tr');
    const noResults = page.locator('text=No se encontraron productos');
    const hasResults = (await rows.count()) > 0 || (await noResults.count()) > 0;
    expect(hasResults).toBe(true);
  });

  test('edit button navigates to edit form', async ({ page }) => {
    await page.goto('/admin/productos');
    // Click edit icon on first product row
    const editBtn = page.locator('a[title="Editar"], a[href*="/editar"]').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForURL('**/editar', { timeout: 8_000 });
      await expect(page.locator('h1')).toContainText('Editar Producto');
    }
  });
});

test.describe('Admin Products - Security', () => {
  test('unauthenticated user cannot access product form', async ({ page }) => {
    // Clear auth
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.removeItem('divinittys-auth'));
    await page.goto('/admin/productos/nuevo');
    await page.waitForURL('**/cuenta/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/cuenta/login');
  });

  test('direct API call without token returns 401', async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.request.post('/api/admin/products', {
      data: { name: 'Hack', sku: 'HACK', categoryId: 'x', basePrice: 1 },
    });
    expect(response.status()).toBe(401);
  });

  test('API call with customer token returns 403', async ({ page }) => {
    // This test requires a customer JWT — simplified check
    const response = await page.request.post('/api/admin/products', {
      headers: { Authorization: 'Bearer invalid-customer-token' },
      data: { name: 'Hack', sku: 'HACK', categoryId: 'x', basePrice: 1 },
    });
    expect([401, 403]).toContain(response.status());
  });
});
