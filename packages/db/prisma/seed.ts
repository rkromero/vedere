// Seed inicial: crea (o actualiza) el usuario ADMIN a partir de variables de entorno.
// Nunca hardcodear credenciales acá: ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NOMBRE.
import { PrismaClient, Rol } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NOMBRE?.trim() || 'Admin Vedere';

  if (!email || !password) {
    throw new Error('Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD en el entorno para correr el seed.');
  }
  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres.');
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email },
    update: { nombre, rol: Rol.ADMIN, activo: true, passwordHash },
    create: { email, nombre, rol: Rol.ADMIN, activo: true, passwordHash },
  });

  console.log(`[seed] Usuario admin listo: ${admin.email} (id ${admin.id})`);
}

main()
  .catch((err) => {
    console.error('[seed] Falló:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
