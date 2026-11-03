// Plantillas de email editables (prompt 6): listado, edición, vista previa, email de prueba y restablecer.
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vedere/db';
import { Errors } from '../../lib/errors.js';
import { enviarEmail } from '../../lib/email.js';
import {
  cargarPlantilla,
  datosFiscales,
  listarPlantillas,
  plantillaDefault,
  renderPlantilla,
  variablesEjemplo,
} from '../../lib/plantillas.js';
import { parse } from '../../lib/validate.js';
import { plantillaPreview, plantillaPruebaInput, plantillaUpdate } from '../../schemas/sitio.js';

const plantillasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({ items: await listarPlantillas() }));

  app.get<{ Params: { tipo: string } }>('/:tipo', async (request) => {
    const p = await cargarPlantilla(request.params.tipo.toUpperCase());
    if (!p) throw Errors.notFound('Plantilla no encontrada');
    return p;
  });

  app.put<{ Params: { tipo: string } }>('/:tipo', async (request) => {
    const tipo = request.params.tipo.toUpperCase();
    const actual = await cargarPlantilla(tipo);
    if (!actual) throw Errors.notFound('Plantilla no encontrada');
    const body = parse(plantillaUpdate, request.body);
    await prisma.plantillaEmail.upsert({
      where: { tipo },
      update: { asunto: body.asunto, titulo: body.titulo, cuerpo: body.cuerpo, ctaLabel: body.ctaLabel ?? null, ...(body.activa !== undefined ? { activa: body.activa } : {}), updatedById: request.user.sub },
      create: {
        tipo,
        nombre: actual.nombre,
        descripcion: actual.descripcion,
        variables: actual.variables,
        asunto: body.asunto,
        titulo: body.titulo,
        cuerpo: body.cuerpo,
        ctaLabel: body.ctaLabel ?? null,
        activa: body.activa ?? true,
        updatedById: request.user.sub,
      },
    });
    return cargarPlantilla(tipo);
  });

  /** Vuelve al default (borra la fila personalizada). */
  app.post<{ Params: { tipo: string } }>('/:tipo/restablecer', async (request) => {
    const tipo = request.params.tipo.toUpperCase();
    if (!plantillaDefault(tipo)) throw Errors.badRequest('Esta plantilla no tiene un default al que volver');
    await prisma.plantillaEmail.deleteMany({ where: { tipo } });
    return cargarPlantilla(tipo);
  });

  /** HTML renderizado con variables de ejemplo (con el borrador que mande el admin, si lo manda). */
  app.post<{ Params: { tipo: string } }>('/:tipo/vista-previa', async (request) => {
    const tipo = request.params.tipo.toUpperCase();
    const actual = await cargarPlantilla(tipo);
    if (!actual) throw Errors.notFound('Plantilla no encontrada');
    const body = parse(plantillaPreview, request.body ?? {});
    const web = app.env.WEB_URL.replace(/\/$/, '');
    const vars = variablesEjemplo(app.env, actual.variables);
    const r = await renderPlantilla(
      app.env,
      {
        asunto: body.asunto ?? actual.asunto,
        titulo: body.titulo ?? actual.titulo,
        cuerpo: body.cuerpo ?? actual.cuerpo,
        ctaLabel: body.ctaLabel === undefined ? actual.ctaLabel : body.ctaLabel,
      },
      vars,
      { ctaHref: `${web}/`, fiscal: await datosFiscales(), extraHtml: ejemploExtra(tipo) },
    );
    return { asunto: r.asunto, titulo: r.titulo, html: r.html, variables: vars };
  });

  /** Manda la plantilla vigente con datos de ejemplo a una casilla. */
  app.post<{ Params: { tipo: string } }>('/:tipo/prueba', async (request) => {
    const tipo = request.params.tipo.toUpperCase();
    const actual = await cargarPlantilla(tipo);
    if (!actual) throw Errors.notFound('Plantilla no encontrada');
    const body = parse(plantillaPruebaInput, request.body);
    const web = app.env.WEB_URL.replace(/\/$/, '');
    const r = await renderPlantilla(app.env, actual, variablesEjemplo(app.env, actual.variables), {
      ctaHref: `${web}/`,
      fiscal: await datosFiscales(),
      extraHtml: ejemploExtra(tipo),
    });
    const registro = await enviarEmail(
      app.env,
      { para: body.para, asunto: `[Prueba] ${r.asunto}`, html: r.html },
      { tipo: `PRUEBA_${tipo}` },
    );
    return { ok: true, estado: registro.estado, para: body.para };
  });
};

/** Bloque de ejemplo (ítems del pedido) para las plantillas de pedido, así la vista previa se parece al real. */
function ejemploExtra(tipo: string): string {
  if (!/^(ESTADO_|PEDIDO_CONFIRMADO|PAGO_RECHAZADO)/.test(tipo)) return '';
  return '<ul style="margin:8px 0 12px;padding-left:18px"><li>1× Sol A · Negro</li><li>1× Recetado R · Carey</li></ul>';
}

export default plantillasRoutes;
