// CUIT / CUIL argentino: 11 dígitos (tipo + DNI + verificador), con o sin guiones. El dígito verificador se
// calcula con módulo 11 y los pesos 5,4,3,2,7,6,5,4,3,2 (resultado 11 → 0; resultado 10 → inválido).
// Copia de apps/api/src/lib/cuit.ts para validar en el formulario: mantenerlas iguales.

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS = ['20', '23', '24', '25', '26', '27', '30', '33', '34'];

export type ErrorCuit = 'formato' | 'tipo' | 'verificador';

/** Deja sólo los dígitos ("30-71234567-1" → "30712345671"). */
export function normalizarCuit(v: string): string {
  return v.replace(/[\s.-]/g, '');
}

/** "30712345671" → "30-71234567-1". */
export function formatearCuit(v: string): string {
  const d = normalizarCuit(v);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : v;
}

export function digitoVerificadorCuit(primeros10: string): number | null {
  const suma = PESOS.reduce((acc, p, i) => acc + p * Number(primeros10[i]), 0);
  const r = 11 - (suma % 11);
  if (r === 11) return 0;
  if (r === 10) return null;
  return r;
}

/** null si es válido; si no, el motivo. */
export function errorCuit(v: string): ErrorCuit | null {
  const d = normalizarCuit(v);
  if (!/^\d{11}$/.test(d)) return 'formato';
  if (!PREFIJOS.includes(d.slice(0, 2))) return 'tipo';
  const dv = digitoVerificadorCuit(d.slice(0, 10));
  if (dv === null || dv !== Number(d[10])) return 'verificador';
  return null;
}

export const MENSAJE_CUIT: Record<ErrorCuit, string> = {
  formato: 'El CUIT tiene que tener 11 números (por ejemplo 30-71234567-1)',
  tipo: 'El CUIT tiene que empezar con 20, 23, 24, 25, 26, 27, 30, 33 o 34',
  verificador: 'El CUIT no es válido: revisá los números (el dígito verificador no coincide)',
};

export function esCuitValido(v: string): boolean {
  return errorCuit(v) === null;
}
