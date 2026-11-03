import Link from 'next/link';
import { Container, IconArrowRight } from '@vedere/ui';
import { site } from '@/config/site';

export function ColabBanner() {
  const { colab } = site;
  return (
    <section aria-labelledby="colab-titulo">
      <Container className="py-6 md:py-10">
        <Link
          href={colab.href}
          className="group grid overflow-hidden rounded-3xl bg-carey text-negro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="p-6 sm:p-10">
            <p className="font-text mb-3 text-sm font-medium uppercase tracking-widest text-negro">
              Colaboración
            </p>
            <h2 id="colab-titulo" className="font-campaign text-4xl sm:text-6xl">
              {colab.titulo}
            </h2>
            <p className="font-text mt-4 max-w-xl text-lg text-negro">{colab.texto}</p>
            <span className="font-text mt-6 inline-flex items-center gap-2 text-base font-medium underline-offset-4 group-hover:underline">
              {colab.cta} <IconArrowRight size={18} />
            </span>
          </div>
          <div
            aria-hidden="true"
            className="font-campaign hidden select-none px-10 text-[12rem] leading-none text-blanco/25 md:block"
          >
            ×
          </div>
        </Link>
      </Container>
    </section>
  );
}
