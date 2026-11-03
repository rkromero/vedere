import Link from 'next/link';
import { Container, IconInstagram, IconWhatsApp, buttonClasses } from '@vedere/ui';
import { site, whatsappLink } from '@/config/site';
import { Logo } from '@/components/Logo';
import type { DatosFiscales } from '@/lib/tienda/sitio';

const columns = [
  { title: 'Ayuda', links: site.footer.ayuda },
  { title: 'Vedere', links: site.footer.empresa },
  { title: 'Legal', links: site.footer.legal },
];

/** Pie de página. `fiscal` viene de GET /sitio/config (editable en el admin); si falta, no se muestra. */
export function Footer({ fiscal }: { fiscal?: DatosFiscales | null }) {
  const wa = whatsappLink('Hola Vedere, tengo una consulta');
  const f = fiscal ?? null;
  const hayFiscal = !!(f?.razonSocial || f?.cuit || f?.domicilioFiscal);
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

      {/* Botón de arrepentimiento (Res. 424/2020): visible y accesible desde todas las páginas. */}
      <div className="border-t border-blanco/10">
        <Container className="font-text flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-blanco/75">
            ¿Te arrepentiste de una compra? Tenés 10 días corridos desde que la recibiste para revocarla
            sin costo (art. 34, Ley 24.240).
          </p>
          <Link
            href="/legal/arrepentimiento"
            data-testid="footer-arrepentimiento"
            className={buttonClasses('secondary', 'md', 'shrink-0 border-blanco bg-blanco text-negro hover:bg-blanco/90')}
          >
            Botón de arrepentimiento
          </Link>
        </Container>
      </div>

      <div className="border-t border-blanco/10">
        <Container className="font-text flex flex-col gap-3 py-6 text-xs text-blanco/60 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p>© {new Date().getFullYear()} Vedere. Hecho en Argentina.</p>
            {hayFiscal && (
              <address className="not-italic" data-testid="footer-fiscal">
                {f?.razonSocial && <span>{f.razonSocial}</span>}
                {f?.cuit && <span> · CUIT {f.cuit}</span>}
                {f?.condicionIva && <span> · {f.condicionIva}</span>}
                {f?.ingresosBrutos && <span> · IIBB {f.ingresosBrutos}</span>}
                {f?.inicioActividades && <span> · Inicio de actividades {f.inicioActividades}</span>}
                {f?.domicilioFiscal && (
                  <>
                    <br />
                    <span>{f.domicilioFiscal}</span>
                  </>
                )}
              </address>
            )}
          </div>
          <div className="space-y-1 lg:text-right">
            <p>
              Defensa de las y los consumidores: para reclamos ingresá en{' '}
              <a
                href="https://www.argentina.gob.ar/defensadelconsumidor"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-blanco"
              >
                www.argentina.gob.ar/defensadelconsumidor
              </a>
              .
            </p>
            <p>
              <a
                href="http://qr.afip.gob.ar/?qr="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Data Fiscal AFIP (pendiente de QR oficial)"
                className="underline underline-offset-2 hover:text-blanco"
              >
                Data Fiscal
              </a>
              {' · '}
              <Link href="/legal/cookies" className="underline underline-offset-2 hover:text-blanco">
                Cookies
              </Link>
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
