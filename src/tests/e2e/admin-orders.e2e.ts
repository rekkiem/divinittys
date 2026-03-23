/**
 * E2E: Admin Orders Management
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test.describe('Admin Orders', () => {
  test('orders page loads correctly', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await expect(page.locator('h1')).toContainText('Pedidos', { timeout: 10_000 });
  });

  test('shows empty state when no orders', async ({ page }) => {
    await page.goto('/admin/pedidos');
    // Either shows orders table or empty state
    const hasOrders = await page.locator('tbody tr').count();
    const hasEmpty  = await page.locator('text=No hay pedidos').count();
    expect(hasOrders > 0 || hasEmpty > 0).toBe(true);
  });

  test('admin sidebar navigation works', async ({ page }) => {
    await page.goto('/admin');
    const navItems = [
      { text: 'Productos',   url: '/admin/productos' },
      { text: 'Pedidos',     url: '/admin/pedidos' },
      { text: 'Clientes',    url: '/admin/clientes' },
      { text: 'Categorías',  url: '/admin/categorias' },
      { text: 'Stock',       url: '/admin/stock' },
    ];
    for (const item of navItems) {
      await page.click(`aside a:has-text("${item.text}")`);
      await page.waitForURL(`**${item.url}**`, { timeout: 8_000 });
      await expect(page.locator('h1')).toBeVisible();
    }
  });
});
