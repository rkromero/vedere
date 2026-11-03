// Utilidades de color para fondos de colección (contraste del texto).
export function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return 1;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(n >> 16) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Clases de texto (negro o blanco) con contraste AA sobre el color dado. */
export function textoSobre(hex: string): { clase: string; oscuro: boolean } {
  const l = luminancia(hex);
  // Contraste con negro (0.05) vs blanco (1.05)
  const contrasteNegro = (l + 0.05) / 0.05;
  const contrasteBlanco = 1.05 / (l + 0.05);
  const oscuro = contrasteNegro >= contrasteBlanco;
  return { clase: oscuro ? 'text-negro' : 'text-blanco', oscuro };
}
