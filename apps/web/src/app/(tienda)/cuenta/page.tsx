import { redirect } from 'next/navigation';

/** /cuenta (placeholder de prompts anteriores) → Mi cuenta. */
export default function CuentaRedirect() {
  redirect('/mi-cuenta');
}
