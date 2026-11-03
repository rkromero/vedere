import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { dbMock, testEnv } from './helpers.js';

vi.mock('@vedere/db', () => dbMock);

const { buildApp } = await import('../src/app.js');

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: testEnv(), logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con el estado de la base cuando está disponible', async () => {
    dbMock.checkDatabase.mockResolvedValueOnce({ ok: true, latencyMs: 3 });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      service: 'vedere-api',
      db: { ok: true, latencyMs: 3 },
    });
  });

  it('responde 503 cuando la base no responde', async () => {
    dbMock.checkDatabase.mockResolvedValueOnce({ ok: false, latencyMs: 10, error: 'ECONNREFUSED' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', db: { ok: false } });
  });

  it('CORS sólo permite el origen de la web', async () => {
    const ok = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');

    const bad = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://malicioso.com', 'access-control-request-method': 'GET' },
    });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('ruta inexistente responde 404 JSON', async () => {
    const res = await app.inject({ method: 'GET', url: '/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
