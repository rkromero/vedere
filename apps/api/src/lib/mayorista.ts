// B2B 2: canal mayorista. Precio por óptica (precioMayorista × (1 − descuentoPct)), compra mínima,
// carrito del portal (separado del de la tienda), pedidos VM-10001 y su ciclo:
// PENDIENTE_APROBACION → APROBADO (reserva stock con ReservaStock, igual que la tienda) → DESPACHADO
// (descuenta el stock y consume la reserva) → ENTREGADO. CANCELADO libera la reserva.
import { prisma } from '@vedere/db';
import type { ConfigMayorista, Optica, Prisma, TipoMinimoMayorista } from '@vedere/db';
import { EN_MAYORISTA } from './canales.js';
import { AppError, Errors } from './errors.js';
import { disponibilidad } from './reservas.js';
import { dec } from './serialize.js';

type Db = Prisma.TransactionClient | typeof prisma;

/** Las reservas de un pedido mayorista aprobado duran hasta el despacho (no vencen solas en la práctica). */
const DIAS_RESERVA_MAYORISTA = 60;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Producto disponible en el canal mayorista: publicado, visible para ópticas y con precio mayorista. */
export const VENDIBLE_MAYORISTA = { ...EN_MAYORISTA, precioMayorista: { not: null } } satisfies Prisma.ProductoWhereInput;

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------

export async function getConfigMayorista(db: Db = prisma): Promise<ConfigMayorista> {
  return db.configMayorista.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
}

export function serializeConfigMayorista(c: ConfigMayorista) {
  return {
    ivaPct: dec(c.ivaPct)!,
    minimoTipo: c.minimoTipo,
    minimoValor: dec(c.minimoValor)!,
    envioHabilitado: c.envioHabilitado,
    envioModo: c.envioModo,
    envioCosto: dec(c.envioCosto)!,
    retiroHabilitado: c.retiroHabilitado,
    retiroDireccion: c.retiroDireccion,
    retiroHorario: c.retiroHorario,
    updatedAt: c.updatedAt,
  };
}

export interface MinimoEfectivo {
  tipo: TipoMinimoMayorista;
  valor: number;
  /** true si sale de la óptica (valor distinto al general). */
  propio: boolean;
}

/** Compra mínima que aplica a la óptica: la propia si la tiene cargada, si no la general. */
export function minimoDe(optica: Pick<Optica, 'minimoTipo' | 'minimoValor'>, cfg: ConfigMayorista): MinimoEfectivo {
  if (optica.minimoTipo) {
    return { tipo: optica.minimoTipo, valor: dec(optica.minimoValor) ?? 0, propio: true };
  }
  return { tipo: cfg.minimoTipo, valor: dec(cfg.minimoValor) ?? 0, propio: false };
}

export interface EstadoMinimo {
  tipo: TipoMinimoMayorista;
  valor: number;
  propio: boolean;
  cumple: boolean;
  /** Unidades o pesos (sin IVA) que faltan; 0 si cumple. */
  falta: number;
  mensaje: string | null;
}

const fmtPesos = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export function evaluarMinimo(min: MinimoEfectivo, unidades: number, subtotal: number): EstadoMinimo {
  if (min.tipo === 'NINGUNO' || min.valor <= 0) {
    return { ...min, cumple: true, falta: 0, mensaje: null };
  }
  if (min.tipo === 'UNIDADES') {
    const falta = Math.max(0, Math.ceil(min.valor) - unidades);
    return {
      ...min,
      cumple: falta === 0,
      falta,
      mensaje:
        falta === 0
          ? null
          : `La compra mínima es de ${Math.ceil(min.valor)} unidades: te ${falta === 1 ? 'falta 1 unidad' : `faltan ${falta} unidades`}.`,
    };
  }
  const falta = round2(Math.max(0, min.valor - subtotal));
  return {
    ...min,
    cumple: falta === 0,
    falta,
    mensaje: falta === 0 ? null : `La compra mínima es de ${fmtPesos(min.valor)} + IVA: te faltan ${fmtPesos(falta)}.`,
  };
}

