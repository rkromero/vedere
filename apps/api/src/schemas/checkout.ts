// Esquemas Zod del checkout (prompt 4): cotización, pedido, receta, promociones, creadores y configuración.
import { z } from 'zod';
import { partialSinDefaults, slugSchema } from './catalogo.js';

const nullableStr = (max: number) => z.string().trim().max(max).nullable().optional();
const emailSchema = z
  .string({ error: 'Ingresá un email válido' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Ingresá un email válido' }));

export const LINEAS = ['SOL', 'RECETADO', 'MULTIFOCAL', 'ACCESORIO'] as const;
export const METODOS_PAGO = ['MERCADO_PAGO', 'MERCADO_PAGO_BILLETERA', 'TRANSFERENCIA'] as const;
export const MODALIDADES = ['RETIRO_OPTICA', 'ENVIO_DOMICILIO'] as const;
export const ESTADOS_PEDIDO = [
  'PENDIENTE_PAGO',
  'CONFIRMADO',
  'EN_PREPARACION',
  'LISTO',
  'ENTREGADO',
  'CANCELADO',
] as const;
export const ESTADOS_PAGO = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'] as const;

// ---------- Carrito / cotización ----------
export const itemCheckout = z.object({
  varianteId: z.string().min(1),
  cantidad: z.number().int().min(1).max(10),
  conReceta: z.boolean().optional().default(false),
});

export const cotizarInput = z.object({
  items: z.array(itemCheckout).min(1, 'El carrito está vacío').max(50),
  cupon: z.string().trim().max(30).nullable().optional(),
  modalidad: z.enum(MODALIDADES).default('RETIRO_OPTICA'),
  metodoPago: z.enum(METODOS_PAGO).nullable().optional(),
  email: z.string().trim().toLowerCase().max(160).optional(),
});

// ---------- Receta ----------
// Rangos clínicos habituales: esfera ±20 (pasos de 0,25), cilindro ±6, eje 0–180, adición 0,75–3,5, DP 50–80 mm.
const paso025 = (v: number) => Math.abs((v * 100) % 25) < 1e-6;
const esfera = z
  .number({ error: 'Ingresá la esfera' })
  .min(-20, 'Esfera entre -20 y +20')
  .max(20, 'Esfera entre -20 y +20')
  .refine(paso025, 'La esfera va en pasos de 0,25');
const cilindro = z
  .number({ error: 'Ingresá el cilindro' })
  .min(-6, 'Cilindro entre -6 y +6')
  .max(6, 'Cilindro entre -6 y +6')
  .refine(paso025, 'El cilindro va en pasos de 0,25');
const eje = z.number({ error: 'Ingresá el eje' }).int('El eje es un entero').min(0, 'Eje entre 0 y 180').max(180, 'Eje entre 0 y 180');

export const recetaValores = z.object({
  odEsfera: esfera,
  odCilindro: cilindro.default(0),
  odEje: eje.default(0),
  oiEsfera: esfera,
  oiCilindro: cilindro.default(0),
  oiEje: eje.default(0),
  adicion: z
    .number()
    .min(0.75, 'Adición entre 0,75 y 3,50')
    .max(3.5, 'Adición entre 0,75 y 3,50')
    .refine(paso025, 'La adición va en pasos de 0,25')
    .nullable()
    .optional(),
  dp: z.number().min(50, 'Distancia pupilar entre 50 y 80 mm').max(80, 'Distancia pupilar entre 50 y 80 mm').nullable().optional(),
  notas: nullableStr(500),
});

export const recetaInput = z.discriminatedUnion('modo', [
  z.object({ modo: z.literal('VALORES'), valores: recetaValores, guardar: z.boolean().optional() }),
  z.object({
    modo: z.literal('ARCHIVO'),
    archivoUrl: z.url({ error: 'Subí la receta' }),
    archivoNombre: z.string().trim().max(200).optional(),
    guardar: z.boolean().optional(),
  }),
  z.object({ modo: z.literal('OPTICA'), guardar: z.boolean().optional() }),
  z.object({ modo: z.literal('GUARDADA'), recetaId: z.string().min(1) }),
]);

export const RECETA_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;

// ---------- Pedido ----------
const dniSchema = z
  .string()
  .trim()
  .regex(/^\d{7,8}$/, 'DNI inválido (7 u 8 números)');
const telefonoSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s()-]{5,24}$/, 'Teléfono inválido');

