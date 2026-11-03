// Sesión actual para el cliente (carrito): responde 200 con user null en vez de un 401 ruidoso.
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSession();
  return Response.json(
    { user: user ? { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
