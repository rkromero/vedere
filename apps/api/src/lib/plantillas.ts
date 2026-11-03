// Plantillas de email editables (prompt 6). Cada email transaccional tiene un `tipo` fijo; el admin puede
// editar asunto, título, cuerpo y CTA desde /admin/plantillas (tabla plantillas_email). Si no hay fila en la
// base se usa el default de @vedere/db (PLANTILLAS_EMAIL_DEFAULT). Las variables van como {{nombre}}.
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { PLANTILLAS_EMAIL_DEFAULT } from '@vedere/db';
import type { Env } from '../env.js';
import { enviarEmail, layoutEmail } from './email.js';

type Db = Prisma.TransactionClient | typeof prisma;

export type TipoPlantilla = (typeof PLANTILLAS_EMAIL_DEFAULT)[number]['tipo'];

export interface PlantillaResuelta {
  tipo: string;
  nombre: string;
  descripcion: string | null;
  variables: string[];
  asunto: string;
  titulo: string;
  cuerpo: string;
  ctaLabel: string | null;
  activa: boolean;
  /** true si viene de la base (editada), false si es el default. */
  personalizada: boolean;
}

export type VariablesPlantilla = Record<string, string | number | null | undefined>;

export function plantillaDefault(tipo: string) {
  return PLANTILLAS_EMAIL_DEFAULT.find((p) => p.tipo === tipo) ?? null;
}

/** Plantilla vigente: la editada en la base o, si no existe, el default. */
export async function cargarPlantilla(tipo: string, db: Db = prisma): Promise<PlantillaResuelta | null> {
  const def = plantillaDefault(tipo);
  const row = await db.plantillaEmail.findUnique({ where: { tipo } });
  if (!row && !def) return null;
  return {
    tipo,
    nombre: row?.nombre ?? def?.nombre ?? tipo,
    descripcion: row?.descripcion ?? def?.descripcion ?? null,
    variables: row?.variables?.length ? row.variables : [...(def?.variables ?? [])],
    asunto: row?.asunto ?? def?.asunto ?? '',
    titulo: row?.titulo ?? def?.titulo ?? '',
    cuerpo: row?.cuerpo ?? def?.cuerpo ?? '',
    ctaLabel: row ? row.ctaLabel : (def?.ctaLabel ?? null),
    activa: row?.activa ?? true,
    personalizada: !!row,
  };
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Reemplaza {{variable}} por su valor (texto plano, sin HTML). Variables desconocidas quedan vacías. */
export function interpolar(texto: string, vars: VariablesPlantilla): string {
  return texto.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

/** Cuerpo en texto plano (párrafos separados por línea en blanco, `- ` para listas) → HTML seguro. */
export function cuerpoAHtml(cuerpo: string): string {
  const bloques = cuerpo.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return bloques
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const lineas = b.split('\n');
      if (lineas.every((l) => /^[-*]\s+/.test(l))) {
        return `<ul>${lineas.map((l) => `<li>${enfasis(escapar(l.replace(/^[-*]\s+/, '')))}</li>`).join('')}</ul>`;
      }
      return `<p>${lineas.map((l) => enfasis(escapar(l))).join('<br>')}</p>`;
    })
    .join('');
}

/** **negrita** → <strong>. */
function enfasis(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export interface PlantillaRenderizada {
  asunto: string;
  titulo: string;
  html: string;
  cta: { label: string; href: string } | null;
}

/**
 * Renderiza una plantilla con sus variables. `extraHtml` se agrega después del cuerpo (p. ej. el detalle
 * de ítems de un pedido) y ya debe venir escapado.
 */
export function renderPlantilla(
  env: Env,
  plantilla: Pick<PlantillaResuelta, 'asunto' | 'titulo' | 'cuerpo' | 'ctaLabel'>,
  vars: VariablesPlantilla,
  opts: { ctaHref?: string | null; extraHtml?: string } = {},
): PlantillaRenderizada {
  const asunto = interpolar(plantilla.asunto, vars).trim();
  const titulo = interpolar(plantilla.titulo, vars).trim();
  const cuerpo = cuerpoAHtml(interpolar(plantilla.cuerpo, vars)) + (opts.extraHtml ?? '');
  const cta = plantilla.ctaLabel && opts.ctaHref ? { label: interpolar(plantilla.ctaLabel, vars), href: opts.ctaHref } : null;
  return { asunto, titulo, html: layoutEmail(env, { titulo, cuerpo, cta: cta ?? undefined }), cta };
}

export interface EnviarPlantillaInput {
  tipo: string;
  para: string;
  vars: VariablesPlantilla;
  ctaHref?: string | null;
  extraHtml?: string;
  pedidoId?: string | null;
  replyTo?: string;
}

/**
 * Envía (o simula) el email de un tipo dado con la plantilla vigente. Devuelve null si la plantilla no existe
 * o está desactivada. Nunca lanza.
 */
export async function enviarPlantilla(env: Env, input: EnviarPlantillaInput, db: Db = prisma) {
  try {
    const plantilla = await cargarPlantilla(input.tipo, db);
    if (!plantilla || !plantilla.activa) return null;
    const r = renderPlantilla(env, plantilla, input.vars, { ctaHref: input.ctaHref, extraHtml: input.extraHtml });
    return await enviarEmail(
      env,
      { para: input.para, asunto: r.asunto, html: r.html, replyTo: input.replyTo },
      { pedidoId: input.pedidoId ?? null, tipo: input.tipo },
      db,
    );
  } catch {
    return null;
  }
}
