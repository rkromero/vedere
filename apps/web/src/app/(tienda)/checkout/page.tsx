import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@vedere/ui';
import { whatsappLink } from '@/config/site';
import { Pagina, Prose } from '@/components/tienda/Pagina';

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false } };

/** Placeholder: el checkout (envío, óptica socia y pago) llega en el prompt 4. */
export default function CheckoutPage() {
  const wa = whatsappLink('Hola Vedere, quiero finalizar una compra');
  return (
    <Pagina
      titulo="Ya casi"
      intro="El pago online se activa en los próximos días. Tu carrito queda guardado en este dispositivo."
    >
      <Prose>
        <p>
          Mientras tanto, podés cerrar la compra por WhatsApp: te confirmamos stock, te asignamos la
          óptica socia y te pasamos el link de pago en cuotas.
        </p>
      </Prose>
      <div className="mt-8 flex flex-wrap gap-3">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp')}>
            Comprar por WhatsApp
          </a>
        )}
        <Link href="/" className={buttonClasses('secondary')}>
          Seguir mirando
        </Link>
      </div>
    </Pagina>
  );
}
