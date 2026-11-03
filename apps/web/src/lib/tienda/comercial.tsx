'use client';
// Configuración comercial (cuotas por línea, medios de pago, envío) disponible en toda la tienda.
// La carga el layout en el servidor (/checkout/config, caché de 60 s) y la expone por contexto.
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Linea } from '@/lib/format';
import { CONFIG_FALLBACK, cuotasParaLinea } from './checkout';
import type { ConfigCheckout } from './checkout';

const ComercialContext = createContext<ConfigCheckout>(CONFIG_FALLBACK);

export function ComercialProvider({ config, children }: { config: ConfigCheckout; children: ReactNode }) {
  return <ComercialContext.Provider value={config}>{children}</ComercialContext.Provider>;
}

export function useComercial(): ConfigCheckout {
  return useContext(ComercialContext);
}

/** Cuotas sin interés a mostrar junto al precio de un producto. */
export function useCuotas(linea?: Linea | null): number {
  const cfg = useComercial();
  return cuotasParaLinea(linea, cfg.cuotas);
}
