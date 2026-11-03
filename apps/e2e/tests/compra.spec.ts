import { expect, test } from '@playwright/test';
import { emailUnico, productoPublicado } from './helpers';

// Flujo de compra completo: registro → ficha → carrito → checkout (retiro en óptica, transferencia) →
// gracias → el pedido aparece en Mi cuenta. Usa el seed: ópticas socias en CABA (Caballito cubre el CP 1424).
test.describe.serial('Compra de punta a punta', () => {
  const email = emailUnico('compra');
  const password = 'E2e-compra-2026!';
  let numeroPedido = '';

  test('registro de un cliente nuevo', async ({ page }) => {
    await page.goto('/ingresar');
    const tabRegistro = page.getByRole('tab', { name: /crear cuenta/i }).or(page.getByRole('button', { name: /crear cuenta/i }));
    if (await tabRegistro.first().isVisible().catch(() => false)) await tabRegistro.first().click();
    await page.getByTestId('registro-nombre').fill('Cliente E2E');
    await page.getByTestId('registro-email').fill(email);
    await page.getByTestId('registro-password').fill(password);
    await page.getByRole('checkbox', { name: /acepto los t/i }).check();
    await page.getByTestId('registro-submit').click();
    await page.waitForURL(/\/mi-cuenta/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/cliente/i);
  });

  test('agrega un producto y completa el checkout por transferencia', async ({ page, request }) => {
    // Sesión: reutiliza el login del test anterior vía cookies del contexto nuevo → login explícito.
    await page.goto('/ingresar');
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/mi-cuenta/);

    const producto = await productoPublicado(request, 'SOL');
    await page.goto(`/p/${producto.slug}`);
    await page.getByTestId('add-to-cart').click();
    await page.getByTestId('cart-checkout').click();
    await page.waitForURL(/\/checkout/);

    // Paso 1: datos (nombre y email vienen de la sesión).
    await expect(page.getByTestId('checkout-email')).toHaveValue(email);
    await page.getByTestId('checkout-dni').fill('30123456');
    await page.getByTestId('checkout-telefono').fill('1155550000');
    await page.getByTestId('checkout-siguiente').click();

    // Paso 2: entrega — retiro en la óptica más cercana a Caballito.
    await page.getByTestId('modalidad-RETIRO_OPTICA').click();
    await page.getByTestId('direccion-direccion').fill('Av. Rivadavia 5000');
    await page.getByTestId('direccion-localidad').fill('Caballito');
    await page.getByTestId('direccion-provincia').selectOption('CABA');
    await page.getByTestId('direccion-cp').fill('1424');
    await expect(page.getByTestId('optica-elegida')).toBeVisible();
    await page.getByTestId('checkout-siguiente').click();

    // Paso 3: receta (sólo si el producto la requiere).
    const modoOptica = page.getByTestId('receta-modo-OPTICA');
    if (await modoOptica.isVisible().catch(() => false)) {
      await modoOptica.click();
      await page.getByTestId('checkout-siguiente').click();
    }

    // Paso 4: pago por transferencia y confirmación.
    await page.getByTestId('pago-TRANSFERENCIA').click();
    await page.getByTestId('checkout-confirmar').click();
    await page.waitForURL(/\/gracias\//);
    const numero = await page.getByTestId('gracias-numero').textContent();
    expect(numero).toMatch(/VD-\d+/);
    numeroPedido = numero!.match(/VD-\d+/)![0];
    await expect(page.getByTestId('gracias-estado')).toBeVisible();

    // Mi cuenta: el pedido aparece con su estado.
    await page.goto('/mi-cuenta/pedidos');
    const item = page.getByTestId('pedido-item').filter({ hasText: numeroPedido });
    await expect(item).toBeVisible();
    await item.getByRole('link').first().click();
    await expect(page.getByTestId('pedido-estado')).toBeVisible();
  });

  test('el botón de arrepentimiento genera un número de trámite', async ({ page }) => {
    await page.goto('/legal/arrepentimiento');
    await page.getByTestId('arrepentimiento-nombre').fill('Cliente E2E');
    await page.getByTestId('arrepentimiento-email').fill(email);
    if (numeroPedido) await page.getByTestId('arrepentimiento-pedido').fill(numeroPedido);
    await page.getByTestId('arrepentimiento-motivo').fill('Prueba automática del botón de arrepentimiento.');
    await page.getByTestId('arrepentimiento-enviar').click();
    await expect(page.getByTestId('arrepentimiento-numero')).toHaveText(/ARR-\d{4}-\d+/);
  });
});
