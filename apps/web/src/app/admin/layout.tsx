import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/toast';

export const metadata: Metadata = {
  title: { default: 'Backoffice', template: '%s | Backoffice Vedere' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
