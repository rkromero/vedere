'use client';
// Navegación de Mi cuenta (lateral en desktop, scroll horizontal en móvil) + cerrar sesión.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import { cuentaApi } from '@/lib/tienda/cuenta';

export const SECCIONES = [
  { href: '/mi-cuenta', label: 'Resumen', exacto: true },
  { href: '/mi-cuenta/pedidos', label: 'Mis pedidos', exacto: false },
  { href: '/mi-cuenta/recetas', label: 'Recetas', exacto: false },
  { href: '/mi-cuenta/direcciones', label: 'Direcciones', exacto: false },
  { href: '/mi-cuenta/favoritos', label: 'Favoritos', exacto: false },
  { href: '/mi-cuenta/datos', label: 'Mis datos', exacto: false },
  { href: '/mi-cuenta/referidos', label: 'Referidos', exacto: false },
] as const;

export function CuentaNav({ panel }: { panel?: { href: string; label: string } | null }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Mi cuenta" className="font-text -mx-4 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {SECCIONES.map((s) => {
          const activo = s.exacto ? pathname === s.href : pathname.startsWith(s.href);
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'block rounded-full px-4 py-2 text-sm font-medium transition-colors lg:rounded-xl lg:px-3',
                  activo ? 'bg-negro text-blanco' : 'text-negro/75 hover:bg-negro/5 hover:text-negro',
                )}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
        {panel && (
          <li className="shrink-0">
            <Link
              href={panel.href}
              className="block rounded-full px-4 py-2 text-sm font-medium text-noche hover:bg-noche/5 lg:rounded-xl lg:px-3"
            >
              {panel.label}
            </Link>
          </li>
        )}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-negro/10 lg:pt-4">
          <LogoutButton />
        </li>
      </ul>
    </nav>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  async function salir() {
    setSaliendo(true);
    try {
      await cuentaApi.logout();
    } catch {
      /* igual redirigimos */
    }
    router.push('/');
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      data-testid="cuenta-logout"
      className={cn(
        'block w-full rounded-full px-4 py-2 text-left text-sm font-medium text-gris-texto transition-colors hover:bg-negro/5 hover:text-negro disabled:opacity-60 lg:rounded-xl lg:px-3',
        className,
      )}
    >
      {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );
}
