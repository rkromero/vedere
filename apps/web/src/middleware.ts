// Middleware de /admin y /optica: si el access token venció (o está por vencer) y hay refresh token,
// renueva la sesión contra la API y propaga las cookies nuevas a la respuesta y al request.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { site } from '@/config/site';

const ACCESS = 'vedere_access';
const REFRESH = 'vedere_refresh';

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

export async function middleware(request: NextRequest) {
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

export const config = {
  matcher: ['/admin/:path*', '/optica/:path*'],
};
