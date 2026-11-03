// Seed: usuario ADMIN (desde env) + catálogo base (categorías, marcas, colecciones y 12 productos de ejemplo)
// + datos de tienda (promos, ópticas socias de ejemplo y cupones) + un usuario OPTICA por óptica socia
// (prompt 5) si está definido OPTICA_PASSWORD.
// Idempotente: usa upsert por slug / sku / email. Nunca hardcodear credenciales acá.
import { PrismaClient, Rol } from '@prisma/client';
import { PAGINAS_LEGALES_DEFAULT, PLANTILLAS_EMAIL_DEFAULT } from '../src/prompt6.js';
import type { EstadoProducto, Forma, Genero, Linea, Material, TipoImagen } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedAdmin() {
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
  return admin;
}

// ---------- Catálogo ----------

const CATEGORIAS = [
  { nombre: 'Sol', slug: 'sol', orden: 1, hijas: ['Polarizados', 'Deportivos'] },
  { nombre: 'Recetados', slug: 'recetados', orden: 2, hijas: ['Armazones', 'Lectura'] },
  { nombre: 'Multifocal', slug: 'multifocal', orden: 3, hijas: [] },
  { nombre: 'Accesorios', slug: 'accesorios', orden: 4, hijas: ['Estuches', 'Limpieza'] },
];

const MARCAS = [
  { nombre: 'Vedere', slug: 'vedere' },
  { nombre: 'Ray-Ban', slug: 'ray-ban' },
  { nombre: 'Oakley', slug: 'oakley' },
  { nombre: 'Vulk', slug: 'vulk' },
];

const COLECCIONES = [
  { nombre: 'Sol', slug: 'sol', colorHex: '#F2B33D' },
  { nombre: 'Vetro', slug: 'vetro', colorHex: '#7FD1C1' },
  { nombre: 'Noche', slug: 'noche', colorHex: '#3A5BD9' },
  { nombre: 'Carey', slug: 'carey', colorHex: '#B7712F' },
];

interface SeedVariante {
  sku: string;
  colorArmazon: string;
  colorArmazonHex: string;
  colorLente?: string;
  colorLenteHex?: string;
  stock: number;
  stockMinimo?: number;
}

interface SeedProducto {
  nombre: string;
  slug: string;
  descripcion: string;
  marca: string;
  categorias: string[];
  coleccion: string;
  linea: Linea;
  material: Material;
  forma: Forma;
  genero: Genero;
  medidas: [number, number, number];
  precio: number;
  precioLista?: number;
  permiteReceta: boolean;
  destacado?: boolean;
  edicionLimitada?: boolean;
  estado?: EstadoProducto;
  vendidos?: number;
  variantes: SeedVariante[];
}

const img = (seed: string, tipo: TipoImagen, orden: number) => ({
  tipo,
  orden,
  url: `https://picsum.photos/seed/${seed}/1600/1600.webp`,
  urlMediana: `https://picsum.photos/seed/${seed}/800/800.webp`,
  urlMiniatura: `https://picsum.photos/seed/${seed}/320/320.webp`,
  alt: null as string | null,
});

