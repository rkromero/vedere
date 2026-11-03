import Link from 'next/link';
import { Container } from '@vedere/ui';
import { site } from '@/config/site';
import { Logo } from './Logo';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gris-claro bg-blanco/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-text text-sm font-medium text-negro transition-colors hover:text-gris-medio"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/cuenta"
            className="font-text text-sm font-medium text-negro transition-colors hover:text-gris-medio"
          >
            Mi cuenta
          </Link>
          <Link
            href="/carrito"
            className="inline-flex h-9 items-center rounded-full bg-negro px-4 text-sm font-medium text-blanco transition-colors hover:bg-negro/85"
          >
            Carrito
          </Link>
        </div>
      </Container>

      {/* Nav mobile */}
      <nav aria-label="Principal (móvil)" className="border-t border-gris-claro md:hidden">
        <Container className="flex gap-6 overflow-x-auto py-2">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-text shrink-0 text-sm font-medium text-negro"
            >
              {item.label}
            </Link>
          ))}
        </Container>
      </nav>
    </header>
  );
}
