'use client';
// "Vistos recientemente": slugs en localStorage (sin datos personales).
const KEY = 'vedere_recientes_v1';
const MAX = 12;

export function leerRecientes(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function registrarReciente(slug: string) {
  try {
    const lista = [slug, ...leerRecientes().filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    /* sin storage: ignorar */
  }
}