// ------------------------------------------------------------------
// Precio que ve cada óptica
// ------------------------------------------------------------------

export interface PrecioOptica {
  /** Precio mayorista de lista, sin IVA. */
  lista: number;
  descuentoPct: number;
  /** Precio para esta óptica, sin IVA. */
  unitario: number;
  iva: number;
  conIva: number;
  ivaPct: number;
  /** Precio sugerido al público (precio web, con IVA). */
  sugerido: number;
  /** Ganancia estimada por unidad y margen sobre el precio de venta sin IVA. */
  ganancia: number;
  margenPct: number | null;
}

export function precioParaOptica(
  producto: { precioMayorista: Prisma.Decimal | number | null; precio: Prisma.Decimal | number },
  descuentoPct: number,
  ivaPct: number,
): PrecioOptica | null {
  const lista = dec(producto.precioMayorista);
  if (lista === null) return null;
  const unitario = round2(lista * (1 - descuentoPct / 100));
  const iva = round2((unitario * ivaPct) / 100);
  const sugerido = dec(producto.precio)!;
  const ventaSinIva = sugerido / (1 + ivaPct / 100);
  const ganancia = round2(ventaSinIva - unitario);
  return {
    lista,
    descuentoPct,
    unitario,
    iva,
    conIva: round2(unitario + iva),
    ivaPct,
    sugerido,
    ganancia,
    margenPct: ventaSinIva > 0 ? round2((ganancia / ventaSinIva) * 100) : null,
  };
}

// ------------------------------------------------------------------
// Catálogo
// ------------------------------------------------------------------

export const productoMayoristaInclude = {
  marca: { select: { id: true, nombre: true, slug: true } },
  coleccion: { select: { id: true, nombre: true, slug: true } },
  categorias: { select: { id: true, nombre: true, slug: true } },
  variantes: {
    where: { activa: true },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    include: { imagenes: { orderBy: { orden: 'asc' } } },
  },
} satisfies Prisma.ProductoInclude;

export type ProductoMayorista = Prisma.ProductoGetPayload<{ include: typeof productoMayoristaInclude }>;

/** Serializa un producto para el portal: nunca incluye datos de otra óptica ni el descuento de otra. */
export function serializeProductoMayorista(
  p: ProductoMayorista,
  ctx: { descuentoPct: number; ivaPct: number; disponible: Map<string, number> },
) {
  const precio = precioParaOptica(p, ctx.descuentoPct, ctx.ivaPct);
  return {
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    descripcion: p.descripcion,
    linea: p.linea,
    forma: p.forma,
    material: p.material,
    genero: p.genero,
    calibreMm: p.calibreMm,
    puenteMm: p.puenteMm,
    varillaMm: p.varillaMm,
    marca: p.marca,
    coleccion: p.coleccion,
    categorias: p.categorias,
    precio,
    variantes: p.variantes.map((v) => {
      const disponible = ctx.disponible.get(v.id) ?? 0;
      return {
        id: v.id,
        sku: v.sku,
        colorArmazon: v.colorArmazon,
        colorArmazonHex: v.colorArmazonHex,
        colorLente: v.colorLente,
        colorLenteHex: v.colorLenteHex,
        disponible,
        imagen: v.imagenes[0]?.urlMediana ?? v.imagenes[0]?.url ?? null,
        imagenes: v.imagenes.map((i) => ({
          id: i.id,
          url: i.url,
          urlMediana: i.urlMediana,
          urlMiniatura: i.urlMiniatura,
          alt: i.alt,
          tipo: i.tipo,
        })),
      };
    }),
  };
}

export async function disponibleDeProductos(productos: Array<{ variantes: Array<{ id: string; stock: number }> }>, db: Db = prisma) {
  return disponibilidad(
    productos.flatMap((p) => p.variantes.map((v) => ({ id: v.id, stock: v.stock }))),
    db,
  );
}

// ------------------------------------------------------------------
// Carrito del portal
// ------------------------------------------------------------------

export interface ItemCarrito {
  varianteId: string;
  cantidad: number;
}

