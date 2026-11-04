import { expect, test } from '@playwright/test';
import { cerrarCookies, emailUnico, loginAdmin } from './helpers';

// B2B 1: una óptica manda la solicitud desde /opticas/sumate, el admin la aprueba en /admin/opticas, y el usuario
// entra al panel con la contraseña provisoria, la cambia y llega a /optica.

/** CUIT válido al azar (prefijo 30 + 8 dígitos + verificador) para que cada corrida sea única. */
function cuitAleatorio(): string {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  for (;;) {
    const base = `30${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const suma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
    const r = 11 - (suma % 11);
    if (r === 10) continue;
    return `${base.slice(0, 2)}-${base.slice(2)}-${r === 11 ? 0 : r}`;
  }
}

test.describe.serial('Alta de óptica socia', () => {
  const email = emailUnico('optica');
  const nombreComercial = `Óptica E2E ${Date.now() % 100000}`;
  const cuit = cuitAleatorio();
  let provisoria = '';

  test('la óptica envía la solicitud (y un CUIT inválido se rechaza con un mensaje claro)', async ({ page }) => {
    await page.goto('/opticas/sumate');
    await cerrarCookies(page);
    const form = page.getByTestId('solicitud-optica');

    await form.locator('[name=razonSocial]').fill('Óptica E2E SRL');
    await form.locator('[name=nombreComercial]').fill(nombreComercial);
    await form.locator('[name=cuit]').fill('30-71111111-9');
    await form.locator('[name=cuit]').blur();
    await expect(form.getByText(/dígito verificador no coincide/i)).toBeVisible();
    await form.locator('[name=cuit]').fill(cuit);
    await form.locator('[name=condicionIva]').selectOption('RESPONSABLE_INSCRIPTO');
    await form.locator('[name=direccion]').fill('Av. Cabildo 2240');
    await form.locator('[name=localidad]').fill('Belgrano');
    await form.locator('[name=provincia]').selectOption('Ciudad Autónoma de Buenos Aires');
    await form.locator('[name=codigoPostal]').fill('1428');
    await form.locator('[name=telefono]').fill('+54 11 4780-0000');
    await form.locator('[name=email]').fill(email);
    await form.locator('[name=opticoResponsable]').fill('Laura Méndez');
    await form.locator('[name=matricula]').fill('MN 9911');
    await form.locator('[name=habilitacion]').setInputFiles({
      name: 'habilitacion.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 habilitacion e2e'),
    });
    await expect(form.getByText('✓ habilitacion.pdf')).toBeVisible();
    await form.getByRole('checkbox', { name: /acepto los términos/i }).check();
    await page.getByTestId('solicitud-enviar').click();
    await expect(page.getByTestId('solicitud-ok')).toContainText(email);
  });

  test('el admin la aprueba y obtiene la contraseña provisoria', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/opticas/solicitudes');
    await page.getByRole('link', { name: nombreComercial }).click();
    await expect(page.getByText(cuit)).toBeVisible();
    await page.getByTestId('solicitud-aprobar').click();
    await page.getByTestId('solicitud-aprobar-confirmar').click();
    await expect(page.getByTestId('aprobacion-resultado')).toContainText(email);
    provisoria = ((await page.getByTestId('password-provisoria').textContent()) ?? '').trim();
    expect(provisoria).toMatch(/^[A-Z][a-z]{3}-\d{4}-[A-Z][a-z]$/);
  });

  test('el usuario entra con la provisoria, la cambia y llega al panel', async ({ page }) => {
    await page.goto('/optica/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(provisoria);
    await page.getByRole('button', { name: /ingresar|entrar/i }).click();
    await page.waitForURL(/\/optica\/cambiar-password/);

    const form = page.getByTestId('cambiar-password');
    await form.locator('[name=actual]').fill(provisoria);
    await form.locator('[name=nueva]').fill('ClaveOptica2026');
    await form.locator('[name=repetir]').fill('ClaveOptica2026');
    await form.getByRole('button', { name: /guardar/i }).click();
    await page.waitForURL(/\/optica$/);

    await page.goto('/optica/usuarios');
    await expect(page.getByRole('cell', { name: email })).toBeVisible();
    await expect(page.getByText('Dueño')).toBeVisible();
  });
});
