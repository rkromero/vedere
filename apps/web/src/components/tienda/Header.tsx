import Link from 'next/link';
import { Container } from '@vedere/ui';
import { site } from '@/config/site';
import { Logo } from '@/components/Logo';
import { CartButton, MenuButton, SearchButton } from './HeaderActions';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-negro/10 bg-blanco/95 backdrop-blur supports-[backdrop-filter]:bg-blanco/85">
      <Container className="flex h-16 items-center gap-3">
        <MenuButton nav={site.nav} />
        <Logo className="shrink-0" />

        <nav aria-label="Principal" className="ml-6 hidden items-center gap-7 md:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-text text-sm font-medium text-negro underline-offset-8 transition-colors hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SearchButton />
          <Link
            href="/mi-cuenta"
            aria-label="Mi cuenta"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-negro hover:bg-negro/5 md:inline-flex"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </Link>
          <CartButton />
        </div>
      </Container>
    </header>
  );
}
