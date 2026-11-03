// Seed: usuario ADMIN (desde env) + catálogo base (categorías, marcas, colecciones y 12 productos de ejemplo).
// Idempotente: usa upsert por slug / sku / email. Nunca hardcodear credenciales acá.
import { PrismaClient, Rol } from '@prisma/client';
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

async function main() {
  const admin = await seedAdmin();
  if (process.env.SEED_CATALOGO !== 'false') {
    await seedCatalogo(admin.id);
  }
}

main()
  .catch((err) => {
    console.error('[seed] Falló:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