const PRODUCTOS: SeedProducto[] = [
  // --- SOL ---
  {
    nombre: 'Aviador Costa',
    slug: 'aviador-costa',
    descripcion: 'Aviador clásico de metal liviano con lentes polarizadas. Protección UV400.',
    marca: 'vedere',
    categorias: ['sol', 'polarizados'],
    coleccion: 'sol',
    linea: 'SOL',
    material: 'METAL',
    forma: 'AVIADOR',
    genero: 'UNISEX',
    medidas: [58, 14, 140],
    precio: 89900,
    precioLista: 109900,
    permiteReceta: true,
    destacado: true,
    vendidos: 120,
    variantes: [
      {
        sku: 'VED-AVC-DOR',
        colorArmazon: 'Dorado',
        colorArmazonHex: '#C9A24D',
        colorLente: 'Verde G15',
        colorLenteHex: '#3B5B47',
        stock: 12,
        stockMinimo: 3,
      },
      {
        sku: 'VED-AVC-NEG',
        colorArmazon: 'Negro',
        colorArmazonHex: '#0A0A0A',
        colorLente: 'Gris',
        colorLenteHex: '#555555',
        stock: 8,
        stockMinimo: 3,
      },
      {
        sku: 'VED-AVC-PLA',
        colorArmazon: 'Plateado',
        colorArmazonHex: '#BFC3C7',
        colorLente: 'Azul espejado',
        colorLenteHex: '#3A5BD9',
        stock: 2,
        stockMinimo: 3,
      },
    ],
  },
  {
    nombre: 'Redondo Palermo',
    slug: 'redondo-palermo',
    descripcion: 'Armazón redondo de acetato con lentes degradé. Estilo retro para todos los días.',
    marca: 'vulk',
    categorias: ['sol'],
    coleccion: 'carey',
    linea: 'SOL',
    material: 'ACETATO',
    forma: 'REDONDO',
    genero: 'UNISEX',
    medidas: [49, 21, 145],
    precio: 64900,
    permiteReceta: true,
    vendidos: 75,
    variantes: [
      {
        sku: 'VLK-RPA-CAR',
        colorArmazon: 'Carey',
        colorArmazonHex: '#B7712F',
        colorLente: 'Marrón degradé',
        colorLenteHex: '#6B4A2B',
        stock: 15,
        stockMinimo: 4,
      },
      {
        sku: 'VLK-RPA-NEG',
        colorArmazon: 'Negro',
        colorArmazonHex: '#0A0A0A',
        colorLente: 'Gris',
        colorLenteHex: '#555555',
        stock: 6,
        stockMinimo: 4,
      },
    ],
  },
  {
    nombre: 'Ojo de Gato Recoleta',
    slug: 'ojo-de-gato-recoleta',
    edicionLimitada: true,
    descripcion: 'Silueta ojo de gato en acetato brillante. Lentes con filtro UV400.',
    marca: 'vedere',
    categorias: ['sol'],
    coleccion: 'noche',
    linea: 'SOL',
    material: 'ACETATO',
    forma: 'OJO_DE_GATO',
    genero: 'MUJER',
    medidas: [53, 18, 140],
    precio: 72900,
    precioLista: 84900,
    permiteReceta: true,
    destacado: true,
    vendidos: 98,
    variantes: [
      {
        sku: 'VED-OGR-NEG',
        colorArmazon: 'Negro',
        colorArmazonHex: '#0A0A0A',
        colorLente: 'Gris',
        colorLenteHex: '#555555',
        stock: 10,
        stockMinimo: 3,
      },
      {
        sku: 'VED-OGR-AZU',
        colorArmazon: 'Azul noche',
        colorArmazonHex: '#3A5BD9',
        colorLente: 'Azul',
        colorLenteHex: '#2B3F8C',
        stock: 4,
        stockMinimo: 3,
      },
    ],
  },
  {
    nombre: 'Deportivo Delta',
    slug: 'deportivo-delta',
    descripcion: 'Armazón envolvente en TR90 ultraliviano, ideal para running y ciclismo.',
    marca: 'oakley',
    categorias: ['sol', 'deportivos'],
    coleccion: 'sol',
    linea: 'SOL',
    material: 'TR90',
    forma: 'RECTANGULAR',
    genero: 'HOMBRE',
    medidas: [62, 12, 125],
    precio: 119900,
    permiteReceta: false,
    vendidos: 40,
    variantes: [
      {
        sku: 'OAK-DDL-NEG',
        colorArmazon: 'Negro mate',
        colorArmazonHex: '#1A1A1A',
        colorLente: 'Prizm',
        colorLenteHex: '#C44B2B',
        stock: 5,
        stockMinimo: 2,
      },
      {
        sku: 'OAK-DDL-BLA',
        colorArmazon: 'Blanco',
        colorArmazonHex: '#FFFFFF',
        colorLente: 'Gris',
        colorLenteHex: '#555555',
        stock: 0,
        stockMinimo: 2,
      },
    ],
  },
  // --- RECETADOS ---
  {
    nombre: 'Cuadrado Centro',
    slug: 'cuadrado-centro',
    descripcion: 'Armazón cuadrado de acetato para lentes recetados. Incluye estuche y paño.',
    marca: 'vedere',
    categorias: ['recetados', 'armazones'],
    coleccion: 'vetro',
    linea: 'RECETADO',
    material: 'ACETATO',
    forma: 'CUADRADO',
    genero: 'UNISEX',
    medidas: [52, 19, 145],
    precio: 54900,
    permiteReceta: true,
    destacado: true,
    vendidos: 210,
    variantes: [
      {
        sku: 'VED-CCE-NEG',
        colorArmazon: 'Negro',
        colorArmazonHex: '#0A0A0A',
        stock: 20,
        stockMinimo: 5,
      },
      {
        sku: 'VED-CCE-CRI',
        colorArmazon: 'Cristal',
        colorArmazonHex: '#E8E8E4',
        stock: 9,
        stockMinimo: 5,
      },
      {
        sku: 'VED-CCE-VER',
        colorArmazon: 'Verde vetro',
        colorArmazonHex: '#7FD1C1',
        stock: 3,
        stockMinimo: 5,
      },
    ],
  },
  {
    nombre: 'Rectangular Norte',
    slug: 'rectangular-norte',
    descripcion: 'Armazón rectangular de titanio, liviano y resistente. Pensado para uso diario.',
    marca: 'ray-ban',
    categorias: ['recetados', 'armazones'],
    coleccion: 'noche',
    linea: 'RECETADO',
    material: 'TITANIO',
    forma: 'RECTANGULAR',
    genero: 'HOMBRE',
    medidas: [54, 17, 145],
    precio: 98900,
    precioLista: 115000,
    permiteReceta: true,
    vendidos: 60,
    variantes: [
      {
        sku: 'RB-RNO-GUN',
        colorArmazon: 'Gunmetal',
        colorArmazonHex: '#4A4F55',
        stock: 7,
        stockMinimo: 2,
      },
      {
        sku: 'RB-RNO-AZU',
        colorArmazon: 'Azul noche',
        colorArmazonHex: '#3A5BD9',
        stock: 4,
        stockMinimo: 2,
      },
    ],
  },
  {
    nombre: 'Redondo Lector',
    slug: 'redondo-lector',
    descripcion: 'Anteojos de lectura redondos en metal fino. Disponibles con graduación estándar.',
    marca: 'vedere',
    categorias: ['recetados', 'lectura'],
    coleccion: 'carey',
    linea: 'RECETADO',
    material: 'METAL',
    forma: 'REDONDO',
    genero: 'UNISEX',
    medidas: [47, 21, 140],
    precio: 38900,
    permiteReceta: true,
    vendidos: 33,
    variantes: [
      {
        sku: 'VED-RLE-DOR',
        colorArmazon: 'Dorado',
        colorArmazonHex: '#C9A24D',
        stock: 11,
        stockMinimo: 3,
      },
      {
        sku: 'VED-RLE-CAR',
        colorArmazon: 'Carey',
        colorArmazonHex: '#B7712F',
        stock: 1,
        stockMinimo: 3,
      },
    ],
  },
  {
    nombre: 'Ojo de Gato Belgrano',
    slug: 'ojo-de-gato-belgrano',
    descripcion: 'Armazón ojo de gato en acetato translúcido, suave y liviano.',
    marca: 'vulk',
    categorias: ['recetados', 'armazones'],
    coleccion: 'vetro',
    linea: 'RECETADO',
    material: 'ACETATO',
    forma: 'OJO_DE_GATO',
    genero: 'MUJER',
    medidas: [51, 18, 140],
    precio: 61900,
    permiteReceta: true,
    estado: 'BORRADOR',
    vendidos: 0,
    variantes: [
      {
        sku: 'VLK-OGB-ROS',
        colorArmazon: 'Rosa translúcido',
        colorArmazonHex: '#E7B9C4',
        stock: 6,
        stockMinimo: 2,
      },
    ],
  },
  // --- MULTIFOCAL ---
  {
    nombre: 'Multifocal Clásico',
    slug: 'multifocal-clasico',
    descripcion:
      'Armazón de acetato para lentes multifocales con campo visual amplio. Incluye asesoramiento en tu óptica.',
    marca: 'vedere',
    categorias: ['multifocal'],
    coleccion: 'carey',
    linea: 'MULTIFOCAL',
    material: 'ACETATO',
    forma: 'RECTANGULAR',
    genero: 'UNISEX',
    medidas: [55, 18, 145],
    precio: 149900,
    precioLista: 169900,
    permiteReceta: true,
    destacado: true,
    vendidos: 48,
    variantes: [
      {
        sku: 'VED-MCL-CAR',
        colorArmazon: 'Carey',
        colorArmazonHex: '#B7712F',
        stock: 8,
        stockMinimo: 2,
      },
      {
        sku: 'VED-MCL-NEG',
        colorArmazon: 'Negro',
        colorArmazonHex: '#0A0A0A',
        stock: 10,
        stockMinimo: 2,
      },
    ],
  },
  {
    nombre: 'Multifocal Titanio Pro',
    slug: 'multifocal-titanio-pro',
    descripcion:
      'Titanio ultraliviano con bisagras flex. Ideal para multifocales de uso prolongado.',
    marca: 'ray-ban',
    categorias: ['multifocal'],
    coleccion: 'noche',
    linea: 'MULTIFOCAL',
    material: 'TITANIO',
    forma: 'CUADRADO',
    genero: 'HOMBRE',
    medidas: [56, 17, 145],
    precio: 189900,
    permiteReceta: true,
    vendidos: 22,
    variantes: [
      {
        sku: 'RB-MTP-GRI',
        colorArmazon: 'Gris titanio',
        colorArmazonHex: '#8A8A86',
        stock: 4,
        stockMinimo: 2,
      },
      {
        sku: 'RB-MTP-AZU',
        colorArmazon: 'Azul noche',
        colorArmazonHex: '#3A5BD9',
        stock: 3,
        stockMinimo: 2,
      },
    ],
  },
  // --- ACCESORIOS ---
  {
    nombre: 'Estuche Rígido Vedere',
    slug: 'estuche-rigido-vedere',
    descripcion: 'Estuche rígido forrado en microfibra. Protege tus anteojos en cualquier bolso.',
    marca: 'vedere',
    categorias: ['accesorios', 'estuches'],
    coleccion: 'sol',
    linea: 'ACCESORIO',
    material: 'OTRO',
    forma: 'RECTANGULAR',
    genero: 'UNISEX',
    medidas: [0, 0, 0],
    precio: 12900,
    permiteReceta: false,
    vendidos: 300,
    variantes: [
      {
        sku: 'VED-EST-NEG',
        colorArmazon: 'Negro',
        colorArmazonHex: '#0A0A0A',
        stock: 50,
        stockMinimo: 10,
      },
      {
        sku: 'VED-EST-AMA',
        colorArmazon: 'Amarillo sol',
        colorArmazonHex: '#F2B33D',
        stock: 25,
        stockMinimo: 10,
      },
      {
        sku: 'VED-EST-VER',
        colorArmazon: 'Verde vetro',
        colorArmazonHex: '#7FD1C1',
        stock: 7,
        stockMinimo: 10,
      },
    ],
  },
  {
    nombre: 'Kit de Limpieza',
    slug: 'kit-de-limpieza',
    descripcion:
      'Spray limpiador de 30 ml + paño de microfibra. Apto para lentes con tratamiento antirreflejo.',
    marca: 'vedere',
    categorias: ['accesorios', 'limpieza'],
    coleccion: 'vetro',
    linea: 'ACCESORIO',
    material: 'OTRO',
    forma: 'RECTANGULAR',
    genero: 'UNISEX',
    medidas: [0, 0, 0],
    precio: 7900,
    permiteReceta: false,
    vendidos: 410,
    variantes: [
      {
        sku: 'VED-KIT-UNI',
        colorArmazon: 'Único',
        colorArmazonHex: '#F2F2F0',
        stock: 120,
        stockMinimo: 20,
      },
    ],
  },
];

