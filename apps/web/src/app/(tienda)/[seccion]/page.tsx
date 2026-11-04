import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listado } from '@/components/tienda/catalogo/Listado';
import type { ContextoListado, SearchParams } from '@/lib/tienda/filtros';

const SECCIONES: Record<
  string,
  { titulo: string; descripcion: string; ctx: ContextoListado; textoSeo?: { titulo: string; parrafos: string[] } }
> = {
  sol: {
    titulo: 'Anteojos de sol',
    descripcion: 'Protección UV400 en todos los modelos. Polarizados, clásicos y deportivos.',
    ctx: { linea: 'SOL' },
    textoSeo: {
      titulo: 'Cómo elegir tus anteojos de sol',
      parrafos: [
        'Todos nuestros anteojos de sol tienen filtro UV400, que bloquea el 100% de los rayos UVA y UVB. Los polarizados además cortan el reflejo del agua, el asfalto y la nieve: son ideales para manejar y para la playa.',
        'Para elegir la forma, pensá en tu cara: los modelos aviador y redondos suavizan rostros angulosos, los cuadrados y rectangulares dan estructura a caras redondas y el ojo de gato levanta la mirada. Si tenés dudas, probalos sin cargo en tu óptica socia más cercana.',
      ],
    },
  },
  recetados: {
    titulo: 'Recetados',
    descripcion:
      'Elegís el armazón, cargás tu receta y tu óptica socia arma los lentes. Antirreflejo incluido.',
    ctx: { linea: 'RECETADO' },
    textoSeo: {
      titulo: 'Anteojos recetados online',
      parrafos: [
        'Elegís el armazón, cargás tu receta y tu óptica socia arma los lentes con antirreflejo incluido. Retirás en la óptica, ajustado a tu cara, o te lo enviamos a domicilio.',
        'Si no tenés receta vigente, podés sacar turno con un profesional en cualquiera de nuestras ópticas socias.',
      ],
    },
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
      textoSeo={s.textoSeo}
      searchParams={await searchParams}
    />
  );
}
