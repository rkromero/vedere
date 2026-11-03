import { PromoBar } from '@/components/PromoBar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PromoBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
