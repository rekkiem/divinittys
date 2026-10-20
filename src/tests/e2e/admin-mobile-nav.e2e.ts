/**
 * E2E: Admin mobile navigation drawer (viewport 390x844)
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.use({
  viewport: { width: 390, height: 844 },
});

test.describe('Admin mobile nav drawer', () => {
  test('login admin, open drawer, navigate to productos', async ({ page }) => {
    await loginAsAdmin(page);

    // Sidebar desktop oculto en móvil
    await expect(page.locator('aside.hidden.lg\\:flex')).toBeHidden();

    const menuBtn = page.getByRole('button', { name: /abrir menú de navegación/i });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const drawer = page.locator('#admin-mobile-nav');
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    await drawer.getByRole('link', { name: 'Productos' }).click();
    await page.waitForURL('**/admin/productos', { timeout: 10_000 });

    // Drawer se cierra al navegar
    await expect(drawer).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('h1')).toContainText('Productos', { timeout: 10_000 });
  });
});
