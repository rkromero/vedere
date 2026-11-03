// Plantillas de email editables (prompt 6). Cada email transaccional tiene un `tipo` fijo; el admin puede
// editar asunto, título, cuerpo y CTA desde /admin/plantillas (tabla plantillas_email). Si no hay fila en la
// base se usa el default de @vedere/db (PLANTILLAS_EMAIL_DEFAULT). Las variables van como {{nombre}}.
// El HTML final lo arma el layout de React Email (emails/Layout.tsx) con el pie fiscal de ConfigTienda.
import { prisma } from '@vedere/db';
import type { Prisma } from '@vedere/db';
import { PLANTILLAS_EMAIL_DEFAULT } from '@vedere/db';
import type { Env } from '../env.js';
import { renderLayoutEmail } from '../emails/Layout.js';
import type { DatosFiscales } from '../emails/Layout.js';
import { enviarEmail } from './email.js';

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
  updatedAt: Date | null;
}

export type VariablesPlantilla = Record<string, string | number | null | undefined>;

export function plantillaDefault(tipo: string) {
  return PLANTILLAS_EMAIL_DEFAULT.find((p) => p.tipo === tipo) ?? null;
}

function resolver(tipo: string, row: Prisma.PlantillaEmailGetPayload<object> | null): PlantillaResuelta | null {
  const def = plantillaDefault(tipo);
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
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Plantilla vigente: la editada en la base o, si no existe, el default. */
export async function cargarPlantilla(tipo: string, db: Db = prisma): Promise<PlantillaResuelta | null> {
  const row = await db.plantillaEmail.findUnique({ where: { tipo } });
  return resolver(tipo, row);
}

/** Todas las plantillas (defaults + personalizadas), en el orden de los defaults y luego las extra de la base. */
export async function listarPlantillas(db: Db = prisma): Promise<PlantillaResuelta[]> {
  const rows = await db.plantillaEmail.findMany();
  const porTipo = new Map(rows.map((r) => [r.tipo, r]));
  const out: PlantillaResuelta[] = [];
  for (const def of PLANTILLAS_EMAIL_DEFAULT) {
    const r = resolver(def.tipo, porTipo.get(def.tipo) ?? null);
    if (r) out.push(r);
    porTipo.delete(def.tipo);
  }
  for (const row of porTipo.values()) {
    const r = resolver(row.tipo, row);
    if (r) out.push(r);
  }
  return out;
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
        return `<ul style="margin:8px 0 12px;padding-left:18px">${lineas.map((l) => `<li>${enfasis(escapar(l.replace(/^[-*]\s+/, '')))}</li>`).join('')}</ul>`;
      }
      return `<p style="margin:0 0 12px">${lineas.map((l) => enfasis(escapar(l))).join('<br>')}</p>`;
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

export interface RenderOpts {
  ctaHref?: string | null;
  /** HTML ya escapado que va después del cuerpo (ítems del pedido, óptica, datos de transferencia). */
  extraHtml?: string;
  fiscal?: DatosFiscales | null;
  urlBaja?: string | null;
}

/** Datos fiscales de la tienda para el pie de los emails (null si no están cargados). */
export async function datosFiscales(db: Db = prisma): Promise<DatosFiscales | null> {
  const c = await db.configTienda.findUnique({
    where: { id: 'default' },
    select: {
      razonSocial: true,
      cuit: true,
      domicilioFiscal: true,
      condicionIva: true,
      ingresosBrutos: true,
      inicioActividades: true,
      emailContacto: true,
    },
  });
  if (!c) return null;
  return c;
}

/** Renderiza una plantilla con sus variables (asunto/título/cuerpo interpolados + layout React Email). */
export async function renderPlantilla(
  env: Env,
  plantilla: Pick<PlantillaResuelta, 'asunto' | 'titulo' | 'cuerpo' | 'ctaLabel'>,
  vars: VariablesPlantilla,
  opts: RenderOpts = {},
): Promise<PlantillaRenderizada> {
  const web = env.WEB_URL.replace(/\/$/, '');
  const asunto = interpolar(plantilla.asunto, vars).trim();
  const titulo = interpolar(plantilla.titulo, vars).trim();
  const cuerpoHtml = cuerpoAHtml(interpolar(plantilla.cuerpo, vars));
  const cta = plantilla.ctaLabel && opts.ctaHref ? { label: interpolar(plantilla.ctaLabel, vars), href: opts.ctaHref } : null;
  const html = await renderLayoutEmail({
    webUrl: web,
    titulo,
    cuerpoHtml,
    extraHtml: opts.extraHtml,
    cta,
    preview: asunto,
    fiscal: opts.fiscal ?? null,
    urlBaja: opts.urlBaja ?? null,
  });
  return { asunto, titulo, html, cta };
}

export interface EnviarPlantillaInput {
  tipo: string;
  para: string;
  vars: VariablesPlantilla;
  ctaHref?: string | null;
  extraHtml?: string;
  pedidoId?: string | null;
  replyTo?: string;
  urlBaja?: string | null;
}

/**
 * Envía (o simula) el email de un tipo dado con la plantilla vigente y el pie fiscal. Devuelve null si la
 * plantilla no existe o está desactivada. Nunca lanza.
 */
export async function enviarPlantilla(env: Env, input: EnviarPlantillaInput, db: Db = prisma) {
  try {
    const [plantilla, fiscal] = await Promise.all([cargarPlantilla(input.tipo, db), datosFiscales(db)]);
    if (!plantilla || !plantilla.activa) return null;
    const r = await renderPlantilla(env, plantilla, input.vars, {
      ctaHref: input.ctaHref,
      extraHtml: input.extraHtml,
      fiscal,
      urlBaja: input.urlBaja,
    });
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

/** Variables de ejemplo para la vista previa y el email de prueba del admin. */
export function variablesEjemplo(env: Env, variables: string[]): VariablesPlantilla {
  const web = env.WEB_URL.replace(/\/$/, '');
  const todas: VariablesPlantilla = {
    nombre: 'Ana',
    nombreAmigo: 'Lucía',
    numero: 'VD-10001',
    total: '$189.000',
    optica: 'Óptica Centro',
    opticaDireccion: 'Av. Rivadavia 4900, Caballito',
    seguimiento: 'AR123456789CA',
    url: `${web}/mi-cuenta/pedidos`,
    urlReferidos: `${web}/mi-cuenta/referidos`,
    urlBaja: `${web}/newsletter/baja/ejemplo`,
    items: '1× Sol A Negro, 1× Recetado R Carey',
    producto: 'Lente Sol Palermo',
    color: 'Carey',
    cupon: 'REF-ABCD-2345',
    descuento: '10%',
    vigencia: '31/12/2026',
    tramite: 'ARR-2026-000001',
    pedido: 'VD-10001',
  };
  const out: VariablesPlantilla = {};
  for (const v of variables) out[v] = todas[v] ?? `{{${v}}}`;
  return out;
}
