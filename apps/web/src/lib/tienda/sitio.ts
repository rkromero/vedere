// Tipos del sitio público (prompt 6): datos fiscales, páginas legales, redirecciones. Módulo plano.
export interface DatosFiscales {
  razonSocial: string | null;
  cuit: string | null;
  domicilioFiscal: string | null;
  condicionIva: string | null;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
  emailContacto: string | null;
}

export interface SitioConfig {
  fiscal: DatosFiscales;
  googleLogin: boolean;
  rivedere: { meses: number; descuentoPct: number };
  referidos: { descuentoPct: number };
  carritoAbandonado: boolean;
}

export const SITIO_FALLBACK: SitioConfig = {
  fiscal: {
    razonSocial: null,
    cuit: null,
    domicilioFiscal: null,
    condicionIva: null,
    ingresosBrutos: null,
    inicioActividades: null,
    emailContacto: null,
  },
  googleLogin: false,
  rivedere: { meses: 24, descuentoPct: 15 },
  referidos: { descuentoPct: 10 },
  carritoAbandonado: true,
};

export interface PaginaLegal {
  slug: string;
  titulo: string;
  intro: string | null;
  /** Markdown. */
  contenido: string;
  updatedAt: string;
}

/** Slugs públicos bajo /legal/<slug>. "cambios" se muestra en /cambios-y-devoluciones. */
export const LEGAL_SLUGS = ['terminos', 'privacidad', 'cookies', 'programa-opticas'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_META: Record<LegalSlug, { titulo: string; description: string }> = {
  terminos: { titulo: 'Términos y condiciones', description: 'Condiciones de uso y de compra en Vedere.' },
  privacidad: {
    titulo: 'Política de privacidad',
    description: 'Qué datos tratamos, para qué y cómo ejercer tus derechos (Ley 25.326).',
  },
  cookies: { titulo: 'Política de cookies', description: 'Qué cookies usamos y cómo administrar tu consentimiento.' },
  'programa-opticas': {
    titulo: 'Términos del programa de ópticas socias',
    description: 'Condiciones para sumarse a la red de ópticas socias Vedere y comprar al por mayor.',
  },
};

export interface ArrepentimientoRespuesta {
  numeroTramite: string;
  createdAt: string;
}
