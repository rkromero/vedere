import Link from 'next/link';
import { Container } from '@vedere/ui';
import { site } from '@/config/site';
import { Logo } from './Logo';

const columns = [
  { title: 'Ayuda', links: site.footer.ayuda },
  { title: 'Empresa', links: site.footer.empresa },
  { title: 'Legal', links: site.footer.legal },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-negro text-blanco">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo variant="blanco" />
          <p className="font-text max-w-xs text-sm text-gris-medio">
            Comprás online y tu óptica socia más cercana arma, entrega y ajusta tu pedido.
          </p>
          <div className="flex gap-2" aria-hidden="true">
            <span className="h-2 w-8 rounded-full bg-sol" />
            <span className="h-2 w-8 rounded-full bg-vetro" />
            <span className="h-2 w-8 rounded-full bg-noche" />
            <span className="h-2 w-8 rounded-full bg-carey" />
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="font-text mb-4 text-sm font-semibold uppercase tracking-wider text-blanco">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-text text-sm text-gris-medio transition-colors hover:text-blanco"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-blanco/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-gris-medio sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. Argentina.
          </p>
          <p>
            Defensa de las y los consumidores: para reclamos ingresá a
            www.argentina.gob.ar/defensadelconsumidor
          </p>
        </Container>
      </div>
    </footer>
  );
}
