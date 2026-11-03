'use client';
// Layout del panel de la óptica socia: menú (Pedidos, Agenda, Liquidación), datos de la óptica y salir.
import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import type { SessionUser } from '@/lib/session';
import { api } from '@/lib/api-client';

const NAV: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: '/optica', label: 'Resumen', exact: true },
  { href: '/optica/pedidos', label: 'Pedidos' },
  { href: '/optica/turnos', label: 'Agenda de turnos' },
  { href: '/optica/liquidacion', label: 'Liquidación' },
];

export function OpticaShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isActive = (i: (typeof NAV)[number]) => (i.exact ? pathname === i.href : pathname.startsWith(i.href));

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      router.push('/optica/login');
      router.refresh();
    }
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Panel de la óptica">
      {NAV.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setOpen(false)}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(i) ? 'bg-negro text-blanco' : 'text-negro/80 hover:bg-gris-claro hover:text-negro',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );

  const pie = (
    <div className="border-t border-negro/10 px-6 py-4 text-xs">
      <p className="truncate font-medium">{user.optica?.nombre ?? 'Óptica'}</p>
      <p className="truncate text-gris-medio">{user.nombre}</p>
      <p className="truncate text-gris-medio">{user.email}</p>
      <div className="mt-3 flex gap-3">
        <Link href="/" className="underline-offset-2 hover:underline">
          Ver tienda
        </Link>
        <button type="button" onClick={logout} className="underline-offset-2 hover:underline">
          Salir
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gris-claro/40">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-negro/10 bg-blanco lg:flex">
        <div className="px-6 py-5">
          <Link href="/optica" className="font-campaign text-2xl">
            Vedere
          </Link>
          <p className="text-xs text-gris-medio">Óptica socia</p>
        </div>
        {nav}
        {pie}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-negro/40" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-blanco shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-campaign text-2xl">Vedere</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {nav}
            {pie}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-negro/10 bg-blanco px-4 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-md p-1 hover:bg-gris-claro">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="font-campaign text-xl">Vedere</span>
          <span className="truncate text-xs text-gris-medio">{user.optica?.nombre}</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
