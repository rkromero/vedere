import { IconWhatsApp } from '@vedere/ui';
import { whatsappLink } from '@/config/site';

/** Botón flotante de WhatsApp (todas las páginas). No se muestra si no hay número configurado. */
export function WhatsAppFab() {
  const href = whatsappLink('Hola Vedere, tengo una consulta sobre anteojos');
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar por WhatsApp"
      className="fixed bottom-4 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-negro shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2 md:bottom-6 md:right-6 [bottom:max(1rem,env(safe-area-inset-bottom))]"
    >
      <IconWhatsApp size={28} />
    </a>
  );
}
