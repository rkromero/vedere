import type { Metadata } from 'next';
import Link from 'next/link';
import { SolicitudOpticaForm } from '@/components/tienda/SolicitudOpticaForm';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = {
  title: 'Sumá tu óptica',
  description: 'Sumá tu óptica a la red de socias Vedere: comprás al por mayor y recibís clientes de tu zona.',
  alternates: { canonical: '/opticas/sumate' },
};

export default function SumatePage() {
  return (
    <Pagina
      titulo="Sumá tu óptica"
      intro="Comprá los armazones Vedere a precio mayorista y recibí los pedidos de clientes de tu zona: vos los armás, los entregás y ganás por cada uno."
      aside={
        <div className="space-y-6">
          <div className="rounded-3xl bg-gris-claro p-6">
            <h2 className="text-lg font-semibold">Qué pedimos</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-negro/80">
              <li>Óptica habilitada, con su habilitación vigente.</li>
              <li>Óptico técnico responsable matriculado.</li>
              <li>CUIT activo.</li>
              <li>Taller propio o laboratorio asociado para el montaje.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-negro/10 p-6">
            <h2 className="text-lg font-semibold">Cómo sigue</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-negro/80">
              <li>Mandás la solicitud con la habilitación.</li>
              <li>La revisamos en unos días hábiles.</li>
              <li>Te llega por email el acceso al panel de ópticas socias.</li>
            </ol>
          </div>
        </div>
      }
    >
      <Prose className="mb-8">
        <p>
          Completá los datos de la óptica. ¿Ya sos socia y querés entrar al panel?{' '}
          <Link href="/optica/login">Ingresá acá</Link>.
        </p>
      </Prose>
      <SolicitudOpticaForm />
    </Pagina>
  );
}
