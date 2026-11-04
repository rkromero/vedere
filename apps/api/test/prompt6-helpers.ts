// Utilidades compartidas por los tests de integración del prompt 6 (sitio, plantillas, jobs, reportes, feeds,
// marketing): app de prueba, limpieza total de la base, catálogo mínimo y pedidos pagados por transferencia.
import { expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@vedere/db';
import { testEnv } from './helpers.js';

export type Cookies = Record<string, string>;

export interface Contexto {
  app: FastifyInstance;
  prisma: PrismaClient;
  staffCookie: Cookies;
  clienteCookie: Cookies;
  ids: { admin: string; cliente: string; optica: string; coleccion: string; solA: string; recetado: string; productoSol: string; productoRecetado: string };
  inject: (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, cookies?: Cookies, payload?: unknown, headers?: Record<string, string>) => ReturnType<FastifyInstance['inject']>;
}

export const direccion = {
  direccion: 'Av. Santa Fe 4100',
  localidad: 'Palermo',
  provincia: 'Buenos Aires',
  codigoPostal: '1425',
  lat: -34.585,
  lng: -58.42,
};

export const datosCliente = { email: 'cli@p6.vedere', nombre: 'Ana Pérez', dni: '30123456', telefono: '+54 11 5555-1234' };

/** Vacía todas las tablas del esquema (menos las migraciones). */
export async function limpiarBase(prisma: PrismaClient) {
  const tablas = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
  await prisma.$executeRawUnsafe('ALTER SEQUENCE pedidos_numero_seq RESTART WITH 60001');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE pedidos_mayoristas_numero_seq RESTART WITH 10001');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE pedidos_mayoristas_remito_seq RESTART WITH 1');
}

export async function crearContexto(envExtra: Record<string, string> = {}): Promise<Contexto> {
  const db = await import('@vedere/db');
  const prisma = db.prisma;
  const { buildApp } = await import('../src/app.js');
  const app = await buildApp({
    env: testEnv({
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      STORAGE_DRIVER: 'local',
      ADMIN_NOTIFY_EMAIL: 'equipo@p6.vedere',
      ...envExtra,
    }),
    logger: false,
  });
  await app.ready();
  await limpiarBase(prisma);

  const admin = await prisma.user.create({ data: { email: 'admin@p6.vedere', nombre: 'Admin P6', rol: 'ADMIN', passwordHash: 'x' } });
  const cliente = await prisma.user.create({ data: { email: datosCliente.email, nombre: datosCliente.nombre, rol: 'CLIENTE', passwordHash: 'x' } });
  const staffCookie = { vedere_access: app.jwt.sign({ sub: admin.id, email: admin.email, rol: 'ADMIN', nombre: admin.nombre }) };
  const clienteCookie = { vedere_access: app.jwt.sign({ sub: cliente.id, email: cliente.email, rol: 'CLIENTE', nombre: cliente.nombre }) };

  const optica = await prisma.optica.create({
    data: { nombre: 'Óptica Centro', slug: 'optica-centro', direccion: 'Av. Rivadavia 4900', localidad: 'Caballito', provincia: 'Buenos Aires', codigoPostal: '1424', lat: -34.6177, lng: -58.4367, radioKm: 15, email: 'centro@p6.vedere' },
  });
  const coleccion = await prisma.coleccion.create({ data: { nombre: 'Verano', slug: 'verano', colorHex: '#F2B33D' } });
  const marca = await prisma.marca.create({ data: { nombre: 'Vedere Lab', slug: 'vedere-lab' } });
  const sol = await prisma.producto.create({
    data: {
      nombre: 'Sol A',
      slug: 'sol-a',
      descripcion: 'Anteojos de sol con lentes polarizados.',
      linea: 'SOL',
      precio: 90000,
      precioLista: 100000,
      estado: 'PUBLICADO',
      publicadoEn: new Date(),
      coleccionId: coleccion.id,
      marcaId: marca.id,
      variantes: { create: [{ sku: 'P6-SOL-A-NEG', colorArmazon: 'Negro', stock: 5, imagenes: { create: [{ url: 'https://media.test/sol-a.webp', tipo: 'FRENTE' }] } }, { sku: 'P6-SOL-A-CAR', colorArmazon: 'Carey', stock: 0 }] },
    },
    include: { variantes: { orderBy: { sku: 'asc' } } },
  });
  const recetado = await prisma.producto.create({
    data: {
      nombre: 'Recetado R',
      slug: 'recetado-r',
      linea: 'RECETADO',
      precio: 120000,
      estado: 'PUBLICADO',
      publicadoEn: new Date(),
      coleccionId: coleccion.id,
      permiteReceta: true,
      variantes: { create: [{ sku: 'P6-REC-R', colorArmazon: 'Negro', stock: 5 }] },
    },
    include: { variantes: true },
  });
  await prisma.configTienda.create({
    data: {
      id: 'default',
      descuentoTransferencia: 0,
      costoEnvio: 9900,
      cbu: '0170001540000001234567',
      alias: 'vedere.pagos',
      titularCuenta: 'Vedere SAS',
      banco: 'Banco Test',
      razonSocial: 'Vedere S.A.S.',
      cuit: '30-00000000-0',
      domicilioFiscal: 'Av. Siempreviva 742, CABA',
      condicionIva: 'IVA Responsable Inscripto',
    },
  });

  const inject: Contexto['inject'] = (method, url, cookies, payload, headers) =>
    app.inject({ method, url, ...(cookies ? { cookies } : {}), ...(payload !== undefined ? { payload } : {}), ...(headers ? { headers } : {}) });

  return {
    app,
    prisma,
    staffCookie,
    clienteCookie,
    ids: { admin: admin.id, cliente: cliente.id, optica: optica.id, coleccion: coleccion.id, solA: sol.variantes.find((v) => v.sku === 'P6-SOL-A-NEG')!.id, recetado: recetado.variantes[0]!.id, productoSol: sol.id, productoRecetado: recetado.id },
    inject,
  };
}

