import { expect, test } from '@playwright/test';
import { ADMIN_PASSWORD, OPTICA_PASSWORD, loginAdmin, loginOptica } from './helpers';

// Paneles: backoffice (pedidos, reportes, plantillas) y panel de la óptica.
test.describe('Backoffice', () => {
  test.skip(!ADMIN_PASSWORD, 'Falta E2E_ADMIN_PASSWORD / ADMIN_PASSWORD');

  test('login, pedidos y reportes', async ({ page }) => {
    await loginAdmin(page);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    await page.goto('/admin/pedidos');
    await expect(page.getByRole('heading', { name: /pedidos/i }).first()).toBeVisible();
    // Al menos un pedido del flujo de compra (si corrió antes) o la tabla vacía sin errores.
    await expect(page.getByRole('table').or(page.getByText(/no hay pedidos/i)).first()).toBeVisible();

    await page.goto('/admin/reportes');
    await expect(page.getByRole('heading', { name: /reportes/i }).first()).toBeVisible();
    await expect(page.getByText(/ticket promedio/i).first()).toBeVisible();

    await page.goto('/admin/plantillas');
    await expect(page.getByRole('heading', { name: /plantillas/i }).first()).toBeVisible();
    await expect(page.getByText(/bienvenida/i).first()).toBeVisible();

    await page.goto('/admin/arrepentimientos');
    await expect(page.getByRole('heading', { name: /arrepentimiento/i }).first()).toBeVisible();
  });

  test('un usuario sin sesión no entra al backoffice', async ({ page }) => {
    await page.goto('/admin/pedidos');
    await page.waitForURL(/\/admin\/login/);
  });
});

test.describe('Panel de la óptica', () => {
  test.skip(!OPTICA_PASSWORD, 'Falta E2E_OPTICA_PASSWORD / OPTICA_PASSWORD');

  test('login y pedidos de la óptica', async ({ page }) => {
    await loginOptica(page);
    await page.goto('/optica/pedidos');
    await expect(page.getByRole('heading', { name: /pedidos/i }).first()).toBeVisible();
    await page.goto('/optica/turnos');
    await expect(page.getByRole('heading', { name: /turnos|agenda/i }).first()).toBeVisible();
  });
});