function normalizarItems(raw: unknown): ItemCarrito[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, number>();
  for (const it of raw) {
    const v = it as Partial<ItemCarrito>;
    if (typeof v?.varianteId !== 'string') continue;
    const c = Math.floor(Number(v.cantidad));
    if (!Number.isFinite(c) || c <= 0) continue;
    map.set(v.varianteId, (map.get(v.varianteId) ?? 0) + c);
  }
  return [...map].map(([varianteId, cantidad]) => ({ varianteId, cantidad }));
}

export async function leerCarrito(userId: string, db: Db = prisma): Promise<ItemCarrito[]> {
  const c = await db.carritoMayorista.findUnique({ where: { userId } });
  return normalizarItems(c?.items);
}

export async function guardarCarrito(userId: string, items: ItemCarrito[], db: Db = prisma) {
  const limpios = normalizarItems(items);
  await db.carritoMayorista.upsert({
    where: { userId },
    create: { userId, items: limpios as unknown as Prisma.InputJsonValue },
    update: { items: limpios as unknown as Prisma.InputJsonValue },
  });
  return limpios;
}

export interface AjusteStock {
  varianteId: string;
  sku: string;
  nombre: string;
  color: string;
  pedida: number;
  disponible: number;
  /** "sin_stock" (no se agregó) o "ajustada" (se agregó lo disponible) o "no_disponible" (producto fuera del canal). */
  motivo: 'sin_stock' | 'ajustada' | 'no_disponible';
}

/**
 * Agrega (o reemplaza) cantidades en el carrito limitando cada variante a su stock disponible.
 * Devuelve el carrito resultante y los ajustes hechos (para avisar en pantalla).
 */
export async function cargarEnCarrito(
  userId: string,
  pedidos: ItemCarrito[],
  modo: 'sumar' | 'reemplazar',
  db: Db = prisma,
): Promise<{ items: ItemCarrito[]; ajustes: AjusteStock[] }> {
  const actuales = modo === 'sumar' ? await leerCarrito(userId, db) : [];
  const deseado = new Map(actuales.map((i) => [i.varianteId, i.cantidad]));
  for (const p of normalizarItems(pedidos)) {
    deseado.set(p.varianteId, modo === 'sumar' ? (deseado.get(p.varianteId) ?? 0) + p.cantidad : p.cantidad);
  }
  const ids = [...deseado.keys()];
  const variantes = await db.variante.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sku: true,
      stock: true,
      activa: true,
      colorArmazon: true,
      producto: { select: { nombre: true, estado: true, visibleMayorista: true, precioMayorista: true } },
    },
  });
  const porId = new Map(variantes.map((v) => [v.id, v]));
  const disp = await disponibilidad(variantes, db);
  const items: ItemCarrito[] = [];
  const ajustes: AjusteStock[] = [];
  for (const [varianteId, cantidad] of deseado) {
    const v = porId.get(varianteId);
    if (!v) continue;
    const base = { varianteId, sku: v.sku, nombre: v.producto.nombre, color: v.colorArmazon, pedida: cantidad };
    const vendible =
      v.activa && v.producto.estado === 'PUBLICADO' && v.producto.visibleMayorista && v.producto.precioMayorista !== null;
    if (!vendible) {
      ajustes.push({ ...base, disponible: 0, motivo: 'no_disponible' });
      continue;
    }
    const d = disp.get(varianteId) ?? 0;
    if (d <= 0) {
      ajustes.push({ ...base, disponible: 0, motivo: 'sin_stock' });
      continue;
    }
    if (cantidad > d) ajustes.push({ ...base, disponible: d, motivo: 'ajustada' });
    items.push({ varianteId, cantidad: Math.min(cantidad, d) });
  }
  await guardarCarrito(userId, items, db);
  return { items, ajustes };
}

export interface LineaCalculada {
  varianteId: string;
  productoId: string;
  slug: string;
  nombre: string;
  sku: string;
  color: string;
  imagen: string | null;
  cantidad: number;
  disponible: number;
  precioMayorista: number;
  precioUnitario: number;
  precioPublico: number;
  total: number;
}

