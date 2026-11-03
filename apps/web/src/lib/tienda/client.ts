'use client';
// Llamadas a la API desde componentes cliente de la tienda (same-origin vía /api/*).
// A diferencia del cliente del admin, un 401 no redirige al login.

export class TiendaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const payload = (await res.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string; details?: unknown } })
    | null;
  if (!res.ok) {
    const err = payload?.error;
    throw new TiendaApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? 'No pudimos completar la operación. Probá de nuevo.',
      err?.details,
    );
  }
  return payload as T;
}

export const tiendaApi = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** Sube un archivo (multipart, campo `file`). */
  upload: async <T>(path: string, file: File): Promise<T> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', body: fd });
    const payload = (await res.json().catch(() => null)) as
      | (T & { error?: { code: string; message: string; details?: unknown } })
      | null;
    if (!res.ok) {
      const err = payload?.error;
      throw new TiendaApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? 'No pudimos subir el archivo.', err?.details);
    }
    return payload as T;
  },
};

/** Mensajes de validación por campo (details de VALIDATION_ERROR). */
export function erroresPorCampo(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof TiendaApiError && Array.isArray(err.details)) {
    for (const d of err.details as Array<{ path?: string; message: string }>) {
      if (d.path && !out[d.path]) out[d.path] = d.message;
    }
  }
  return out;
}

export function mensajeError(err: unknown): string {
  if (err instanceof TiendaApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Ocurrió un error inesperado. Probá de nuevo.';
}
