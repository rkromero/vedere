import { redirect } from 'next/navigation';

// B2B 3: la gestión se mudó a /admin/pedidos-mayoristas.
export default async function MayoristaRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') sp.set(k, v);
  redirect(`/admin/pedidos-mayoristas${sp.toString() ? `?${sp}` : ''}`);
}
