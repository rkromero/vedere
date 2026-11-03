// Cliente mínimo para la API. Siempre con credentials: 'include' (cookies httpOnly).
import { site } from '@/config/site';

export interface ApiHealth {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  env: string;
  uptimeSeconds: number;
  timestamp: string;
  db: { ok: boolean; latencyMs: number; error?: string };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${site.apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

  const body = (await res.json().catch(() => null)) as
    (T & { error?: { code: string; message: string } }) | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? res.statusText,
    );
  }
  return body as T;
}

/** Consulta /health de la API. Devuelve el cuerpo aunque responda 503 (estado degradado). */
export async function getApiHealth(): Promise<
  { reachable: true; status: number; data: ApiHealth } | { reachable: false; error: string }
> {
  try {
    const res = await fetch(`${site.apiUrl}/health`, { cache: 'no-store' });
    const data = (await res.json().catch(() => null)) as Partial<ApiHealth> | null;
    // Si el host responde pero no es nuestra API (ej. 404 del proxy), lo tratamos como no alcanzable.
    if (!data || data.service !== 'vedere-api' || typeof data.db !== 'object') {
      return { reachable: false, error: `Respuesta inesperada de la API (HTTP ${res.status})` };
    }
    return { reachable: true, status: res.status, data: data as ApiHealth };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}