async function seedCatalogo(adminId: string) {
  const audit = { createdById: adminId, updatedById: adminId };

  // Categorías (padres e hijas)
  const catIdBySlug = new Map<string, string>();
  for (const c of CATEGORIAS) {
    const padre = await prisma.categoria.upsert({
      where: { slug: c.slug },
      update: { nombre: c.nombre, orden: c.orden, activa: true, updatedById: adminId },
      create: { nombre: c.nombre, slug: c.slug, orden: c.orden, activa: true, ...audit },
    });
    catIdBySlug.set(padre.slug, padre.id);
    for (const [i, nombre] of c.hijas.entries()) {
      const slug = nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      const hija = await prisma.categoria.upsert({
        where: { slug },
        update: { nombre, orden: i + 1, padreId: padre.id, activa: true, updatedById: adminId },
        create: { nombre, slug, orden: i + 1, padreId: padre.id, activa: true, ...audit },
      });
      catIdBySlug.set(hija.slug, hija.id);
    }
  }

  const marcaIdBySlug = new Map<string, string>();
  for (const m of MARCAS) {
    const r = await prisma.marca.upsert({
      where: { slug: m.slug },
      update: { nombre: m.nombre, activa: true, updatedById: adminId },
      create: { ...m, activa: true, ...audit },
    });
    marcaIdBySlug.set(r.slug, r.id);
  }

  const colIdBySlug = new Map<string, string>();
  for (const c of COLECCIONES) {
    const r = await prisma.coleccion.upsert({
      where: { slug: c.slug },
      update: { nombre: c.nombre, colorHex: c.colorHex, activa: true, updatedById: adminId },
      create: { ...c, activa: true, ...audit },
    });
    colIdBySlug.set(r.slug, r.id);
  }

  let creados = 0;
  for (const p of PRODUCTOS) {
    const estado = p.estado ?? 'PUBLICADO';
    const data = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      marcaId: marcaIdBySlug.get(p.marca)!,
      coleccionId: colIdBySlug.get(p.coleccion)!,
      linea: p.linea,
      material: p.material,
      forma: p.linea === 'ACCESORIO' ? null : p.forma,
      genero: p.genero,
      calibreMm: p.medidas[0] || null,
      puenteMm: p.medidas[1] || null,
      varillaMm: p.medidas[2] || null,
      precio: p.precio,
      precioLista: p.precioLista ?? null,
      permiteReceta: p.permiteReceta,
      destacado: p.destacado ?? false,
      edicionLimitada: p.edicionLimitada ?? false,
      estado,
      vendidos: p.vendidos ?? 0,
      seoTitle: `${p.nombre} | Vedere`,
      seoDescription: p.descripcion.slice(0, 155),
      updatedById: adminId,
    };
    const categorias = { set: p.categorias.map((s) => ({ id: catIdBySlug.get(s)! })) };
    const producto = await prisma.producto.upsert({
      where: { slug: p.slug },
      update: { ...data, categorias },
      create: {
        ...data,
        slug: p.slug,
        createdById: adminId,
        publicadoEn: estado === 'PUBLICADO' ? new Date() : null,
        categorias: { connect: categorias.set },
      },
    });

    for (const [i, v] of p.variantes.entries()) {
      const imagenes = [
        img(`${v.sku}-f`, 'FRENTE', 0),
        img(`${v.sku}-p`, 'PERFIL', 1),
        img(`${v.sku}-t`, 'TRES_CUARTOS', 2),
        img(`${v.sku}-u`, 'PUESTO', 3),
      ];
      await prisma.variante.upsert({
        where: { sku: v.sku },
        update: {
          colorArmazon: v.colorArmazon,
          colorArmazonHex: v.colorArmazonHex,
          colorLente: v.colorLente ?? null,
          colorLenteHex: v.colorLenteHex ?? null,
          stock: v.stock,
          stockMinimo: v.stockMinimo ?? 0,
          orden: i,
          activa: true,
          updatedById: adminId,
          imagenes: { deleteMany: {}, create: imagenes },
        },
        create: {
          sku: v.sku,
          productoId: producto.id,
          colorArmazon: v.colorArmazon,
          colorArmazonHex: v.colorArmazonHex,
          colorLente: v.colorLente ?? null,
          colorLenteHex: v.colorLenteHex ?? null,
          stock: v.stock,
          stockMinimo: v.stockMinimo ?? 0,
          orden: i,
          activa: true,
          ...audit,
          imagenes: { create: imagenes },
        },
      });
    }
    creados++;
  }
  console.log(
    `[seed] Catálogo: ${CATEGORIAS.length} categorías base (+ hijas), ${MARCAS.length} marcas, ${COLECCIONES.length} colecciones, ${creados} productos`,
  );
}


