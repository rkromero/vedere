import { TiendaChrome } from '@/components/tienda/TiendaChrome';
import { checkoutConfig } from '@/lib/tienda/api';

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const config = await checkoutConfig();
  return <TiendaChrome config={config}>{children}</TiendaChrome>;
}
