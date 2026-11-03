import Link from 'next/link';
import { site } from '@/config/site';

/** Barra de promo superior. Se configura con NEXT_PUBLIC_PROMO_ENABLED / _TEXT / _LINK. */
export function PromoBar() {
  if (!site.promo.enabled || !site.promo.text) return null;

  const content = (
    <span className="font-text text-xs font-medium tracking-wide sm:text-sm">
      {site.promo.text}
    </span>
  );

  return (
    <div className="bg-negro text-blanco">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 text-center">
        {site.promo.link ? (
          <Link href={site.promo.link} className="underline-offset-4 hover:underline">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
