// Proxy same-origin hacia la API. Así las cookies httpOnly quedan en el dominio de la web
// (SameSite=Lax) y los server components pueden leerlas.
import type { NextRequest } from 'next/server';
import { site } from '@/config/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = new URL(`${site.apiServerUrl}/${path.join('/')}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  const ip = request.headers.get('x-forwarded-for') ?? '';
  if (ip) headers.set('x-forwarded-for', ip);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // @ts-expect-error: necesario para enviar body en streaming con fetch de Node
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k === 'set-cookie' || k === 'content-encoding') return;
    resHeaders.set(key, value);
  });
  // Set-Cookie: puede haber varias; el refresh token viaja con Path=/auth en la API → Path=/ acá.
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    resHeaders.append('set-cookie', c.replace(/;\s*Path=\/auth/i, '; Path=/'));
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
