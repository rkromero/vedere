// Plantilla de página institucional: cabecera en gris claro y cuerpo con tipografía cómoda.
import type { ReactNode } from 'react';
import { Container, cn } from '@vedere/ui';

export function Pagina({
  titulo,
  intro,
  children,
  ancho = 'prose',
  aside,
}: {
  titulo: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  ancho?: 'prose' | 'full';
  aside?: ReactNode;
}) {
  return (
    <>
      <section className="bg-gris-claro">
        <Container className="py-10 md:py-14">
          <h1 className="font-campaign text-5xl md:text-7xl">{titulo}</h1>
          {intro && <p className="font-text mt-4 max-w-2xl text-lg text-negro/75">{intro}</p>}
        </Container>
      </section>
      <Container className={cn('py-10 md:py-14', aside ? 'grid gap-10 lg:grid-cols-[1fr_20rem]' : '')}>
        <div className={cn('font-text', ancho === 'prose' && 'max-w-3xl')}>{children}</div>
        {aside && <aside className="font-text">{aside}</aside>}
      </Container>
    </>
  );
}

/** Estilos para texto largo (h2, p, ul) sin plugin de tipografía. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-4 text-base leading-relaxed text-negro/85',
        '[&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-negro',
        '[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-negro',
        '[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6',
        '[&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-negro',
        className,
      )}
    >
      {children}
    </div>
  );
}
