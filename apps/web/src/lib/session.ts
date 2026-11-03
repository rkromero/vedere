// Sesión del lado servidor (server components / layouts).
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { site } from '@/config/site';

export type Rol = 'ADMIN' | 'OPERADOR' | 'OPTICA' | 'CLIENTE';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  createdAt: string;
}

export const STAFF_ROLES: Rol[] = ['ADMIN', 'OPERADOR'];

/** Usuario actual según la cookie de acceso (null si no hay sesión válida). */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const access = jar.get('vedere_access')?.value;
  if (!access) return null;
  try {
    const res = await fetch(`${site.apiServerUrl}/auth/me`, {
      headers: { cookie: `vedere_access=${access}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: SessionUser };
    return data.user;
  } catch {
    return null;
  }
});

/** Exige usuario ADMIN u OPERADOR; redirige al login si no hay sesión. */
export async function requireStaff(nextPath = '/admin'): Promise<SessionUser> {
  const user = await getSession();
  if (!user || !STAFF_ROLES.includes(user.rol)) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}${user ? '&denied=1' : ''}`);
  }
  return user;
}

/** Exige ADMIN. */
export async function requireAdmin(nextPath = '/admin'): Promise<SessionUser> {
  const user = await requireStaff(nextPath);
  if (user.rol !== 'ADMIN') redirect('/admin?denied=usuarios');
  return user;
}