export const direccionInput = z.object({
  direccion: z.string().trim().min(3, 'Ingresá la dirección').max(200),
  piso: nullableStr(40),
  localidad: z.string().trim().min(2, 'Ingresá la localidad').max(80),
  provincia: z.string().trim().min(2, 'Ingresá la provincia').max(80),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/, 'Código postal inválido (ej. 1425 o C1425ABC)')
    .transform((v) => v.toUpperCase()),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  placeId: nullableStr(200),
  direccionCompleta: nullableStr(300),
});

export const pedidoInput = z.object({
  datos: z.object({
    email: emailSchema,
    nombre: z.string().trim().min(2, 'Ingresá tu nombre y apellido').max(120),
    dni: dniSchema,
    telefono: telefonoSchema,
  }),
  entrega: z.object({
    modalidad: z.enum(MODALIDADES),
    opticaId: z.string().min(1, 'Elegí la óptica'),
    direccion: direccionInput,
  }),
  receta: recetaInput.nullable().optional(),
  pago: z.object({
    metodo: z.enum(METODOS_PAGO, { error: 'Elegí cómo pagar' }),
  }),
  items: z.array(itemCheckout).min(1, 'El carrito está vacío').max(50),
  cupon: z.string().trim().max(30).nullable().optional(),
  notas: nullableStr(500),
  // Honeypot anti-spam.
  web: z.string().max(200).optional(),
});

export const pedidoPublicoQuery = z.object({
  email: z.string().trim().toLowerCase().max(160).optional(),
});

export const placesQuery = z.object({
  q: z.string().trim().min(3).max(200),
  session: z.string().trim().max(80).optional(),
});

export const geocodificarInput = z
  .object({
    placeId: z.string().trim().max(200).optional(),
    direccion: z.string().trim().min(3).max(300).optional(),
    session: z.string().trim().max(80).optional(),
  })
  .refine((v) => v.placeId || v.direccion, { message: 'Indicá placeId o dirección' });

export const opticaQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  cp: z.string().trim().max(10).optional(),
});

// ---------- Admin: pedidos ----------
export const pedidosListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  estadoPago: z.enum(ESTADOS_PAGO).optional(),
  metodoPago: z.enum(METODOS_PAGO).optional(),
  opticaId: z.string().optional(),
});

export const pedidoUpdate = z.object({
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  numeroFactura: nullableStr(40),
  notasInternas: nullableStr(2000),
  opticaId: z.string().min(1).nullable().optional(),
});

// ---------- Admin: promociones ----------
export const TIPOS_PROMOCION = ['DOS_POR_UNO', 'SEGUNDO_50', 'ENVIO_GRATIS'] as const;
export const promocionBase = z.object({
  nombre: z.string().trim().min(3, 'Ingresá el nombre').max(120),
  tipo: z.enum(TIPOS_PROMOCION, { error: 'Tipo inválido' }),
  linea: z.enum(LINEAS).nullable().optional(),
  coleccionId: z.string().min(1).nullable().optional(),
  montoMinimo: z.number().nonnegative().nullable().optional(),
  acumulable: z.boolean().default(false),
  prioridad: z.number().int().min(0).default(0),
  activa: z.boolean().default(true),
  vigenciaDesde: z.coerce.date().nullable().optional(),
  vigenciaHasta: z.coerce.date().nullable().optional(),
});
export const promocionInput = promocionBase;
export const promocionUpdate = partialSinDefaults(promocionBase.shape);

// ---------- Admin: creadores ----------
export const creadorBase = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  slug: slugSchema.optional(),
  instagram: nullableStr(80),
  email: z.union([emailSchema, z.literal('')]).nullable().optional(),
  comision: z.number().min(0).max(100).nullable().optional(),
  activo: z.boolean().default(true),
});
export const creadorInput = creadorBase;
export const creadorUpdate = partialSinDefaults(creadorBase.shape);

export const reporteQuery = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

// ---------- Admin: configuración de tienda ----------
export const configTiendaUpdate = z.object({
  transferenciaHabilitada: z.boolean().optional(),
  cbu: z
    .string()
    .trim()
    .regex(/^\d{22}$/, 'El CBU tiene 22 dígitos')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  alias: nullableStr(40),
  titularCuenta: nullableStr(120),
  banco: nullableStr(80),
  descuentoTransferencia: z.number().min(0).max(100).optional(),
  transferenciaHorasReserva: z.number().int().min(1).max(720).optional(),
  mpHabilitado: z.boolean().optional(),
  mpBilleteraHabilitada: z.boolean().optional(),
  cuotasGeneral: z.number().int().min(1).max(24).optional(),
  cuotasPorLinea: z.partialRecord(z.enum(LINEAS), z.number().int().min(1).max(24)).optional(),
  costoEnvio: z.number().nonnegative().optional(),
});
