import { TiendaChrome } from '@/components/tienda/TiendaChrome';
import { checkoutConfig, sitioConfig } from '@/lib/tienda/api';

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const [config, sitio] = await Promise.all([checkoutConfig(), sitioConfig()]);
  return (
    <TiendaChrome config={config} sitio={sitio}>
      {children}
    </TiendaChrome>
  );
}