// ---------- Tienda (prompt 3): promos, ópticas socias y cupones ----------

const PROMOS = [
  { texto: 'Envío gratis en compras desde $80.000', link: '/envios', orden: 0 },
  { texto: '6 cuotas sin interés con tarjetas bancarias', link: null, orden: 1 },
  { texto: 'Comprás online. Te los ajustan en tu óptica más cercana', link: '/opticas', orden: 2 },
];

// Ópticas de ejemplo (nombres ficticios) con coordenadas aproximadas para el mapa.
const OPTICAS = [
  { nombre: 'Óptica Mirada Palermo', razonSocial: 'Mirada Palermo S.R.L.', cuit: '30-71234567-8', opticoResponsable: 'Lic. Carolina Suárez', matricula: 'MN 4521', radioKm: 8, comisionPct: 12, capacidadDiaria: 15, direccion: 'Av. Santa Fe 4120', localidad: 'Palermo, CABA', provincia: 'Buenos Aires', codigoPostal: '1425', lat: -34.5846, lng: -58.4216, whatsapp: '5491150000001', horarios: 'Lun a vie 10 a 19 · Sáb 10 a 14' },
  { nombre: 'Óptica Mirada Recoleta', razonSocial: 'Mirada Recoleta S.A.', cuit: '30-71234568-6', opticoResponsable: 'Lic. Martín Peralta', matricula: 'MN 3890', radioKm: 6, comisionPct: 12, capacidadDiaria: 12, direccion: 'Av. Callao 1580', localidad: 'Recoleta, CABA', provincia: 'Buenos Aires', codigoPostal: '1024', lat: -34.5913, lng: -58.3921, whatsapp: '5491150000002', horarios: 'Lun a vie 9 a 19' },
  { nombre: 'Visión Belgrano', razonSocial: 'Visión Belgrano S.R.L.', cuit: '30-71234569-4', opticoResponsable: 'Lic. Paula Grimaldi', matricula: 'MN 5102', radioKm: 5, comisionPct: 10, capacidadDiaria: 10, direccion: 'Av. Cabildo 2240', localidad: 'Belgrano, CABA', provincia: 'Buenos Aires', codigoPostal: '1428', lat: -34.5615, lng: -58.4567, whatsapp: '5491150000003', horarios: 'Lun a sáb 10 a 20' },
  { nombre: 'Óptica Caballito Centro', razonSocial: 'Caballito Centro S.R.L.', cuit: '30-71234570-8', opticoResponsable: 'Lic. Diego Ferreyra', matricula: 'MN 2977', radioKm: 6, comisionPct: 10, capacidadDiaria: 20, direccion: 'Av. Rivadavia 5020', localidad: 'Caballito, CABA', provincia: 'Buenos Aires', codigoPostal: '1424', lat: -34.6183, lng: -58.4342, whatsapp: '5491150000004', horarios: 'Lun a vie 9.30 a 19' },
  { nombre: 'Óptica San Isidro Norte', direccion: 'Av. Centenario 980', localidad: 'San Isidro', provincia: 'Buenos Aires', codigoPostal: '1642', lat: -34.4712, lng: -58.5277, whatsapp: '5491150000005', horarios: 'Lun a vie 9 a 18 · Sáb 9 a 13' },
  { nombre: 'Lomas Visión', direccion: 'Laprida 340', localidad: 'Lomas de Zamora', provincia: 'Buenos Aires', codigoPostal: '1832', lat: -34.7608, lng: -58.4008, whatsapp: '5491150000006', horarios: 'Lun a sáb 9 a 19' },
  { nombre: 'Óptica Oeste Morón', direccion: 'Brown 760', localidad: 'Morón', provincia: 'Buenos Aires', codigoPostal: '1708', lat: -34.6503, lng: -58.6195, whatsapp: '5491150000007', horarios: 'Lun a vie 9 a 18' },
  { nombre: 'Óptica Diagonal 74', direccion: 'Calle 8 n.º 1150', localidad: 'La Plata', provincia: 'Buenos Aires', codigoPostal: '1900', lat: -34.9214, lng: -57.9544, whatsapp: '5492210000008', horarios: 'Lun a vie 9 a 18 · Sáb 9 a 13' },
  { nombre: 'Óptica Costa Mar del Plata', direccion: 'Av. Independencia 2320', localidad: 'Mar del Plata', provincia: 'Buenos Aires', codigoPostal: '7600', lat: -38.0055, lng: -57.5426, whatsapp: '5492230000009', horarios: 'Lun a sáb 9 a 20' },
  { nombre: 'Óptica Pellegrini', direccion: 'Córdoba 1450', localidad: 'Rosario', provincia: 'Santa Fe', codigoPostal: '2000', lat: -32.9468, lng: -60.6393, whatsapp: '5493410000010', horarios: 'Lun a vie 9 a 19 · Sáb 9 a 13' },
  { nombre: 'Óptica Nueva Córdoba', direccion: 'Bv. Illia 320', localidad: 'Córdoba', provincia: 'Córdoba', codigoPostal: '5000', lat: -31.4245, lng: -64.1851, whatsapp: '5493510000011', horarios: 'Lun a vie 9 a 19' },
  { nombre: 'Óptica Andina', direccion: 'Av. San Martín 1180', localidad: 'Mendoza', provincia: 'Mendoza', codigoPostal: '5500', lat: -32.8908, lng: -68.8272, whatsapp: '5492610000012', horarios: 'Lun a vie 9 a 13 y 17 a 21' },
  { nombre: 'Óptica del Norte', direccion: '25 de Mayo 450', localidad: 'San Miguel de Tucumán', provincia: 'Tucumán', codigoPostal: '4000', lat: -26.8241, lng: -65.2043, whatsapp: '5493810000013', horarios: 'Lun a vie 9 a 13 y 17 a 21' },
];

