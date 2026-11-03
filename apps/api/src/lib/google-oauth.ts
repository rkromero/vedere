// Login con Google (prompt 6): OAuth 2.0 con flujo de código, sin SDK. El `state` va firmado (HMAC) y en una
// cookie httpOnly para evitar CSRF. El redirect_uri pasa por el proxy same-origin de la web
// (`${WEB_URL}/api/auth/google/callback`) para que las cookies de sesión queden en el dominio de la web.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Env } from '../env.js';

export const GOOGLE_STATE_COOKIE = 'vedere_oauth_state';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export function googleHabilitado(env: Env): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

export function googleRedirectUri(env: Env): string {
  return `${env.WEB_URL.replace(/\/$/, '')}/api/auth/google/callback`;
}

export interface GoogleState {
  nonce: string;
  next: string;
  ref?: string;
}

function firmar(env: Env, payload: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(payload).digest('base64url');
}

/** Crea un state firmado: base64url(json).firma */
export function crearState(env: Env, input: { next: string; ref?: string }): string {
  const data: GoogleState = { nonce: randomBytes(12).toString('base64url'), next: input.next, ref: input.ref };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${firmar(env, payload)}`;
}

/** Verifica firma y devuelve el contenido del state (null si es inválido). */
export function leerState(env: Env, state: string): GoogleState | null {
  const [payload, firma] = state.split('.');
  if (!payload || !firma) return null;
  const esperada = firmar(env, payload);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GoogleState;
    if (typeof data.nonce !== 'string' || typeof data.next !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function urlAutorizacion(env: Env, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(env),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface PerfilGoogle {
  sub: string;
  email: string;
  emailVerificado: boolean;
  nombre: string | null;
}

/** Cambia el código por tokens y lee el perfil (sub, email, nombre). Lanza si Google rechaza. */
export async function perfilDesdeCodigo(env: Env, code: string): Promise<PerfilGoogle> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(env),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(8000),
  });
  const tokens = (await tokenRes.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!tokenRes.ok || !tokens?.access_token) {
    throw new Error(`Google token: ${tokens?.error ?? `HTTP ${tokenRes.status}`}`);
  }
  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(8000),
  });
  const info = (await infoRes.json().catch(() => null)) as
    | { sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string }
    | null;
  if (!infoRes.ok || !info?.sub || !info.email) {
    throw new Error(`Google userinfo: HTTP ${infoRes.status}`);
  }
  return {
    sub: info.sub,
    email: info.email.trim().toLowerCase(),
    emailVerificado: info.email_verified === true,
    nombre: (info.name ?? info.given_name ?? '').trim() || null,
  };
}
