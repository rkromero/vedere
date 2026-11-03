'use client';
// Consentimiento de cookies (prompt 6): se guarda en localStorage y se comunica por un evento de
// window para que Analytics cargue los scripts apenas el visitante acepta.
export type Consentimiento = 'todas' | 'necesarias';

export const CONSENT_KEY = 'vedere_cookies';
export const CONSENT_EVENT = 'vedere:cookies';

export function leerConsentimiento(): Consentimiento | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'todas' || v === 'necesarias' ? v : null;
  } catch {
    return null;
  }
}

export function guardarConsentimiento(valor: Consentimiento) {
  try {
    localStorage.setItem(CONSENT_KEY, valor);
  } catch {
    /* modo privado o storage bloqueado: igual avisamos a los scripts de esta visita */
  }
  window.dispatchEvent(new CustomEvent<Consentimiento>(CONSENT_EVENT, { detail: valor }));
}

/** Suscribe a cambios de consentimiento (desde el banner o desde /legal/cookies). */
export function onConsentimiento(cb: (valor: Consentimiento) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Consentimiento>).detail);
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}
