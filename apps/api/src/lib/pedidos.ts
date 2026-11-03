// Servicio de pedidos: cotización del carrito (motor de promos + stock disponible), creación del
// pedido con reserva de stock, aprobación idempotente del pago (descuenta stock una sola vez),
// rechazo/reembolso/cancelación y serialización para la tienda y el admin.
import { prisma } from '@vedere/db';
import type { ConfigTienda, EstadoPago, MetodoPago, Prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { AppError, Errors } from './errors.js';
import { crearPreferencia, mpConfig, mpHabilitado, mapearEstado } from './mercadopago.js';
import type { MpPayment } from './mercadopago.js';
import { calcularCarrito, cuotasParaCarrito } from './promos.js';
import type { CuponPromo, ItemPromo, LineaPromo, ReglaPromo, ResultadoCalculo } from './promos.js';
import { disponibilidad, liberarReservasVencidas } from './reservas.js';
import { dec } from './serialize.js';
import type { pedidoInput, recetaInput } from '../schemas/checkout.js';
import type { z } from 'zod';

type Db = Prisma.TransactionClient | typeof prisma;

export const LINEAS_CON_RECETA: LineaPromo[] = ['RECETADO', 'MULTIFOCAL'];

// ---------- Configuración ----------

export async function cargarConfig(db: Db = prisma): Promise<ConfigTienda> {
  return db.configTienda.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
}

export function cuotasConfig(cfg: ConfigTienda) {
  const porLinea = (cfg.cuotasPorLinea ?? {}) as Partial<Record<LineaPromo, number>>;
  return { cuotasGeneral: cfg.cuotasGeneral, cuotasPorLinea: porLinea };
}

/** Configuración visible para el checkout (sin datos internos). */
export function configPublica(cfg: ConfigTienda, env: Env) {
  const mp = mpHabilitado(env) && cfg.mpHabilitado;
  return {
    mercadoPago: mp,
    mercadoPagoBilletera: mp && cfg.mpBilleteraHabilitada,
    transferencia: cfg.transferenciaHabilitada
      ? {
          cbu: cfg.cbu,
          alias: cfg.alias,
          titular: cfg.titularCuenta,
          banco: cfg.banco,
          descuento: dec(cfg.descuentoTransferencia) ?? 0,
          horasReserva: cfg.transferenciaHorasReserva,
        }
      : null,
    cuotas: cuotasConfig(cfg),
    costoEnvio: dec(cfg.costoEnvio) ?? 0,
    places: !!env.GOOGLE_MAPS_API_KEY,
    reservaMinutos: env.RESERVA_STOCK_MINUTOS,
  };
}

// ---------- Ítems ----------

export interface ItemDetalle extends ItemPromo {
  slug: string;
  sku: string;
  color: string;
  colorHex: string | null;
  imagen: string | null;
  conReceta: boolean;
  stock: number;
  disponible: number;
  permiteReceta: boolean;
}

export async function cargarItems(
  items: Array<{ varianteId: string; cantidad: number; conReceta?: boolean }>,
  db: Db = prisma,
  opts: { excluirPedidoId?: string } = {},
): Promise<ItemDetalle[]> {
  // Unificar duplicados.
  const porVariante = new Map<string, { cantidad: number; conReceta: boolean }>();
  for (const it of items) {
    const prev = porVariante.get(it.varianteId);
    porVariante.set(it.varianteId, {
      cantidad: Math.min(10, (prev?.cantidad ?? 0) + it.cantidad),
      conReceta: !!(prev?.conReceta || it.conReceta),
    });
  }
  const ids = [...porVariante.keys()];
  const variantes = await db.variante.findMany({
    where: { id: { in: ids } },
    include: {
      producto: { include: { categorias: { select: { id: true } } } },
      imagenes: { orderBy: { orden: 'asc' }, take: 1 },
    },
  });
  const faltantes = ids.filter((id) => !variantes.some((v) => v.id === id));
  if (faltantes.length) {
    throw Errors.badRequest('Algunos productos del carrito ya no están disponibles', {
      noDisponibles: faltantes,
    });
  }
  const noDisponibles = variantes.filter((v) => !v.activa || v.producto.estado !== 'PUBLICADO');
  if (noDisponibles.length) {
    throw Errors.badRequest('Algunos productos del carrito ya no están disponibles', {
      noDisponibles: noDisponibles.map((v) => v.id),
    });
  }
  const disp = await disponibilidad(variantes, db, opts.excluirPedidoId);
  return ids.map((id) => {
    const v = variantes.find((x) => x.id === id)!;
    const pedido = porVariante.get(id)!;
    const img = v.imagenes[0];
    return {
      varianteId: v.id,
      productoId: v.productoId,
      slug: v.producto.slug,
      nombre: v.producto.nombre,
      sku: v.sku,
      color: v.colorArmazon,
      colorHex: v.colorArmazonHex,
      imagen: img?.urlMiniatura ?? img?.urlMediana ?? img?.url ?? null,
      precio: dec(v.producto.precio) ?? 0,
      precioLista: dec(v.producto.precioLista),
      cantidad: pedido.cantidad,
      conReceta: pedido.conReceta,
      linea: v.producto.linea,
      coleccionId: v.producto.coleccionId,
      categoriaIds: v.producto.categorias.map((c) => c.id),
      stock: v.stock,
      disponible: disp.get(v.id) ?? 0,
      permiteReceta: v.producto.permiteReceta,
    };
  });
}

// ---------- Reglas y cupones ----------

export async function cargarReglas(db: Db = prisma, ahora = new Date()): Promise<ReglaPromo[]> {
  const filas = await db.promocion.findMany({
    where: {
      activa: true,
      OR: [{ vigenciaDesde: null }, { vigenciaDesde: { lte: ahora } }],
      AND: [{ OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: ahora } }] }],
    },
    orderBy: { prioridad: 'asc' },
  });
  return filas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    linea: p.linea,
    coleccionId: p.coleccionId,
    montoMinimo: dec(p.montoMinimo),
    acumulable: p.acumulable,
    prioridad: p.prioridad,
  }));
}

