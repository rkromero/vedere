import type { Metadata } from 'next';
import { CargaStock } from '@/components/admin/productos/CargaStock';

export const metadata: Metadata = { title: 'Cargar stock' };
export const dynamic = 'force-dynamic';

export default function CargarStockPage() {
  return <CargaStock />;
}
