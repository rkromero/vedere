import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { dbMock, testEnv } from './helpers.js';

vi.mock('@vedere/db', () => dbMock);

const { buildApp } = await import('../src/app.js');

describe('middleware de roles', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv(), logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const tokenFor = (rol: 'ADMIN' | 'OPERADOR' | 'OPTICA' | 'CLIENTE') =>
    app.jwt.sign({ sub: `user-${rol}`, email: `${rol.toLowerCase()}@vedere.test`, rol });

  it('sin sesión responde 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/ping' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('un CLIENTE no puede acceder a rutas ADMIN (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/ping',
      cookies: { vedere_access: tokenFor('CLIENTE') },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('OPERADOR y OPTICA tampoco acceden a rutas ADMIN', async () => {
    for (const rol of ['OPERADOR', 'OPTICA'] as const) {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ping',
        cookies: { vedere_access: tokenFor(rol) },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it('un ADMIN accede (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/ping',
      cookies: { vedere_access: tokenFor('ADMIN') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, rol: 'ADMIN' });
  });

  it('acepta también Authorization: Bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/ping',
      headers: { authorization: `Bearer ${tokenFor('ADMIN')}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('un token firmado con otro secreto es rechazado', async () => {
    const otherApp = await buildApp({
      env: testEnv({ JWT_ACCESS_SECRET: 'otro-secreto-distinto-de-mas-de-32-caracteres' }),
      logger: false,
    });
    const forged = otherApp.jwt.sign({ sub: 'x', email: 'x@x', rol: 'ADMIN' });
    await otherApp.close();

    const res = await app.inject({
      method: 'GET',
      url: '/admin/ping',
      cookies: { vedere_access: forged },
    });
    expect(res.statusCode).toBe(401);
  });
});
