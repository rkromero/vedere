import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? 'admin@vedere.local';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '';
export const OPTICA_EMAIL = process.env.E2E_OPTICA_EMAIL ?? 'optica-optica-caballito-centro@vedere.com.ar';
export const OPTICA_PASSWORD = process.env.E2E_OPTICA_PASSWORD ?? process.env.OPTICA_PASSWORD ?? '';

/** Email único por corrida para registrar un cliente nuevo. */
export function emailUnico(prefijo = 'e2e'): string {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@vedere.local`;
}

export interface ProductoE2E {
  slug: string;
  nombre: string;
}

/** Primer producto publicado de la línea (vía la API pública detrás del proxy). */
export async function productoPublicado(request: APIRequestContext, linea = 'SOL'): Promise<ProductoE2E> {
  const res = await request.get(`/api/catalogo/productos?linea=${linea}&pageSize=5`);
  expect(res.ok(), `GET /catalogo/productos → ${res.status()}`).toBeTruthy();
  const data = (await res.json()) as { items: ProductoE2E[] };
  expect(data.items.length, 'hay al menos un producto publicado').toBeGreaterThan(0);
  return data.items[0]!;
}

export async function loginAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/contraseña/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /ingresar|entrar/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/);
}

export async function loginOptica(page: Page) {
  await page.goto('/optica/login');
  await page.getByLabel(/email/i).fill(OPTICA_EMAIL);
  await page.getByLabel(/contraseña/i).fill(OPTICA_PASSWORD);
  await page.getByRole('button', { name: /ingresar|entrar/i }).click();
  await page.waitForURL(/\/optica(?!\/login)/);
}