export interface CuponCargado {
  id: string;
  promo: CuponPromo;
  creadorId: string | null;
}

/** Valida un cupón (vigencia, usos totales y por cliente). Lanza AppError si no sirve. */
export async function cargarCupon(
  codigo: string,
  ctx: { email?: string | null },
  db: Db = prisma,
  ahora = new Date(),
): Promise<CuponCargado> {
  const c = await db.cupon.findUnique({
    where: { codigo: codigo.trim().toUpperCase() },
    include: { categorias: { select: { id: true } }, colecciones: { select: { id: true } } },
  });
  if (!c || !c.activo) throw Errors.notFound('Ese cupón no existe o ya no está vigente');
  if (c.vigenciaDesde && c.vigenciaDesde > ahora) throw Errors.badRequest('Ese cupón todavía no está vigente');
  if (c.vigenciaHasta && c.vigenciaHasta < ahora) throw Errors.badRequest('Ese cupón ya venció');
  if (c.usosMax !== null && c.usos >= c.usosMax) throw Errors.badRequest('Ese cupón ya alcanzó el máximo de usos');
  if (c.usosMaxPorCliente !== null && ctx.email) {
    const usados = await db.cuponUso.count({
      where: { cuponId: c.id, email: ctx.email.toLowerCase(), pedido: { estado: { not: 'CANCELADO' } } },
    });
    if (usados >= c.usosMaxPorCliente) throw Errors.badRequest('Ya usaste este cupón el máximo de veces');
  }
  return {
    id: c.id,
    creadorId: c.creadorId,
    promo: {
      id: c.id,
      codigo: c.codigo,
      descripcion: c.descripcion,
      tipo: c.tipo,
      valor: dec(c.valor) ?? 0,
      minimoCompra: dec(c.minimoCompra),
      acumulable: c.acumulable,
      categoriaIds: c.categorias.map((x) => x.id),
      coleccionIds: c.colecciones.map((x) => x.id),
    },
  };
}

// ---------- Cotización ----------

export interface Cotizacion {
  items: Array<ItemDetalle & { descuento: number; total: number }>;
  totales: ResultadoCalculo;
  cupon: CuponPromo | null;
  cuponError: string | null;
  requiereReceta: boolean;
  lineas: LineaPromo[];
  cuotas: { cantidad: number; valorCuota: number };
  sinStock: Array<{ varianteId: string; disponible: number }>;
}

