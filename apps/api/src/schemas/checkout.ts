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
  'PAGADO',
  'ASIGNADO',
  'ACEPTADO',
  'EN_ARMADO',
  'LISTO',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
  'DEVUELTO',
] as const;
export const ESTADOS_PAGO = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'] as const;
export const CANALES = ['WEB', 'WHATSAPP', 'OPTICA', 'ADMIN'] as const;

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
  /** Número, email, nombre, DNI o factura. */
  q: z.string().trim().max(80).optional(),
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  estadoPago: z.enum(ESTADOS_PAGO).optional(),
  metodoPago: z.enum(METODOS_PAGO).optional(),
  /** id de óptica, o "sin" para los pedidos pagados sin asignar. */
  opticaId: z.string().trim().max(60).optional(),
  linea: z.enum(LINEAS).optional(),
  canal: z.enum(CANALES).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const pedidoUpdate = z.object({
  numeroFactura: nullableStr(40),
  notasInternas: nullableStr(2000),
});

/** Cambio de estado desde el admin (con nota; `forzar` saltea la validación de transiciones). */
export const pedidoEstadoInput = z.object({
  estado: z.enum(ESTADOS_PEDIDO).refine((e) => e !== 'CANCELADO' && e !== 'PENDIENTE_PAGO', 'Usá la acción correspondiente'),
  nota: nullableStr(500),
  numeroSeguimiento: nullableStr(80),
  forzar: z.boolean().optional(),
});

export const asignarInput = z.object({
  opticaId: z.string().min(1, 'Elegí la óptica'),
  motivo: z.string().trim().min(3, 'Indicá el motivo de la reasignación').max(500),
});

export const notaInternaInput = z.object({
  nota: z.string().trim().min(1, 'Escribí la nota').max(2000),
});

export const reenviarEmailInput = z.object({
  /** Estado cuya plantilla se reenvía; por defecto el estado actual. */
  estado: z.enum(ESTADOS_PEDIDO).optional(),
});

export const reembolsoInput = z.object({
  /** Monto parcial; vacío = total pendiente de reembolso. */
  monto: z.number().positive().optional(),
  motivo: z.string().trim().min(3, 'Indicá el motivo').max(500),
  /** Si además corresponde cancelar el pedido y reponer stock (default: sólo si el reembolso es total). */
  cancelar: z.boolean().optional(),
});

export const cancelarInput = z.object({
  motivo: z.string().trim().min(3, 'Indicá el motivo').max(500),
  /** Reembolsar automáticamente por Mercado Pago si el pago estaba aprobado. */
  reembolsar: z.boolean().optional(),
});

// ---------- Panel de la óptica ----------
export const opticaPedidosQuery = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const rechazoInput = z.object({
  motivo: z.string().trim().min(3, 'Contanos por qué no podés tomar el pedido').max(500),
});

export const opticaEstadoInput = z.object({
  estado: z.enum(['EN_ARMADO', 'LISTO', 'ENVIADO', 'ENTREGADO']),
  nota: nullableStr(500),
  numeroSeguimiento: nullableStr(80),
});

export const TIPOS_TURNO = ['MEDICION', 'AJUSTE', 'RETIRO', 'OTRO'] as const;
export const ESTADOS_TURNO = ['PROGRAMADO', 'REALIZADO', 'CANCELADO'] as const;
export const turnoBase = z.object({
  pedidoId: z.string().min(1).nullable().optional(),
  tipo: z.enum(TIPOS_TURNO).default('MEDICION'),
  fecha: z.coerce.date({ error: 'Ingresá fecha y hora' }),
  duracionMin: z.number().int().min(10).max(240).default(30),
  clienteNombre: z.string().trim().min(2, 'Ingresá el nombre').max(120),
  clienteTelefono: nullableStr(40),
  notas: nullableStr(500),
  estado: z.enum(ESTADOS_TURNO).default('PROGRAMADO'),
});
export const turnoInput = turnoBase;
export const turnoUpdate = partialSinDefaults(turnoBase.shape);
export const turnosQuery = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  estado: z.enum(ESTADOS_TURNO).optional(),
});

export const liquidacionQuery = z.object({
  /** Mes en formato AAAA-MM (default: mes actual). */
  mes: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (AAAA-MM)')
    .optional(),
  opticaId: z.string().optional(),
});

// ---------- Solicitudes de cambio / devolución ----------
export const TIPOS_SOLICITUD = ['CAMBIO', 'DEVOLUCION'] as const;
export const solicitudInput = z.object({
  tipo: z.enum(TIPOS_SOLICITUD, { error: 'Elegí cambio o devolución' }),
  motivo: z.string().trim().min(3, 'Contanos el motivo').max(200),
  detalle: nullableStr(2000),
  /** Para pedidos sin cuenta: debe coincidir con el email del pedido. */
  email: z.string().trim().toLowerCase().max(160).optional(),
  web: z.string().max(200).optional(),
});

export const buscarPedidoQuery = z.object({
  numero: z.string().trim().min(3).max(20),
  email: emailSchema,
});

export const solicitudResolverInput = z.object({
  resolucion: z.enum(['NUEVO_PEDIDO', 'REINTEGRO'], { error: 'Elegí cómo resolverla' }),
  respuesta: nullableStr(1000),
});

export const solicitudRechazarInput = z.object({
  respuesta: z.string().trim().min(3, 'Explicale al cliente el motivo').max(1000),
});

export const solicitudesListQuery = z.object({
  estado: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA']).optional(),
  tipo: z.enum(TIPOS_SOLICITUD).optional(),
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
  plazoAceptacionHoras: z.number().int().min(1).max(72).optional(),
  horaHabilDesde: z.number().int().min(0).max(22).optional(),
  horaHabilHasta: z.number().int().min(1).max(23).optional(),
  sabadoHabil: z.boolean().optional(),
});
