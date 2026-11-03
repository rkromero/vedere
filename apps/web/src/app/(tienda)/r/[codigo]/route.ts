// Link de referidos (/r/<codigo>): guarda el código en una cookie (30 días) y lleva a la home.
// El registro en /ingresar lo manda como `ref` y el referido recibe su cupón al pagar la primera compra.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { REF_COOKIE } from '@/lib/tienda/cuenta';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const limpio = codigo.trim().toUpperCase();
  const valido = /^[A-Z0-9-]{4,24}$/.test(limpio);
  const destino = new URL(valido ? '/?ref=1' : '/', request.url);
  const res = NextResponse.redirect(destino, 302);
  if (valido) {
    res.cookies.set(REF_COOKIE, limpio, {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: request.nextUrl.protocol === 'https:',
    });
  }
  return res;
}
