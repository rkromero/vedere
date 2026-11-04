import Link from 'next/link';

/** 403: la página existe pero no es tuya (p. ej. un pedido de otra óptica). */
export default function Forbidden() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-gris-medio">Error 403</p>
      <h1 className="mt-2 text-2xl font-semibold">No tenés acceso a esta página</h1>
      <p className="mt-2 max-w-md text-sm text-gris-medio">
        Lo que buscás pertenece a otra cuenta. Si creés que es un error, escribinos.
      </p>
      <Link href="/optica" className="mt-6 inline-flex h-10 items-center rounded-lg bg-negro px-4 text-sm font-medium text-blanco">
        Volver al panel
      </Link>
    </main>
  );
}
