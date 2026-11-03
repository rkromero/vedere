// Tokens de marca Vedere. Se replican como variables CSS en apps/web/src/styles/globals.css (@theme).
export const colors = {
  negro: '#0A0A0A',
  blanco: '#FFFFFF',
  grisClaro: '#F2F2F0',
  grisMedio: '#8A8A86',
  // Colección
  sol: '#F2B33D',
  vetro: '#7FD1C1',
  noche: '#3A5BD9',
  carey: '#B7712F',
} as const;

export type ColorToken = keyof typeof colors;

export const typography = {
  family: 'Archivo',
  /** Titulares de campaña: Archivo wdth 62, peso 800, mayúsculas. */
  campaign: { wdth: 62, wght: 800, uppercase: true },
  /** Títulos y texto: wdth 100, pesos 400 a 600. */
  text: { wdth: 100, wghtMin: 400, wghtMax: 600 },
} as const;
