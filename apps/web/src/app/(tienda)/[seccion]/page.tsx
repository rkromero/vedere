import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listado } from '@/components/tienda/catalogo/Listado';
import type { ContextoListado, SearchParams } from '@/lib/tienda/filtros';

const SECCIONES: Record<string, { titulo: string; descripcion: string; ctx: ContextoListado }> = {
  sol: {
    titulo: 'Anteojos de sol',
    descripcion: 'Protección UV400 en todos los modelos. Polarizados, clásicos y deportivos.',
    ctx: { linea: 'SOL' },
  },
  recetados: {
    titulo: 'Recetados',
    descripcion:
      'Elegís el armazón, cargás tu receta y tu óptica socia arma los lentes. Antirreflejo incluido.',
    ctx: { linea: 'RECETADO' },
  },
  multifocales: {
    titulo: 'Multifocales',
    descripcion: 'Un solo par para cerca, lejos y el medio. Adaptación garantizada.',
    ctx: { linea: 'MULTIFOCAL' },
  },
  accesorios: {
    titulo: 'Accesorios',
    descripcion: 'Estuches, paños y limpieza para que te duren años.',
    ctx: { linea: 'ACCESORIO' },
  },
  novedades: {
    titulo: 'Novedades',
    descripcion: 'Lo último que llegó a Vedere.',
    ctx: { orden: 'novedades' },
  },
  'mas-vendidos': {
    titulo: 'Más vendidos',
    descripcion: 'Los modelos que más eligen.',
    ctx: { orden: 'mas_vendidos' },
  },
};

export function generateStaticParams() {
  return Object.keys(SECCIONES).map((seccion) => ({ seccion }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seccion: string }>;
}): Promise<Metadata> {
  const { seccion } = await params;
  const s = SECCIONES[seccion];
  if (!s) return {};
  return {
    title: s.titulo,
    description: s.descripcion,
    alternates: { canonical: `/${seccion}` },
  };
}

export default async function SeccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ seccion: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { seccion } = await params;
  const s = SECCIONES[seccion];
  if (!s) notFound();
  return (
    <Listado
      titulo={s.titulo}
      descripcion={s.descripcion}
      basePath={`/${seccion}`}
      ctx={s.ctx}
      searchParams={await searchParams}
    />
  );
}
