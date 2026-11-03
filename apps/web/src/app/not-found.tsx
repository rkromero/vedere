import Link from 'next/link';
import { Container } from '@vedere/ui';

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start justify-center py-24 md:py-40">
      <p className="font-text mb-4 text-sm font-medium uppercase tracking-widest text-gris-medio">
        Error 404
      </p>
      <h1 className="font-campaign text-6xl md:text-8xl">
        Esto no
        <br />
        lo vemos
      </h1>
      <p className="font-text mt-6 max-w-md text-lg text-negro/80">
        La página que buscás no existe o cambió de lugar. Probá desde el inicio.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-full bg-negro px-7 text-base font-medium text-blanco transition-colors hover:bg-negro/85"
      >
        Volver al inicio
      </Link>
    </Container>
  );
}
