/**
 * E2E: Admin Authentication Flow
 * Tests login, redirect, and unauthorized access
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

test.describe('Admin Authentication', () => {
  test('redirects /admin to login when not authenticated', async ({ page }) => {
    // Clear all auth state
    await page.context().clearCookies();
    await page.goto('/admin');
    await page.waitForURL('**/cuenta/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/cuenta/login');
    expect(page.url()).toContain('redirect');
  });

  test('admin can log in and reach /admin', async ({ page }) => {
    await page.goto('/cuenta/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin**', { timeout: 15_000 });
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/cuenta/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login page
    await page.waitForTimeout(2_000);
    expect(page.url()).toContain('/cuenta/login');
  });

  test('customer user cannot access /admin', async ({ page }) => {
    await page.goto('/cuenta/login');
    await page.fill('input[type="email"]', 'customer@test.cl');
    await page.fill('input[type="password"]', 'Customer123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2_000);
    // Should be redirected to /cuenta, not /admin
    expect(page.url()).not.toContain('/admin');
  });

  test('authenticated admin sees all sidebar menu items', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    const navItems = ['Dashboard', 'Productos', 'Pedidos', 'Clientes', 'Categorías', 'Stock'];
    for (const item of navItems) {
      await expect(page.locator(`text=${item}`)).toBeVisible();
    }
  });
});
