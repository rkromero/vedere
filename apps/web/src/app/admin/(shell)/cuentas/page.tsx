import type { Metadata } from 'next';
import { CuentasListado } from '@/components/admin/cuentas/Cuentas';
import type { Paged } from '@/components/admin/table';
import { serverApi } from '@/lib/api-server';
import type { CuentaListado, PagoInformado } from '@/lib/mayorista';

export const metadata: Metadata = { title: 'Cuentas corrientes' };
export const dynamic = 'force-dynamic';

export default async function CuentasPage() {
  const [cuentas, pagos] = await Promise.all([
    serverApi<{ items: CuentaListado[]; totales: { deudaTotal: number; deudaVencida: number; opticasConDeudaVencida: number } }>('/admin/cuentas'),
    serverApi<Paged<PagoInformado> & { pendientes: number }>('/admin/cuentas/pagos-informados?estado=PENDIENTE&pageSize=50'),
  ]);
  return <CuentasListado items={cuentas.items} totales={cuentas.totales} pagos={pagos} />;
}
