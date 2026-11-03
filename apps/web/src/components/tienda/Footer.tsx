import Link from 'next/link';
import { Container, IconInstagram, IconWhatsApp } from '@vedere/ui';
import { site, whatsappLink } from '@/config/site';
import { Logo } from '@/components/Logo';

const columns = [
  { title: 'Ayuda', links: site.footer.ayuda },
  { title: 'Vedere', links: site.footer.empresa },
  { title: 'Legal', links: site.footer.legal },
];

export function Footer() {
  const wa = whatsappLink('Hola Vedere, tengo una consulta');
  return (
    <footer className="mt-16 bg-negro text-blanco">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo variant="blanco" />
          <p className="font-text max-w-xs text-sm text-blanco/70">
            Comprás online y tu óptica socia más cercana arma, entrega y ajusta tu pedido.
          </p>
          <div className="flex gap-2" aria-hidden="true">
            <span className="h-2 w-8 rounded-full bg-sol" />
            <span className="h-2 w-8 rounded-full bg-vetro" />
            <span className="h-2 w-8 rounded-full bg-noche" />
            <span className="h-2 w-8 rounded-full bg-carey" />
          </div>
          <div className="flex gap-2 pt-2">
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de Vedere"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-blanco/20 hover:bg-blanco/10"
            >
              <IconInstagram />
            </a>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp de Vedere"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-blanco/20 hover:bg-blanco/10"
              >
                <IconWhatsApp />
              </a>
            )}
          </div>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-text mb-4 text-sm font-semibold uppercase tracking-wider text-blanco">
              {col.title}
            </h2>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-text inline-block py-0.5 text-sm text-blanco/75 transition-colors hover:text-blanco"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-blanco/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-blanco/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vedere. Hecho en Argentina.</p>
          <p>
            Defensa de las y los consumidores: para reclamos ingresá{' '}
            <a
              href="https://www.argentina.gob.ar/defensadelconsumidor"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-blanco"
            >
              acá
            </a>
            .
          </p>
        </Container>
      </div>
    </footer>
  );
}
