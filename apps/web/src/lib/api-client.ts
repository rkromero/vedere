'use client';
// Cliente de la API para componentes cliente: same-origin vía /api/* (proxy), con refresh automático.

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  /** Mensajes de validación por campo (si el error es VALIDATION_ERROR). */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as ApiErrorDetail[]) {
        if (d.path && !out[d.path]) out[d.path] = d.message;
      }
    }
    return out;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: isForm || body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
    const ok = await tryRefresh();
    if (ok) return request<T>(method, path, body, false);
    if (typeof window !== 'undefined') {
      const login = window.location.pathname.startsWith('/optica') ? '/optica/login' : '/admin/login';
      window.location.href = `${login}?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const err =
      (payload && typeof payload === 'object'
        ? (payload as { error?: { code: string; message: string; details?: unknown } }).error
        : null) ?? null;
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Error ${res.status}`,
      err?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  /** Sube un archivo (multipart) a POST /admin/imagenes. */
  upload: (file: File, folder = 'productos') => {
    const fd = new FormData();
    fd.append('folder', folder);
    fd.append('file', file);
    return request<{
      key: string;
      url: string;
      urlMediana: string;
      urlMiniatura: string;
      width: number;
      height: number;
    }>('POST', '/admin/imagenes', fd);
  },
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado';
}