export interface Cotizacion {
  lineas: LineaCalculada[];
  /** Variantes del carrito que ya no se pueden pedir (sin stock o fuera del canal). */
  problemas: AjusteStock[];
  unidades: number;
  subtotalLista: number;
  descuentoPct: number;
  descuento: number;
  subtotal: number;
  ivaPct: number;
  iva: number;
  total: number;
  minimo: EstadoMinimo;
}

/** Calcula el carrito con los precios de ESTA óptica (sin envío). */
export async function cotizarCarrito(
  items: ItemCarrito[],
  optica: Pick<Optica, 'descuentoPct' | 'minimoTipo' | 'minimoValor'>,
  cfg: ConfigMayorista,
  db: Db = prisma,
): Promise<Cotizacion> {
  const descuentoPct = dec(optica.descuentoPct) ?? 0;
  const ivaPct = dec(cfg.ivaPct) ?? 21;
  const variantes = await db.variante.findMany({
    where: { id: { in: items.map((i) => i.varianteId) } },
    include: {
      imagenes: { orderBy: { orden: 'asc' }, take: 1 },
      producto: { select: { id: true, slug: true, nombre: true, precio: true, precioMayorista: true, estado: true, visibleMayorista: true } },
    },
  });
  const porId = new Map(variantes.map((v) => [v.id, v]));
  const disp = await disponibilidad(variantes, db);
  const lineas: LineaCalculada[] = [];
  const problemas: AjusteStock[] = [];
  for (const it of items) {
    const v = porId.get(it.varianteId);
    if (!v) continue;
    const d = disp.get(v.id) ?? 0;
    const base = { varianteId: v.id, sku: v.sku, nombre: v.producto.nombre, color: v.colorArmazon, pedida: it.cantidad };
    const precio = precioParaOptica(v.producto, descuentoPct, ivaPct);
    const vendible = v.activa && v.producto.estado === 'PUBLICADO' && v.producto.visibleMayorista && precio;
    if (!vendible) {
      problemas.push({ ...base, disponible: 0, motivo: 'no_disponible' });
      continue;
    }
    if (d < it.cantidad) problemas.push({ ...base, disponible: d, motivo: d <= 0 ? 'sin_stock' : 'ajustada' });
    lineas.push({
      varianteId: v.id,
      productoId: v.producto.id,
      slug: v.producto.slug,
      nombre: v.producto.nombre,
      sku: v.sku,
      color: v.colorArmazon,
      imagen: v.imagenes[0]?.urlMiniatura ?? v.imagenes[0]?.url ?? null,
      cantidad: it.cantidad,
      disponible: d,
      precioMayorista: precio.lista,
      precioUnitario: precio.unitario,
      precioPublico: precio.sugerido,
      total: round2(precio.unitario * it.cantidad),
    });
  }
  const unidades = lineas.reduce((a, l) => a + l.cantidad, 0);
  const subtotalLista = round2(lineas.reduce((a, l) => a + l.precioMayorista * l.cantidad, 0));
  const subtotal = round2(lineas.reduce((a, l) => a + l.total, 0));
  const descuento = round2(subtotalLista - subtotal);
  const iva = round2((subtotal * ivaPct) / 100);
  return {
    lineas,
    problemas,
    unidades,
    subtotalLista,
    descuentoPct,
    descuento,
    subtotal,
    ivaPct,
    iva,
    total: round2(subtotal + iva),
    minimo: evaluarMinimo(minimoDe(optica, cfg), unidades, subtotal),
  };
}

/** Opciones de entrega para la óptica, con el costo de envío que corresponde. */
export function opcionesEntrega(optica: Pick<Optica, 'direccion' | 'localidad' | 'provincia' | 'codigoPostal'>, cfg: ConfigMayorista) {
  const envioCosto = dec(cfg.envioCosto) ?? 0;
  return {
    envio: cfg.envioHabilitado
      ? {
          direccion: `${optica.direccion}, ${optica.localidad}, ${optica.provincia} (CP ${optica.codigoPostal})`,
          modo: cfg.envioModo,
          costo: cfg.envioModo === 'COSTO_FIJO' ? envioCosto : 0,
        }
      : null,
    retiro: cfg.retiroHabilitado
      ? { direccion: cfg.retiroDireccion ?? 'Depósito Vedere (dirección a confirmar)', horario: cfg.retiroHorario }
      : null,
  };
}

