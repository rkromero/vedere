// Barra de promo superior: mensajes cargados desde el admin (rotan en el cliente).
import { site } from '@/config/site';
import { catalogo } from '@/lib/tienda/api';
import { PromoRotator } from './PromoRotator';

export async function PromoBar() {
  const { items } = await catalogo.promos();
  const mensajes = items.length
    ? items
    : site.promo.enabled && site.promo.text
      ? [{ id: 'env', texto: site.promo.text, link: site.promo.link || null }]
      : [];
  if (mensajes.length === 0) return null;
  return <PromoRotator mensajes={mensajes} />;
}
