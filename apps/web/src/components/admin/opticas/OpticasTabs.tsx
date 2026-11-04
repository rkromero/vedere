'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vedere/ui';

export function OpticasTabs({ pendientes }: { pendientes: number }) {
  const pathname = usePathname();
  const enSolicitudes = pathname.startsWith('/admin/opticas/solicitudes');
  const tabs = [
    { href: '/admin/opticas', label: 'Ópticas', activa: !enSolicitudes },
    { href: '/admin/opticas/solicitudes', label: 'Solicitudes', activa: enSolicitudes, badge: pendientes },
  ];
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-negro/10" aria-label="Ópticas socias">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.activa ? 'page' : undefined}
          className={cn(
            '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            t.activa ? 'border-negro text-negro' : 'border-transparent text-gris-medio hover:text-negro',
          )}
        >
          {t.label}
          {!!t.badge && (
            <span className="rounded-full bg-sol px-2 py-0.5 text-xs font-semibold text-negro" aria-label={`${t.badge} pendientes`}>
              {t.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