export async function cotizar(
  input: {
    items: Array<{ varianteId: string; cantidad: number; conReceta?: boolean }>;
    cupon?: string | null;
    modalidad: 'RETIRO_OPTICA' | 'ENVIO_DOMICILIO';
    metodoPago?: MetodoPago | null;
    email?: string | null;
  },
  env: Env,
  db: Db = prisma,
): Promise<Cotizacion> {
  await liberarReservasVencidas(db);
  const [items, reglas, cfg] = await Promise.all([cargarItems(input.items, db), cargarReglas(db), cargarConfig(db)]);
  let cupon: CuponPromo | null = null;
  let cuponError: string | null = null;
  if (input.cupon) {
    try {
      cupon = (await cargarCupon(input.cupon, { email: input.email }, db)).promo;
    } catch (err) {
      cuponError = err instanceof AppError ? err.message : 'Cupón inválido';
    }
  }
  const totales = calcularCarrito({
    items,
    reglas,
    cupon,
    envio: { modalidad: input.modalidad, costo: dec(cfg.costoEnvio) ?? 0 },
    pago: input.metodoPago
      ? { metodo: input.metodoPago, descuentoTransferencia: dec(cfg.descuentoTransferencia) ?? 0 }
      : null,
  });
  const lineas = [...new Set(items.map((i) => i.linea))];
  const nCuotas = cuotasParaCarrito(lineas, cuotasConfig(cfg));
  return {
    items: items.map((i) => {
      const t = totales.items.find((x) => x.varianteId === i.varianteId);
      return { ...i, descuento: t?.descuento ?? 0, total: t?.total ?? i.precio * i.cantidad };
    }),
    totales,
    cupon,
    cuponError: cuponError ?? totales.cuponError,
    requiereReceta: items.some((i) => LINEAS_CON_RECETA.includes(i.linea)),
    lineas,
    cuotas: { cantidad: nCuotas, valorCuota: Math.ceil(totales.total / nCuotas) },
    sinStock: items.filter((i) => i.disponible < i.cantidad).map((i) => ({ varianteId: i.varianteId, disponible: i.disponible })),
  };
}

// ---------- Creación del pedido ----------

type PedidoBody = z.infer<typeof pedidoInput>;
type RecetaBody = z.infer<typeof recetaInput>;

export const pedidoInclude = {
  items: { orderBy: { id: 'asc' } },
  pagos: { orderBy: { createdAt: 'asc' } },
  optica: true,
  receta: true,
  cuponUso: { include: { cupon: { select: { codigo: true, creadorId: true } } } },
} satisfies Prisma.PedidoInclude;

export type PedidoFull = Prisma.PedidoGetPayload<{ include: typeof pedidoInclude }>;