const CUPONES = [
  { codigo: 'BIENVENIDA10', descripcion: '10 % en tu primera compra', tipo: 'PORCENTAJE' as const, valor: 10 },
  { codigo: 'VEDERE5000', descripcion: '$5.000 de descuento en compras desde $60.000', tipo: 'MONTO' as const, valor: 5000, minimoCompra: 60000 },
];

const slugify = (input: string) =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function seedTienda(adminId: string) {
  const audit = { createdById: adminId, updatedById: adminId };

  const promosExistentes = await prisma.promoMensaje.count();
  if (promosExistentes === 0) {
    await prisma.promoMensaje.createMany({
      data: PROMOS.map((p) => ({ ...p, activo: true, ...audit })),
    });
  }

  // Un usuario OPTICA por óptica (prompt 5) sólo si hay OPTICA_PASSWORD en el entorno: email optica-<slug>@vedere.com.ar.
  const opticaPassword = process.env.OPTICA_PASSWORD;
  if (opticaPassword && opticaPassword.length < 10) throw new Error('OPTICA_PASSWORD debe tener al menos 10 caracteres.');
  const opticaHash = opticaPassword ? await argon2.hash(opticaPassword, { type: argon2.argon2id }) : null;
  let usuariosOptica = 0;

  for (const o of OPTICAS) {
    const slug = slugify(o.nombre);
    // Defaults del prompt 5 para las ópticas sin datos propios: radio 10 km, 10 % de comisión, 20 pedidos por día.
    const datos = { radioKm: 10, comisionPct: 10, capacidadDiaria: 20, email: `${slug}@vedere.com.ar`, ...o };
    const optica = await prisma.optica.upsert({
      where: { slug },
      update: { ...datos, activa: true, updatedById: adminId },
      create: { ...datos, slug, activa: true, ...audit },
    });
    if (opticaHash) {
      const email = `optica-${slug}@vedere.com.ar`;
      await prisma.user.upsert({
        where: { email },
        update: { rol: Rol.OPTICA, opticaId: optica.id, activo: true, passwordHash: opticaHash },
        create: { email, nombre: o.nombre, rol: Rol.OPTICA, opticaId: optica.id, activo: true, passwordHash: opticaHash },
      });
      usuariosOptica++;
    }
  }

  for (const c of CUPONES) {
    await prisma.cupon.upsert({
      where: { codigo: c.codigo },
      update: { ...c, activo: true, updatedById: adminId },
      create: { ...c, activo: true, ...audit },
    });
  }
  console.log(
    '[seed] Tienda: ' + PROMOS.length + ' promos, ' + OPTICAS.length + ' ópticas socias, ' + CUPONES.length + ' cupones' +
      (usuariosOptica ? ', ' + usuariosOptica + ' usuarios OPTICA (optica-<slug>@vedere.com.ar)' : ' (sin usuarios OPTICA: definí OPTICA_PASSWORD)'),
  );
}

