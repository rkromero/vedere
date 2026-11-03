// Llamadas a la API desde server components, reenviando la cookie de sesión.
import { cookies } from 'next/headers';
import { site } from '@/config/site';

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const access = jar.get('vedere_access')?.value;
  const res = await fetch(`${site.apiServerUrl}${path}`, {
    ...init,
    headers: {
      ...(access ? { cookie: `vedere_access=${access}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    throw new ServerApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? res.statusText,
    );
  }
  return (await res.json()) as T;
}

/** Igual que serverApi pero devuelve null en vez de lanzar (para páginas tolerantes). */
export async function serverApiOrNull<T>(path: string): Promise<T | null> {
  try {
    return await serverApi<T>(path);
  } catch {
    return null;
  }
}

/** Arma un query string a partir de searchParams de página (omite vacíos). */
export function qs(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== '') sp.set(k, val);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
