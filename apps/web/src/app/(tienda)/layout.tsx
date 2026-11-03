import { TiendaChrome } from '@/components/tienda/TiendaChrome';

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return <TiendaChrome>{children}</TiendaChrome>;
}