// ---------- Checkout (prompt 4): configuración comercial y reglas de promoción ----------

async function seedCheckout(adminId: string) {
  const audit = { createdById: adminId, updatedById: adminId };

  // Fila única de configuración: sólo se crea si no existe (lo que edita el admin no se pisa).
  await prisma.configTienda.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      transferenciaHabilitada: true,
      descuentoTransferencia: 10,
      transferenciaHorasReserva: 48,
      mpHabilitado: true,
      mpBilleteraHabilitada: false,
      cuotasGeneral: 6,
      cuotasPorLinea: { MULTIFOCAL: 12 },
      costoEnvio: 0,
      // Prompt 5: plazo de aceptación de la óptica en horas hábiles y horario hábil (hora Argentina).
      plazoAceptacionHoras: 4,
      horaHabilDesde: 9,
      horaHabilHasta: 18,
      sabadoHabil: true,
      updatedById: adminId,
    },
  });

  const promociones = await prisma.promocion.count();
  if (promociones === 0) {
    await prisma.promocion.createMany({
      data: [
        {
          nombre: 'Envío gratis desde $80.000',
          tipo: 'ENVIO_GRATIS',
          montoMinimo: 80000,
          activa: true,
          prioridad: 0,
          ...audit,
        },
        {
          nombre: 'Segundo par al 50 % en Recetados',
          tipo: 'SEGUNDO_50',
          linea: 'RECETADO',
          activa: false,
          prioridad: 1,
          ...audit,
        },
        {
          nombre: '2x1 en Sol',
          tipo: 'DOS_POR_UNO',
          linea: 'SOL',
          activa: false,
          prioridad: 2,
          ...audit,
        },
      ],
    });
  }
  console.log('[seed] Checkout: configuración de tienda y reglas de promoción');
}

