'use client';
// Layout del backoffice: menú lateral (responsive), barra superior y contenido.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@vedere/ui';
import type { SessionUser } from '@/lib/session';
import { api } from '@/lib/api-client';

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
  exact?: boolean;
}

interface NavSeccion {
  id: string;
  titulo: string | null;
  items: NavItem[];
}

const SECCIONES: NavSeccion[] = [
  { id: 'inicio', titulo: null, items: [{ href: '/admin', label: 'Dashboard', exact: true }] },
  {
    id: 'ventas',
    titulo: 'Ventas',
    items: [
      { href: '/admin/pedidos', label: 'Pedidos' },
      { href: '/admin/solicitudes', label: 'Cambios y devoluciones' },
      { href: '/admin/arrepentimientos', label: 'Arrepentimientos' },
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo',
    items: [
      { href: '/admin/productos', label: 'Productos' },
      { href: '/admin/productos/escanear', label: 'Cargar stock' },
      { href: '/admin/productos/precios', label: 'Actualizar precios' },
      { href: '/admin/categorias', label: 'Categorías' },
      { href: '/admin/marcas', label: 'Marcas' },
      { href: '/admin/colecciones', label: 'Colecciones' },
    ],
  },
  {
    id: 'opticas',
    titulo: 'Ópticas (mayorista)',
    items: [
      { href: '/admin/opticas', label: 'Ópticas' },
      { href: '/admin/pedidos-mayoristas', label: 'Pedidos mayoristas' },
      { href: '/admin/cuentas', label: 'Cuentas corrientes' },
      { href: '/admin/liquidaciones', label: 'Liquidaciones' },
      { href: '/admin/niveles', label: 'Niveles y logros' },
    ],
  },
  {
    id: 'clientes',
    titulo: 'Clientes',
    items: [
      { href: '/admin/mensajes', label: 'Mensajes' },
      { href: '/admin/newsletter', label: 'Suscriptores newsletter' },
    ],
  },
  {
    id: 'marketing',
    titulo: 'Marketing',
    items: [
      { href: '/admin/cupones', label: 'Cupones' },
      { href: '/admin/promos', label: 'Barra de promo' },
      { href: '/admin/plantillas', label: 'Plantillas de email' },
    ],
  },
  {
    id: 'analytics',
    titulo: 'Analytics',
    items: [{ href: '/admin/reportes', label: 'Reportes' }],
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    items: [
      { href: '/admin/configuracion', label: 'Configuración' },
      { href: '/admin/usuarios', label: 'Usuarios y permisos', adminOnly: true },
      { href: '/admin/legal', label: 'Páginas legales' },
      { href: '/admin/redirecciones', label: 'Redirecciones', adminOnly: true },
    ],
  },
];

const CLAVE_PLEGADAS = 'vedere-admin-menu-plegadas';

function leerPlegadas(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLAVE_PLEGADAS) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** El ítem activo es el de href más largo que coincide (así "Cargar stock" no marca también "Productos"). */
function hrefActivo(pathname: string, items: NavItem[]): string | null {
  let mejor: NavItem | null = null;
  for (const i of items) {
    const coincide = i.exact
      ? pathname === i.href
      : pathname === i.href || pathname.startsWith(i.href + '/');
    if (coincide && (!mejor || i.href.length > mejor.href.length)) mejor = i;
  }
  return mejor?.href ?? null;
}

export function AdminShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plegadas, setPlegadas] = useState<string[]>([]);

  useEffect(() => setPlegadas(leerPlegadas()), []);

  const secciones = SECCIONES.map((sec) => ({
    ...sec,
    items: sec.items.filter((i) => !i.adminOnly || user.rol === 'ADMIN'),
  })).filter((sec) => sec.items.length > 0);
  const activo = hrefActivo(
    pathname,
    secciones.flatMap((sec) => sec.items),
  );

  function alternar(id: string) {
    setPlegadas((l) => {
      const next = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
      try {
        window.localStorage.setItem(CLAVE_PLEGADAS, JSON.stringify(next));
      } catch {
        // Sin almacenamiento: el estado dura hasta recargar.
      }
      return next;
    });
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4" aria-label="Backoffice">
      {secciones.map((sec) => {
        const tieneActivo = sec.items.some((i) => i.href === activo);
        // La sección de la página actual siempre se ve, aunque esté plegada.
        const abierta = !sec.titulo || tieneActivo || !plegadas.includes(sec.id);
        const listaId = `menu-${sec.id}`;
        return (
          <div key={sec.id} className={sec.titulo ? 'mt-2' : undefined}>
            {sec.titulo && (
              <button
                type="button"
                onClick={() => alternar(sec.id)}
                aria-expanded={abierta}
                aria-controls={listaId}
                disabled={tieneActivo}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gris-medio hover:text-negro disabled:cursor-default disabled:hover:text-gris-medio"
              >
                {sec.titulo}
                {!tieneActivo && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                    className={cn('transition-transform', abierta ? 'rotate-0' : '-rotate-90')}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </button>
            )}
            {abierta && (
              <ul id={listaId} className="flex flex-col gap-0.5">
                {sec.items.map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      aria-current={i.href === activo ? 'page' : undefined}
                      className={cn(
                        'block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        i.href === activo
                          ? 'bg-negro text-blanco'
                          : 'text-negro/80 hover:bg-gris-claro hover:text-negro',
                      )}
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-gris-claro/40">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 print:!hidden shrink-0 flex-col border-r border-negro/10 bg-blanco lg:flex">
        <div className="px-6 py-5">
          <Link href="/admin" className="font-campaign text-2xl">
            Vedere
          </Link>
          <p className="text-xs text-gris-medio">Backoffice</p>
        </div>
        {nav}
        <div className="border-t border-negro/10 px-6 py-4 text-xs">
          <p className="truncate font-medium">{user.nombre}</p>
          <p className="truncate text-gris-medio">{user.email}</p>
          <p className="mt-1 text-gris-medio">{user.rol}</p>
          <div className="mt-3 flex gap-3">
            <Link href="/" className="underline-offset-2 hover:underline">
              Ver tienda
            </Link>
            <button type="button" onClick={logout} className="underline-offset-2 hover:underline">
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-negro/40" />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-blanco shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-campaign text-2xl">Vedere</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="p-1"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {nav}
            <div className="border-t border-negro/10 px-5 py-4 text-xs">
              <p className="font-medium">{user.nombre}</p>
              <button
                type="button"
                onClick={logout}
                className="mt-2 underline-offset-2 hover:underline"
              >
                Salir
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden flex h-14 items-center gap-3 border-b border-negro/10 bg-blanco px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="rounded-md p-1 hover:bg-gris-claro"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="font-campaign text-xl">Vedere</span>
          <span className="text-xs text-gris-medio">Backoffice</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
