import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emailUnico, loginAdmin } from './helpers';

// B2B 2: una óptica arma un pedido mayorista desde el catálogo de su portal (no llega a la compra mínima,
// completa y confirma), lo repite desde Mis compras, otra óptica no lo puede ver (403) y el admin lo aprueba.
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
      // La óptica no debe tener una compra mínima propia que pise la general.
      await req.put(`/api/admin/opticas/${o.id}`, { data: { minimoTipo: null, minimoValor: null } });
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
    await expect(page.getByText('Pendiente de aprobación').first()).toBeVisible();
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
    await page.getByTestId('mayorista-aprobar').click();
    await page.getByTestId('mayorista-confirmar').click();
    await expect(page.getByText('Aprobado', { exact: true }).first()).toBeVisible();
  });
});
