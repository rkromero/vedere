'use client';
// Carga de GTM, GA4 y Meta Pixel (prompt 6). Nada se inyecta hasta que el visitante acepta "todas" las
// cookies; con "necesarias" los eventos de lib/analytics.ts quedan sólo en window.dataLayer (no salen).
// Con NEXT_PUBLIC_ANALYTICS_DEBUG=true o ?debug_analytics=1 GA4 va en debug_mode (DebugView) y cada
// evento se loguea en consola; Meta se verifica con el Pixel Helper / Test Events del Events Manager.
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { site } from '@/config/site';
import { leerConsentimiento, onConsentimiento } from './consentimiento';

const { gtmId, ga4Id, metaPixelId } = site.analytics;

function cargarScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  s.id = id;
  document.head.appendChild(s);
}

function esDebug(): boolean {
  if (site.analytics.debug) return true;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('debug_analytics') === '1') {
      sessionStorage.setItem('vedere_analytics_debug', '1');
      return true;
    }
    return sessionStorage.getItem('vedere_analytics_debug') === '1';
  } catch {
    return false;
  }
}

/** Inyecta los scripts una sola vez. Idempotente. */
function activar(debug: boolean) {
  const w = window;
  w.dataLayer = w.dataLayer ?? [];

  if (ga4Id) {
    // gtag estándar: la cola va a dataLayer y el script la procesa al cargar.
    if (!w.gtag) {
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag('js', new Date());
      w.gtag('config', ga4Id, { send_page_view: false, ...(debug ? { debug_mode: true } : {}) });
    }
    cargarScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`, 'vedere-ga4');
  }

  if (gtmId && !document.getElementById('vedere-gtm')) {
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    cargarScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`, 'vedere-gtm');
  }

  if (metaPixelId && !w.fbq) {
    // Equivalente al snippet oficial del Pixel, sin eval.
    type FbqFn = ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[];
      push: FbqFn;
      loaded: boolean;
      version: string;
    };
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as FbqFn;
    fbq.queue = [];
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    (w as unknown as { _fbq: FbqFn })._fbq = fbq;
    w.fbq = fbq;
    cargarScript('https://connect.facebook.net/en_US/fbevents.js', 'vedere-meta');
    w.fbq('init', metaPixelId);
  }

  if (debug) {
    // Log de cada evento que pasa por dataLayer (lo que mandan lib/analytics.ts y GTM).
    const original = w.dataLayer.push.bind(w.dataLayer);
    w.dataLayer.push = (...items: unknown[]) => {
      for (const it of items) if (it && typeof it === 'object' && 'event' in (it as object)) console.info('[analytics]', it);
      return original(...items);
    };
    console.info('[analytics] modo debug: GA4 debug_mode activo', { ga4Id, gtmId, metaPixelId });
  }
}

export function Analytics() {
  const [activo, setActivo] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ultimaRuta = useRef<string | null>(null);
  const habilitado = !!(gtmId || ga4Id || metaPixelId);

  // Activar con consentimiento previo o cuando el banner lo otorga.
  useEffect(() => {
    if (!habilitado) return;
    const debug = esDebug();
    if (leerConsentimiento() === 'todas') {
      activar(debug);
      setActivo(true);
    }
    return onConsentimiento((v) => {
      if (v === 'todas') {
        activar(debug);
        setActivo(true);
      }
    });
  }, [habilitado]);

  // page_view / PageView en cada cambio de ruta (App Router no recarga la página).
  useEffect(() => {
    if (!activo) return;
    const ruta = `${pathname}${searchParams?.toString() ? `?${searchParams}` : ''}`;
    if (ultimaRuta.current === ruta) return;
    ultimaRuta.current = ruta;
    const w = window;
    w.gtag?.('event', 'page_view', { page_location: window.location.href, page_path: ruta, page_title: document.title });
    w.dataLayer?.push({ event: 'page_view', page_path: ruta });
    w.fbq?.('track', 'PageView');
  }, [activo, pathname, searchParams]);

  return null;
}
