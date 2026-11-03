import type { Metadata } from 'next';
import { ContactoForm } from '@/components/tienda/ContactoForm';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Sumá tu óptica',
  description: 'Formá parte de la red de ópticas socias Vedere y recibí clientes de tu zona.',
  alternates: { canonical: '/opticas/sumate' },
};

export default function SumatePage() {
  return (
    <Pagina
      titulo="Sumá tu óptica"
      intro="Te derivamos los pedidos de tu zona; vos los armás, los entregás y ganás una comisión por cada uno."
      aside={
        <div className="rounded-3xl bg-gris-claro p-6">
          <h2 className="text-lg font-semibold">Qué pedimos</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-negro/80">
            <li>Óptica habilitada con profesional matriculado.</li>
            <li>Taller propio o laboratorio asociado para montaje.</li>
            <li>Atención con turno y sin turno para ajustes.</li>
          </ul>
        </div>
      }
    >
      <Prose className="mb-8">
        <p>
          Dejanos los datos de tu óptica y te contactamos en la semana para contarte cómo funciona
          la red, las comisiones y el sistema de pedidos.
        </p>
      </Prose>
      <ContactoForm motivoInicial="OPTICA" />
    </Pagina>
  );
}
