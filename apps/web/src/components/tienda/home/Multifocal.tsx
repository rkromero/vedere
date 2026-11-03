import Link from 'next/link';
import { Container, IconWhatsApp, buttonClasses } from '@vedere/ui';
import { whatsappLink } from '@/config/site';

/** Bloque para el público de más de 50: texto más grande, pasos claros y dos acciones. */
export function Multifocal() {
  const wa = whatsappLink('Hola, quiero asesoramiento sobre anteojos multifocales');
  return (
    <section aria-labelledby="multifocal-titulo" className="bg-noche text-blanco">
      <Container className="py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="font-text mb-4 text-base font-medium uppercase tracking-widest text-blanco">
            Línea Multifocal
          </p>
          <h2 id="multifocal-titulo" className="font-campaign text-5xl md:text-7xl">
            Cerca, lejos
            <br />y en el medio.
          </h2>
          <p className="font-text mt-6 text-xl leading-relaxed text-blanco md:text-2xl">
            Un solo par para leer, usar la computadora y manejar. Te asesoramos sin apuro, por
            teléfono o en la óptica, y te los ajustan hasta que queden perfectos.
          </p>
          <ul className="font-text mt-6 space-y-2 text-lg text-blanco">
            <li>· Lentes multifocales de última generación, con antirreflejo incluido.</li>
            <li>· Período de adaptación garantizado: si no te acostumbrás, lo cambiamos.</li>
            <li>· Pedís turno y te atienden en tu óptica socia más cercana.</li>
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contacto?motivo=turno"
              className={buttonClasses('blanco', 'lg', 'text-lg')}
            >
              Pedir turno
            </Link>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses('whatsapp', 'lg', 'text-lg')}
              >
                <IconWhatsApp /> Hablar por WhatsApp
              </a>
            )}
            <Link
              href="/multifocales"
              className={buttonClasses('outline-blanco', 'lg', 'text-lg')}
            >
              Ver modelos
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