// ------------------------------------------------------------------
// Pedidos
// ------------------------------------------------------------------

export const pedidoMayoristaInclude = {
  items: { orderBy: { nombre: 'asc' } },
  optica: { select: { id: true, nombre: true, slug: true, cuit: true, razonSocial: true, email: true, telefono: true } },
} satisfies Prisma.PedidoMayoristaInclude;

export type PedidoMayoristaFull = Prisma.PedidoMayoristaGetPayload<{ include: typeof pedidoMayoristaInclude }>;

export function serializePedidoMayorista(p: PedidoMayoristaFull, opts: { interno?: boolean } = {}) {
  return {
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    optica: p.optica,
    usuarioNombre: p.usuarioNombre,
    usuarioEmail: p.usuarioEmail,
    entrega: p.entrega,
    direccionEntrega: p.direccionEntrega,
    envioACargoOptica: p.envioACargoOptica,
    unidades: p.unidades,
    subtotalLista: dec(p.subtotalLista)!,
    descuentoPct: dec(p.descuentoPct)!,
    descuento: dec(p.descuento)!,
    subtotal: dec(p.subtotal)!,
    envio: dec(p.envio)!,
    ivaPct: dec(p.ivaPct)!,
    iva: dec(p.iva)!,
    total: dec(p.total)!,
    notas: p.notas,
    ...(opts.interno ? { notasInternas: p.notasInternas } : {}),
    motivoCancelacion: p.motivoCancelacion,
    repetidoDeId: p.repetidoDeId,
    numeroSeguimiento: p.numeroSeguimiento,
    aprobadoEn: p.aprobadoEn,
    despachadoEn: p.despachadoEn,
    entregadoEn: p.entregadoEn,
    canceladoEn: p.canceladoEn,
    createdAt: p.createdAt,
    items: p.items.map((i) => ({
      id: i.id,
      varianteId: i.varianteId,
      productoId: i.productoId,
      nombre: i.nombre,
      sku: i.sku,
      color: i.color,
      imagen: i.imagen,
      precioMayorista: dec(i.precioMayorista)!,
      descuentoPct: dec(i.descuentoPct)!,
      precioUnitario: dec(i.precioUnitario)!,
      precioPublico: dec(i.precioPublico),
      cantidad: i.cantidad,
      total: dec(i.total)!,
    })),
  };
}

