import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emailUnico, loginAdmin } from './helpers';

// B2B 2: una óptica arma un pedido mayorista desde el catálogo de su portal (no llega a la compra mínima,
// completa y confirma), lo repite desde Mis compras, otra óptica no lo puede ver (403) y el admin lo aprueba.
// B2B 3: sin crédito asignado el pedido queda en revisión; al salir del depósito se debita en la cuenta
// corriente, la óptica informa un pago con comprobante y el admin lo valida.
// El spec crea sus propios usuarios de óptica y le pone precio mayorista a un producto publicado.

const PASSWORD = 'MayoristaE2E2026';

interface Preparado {
  emailA: string;
  emailB: string;
  sku: string;
  varianteId: string;
}
let datos: Preparado;
let compraUrl = '';
let compraId = '';

async function loginOpticaComo(page: Page, email: string) {
  await page.goto('/optica/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole('button', { name: /ingresar|entrar/i }).click();
  await page.waitForURL(/\/optica(?!\/login)/);
}

test.describe.serial('Pedido mayorista de una óptica socia', () => {
  test('el admin prepara el canal: precio mayorista, compra mínima de 2 unidades y dos usuarios de óptica', async ({ page }) => {
    await loginAdmin(page);
    const req = page.request;

    const opticas = (await (await req.get('/api/admin/opticas?pageSize=2&activa=true')).json()) as { items: Array<{ id: string }> };
    expect(opticas.items.length).toBeGreaterThanOrEqual(2);

    const productos = (await (await req.get('/api/admin/productos?linea=SOL&estado=PUBLICADO&pageSize=20')).json()) as {
      items: Array<{ id: string; slug: string; variantes: Array<{ id: string; sku: string; stock: number; activa: boolean }> }>;
    };
    const producto = productos.items.find((p) => p.variantes.some((v) => v.activa && v.stock >= 4));
    expect(producto, 'hay un producto de sol publicado con stock').toBeTruthy();
    const variante = producto!.variantes.find((v) => v.activa && v.stock >= 4)!;
    const put = await req.put(`/api/admin/productos/${producto!.id}`, { data: { precioMayorista: 50000, visibleMayorista: true } });
    expect(put.ok(), `PUT producto → ${put.status()}`).toBeTruthy();

    const cfg = await req.put('/api/admin/mayorista/config', {
      data: {
        ivaPct: 21,
        minimoTipo: 'UNIDADES',
        minimoValor: 2,
        envioHabilitado: true,
        envioModo: 'A_CARGO_OPTICA',
        envioCosto: 0,
        retiroHabilitado: true,
        retiroDireccion: 'Depósito Vedere, Av. Warnes 1200',
        retiroHorario: 'Lunes a viernes de 9 a 17',
      },
    });
    expect(cfg.ok(), `PUT config mayorista → ${cfg.status()}`).toBeTruthy();

    const emails: string[] = [];
    for (const [i, o] of opticas.items.slice(0, 2).entries()) {
      const email = emailUnico(`mayorista-${i}`);
      // La óptica no debe tener una compra mínima propia que pise la general. Con límite de crédito 0
      // y plazo de 30 días (excepciones a los de su nivel) el pedido pasa a revisión y la deuda no vence en el día.
      await req.put(`/api/admin/opticas/${o.id}`, { data: { minimoTipo: null, minimoValor: null, limiteCredito: 0, plazoPagoDias: 30 } });
      const u = await req.post('/api/admin/usuarios', {
        data: { email, nombre: `Compras E2E ${i}`, rol: 'OPTICA', opticaId: o.id, password: PASSWORD, activo: true },
      });
      expect(u.ok(), `POST usuario óptica → ${u.status()}`).toBeTruthy();
      emails.push(email);
    }
    datos = { emailA: emails[0]!, emailB: emails[1]!, sku: variante.sku, varianteId: variante.id };
  });

  test('la óptica carga cantidades desde el catálogo, no llega al mínimo y después confirma', async ({ page }) => {
    await loginOpticaComo(page, datos.emailA);
    await page.goto(`/optica/catalogo?q=${encodeURIComponent(datos.sku)}&vista=lista`);
    const lista = page.getByTestId('catalogo-lista');
    const fila = lista.getByRole('row').filter({ hasText: datos.sku });
    await fila.getByRole('spinbutton').fill('1');
    await page.getByTestId('agregar-carrito').click();
    await expect(page.getByRole('link', { name: /carrito \(\d+ u\.\)/i })).toBeVisible();

    await page.goto('/optica/carrito');
    await expect(page.getByTestId('carrito-lineas')).toContainText(datos.sku);
    await expect(page.getByTestId('minimo')).toContainText(/falta 1 unidad/i);
    await expect(page.getByTestId('confirmar-pedido')).toBeDisabled();

    // El carrito de la tienda (de este mismo usuario) no tiene nada del portal.
    const tienda = (await (await page.request.get('/api/carrito')).json()) as { items: Array<{ varianteId: string }> };
    expect(tienda.items.map((i) => i.varianteId)).not.toContain(datos.varianteId);

    await page.getByTestId('carrito-lineas').getByRole('spinbutton').fill('2');
    await expect(page.getByTestId('minimo')).toContainText(/llegaste a la compra mínima/i);
    await page.getByRole('radio', { name: /retiro en el depósito/i }).check();
    await page.getByTestId('confirmar-pedido').click();
    await page.waitForURL(/\/optica\/compras\/[^/?]+\?nuevo=1/);
    await expect(page.getByTestId('pedido-confirmado')).toContainText(/VM-\d+/);
    await expect(page.getByText('En revisión').first()).toBeVisible();
    compraUrl = new URL(page.url()).pathname;
    compraId = compraUrl.split('/').pop()!;

    await page.goto('/optica/compras');
    await expect(page.getByRole('link', { name: /VM-\d+/ }).first()).toBeVisible();
  });

  test('"Repetir pedido" vuelve a cargar el carrito', async ({ page }) => {
    await loginOpticaComo(page, datos.emailA);
    await page.goto(compraUrl);
    await page.getByTestId('repetir-pedido').click();
    await page.waitForURL(/\/optica\/carrito/);
    await expect(page.getByTestId('carrito-lineas')).toContainText(datos.sku);
    await page.request.delete('/api/optica/mayorista/carrito');
  });

  test('otra óptica no puede ver la compra: 403 por URL y por API', async ({ page }) => {
    await loginOpticaComo(page, datos.emailB);
    const res = await page.goto(compraUrl);
    expect(res?.status()).toBe(403);
    await expect(page.getByText(/no tenés acceso/i)).toBeVisible();
    const api = await page.request.get(`/api/optica/mayorista/pedidos/${compraId}`);
    expect(api.status()).toBe(403);
    await page.goto('/optica/compras');
    await expect(page.getByRole('link', { name: /VM-\d+/ })).toHaveCount(0);
  });

  test('el admin aprueba el pedido y se reserva el stock', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`/admin/mayorista/${compraId}`);
    await page.waitForURL(new RegExp(`/admin/pedidos-mayoristas/${compraId}`));
    await page.getByTestId('mayorista-aprobar').click();
    await page.getByTestId('mayorista-confirmar').click();
    await expect(page.getByText('Aprobado', { exact: true }).first()).toBeVisible();
  });

  test('el admin lo deja listo para retirar: remito y débito en la cuenta corriente', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`/admin/pedidos-mayoristas/${compraId}`);
    await page.getByTestId('mayorista-listo-para-retiro').click();
    await page.getByTestId('mayorista-confirmar').click();
    await expect(page.getByText('Listo para retirar', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('remito-pdf')).toBeVisible();
    const remito = await page.request.get(`/api/admin/mayorista/pedidos/${compraId}/remito.pdf`);
    expect(remito.headers()['content-type']).toContain('application/pdf');
  });

  test('la óptica ve su deuda, informa un pago con comprobante y el admin lo valida', async ({ page, browser }) => {
    const referencia = `E2E-${Date.now()}`;
    await loginOpticaComo(page, datos.emailA);
    await page.goto('/optica/cuenta');
    await expect(page.getByTestId('resumen-cuenta')).toBeVisible();
    await expect(page.getByTestId('movimientos')).toContainText(/VM-\d+/);
    const pdf = await page.request.get('/api/optica/cuenta/estado.pdf');
    expect(pdf.headers()['content-type']).toContain('application/pdf');

    await page.getByTestId('informar-pago').click();
    await page.getByTestId('informar-importe').fill('10000');
    await page.getByLabel('Referencia').fill(referencia);
    await page.getByTestId('comprobante').setInputFiles({
      name: 'transferencia.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 comprobante e2e'),
    });
    await expect(page.getByText('✓ transferencia.pdf')).toBeVisible();
    await page.getByTestId('enviar-pago').click();
    await expect(page.getByTestId('mis-pagos-informados')).toContainText('Pendiente de validar');

    // La óptica no puede registrar movimientos por su cuenta.
    const intento = await page.request.post(`/api/admin/cuentas/${'x'}/pagos`, { data: { importe: 1 } });
    expect([401, 403]).toContain(intento.status());

    const admin = await browser.newPage();
    await loginAdmin(admin);
    await admin.goto('/admin/cuentas');
    const fila = admin.getByTestId('pagos-informados').locator('div', { hasText: referencia }).filter({ has: admin.getByTestId('validar-pago') }).last();
    await fila.getByTestId('validar-pago').click();
    await expect(admin.getByText(referencia)).toHaveCount(0);
    await admin.close();

    await page.goto(`/optica/compras/${compraId}`);
    await expect(page.getByTestId('compra-pago')).toContainText('Pago parcial');
  });

  test('la óptica ve su nivel y el admin el reporte de niveles', async ({ page, browser }) => {
    await loginOpticaComo(page, datos.emailA);
    await page.goto('/optica/nivel');
    await expect(page.getByTestId('panel-nivel')).toBeVisible();
    await expect(page.getByTestId('nivel-actual')).toContainText(/Vetro|Cristallo|Prisma|Zafiro/);
    await expect(page.getByTestId('variables')).toContainText('Unidades en 12 meses');
    await expect(page.getByTestId('logros')).toContainText('Primer foco');
    const api = await page.request.get('/api/admin/niveles/reporte');
    expect([401, 403]).toContain(api.status());

    const admin = await browser.newPage();
    await loginAdmin(admin);
    await admin.goto('/admin/niveles');
    await expect(admin.getByTestId('opticas-por-nivel')).toContainText('Zafiro');
    await admin.getByTestId('recalcular-niveles').click();
    await expect(admin.getByText(/Recalculadas \d+ ópticas/)).toBeVisible();
    await admin.close();
  });
});