// ---------- Prompt 6: plantillas de email, páginas legales y datos fiscales ----------

async function seedPrompt6(adminId: string) {
  for (const t of PLANTILLAS_EMAIL_DEFAULT) {
    // Sólo se crean si faltan: lo que edita el admin no se pisa.
    await prisma.plantillaEmail.upsert({
      where: { tipo: t.tipo },
      update: { variables: t.variables, descripcion: t.descripcion },
      create: { ...t, ctaLabel: t.ctaLabel ?? null, updatedById: adminId },
    });
  }
  for (const pg of PAGINAS_LEGALES_DEFAULT) {
    await prisma.paginaLegal.upsert({ where: { slug: pg.slug }, update: {}, create: { ...pg, updatedById: adminId } });
  }
  await prisma.configTienda.updateMany({
    where: { id: 'default', razonSocial: null },
    data: {
      razonSocial: 'Vedere S.A.S.',
      cuit: '30-00000000-0',
      domicilioFiscal: 'Av. Santa Fe 1234, CABA',
      condicionIva: 'Responsable Inscripto',
      ingresosBrutos: 'Exento',
      inicioActividades: '01/2026',
      emailContacto: 'hola@vedere.com.ar',
    },
  });
  console.log(`[seed] Prompt 6: ${PLANTILLAS_EMAIL_DEFAULT.length} plantillas de email, ${PAGINAS_LEGALES_DEFAULT.length} páginas legales, datos fiscales`);
}

async function main() {
  const admin = await seedAdmin();
  if (process.env.SEED_CATALOGO !== 'false') await seedCatalogo(admin.id);
  // Promos, ópticas socias y cupones: idempotente, se puede correr solo con SEED_CATALOGO=false.
  if (process.env.SEED_TIENDA !== 'false') await seedTienda(admin.id);
  if (process.env.SEED_TIENDA !== 'false') await seedCheckout(admin.id);
  await seedPrompt6(admin.id);
}

main()
  .catch((err) => {
    console.error('[seed] Falló:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