export interface PedidoCreado {
  id: string;
  numero: string;
  estado: string;
}

/** Crea un pedido por transferencia (con sesión de cliente si se indica). */
export async function crearPedido(
  ctx: Contexto,
  opts: { items?: Array<{ varianteId: string; cantidad: number }>; conSesion?: boolean; email?: string; nombre?: string; cupon?: string; modalidad?: 'RETIRO_OPTICA' | 'ENVIO_DOMICILIO' } = {},
): Promise<PedidoCreado> {
  const items = opts.items ?? [{ varianteId: ctx.ids.solA, cantidad: 1 }];
  const res = await ctx.inject('POST', '/checkout/pedidos', opts.conSesion === false ? undefined : ctx.clienteCookie, {
    datos: { ...datosCliente, email: opts.email ?? datosCliente.email, nombre: opts.nombre ?? datosCliente.nombre },
    entrega: { modalidad: opts.modalidad ?? 'RETIRO_OPTICA', opticaId: ctx.ids.optica, direccion },
    pago: { metodo: 'TRANSFERENCIA' },
    items,
    receta: items.some((i) => i.varianteId === ctx.ids.recetado) ? { modo: 'OPTICA' } : undefined,
    cupon: opts.cupon ?? null,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().pedido as PedidoCreado;
}

export async function aprobarPago(ctx: Contexto, id: string) {
  const res = await ctx.inject('POST', `/admin/pedidos/${id}/pago/aprobar`, ctx.staffCookie, { nota: 'transferencia vista' });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { id: string; estado: string; estadoPago: string };
}

export async function crearPedidoPagado(ctx: Contexto, opts: Parameters<typeof crearPedido>[1] = {}) {
  const p = await crearPedido(ctx, opts);
  await aprobarPago(ctx, p.id);
  return p;
}

export async function emailsDe(prisma: PrismaClient, where: { tipo?: string; para?: string; pedidoId?: string } = {}) {
  return prisma.emailEnviado.findMany({ where, orderBy: { createdAt: 'asc' } });
}
