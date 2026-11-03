import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const next = h.get('x-invoke-path') ?? '/admin';
  const user = await requireStaff(next);
  return <AdminShell user={user}>{children}</AdminShell>;
}