async function siguienteNumero(db: Db): Promise<string> {
  const filas = await db.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT nextval('pedidos_numero_seq') AS n`,
  );
  return `VD-${Number(filas[0]?.n ?? 10001)}`;
}

async function crearReceta(receta: RecetaBody, userId: string | null, db: Db): Promise<string> {
  if (receta.modo === 'GUARDADA') {
    if (!userId) throw Errors.badRequest('Iniciá sesión para usar una receta guardada');
    const r = await db.receta.findFirst({ where: { id: receta.recetaId, userId } });
    if (!r) throw Errors.notFound('Receta no encontrada');
    return r.id;
  }
  // Si hay cuenta, la receta queda guardada para futuras compras.
  const data: Prisma.RecetaCreateInput = {
    modo: receta.modo,
    ...(userId ? { user: { connect: { id: userId } } } : {}),
  };
  if (receta.modo === 'VALORES') {
    Object.assign(data, {
      odEsfera: receta.valores.odEsfera,
      odCilindro: receta.valores.odCilindro,
      odEje: receta.valores.odEje,
      oiEsfera: receta.valores.oiEsfera,
      oiCilindro: receta.valores.oiCilindro,
      oiEje: receta.valores.oiEje,
      adicion: receta.valores.adicion ?? null,
      dp: receta.valores.dp ?? null,
      notas: receta.valores.notas ?? null,
    });
  } else if (receta.modo === 'ARCHIVO') {
    Object.assign(data, { archivoUrl: receta.archivoUrl, archivoNombre: receta.archivoNombre ?? null });
  }
  const r = await db.receta.create({ data });
  return r.id;
}

export interface PedidoCreado {
  pedido: PedidoFull;
  /** URL de pago de Mercado Pago (Checkout Pro), si corresponde. */
  initPoint: string | null;
}

export async function crearPedido(
  body: PedidoBody,
  ctx: { userId: string | null; env: Env; log?: { warn: (o: unknown, m?: string) => void } },
): Promise<PedidoCreado> {
  const { env } = ctx;
  const email = body.datos.email;

  const creado = await prisma.$transaction(async (tx) => {
    await liberarReservasVencidas(tx);
    const [items, reglas, cfg] = await Promise.all([cargarItems(body.items, tx), cargarReglas(tx), cargarConfig(tx)]);

    // Stock disponible (stock físico − reservas activas de otros).
    const sinStock = items.filter((i) => i.disponible < i.cantidad);
    if (sinStock.length) {
      throw Errors.conflict('No hay stock suficiente para algunos productos', {
        sinStock: sinStock.map((i) => ({ varianteId: i.varianteId, nombre: i.nombre, disponible: i.disponible })),
      });
    }

    // Receta obligatoria si hay recetados o multifocales.
    const requiereReceta = items.some((i) => LINEAS_CON_RECETA.includes(i.linea));
    if (requiereReceta && !body.receta) {
      throw Errors.badRequest('Elegí cómo cargar tu receta para continuar', [
        { path: 'receta', message: 'Cargá los valores, subí una foto o dejala para que la mida la óptica' },
      ]);
    }
    const multifocal = items.some((i) => i.linea === 'MULTIFOCAL');
    if (body.receta?.modo === 'VALORES' && multifocal && body.receta.valores.adicion == null) {
      throw Errors.badRequest('Para multifocales necesitamos la adición', [
        { path: 'receta.valores.adicion', message: 'Ingresá la adición (0,75 a 3,50)' },
      ]);
    }

    // Método de pago habilitado.
    const metodo = body.pago.metodo;
    const mp = mpHabilitado(env) && cfg.mpHabilitado;
    if ((metodo === 'MERCADO_PAGO' && !mp) || (metodo === 'MERCADO_PAGO_BILLETERA' && !(mp && cfg.mpBilleteraHabilitada))) {
      throw Errors.badRequest('Mercado Pago no está disponible en este momento', [
        { path: 'pago.metodo', message: 'Elegí otro medio de pago' },
      ]);
    }
    if (metodo === 'TRANSFERENCIA' && !cfg.transferenciaHabilitada) {
      throw Errors.badRequest('La transferencia no está disponible en este momento', [
        { path: 'pago.metodo', message: 'Elegí otro medio de pago' },
      ]);
    }

    // Óptica socia.
    const optica = await tx.optica.findFirst({ where: { id: body.entrega.opticaId, activa: true } });
    if (!optica) throw Errors.badRequest('La óptica elegida no está disponible', [{ path: 'entrega.opticaId', message: 'Elegí otra óptica' }]);

    // Cupón (lanza si no sirve) y motor de promos.
    const cupon = body.cupon ? await cargarCupon(body.cupon, { email }, tx) : null;
    const totales = calcularCarrito({
      items,
      reglas,
      cupon: cupon?.promo ?? null,
      envio: { modalidad: body.entrega.modalidad, costo: dec(cfg.costoEnvio) ?? 0 },
      pago: { metodo, descuentoTransferencia: dec(cfg.descuentoTransferencia) ?? 0 },
    });
    if (cupon && totales.cuponError) {
      throw Errors.badRequest(totales.cuponError, [{ path: 'cupon', message: totales.cuponError }]);
    }

    const recetaId = body.receta ? await crearReceta(body.receta, ctx.userId, tx) : null;
    const numero = await siguienteNumero(tx);
    const ahora = new Date();
    const expira =
      metodo === 'TRANSFERENCIA'
        ? new Date(ahora.getTime() + cfg.transferenciaHorasReserva * 3600_000)
        : new Date(ahora.getTime() + env.RESERVA_STOCK_MINUTOS * 60_000);
    const nCuotas = cuotasParaCarrito(
      [...new Set(items.map((i) => i.linea))],
      cuotasConfig(cfg),
    );
    const d = body.entrega.direccion;

    const pedido = await tx.pedido.create({
      data: {
        numero,
        estado: 'PENDIENTE_PAGO',
        userId: ctx.userId,
        email,
        nombre: body.datos.nombre,
        dni: body.datos.dni,
        telefono: body.datos.telefono,
        modalidad: body.entrega.modalidad,
        opticaId: optica.id,
        direccion: d.direccion,
        piso: d.piso ?? null,
        localidad: d.localidad,
        provincia: d.provincia,
        codigoPostal: d.codigoPostal,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        placeId: d.placeId ?? null,
        direccionCompleta: d.direccionCompleta ?? null,
        recetaId,
        subtotal: totales.subtotal,
        descuentos: totales.descuentoTotal,
        descuentosDetalle: totales.descuentos.map((x) => ({
          tipo: x.tipo,
          codigo: x.codigo ?? null,
          descripcion: x.descripcion,
          monto: x.monto,
        })) as Prisma.InputJsonValue,
        envio: totales.envio,
        total: totales.total,
        cuponCodigo: cupon?.promo.codigo ?? null,
        metodoPago: metodo,
        estadoPago: 'PENDIENTE',
        cuotas: metodo === 'TRANSFERENCIA' ? 1 : nCuotas,
        reservaExpiraEn: expira,
        notas: body.notas ?? null,
        items: {
          create: items.map((i) => {
            const t = totales.items.find((x) => x.varianteId === i.varianteId)!;
            return {
              varianteId: i.varianteId,
              productoId: i.productoId,
              nombre: i.nombre,
              sku: i.sku,
              color: i.color,
              imagen: i.imagen,
              linea: i.linea,
              precioUnitario: i.precio,
              precioLista: i.precioLista,
              cantidad: i.cantidad,
              descuento: t.descuento,
              total: t.total,
              conReceta: i.conReceta || LINEAS_CON_RECETA.includes(i.linea),
            };
          }),
        },
        reservas: {
          create: items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad, estado: 'ACTIVA', expiraEn: expira })),
        },
        pagos: {
          create: {
            metodo,
            proveedor: metodo === 'TRANSFERENCIA' ? 'transferencia' : 'mercadopago',
            estado: 'PENDIENTE',
            monto: totales.total,
          },
        },
        ...(cupon
          ? {
              cuponUso: {
                create: {
                  cuponId: cupon.id,
                  email,
                  monto: totales.descuentos.find((x) => x.tipo === 'CUPON')?.monto ?? 0,
                },
              },
            }
          : {}),
      },
      include: pedidoInclude,
    });
    if (cupon) await tx.cupon.update({ where: { id: cupon.id }, data: { usos: { increment: 1 } } });
    return pedido;
  });

  // Preferencia de Mercado Pago (fuera de la transacción: llamada externa).
  if (creado.metodoPago === 'TRANSFERENCIA') return { pedido: creado, initPoint: null };
  const cfg = mpConfig(env)!;
  try {
    const web = env.WEB_URL.replace(/\/$/, '');
    const pref = await crearPreferencia(cfg, {
      pedidoId: creado.id,
      numero: creado.numero,
      total: dec(creado.total) ?? 0,
      items: [
        {
          id: creado.numero,
          title: `Pedido ${creado.numero} · Vedere`,
          description: creado.items.map((i) => `${i.cantidad}× ${i.nombre} ${i.color}`).join(', ').slice(0, 250),
          category_id: 'fashion',
          quantity: 1,
          unit_price: Math.round((dec(creado.total) ?? 0) * 100) / 100,
          currency_id: 'ARS',
        },
      ],
      pagador: { email, nombre: creado.nombre, dni: creado.dni, telefono: creado.telefono },
      cuotas: creado.cuotas,
      backUrls: {
        success: `${web}/gracias/${creado.id}?status=success`,
        pending: `${web}/gracias/${creado.id}?status=pending`,
        failure: `${web}/gracias/${creado.id}?status=failure`,
      },
      notificationUrl: `${env.API_PUBLIC_URL.replace(/\/$/, '')}/checkout/mercadopago/webhook`,
      billetera: creado.metodoPago === 'MERCADO_PAGO_BILLETERA',
      expiraEn: creado.reservaExpiraEn ?? new Date(Date.now() + env.RESERVA_STOCK_MINUTOS * 60_000),
    });
    await prisma.pago.updateMany({
      where: { pedidoId: creado.id, proveedor: 'mercadopago', externoId: null },
      data: { preferenciaId: pref.id },
    });
    return { pedido: creado, initPoint: pref.init_point };
  } catch (err) {
    ctx.log?.warn({ err, pedidoId: creado.id }, 'No se pudo crear la preferencia de Mercado Pago');
    await cancelarPedido(creado.id, { motivo: 'Fallo al crear la preferencia de Mercado Pago' });
    throw err instanceof AppError ? err : new AppError(502, 'MP_ERROR', 'No pudimos iniciar el pago con Mercado Pago');
  }
}

// ---------- Transiciones de pago ----------

export interface PagoInfo {
  proveedor: 'mercadopago' | 'transferencia';
  externoId?: string | null;
  metodo: MetodoPago;
  monto: number;
  detalle?: Prisma.InputJsonValue;
  confirmadoPorId?: string | null;
  cuotas?: number | null;
}

async function registrarPago(tx: Prisma.TransactionClient, pedidoId: string, info: PagoInfo, estado: EstadoPago) {
  const datos = {
    estado,
    monto: info.monto,
    detalle: info.detalle,
    confirmadoPorId: info.confirmadoPorId ?? undefined,
  };
  if (info.externoId) {
    await tx.pago.upsert({
      where: { proveedor_externoId: { proveedor: info.proveedor, externoId: info.externoId } },
      update: datos,
      create: { pedidoId, metodo: info.metodo, proveedor: info.proveedor, externoId: info.externoId, ...datos },
    });
    return;
  }
  // Sin id externo (transferencia): se actualiza el intento pendiente del pedido.
  const pendiente = await tx.pago.findFirst({ where: { pedidoId, proveedor: info.proveedor }, orderBy: { createdAt: 'desc' } });
  if (pendiente) await tx.pago.update({ where: { id: pendiente.id }, data: datos });
  else await tx.pago.create({ data: { pedidoId, metodo: info.metodo, proveedor: info.proveedor, ...datos } });
}

/**
 * Aprueba el pago de un pedido. Idempotente: el stock se descuenta una sola vez (bandera
 * `stockDescontado` tomada con un UPDATE condicional), repetir la llamada no cambia nada.
 */
export async function aprobarPago(pedidoId: string, info: PagoInfo): Promise<{ pedido: PedidoFull; yaEstaba: boolean }> {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { items: true } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    await registrarPago(tx, pedidoId, info, 'APROBADO');

    const claim = await tx.pedido.updateMany({
      where: { id: pedidoId, stockDescontado: false },
      data: {
        stockDescontado: true,
        estadoPago: 'APROBADO',
        pagadoEn: new Date(),
        ...(pedido.estado === 'PENDIENTE_PAGO' ? { estado: 'CONFIRMADO' } : {}),
        ...(info.cuotas ? { cuotas: info.cuotas } : {}),
      },
    });
    if (claim.count === 0) {
      // Ya estaba aprobado (webhook repetido): sólo nos aseguramos del estado de pago.
      await tx.pedido.update({ where: { id: pedidoId }, data: { estadoPago: 'APROBADO' } });
      const p = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
      return { pedido: p, yaEstaba: true };
    }

    const faltantes: string[] = [];
    for (const item of pedido.items) {
      if (!item.varianteId) continue;
      const v = await tx.variante.update({
        where: { id: item.varianteId },
        data: { stock: { decrement: item.cantidad } },
        select: { stock: true, sku: true },
      });
      if (v.stock < 0) faltantes.push(`${v.sku} (${-v.stock})`);
      if (item.productoId) {
        await tx.producto.update({ where: { id: item.productoId }, data: { vendidos: { increment: item.cantidad } } });
      }
    }
    await tx.reservaStock.updateMany({ where: { pedidoId, estado: 'ACTIVA' }, data: { estado: 'CONSUMIDA' } });
    if (faltantes.length) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          notasInternas: `${pedido.notasInternas ? pedido.notasInternas + '\n' : ''}Stock insuficiente al confirmar el pago: ${faltantes.join(', ')}`,
        },
      });
    }
    const p = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
    return { pedido: p, yaEstaba: false };
  });
}

/** Rechazo: el pedido sigue pendiente (puede reintentar) salvo que ya esté aprobado. */
export async function rechazarPago(pedidoId: string, info: PagoInfo): Promise<PedidoFull> {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    await registrarPago(tx, pedidoId, info, 'RECHAZADO');
    if (pedido.estadoPago !== 'APROBADO') {
      await tx.pedido.update({ where: { id: pedidoId }, data: { estadoPago: 'RECHAZADO' } });
    }
    return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
  });
}

/** Reembolso / contracargo: repone stock si se había descontado y cancela el pedido. */
export async function reembolsarPago(pedidoId: string, info: PagoInfo): Promise<PedidoFull> {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { items: true } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    await registrarPago(tx, pedidoId, info, 'REEMBOLSADO');
    if (pedido.estadoPago === 'REEMBOLSADO') {
      return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
    }
    if (pedido.stockDescontado) await reponerStock(tx, pedido.items);
    await tx.reservaStock.updateMany({ where: { pedidoId, estado: 'ACTIVA' }, data: { estado: 'LIBERADA' } });
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { estadoPago: 'REEMBOLSADO', estado: 'CANCELADO', stockDescontado: false },
    });
    return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
  });
}

async function reponerStock(tx: Prisma.TransactionClient, items: Array<{ varianteId: string | null; productoId: string | null; cantidad: number }>) {
  for (const item of items) {
    if (item.varianteId) {
      await tx.variante.updateMany({ where: { id: item.varianteId }, data: { stock: { increment: item.cantidad } } });
    }
    if (item.productoId) {
      await tx.producto.updateMany({ where: { id: item.productoId }, data: { vendidos: { decrement: item.cantidad } } });
    }
  }
}

/** Cancela un pedido: libera reservas, repone stock si ya estaba descontado y devuelve el uso del cupón. */
export async function cancelarPedido(pedidoId: string, opts: { motivo?: string; porId?: string | null } = {}): Promise<PedidoFull> {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { items: true, cuponUso: true } });
    if (!pedido) throw Errors.notFound('Pedido no encontrado');
    if (pedido.estado === 'CANCELADO') {
      return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
    }
    await tx.reservaStock.updateMany({ where: { pedidoId, estado: 'ACTIVA' }, data: { estado: 'LIBERADA' } });
    if (pedido.stockDescontado) await reponerStock(tx, pedido.items);
    if (pedido.cuponUso) {
      await tx.cupon.updateMany({ where: { id: pedido.cuponUso.cuponId, usos: { gt: 0 } }, data: { usos: { decrement: 1 } } });
    }
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'CANCELADO',
        stockDescontado: false,
        notasInternas: opts.motivo
          ? `${pedido.notasInternas ? pedido.notasInternas + '\n' : ''}Cancelado: ${opts.motivo}`
          : pedido.notasInternas,
      },
    });
    return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: pedidoInclude });
  });
}

/** Procesa un pago de Mercado Pago (desde el webhook o una consulta manual). Idempotente. */
export async function procesarPagoMP(payment: MpPayment): Promise<{ pedido: PedidoFull | null; estado: EstadoPago; yaEstaba: boolean }> {
  const pedidoId = payment.external_reference ?? (payment.metadata?.pedido_id as string | undefined) ?? null;
  const estado = mapearEstado(payment.status);
  if (!pedidoId) return { pedido: null, estado, yaEstaba: false };
  const existe = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { id: true, metodoPago: true } });
  if (!existe) return { pedido: null, estado, yaEstaba: false };
  const info: PagoInfo = {
    proveedor: 'mercadopago',
    externoId: String(payment.id),
    metodo: existe.metodoPago,
    monto: payment.transaction_amount ?? 0,
    cuotas: payment.installments ?? null,
    detalle: {
      status: payment.status,
      status_detail: payment.status_detail ?? null,
      payment_method_id: payment.payment_method_id ?? null,
      payment_type_id: payment.payment_type_id ?? null,
      installments: payment.installments ?? null,
      date_approved: payment.date_approved ?? null,
      payer_email: payment.payer?.email ?? null,
    },
  };
  if (estado === 'APROBADO') {
    const r = await aprobarPago(pedidoId, info);
    return { pedido: r.pedido, estado, yaEstaba: r.yaEstaba };
  }
  if (estado === 'RECHAZADO') return { pedido: await rechazarPago(pedidoId, info), estado, yaEstaba: false };
  if (estado === 'REEMBOLSADO') return { pedido: await reembolsarPago(pedidoId, info), estado, yaEstaba: false };
  // Pendiente / en proceso: se registra el intento sin tocar el pedido.
  await prisma.$transaction((tx) => registrarPago(tx, pedidoId, info, 'PENDIENTE'));
  return { pedido: await prisma.pedido.findUnique({ where: { id: pedidoId }, include: pedidoInclude }), estado, yaEstaba: false };
}

// ---------- Serialización ----------

export function serializeReceta(r: NonNullable<PedidoFull['receta']>) {
  return {
    id: r.id,
    modo: r.modo,
    odEsfera: dec(r.odEsfera),
    odCilindro: dec(r.odCilindro),
    odEje: r.odEje,
    oiEsfera: dec(r.oiEsfera),
    oiCilindro: dec(r.oiCilindro),
    oiEje: r.oiEje,
    adicion: dec(r.adicion),
    dp: dec(r.dp),
    archivoUrl: r.archivoUrl,
    archivoNombre: r.archivoNombre,
    notas: r.notas,
    createdAt: r.createdAt,
  };
}

export function serializePedido(p: PedidoFull, opts: { admin?: boolean } = {}) {
  const pagoActual = p.pagos[p.pagos.length - 1] ?? null;
  const base = {
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    estadoPago: p.estadoPago,
    metodoPago: p.metodoPago,
    cuotas: p.cuotas,
    createdAt: p.createdAt,
    pagadoEn: p.pagadoEn,
    reservaExpiraEn: p.reservaExpiraEn,
    cliente: { email: p.email, nombre: p.nombre, dni: p.dni, telefono: p.telefono },
    entrega: {
      modalidad: p.modalidad,
      direccion: p.direccion,
      piso: p.piso,
      localidad: p.localidad,
      provincia: p.provincia,
      codigoPostal: p.codigoPostal,
      lat: p.lat,
      lng: p.lng,
      direccionCompleta: p.direccionCompleta,
      optica: p.optica
        ? {
            id: p.optica.id,
            nombre: p.optica.nombre,
            slug: p.optica.slug,
            direccion: p.optica.direccion,
            localidad: p.optica.localidad,
            provincia: p.optica.provincia,
            horarios: p.optica.horarios,
            whatsapp: p.optica.whatsapp,
            telefono: p.optica.telefono,
          }
        : null,
    },
    items: p.items.map((i) => ({
      id: i.id,
      varianteId: i.varianteId,
      productoId: i.productoId,
      nombre: i.nombre,
      sku: i.sku,
      color: i.color,
      imagen: i.imagen,
      linea: i.linea,
      precioUnitario: dec(i.precioUnitario) ?? 0,
      precioLista: dec(i.precioLista),
      cantidad: i.cantidad,
      descuento: dec(i.descuento) ?? 0,
      total: dec(i.total) ?? 0,
      conReceta: i.conReceta,
    })),
    totales: {
      subtotal: dec(p.subtotal) ?? 0,
      descuentos: dec(p.descuentos) ?? 0,
      envio: dec(p.envio) ?? 0,
      total: dec(p.total) ?? 0,
      detalle: (p.descuentosDetalle ?? []) as Array<{ tipo: string; codigo: string | null; descripcion: string; monto: number }>,
    },
    cuponCodigo: p.cuponCodigo,
    receta: p.receta ? serializeReceta(p.receta) : null,
    notas: p.notas,
    numeroFactura: p.numeroFactura,
    pago: pagoActual
      ? {
          id: pagoActual.id,
          estado: pagoActual.estado,
          proveedor: pagoActual.proveedor,
          preferenciaId: pagoActual.preferenciaId,
          comprobanteUrl: pagoActual.comprobanteUrl,
          comprobanteNombre: pagoActual.comprobanteNombre,
          comprobanteSubidoEn: pagoActual.comprobanteSubidoEn,
        }
      : null,
  };
  if (!opts.admin) return base;
  return {
    ...base,
    userId: p.userId,
    placeId: p.placeId,
    stockDescontado: p.stockDescontado,
    notasInternas: p.notasInternas,
    updatedAt: p.updatedAt,
    creadorId: p.cuponUso?.cupon.creadorId ?? null,
    pagos: p.pagos.map((pg) => ({
      id: pg.id,
      metodo: pg.metodo,
      proveedor: pg.proveedor,
      externoId: pg.externoId,
      preferenciaId: pg.preferenciaId,
      estado: pg.estado,
      monto: dec(pg.monto) ?? 0,
      detalle: pg.detalle,
      comprobanteUrl: pg.comprobanteUrl,
      comprobanteNombre: pg.comprobanteNombre,
      comprobanteSubidoEn: pg.comprobanteSubidoEn,
      confirmadoPorId: pg.confirmadoPorId,
      createdAt: pg.createdAt,
      updatedAt: pg.updatedAt,
    })),
  };
}
