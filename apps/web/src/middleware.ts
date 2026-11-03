// Middleware de la web:
// 1) Redirecciones 301/302 administrables (prompt 6): GET /sitio/redirecciones de la API, cacheadas 60 s en
//    memoria; con la API caída no se redirige nada. El hit se registra sin esperar la respuesta.
// 2) Renovación de sesión en /admin, /optica y /mi-cuenta: si el access token venció (o está por vencer) y hay
//    refresh token, renueva contra la API y propaga las cookies nuevas a la respuesta y al request.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { site } from '@/config/site';

const ACCESS = 'vedere_access';
const REFRESH = 'vedere_refresh';
const CACHE_MS = 60_000;

interface Redireccion {
  origen: string;
  destino: string;
  permanente: boolean;
}

let cache: { hasta: number; mapa: Map<string, Redireccion> } | null = null;
let cargando: Promise<Map<string, Redireccion>> | null = null;

function normalizar(path: string): string {
  const p = path.replace(/\/+$/, '') || '/';
  return p.toLowerCase();
}

async function cargarRedirecciones(): Promise<Map<string, Redireccion>> {
  const ahora = Date.now();
  if (cache && cache.hasta > ahora) return cache.mapa;
  if (cargando) return cargando;
  cargando = (async () => {
    try {
      const res = await fetch(`${site.apiServerUrl}/sitio/redirecciones`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items?: Redireccion[] };
      const mapa = new Map<string, Redireccion>();
      for (const r of data.items ?? []) {
        if (r?.origen && r?.destino) mapa.set(normalizar(r.origen), r);
      }
      cache = { hasta: Date.now() + CACHE_MS, mapa };
      return mapa;
    } catch {
      // API caída o endpoint inexistente: reintentar en 60 s, mientras tanto sin redirecciones
      // (si había una lista anterior, se conserva).
      cache = { hasta: Date.now() + CACHE_MS, mapa: cache?.mapa ?? new Map() };
      return cache.mapa;
    } finally {
      cargando = null;
    }
  })();
  return cargando;
}

function registrarHit(origen: string) {
  fetch(`${site.apiServerUrl}/sitio/redirecciones/hit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origen }),
    cache: 'no-store',
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});
}

function jwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

const CON_SESION = ['/admin', '/optica', '/mi-cuenta'];

async function renovarSesion(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/optica/login')) return NextResponse.next();

  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  const exp = access ? jwtExp(access) : null;
  const now = Math.floor(Date.now() / 1000);
  const vigente = !!exp && exp > now + 60;

  if (vigente || !refresh) return NextResponse.next();

  try {
    const res = await fetch(`${site.apiServerUrl}/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `${REFRESH}=${refresh}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.next();

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const nuevas: Record<string, string> = {};
    for (const c of setCookies) {
      const [pair] = c.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      if (name) nuevas[name.trim()] = rest.join('=');
    }

    // Cookies nuevas visibles para los server components de este mismo request.
    const reqHeaders = new Headers(request.headers);
    const cookieHeader = Object.entries({
      ...Object.fromEntries(request.cookies.getAll().map((c) => [c.name, c.value])),
      ...nuevas,
    })
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    reqHeaders.set('cookie', cookieHeader);

    const response = NextResponse.next({ request: { headers: reqHeaders } });
    for (const c of setCookies) {
      response.headers.append('set-cookie', c.replace(/;\s*Path=\/auth/i, '; Path=/'));
    }
    return response;
  } catch {
    return NextResponse.next();
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (CON_SESION.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return renovarSesion(request);
  }

  // Redirecciones administrables (sólo navegación GET/HEAD de páginas).
  if (request.method === 'GET' || request.method === 'HEAD') {
    const mapa = await cargarRedirecciones();
    if (mapa.size > 0) {
      const r = mapa.get(normalizar(pathname));
      if (r && normalizar(r.destino) !== normalizar(pathname)) {
        registrarHit(r.origen);
        const destino = /^https?:\/\//i.test(r.destino) ? new URL(r.destino) : new URL(r.destino, request.url);
        // Conservar el query string original si el destino no trae uno propio.
        if (!destino.search && request.nextUrl.search) destino.search = request.nextUrl.search;
        return NextResponse.redirect(destino, r.permanente ? 301 : 302);
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  // Todo salvo assets de Next, el proxy /api, archivos estáticos y metadatos.
  matcher: ['/((?!_next/|api/|favicon.ico|icon.svg|robots.txt|sitemap.xml|opengraph-image|brand/|.*\\.[a-zA-Z0-9]+$).*)'],
};