async function siguienteNumeroMayorista(db: Db): Promise<string> {
  const filas = await db.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT nextval('pedidos_mayoristas_numero_seq') AS n`,
  );
  return `VM-${Number(filas[0]?.n ?? 10001)}`;
}

export interface ConfirmarInput {
  entrega: 'ENVIO_TRANSPORTE' | 'RETIRO_DEPOSITO';
  notas?: string | null;
  repetidoDeId?: string | null;
}

/** Confirma el carrito del usuario como pedido mayorista PENDIENTE_APROBACION. */
export async function confirmarPedidoMayorista(
  usuario: { id: string; nombre: string; email: string },
  optica: Optica,
  input: ConfirmarInput,
) {
  const cfg = await getConfigMayorista();
  const items = await leerCarrito(usuario.id);
  if (items.length === 0) throw Errors.badRequest('Tu carrito mayorista está vacío');
  const cot = await cotizarCarrito(items, optica, cfg);
  if (cot.problemas.length) {
    throw new AppError(409, 'STOCK_INSUFICIENTE', 'Algunos modelos ya no tienen stock suficiente. Revisá el carrito.', {
      problemas: cot.problemas,
    });
  }
  if (!cot.minimo.cumple) {
    throw new AppError(422, 'MINIMO_NO_ALCANZADO', cot.minimo.mensaje ?? 'No llegás a la compra mínima', {
      minimo: cot.minimo,
    });
  }
  const entrega = opcionesEntrega(optica, cfg);
  const opcion = input.entrega === 'ENVIO_TRANSPORTE' ? entrega.envio : entrega.retiro;
  if (!opcion) throw Errors.badRequest('Esa forma de entrega no está disponible');
  const envio = input.entrega === 'ENVIO_TRANSPORTE' ? entrega.envio!.costo : 0;
  const envioACargoOptica = input.entrega === 'ENVIO_TRANSPORTE' && cfg.envioModo === 'A_CARGO_OPTICA';
  // El envío (si tiene costo) también lleva IVA.
  const ivaEnvio = round2((envio * cot.ivaPct) / 100);

  return prisma.$transaction(async (tx) => {
    const numero = await siguienteNumeroMayorista(tx);
    const p = await tx.pedidoMayorista.create({
      data: {
        numero,
        opticaId: optica.id,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        usuarioEmail: usuario.email,
        entrega: input.entrega,
        direccionEntrega:
          input.entrega === 'RETIRO_DEPOSITO'
            ? `${entrega.retiro!.direccion}${entrega.retiro!.horario ? ` · ${entrega.retiro!.horario}` : ''}`
            : entrega.envio!.direccion,
        envioACargoOptica,
        unidades: cot.unidades,
        subtotalLista: cot.subtotalLista,
        descuentoPct: cot.descuentoPct,
        descuento: cot.descuento,
        subtotal: cot.subtotal,
        envio,
        ivaPct: cot.ivaPct,
        iva: round2(cot.iva + ivaEnvio),
        total: round2(cot.subtotal + envio + cot.iva + ivaEnvio),
        notas: input.notas?.trim() || null,
        repetidoDeId: input.repetidoDeId ?? null,
        items: {
          create: cot.lineas.map((l) => ({
            varianteId: l.varianteId,
            productoId: l.productoId,
            nombre: l.nombre,
            sku: l.sku,
            color: l.color,
            imagen: l.imagen,
            precioMayorista: l.precioMayorista,
            descuentoPct: cot.descuentoPct,
            precioUnitario: l.precioUnitario,
            precioPublico: l.precioPublico,
            cantidad: l.cantidad,
            total: l.total,
          })),
        },
      },
      include: pedidoMayoristaInclude,
    });
    await tx.carritoMayorista.update({ where: { userId: usuario.id }, data: { items: [] } });
    return p;
  });
}

/** Carga en el carrito los ítems de un pedido anterior, ajustando por stock. */
export async function repetirPedidoMayorista(userId: string, pedido: { items: Array<{ varianteId: string | null; cantidad: number; sku: string; nombre: string; color: string }> }) {
  const conVariante = pedido.items.filter((i) => i.varianteId);
  const { items, ajustes } = await cargarEnCarrito(
    userId,
    conVariante.map((i) => ({ varianteId: i.varianteId!, cantidad: i.cantidad })),
    'sumar',
  );
  // Ítems cuya variante ya no existe (se borró): también se avisan.
  for (const i of pedido.items.filter((x) => !x.varianteId)) {
    ajustes.push({ varianteId: '', sku: i.sku, nombre: i.nombre, color: i.color, pedida: i.cantidad, disponible: 0, motivo: 'no_disponible' });
  }
  return { items, ajustes };
}

// ------------------------------------------------------------------
// Transiciones (admin)
// ------------------------------------------------------------------

async function cargar(id: string, db: Db) {
  const p = await db.pedidoMayorista.findUnique({ where: { id }, include: pedidoMayoristaInclude });
  if (!p) throw Errors.notFound('Pedido mayorista no encontrado');
  return p;
}

/** Aprueba y reserva el stock (misma tabla ReservaStock que la tienda: el stock es uno solo). */
export async function aprobarPedidoMayorista(id: string, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      const p = await cargar(id, tx);
      if (p.estado !== 'PENDIENTE_APROBACION') throw Errors.conflict('Sólo se aprueban pedidos pendientes de aprobación');
      const cantidades = new Map<string, number>();
      for (const i of p.items) if (i.varianteId) cantidades.set(i.varianteId, (cantidades.get(i.varianteId) ?? 0) + i.cantidad);
      // Bloquea las variantes para que dos aprobaciones (o un pago web) no reserven el mismo stock.
      const ids = [...cantidades.keys()];
      if (ids.length) {
        await tx.$queryRawUnsafe(`SELECT id FROM variantes WHERE id = ANY($1::text[]) FOR UPDATE`, ids);
      }
      const variantes = await tx.variante.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true, sku: true } });
      const disp = await disponibilidad(variantes, tx);
      const faltantes = variantes
        .filter((v) => (disp.get(v.id) ?? 0) < (cantidades.get(v.id) ?? 0))
        .map((v) => ({ sku: v.sku, pedida: cantidades.get(v.id) ?? 0, disponible: disp.get(v.id) ?? 0 }));
      if (faltantes.length) {
        throw new AppError(
          409,
          'STOCK_INSUFICIENTE',
          `No hay stock para reservar: ${faltantes.map((f) => `${f.sku} (pide ${f.pedida}, hay ${f.disponible})`).join(', ')}`,
          { faltantes },
        );
      }
      const expiraEn = new Date(Date.now() + DIAS_RESERVA_MAYORISTA * 24 * 3600 * 1000);
      await tx.reservaStock.createMany({
        data: [...cantidades].map(([varianteId, cantidad]) => ({ pedidoMayoristaId: p.id, varianteId, cantidad, expiraEn })),
      });
      await tx.pedidoMayorista.update({
        where: { id: p.id },
        data: { estado: 'APROBADO', aprobadoEn: new Date(), aprobadoPorId: actorId },
      });
      return cargar(p.id, tx);
    },
    { timeout: 20000 },
  );
}

export async function cancelarPedidoMayorista(id: string, motivo: string) {
  return prisma.$transaction(async (tx) => {
    const p = await cargar(id, tx);
    if (p.estado !== 'PENDIENTE_APROBACION' && p.estado !== 'APROBADO') {
      throw Errors.conflict('Sólo se cancelan pedidos pendientes o aprobados (sin despachar)');
    }
    await tx.reservaStock.updateMany({ where: { pedidoMayoristaId: p.id, estado: 'ACTIVA' }, data: { estado: 'LIBERADA' } });
    await tx.pedidoMayorista.update({
      where: { id: p.id },
      data: { estado: 'CANCELADO', canceladoEn: new Date(), motivoCancelacion: motivo },
    });
    return cargar(p.id, tx);
  });
}

/** Despacha: descuenta el stock físico una sola vez y consume la reserva. */
export async function despacharPedidoMayorista(id: string, numeroSeguimiento: string | null) {
  return prisma.$transaction(async (tx) => {
    const p = await cargar(id, tx);
    if (p.estado !== 'APROBADO') throw Errors.conflict('Sólo se despachan pedidos aprobados');
    if (!p.stockDescontado) {
      for (const i of p.items) {
        if (!i.varianteId) continue;
        await tx.variante.update({ where: { id: i.varianteId }, data: { stock: { decrement: i.cantidad } } });
      }
      await tx.reservaStock.updateMany({ where: { pedidoMayoristaId: p.id, estado: 'ACTIVA' }, data: { estado: 'CONSUMIDA' } });
    }
    await tx.pedidoMayorista.update({
      where: { id: p.id },
      data: { estado: 'DESPACHADO', despachadoEn: new Date(), stockDescontado: true, numeroSeguimiento },
    });
    return cargar(p.id, tx);
  });
}

export async function entregarPedidoMayorista(id: string) {
  const p = await cargar(id, prisma);
  if (p.estado !== 'DESPACHADO') throw Errors.conflict('Sólo se marcan como entregados los pedidos despachados');
  await prisma.pedidoMayorista.update({ where: { id }, data: { estado: 'ENTREGADO', entregadoEn: new Date() } });
  return cargar(id, prisma);
}
