import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses, formatARS } from '@vedere/ui';
import { site } from '@/config/site';
import { Pagina } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description: 'Comprás online, tu óptica socia arma, entrega y ajusta. Así de simple.',
  alternates: { canonical: '/como-funciona' },
};

const PASOS = [
  {
    t: 'Elegís online',
    d: 'Mirá los modelos con fotos grandes, elegí el color y, si es recetado, marcá "Usar con mi receta". Precio final y cuotas siempre a la vista.',
  },
  {
    t: 'Te asignamos una óptica socia',
    d: 'Con tu código postal buscamos la óptica más cercana. Ahí arman el pedido, montan los lentes y lo dejan listo.',
  },
  {
    t: 'Lo retirás o te lo enviamos',
    d: `Retiro gratis en la óptica, con ajuste a tu cara incluido. O envío a domicilio, gratis desde ${formatARS(site.comercial.envioGratisDesde)}.`,
  },
  {
    t: 'Ajuste de por vida',
    d: 'Volvé a la óptica socia las veces que necesites para ajustar varillas o plaquetas. Es gratis, siempre.',
  },
];

export default function ComoFuncionaPage() {
  return (
    <Pagina titulo="Cómo funciona" intro="Lo mejor de comprar online y lo mejor de tu óptica de barrio.">
      <ol className="space-y-8">
        {PASOS.map((p, i) => (
          <li key={p.t} className="flex gap-5">
            <span
              aria-hidden="true"
              className="font-campaign flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-negro text-2xl text-blanco"
            >
              {i + 1}
            </span>
            <div>
              <h2 className="text-xl font-semibold">{p.t}</h2>
              <p className="mt-1 text-negro/80">{p.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/sol" className={buttonClasses('primary')}>
          Ver anteojos de sol
        </Link>
        <Link href="/opticas" className={buttonClasses('secondary')}>
          Buscar mi óptica
        </Link>
      </div>
    </Pagina>
  );
}
