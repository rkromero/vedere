import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/toast';

export const metadata: Metadata = {
  title: { default: 'Panel de óptica', template: '%s | Óptica socia Vedere' },
  robots: { index: false, follow: false },
};

export default function OpticaRootLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
