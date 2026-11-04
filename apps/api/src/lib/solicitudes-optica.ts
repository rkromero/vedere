// Alta de ópticas socias (B2B 1): la óptica manda la solicitud desde /opticas/sumate, el equipo la aprueba o
// rechaza en /admin/opticas (pestaña Solicitudes). Al aprobar se crea (o se vincula por CUIT) la Optica y un
// usuario OPTICA dueño con contraseña provisoria, que tiene que cambiar en el primer ingreso.
import { randomInt } from 'node:crypto';
import argon2 from 'argon2';
import { prisma } from '@vedere/db';
import type { Optica, Prisma, SolicitudOptica } from '@vedere/db';
import type { Env } from '../env.js';
import { Errors } from './errors.js';
import { emailAdmin } from './email.js';
import { geocodificar } from './geo.js';
import { evaluarLogros, nivelInicial } from './niveles.js';
import { enviarPlantilla } from './plantillas.js';
import { uniqueSlug } from './slug.js';

const web = (env: Env) => env.WEB_URL.replace(/\/$/, '');
const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Contraseña provisoria legible (sin 0/O ni 1/l/I): 4 letras + 4 números + 2 letras, p. ej. "Kmra-4827-Tx". */
export function passwordProvisoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const mayus = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const nums = '23456789';
  const pick = (set: string, n: number) => Array.from({ length: n }, () => set[randomInt(set.length)]).join('');
  return `${pick(mayus, 1)}${pick(letras, 3)}-${pick(nums, 4)}-${pick(mayus, 1)}${pick(letras, 1)}`;
}

export const hashPassword = (p: string) => argon2.hash(p, { type: argon2.argon2id });

export function serializeSolicitudOptica(s: SolicitudOptica & { optica?: Pick<Optica, 'id' | 'nombre' | 'slug'> | null }) {
  return {
    id: s.id,
    razonSocial: s.razonSocial,
    nombreComercial: s.nombreComercial,
    cuit: s.cuit,
    condicionIva: s.condicionIva,
    direccion: s.direccion,
    localidad: s.localidad,
    provincia: s.provincia,
    codigoPostal: s.codigoPostal,
    telefono: s.telefono,
    whatsapp: s.whatsapp,
    email: s.email,
    opticoResponsable: s.opticoResponsable,
    matricula: s.matricula,
    habilitacionUrl: s.habilitacionUrl,
    habilitacionNombre: s.habilitacionNombre,
    referidaPorCuit: s.referidaPorCuit,
    aceptaTerminosEn: s.aceptaTerminosEn,
    estado: s.estado,
    motivoRechazo: s.motivoRechazo,
    opticaId: s.opticaId,
    optica: s.optica ?? null,
    usuarioId: s.usuarioId,
    resueltoPorId: s.resueltoPorId,
    resueltoEn: s.resueltoEn,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export type SolicitudOpticaData = Omit<
  Prisma.SolicitudOpticaUncheckedCreateInput,
  'id' | 'estado' | 'aceptaTerminosEn' | 'createdAt' | 'updatedAt'
>;

/** Registra la solicitud, confirma a la óptica por email y avisa al equipo. */
export async function crearSolicitudOptica(env: Env, data: SolicitudOpticaData) {
  const pendiente = await prisma.solicitudOptica.findFirst({
    where: { cuit: data.cuit, estado: 'PENDIENTE' },
    select: { id: true },
  });
  if (pendiente) {
    throw Errors.conflict('Ya hay una solicitud pendiente con ese CUIT: te vamos a responder por email');
  }
  const s = await prisma.solicitudOptica.create({ data: { ...data, aceptaTerminosEn: new Date() } });

  await enviarPlantilla(env, {
    tipo: 'SOLICITUD_OPTICA_RECIBIDA',
    para: s.email,
    vars: { nombre: primerNombre(s.opticoResponsable), optica: s.nombreComercial, razonSocial: s.razonSocial, cuit: s.cuit },
  });
  try {
    await emailAdmin(env, {
      tipo: 'ADMIN_SOLICITUD_OPTICA',
      asunto: `Nueva solicitud de óptica: ${s.nombreComercial}`,
      cuerpoHtml: `<p><strong>${escapar(s.nombreComercial)}</strong> (${escapar(s.razonSocial)}, CUIT ${escapar(s.cuit)}) de ${escapar(s.localidad)}, ${escapar(s.provincia)} pidió sumarse a la red de ópticas socias.</p>`,
      href: `${web(env)}/admin/opticas/solicitudes/${s.id}`,
    });
  } catch {
    /* el aviso al equipo nunca bloquea la solicitud */
  }
  return s;
}

export interface ResultadoAprobacion {
  solicitud: ReturnType<typeof serializeSolicitudOptica>;
  optica: { id: string; nombre: string; slug: string; creada: boolean };
  usuario: { id: string; email: string; nombre: string; creado: boolean };
  /** Se muestra una sola vez al admin (por si el email no llega). */
  passwordProvisoria: string;
}

export async function aprobarSolicitudOptica(
  env: Env,
  id: string,
  input: { opticaId?: string | null; comisionPct?: number; radioKm?: number; capacidadDiaria?: number },
  actorId: string,
): Promise<ResultadoAprobacion> {
  const s = await prisma.solicitudOptica.findUnique({ where: { id } });
  if (!s) throw Errors.notFound('Solicitud no encontrada');
  if (s.estado !== 'PENDIENTE') throw Errors.conflict(`La solicitud ya está ${s.estado === 'APROBADA' ? 'aprobada' : 'rechazada'}`);

  // Óptica: la indicada, o una existente con el mismo CUIT, o una nueva.
  let existente: Optica | null = null;
  if (input.opticaId) {
    existente = await prisma.optica.findUnique({ where: { id: input.opticaId } });
    if (!existente) throw Errors.badRequest('La óptica indicada no existe');
  } else {
    existente = await prisma.optica.findFirst({ where: { cuit: s.cuit } });
  }

  // Usuario: el email de la solicitud. Si ya existe con otro rol no se puede reutilizar.
  const userExistente = await prisma.user.findUnique({ where: { email: s.email } });
  if (userExistente && userExistente.rol !== 'OPTICA') {
    throw Errors.conflict(
      `Ya existe una cuenta ${userExistente.rol === 'CLIENTE' ? 'de cliente' : 'del equipo'} con el email ${s.email}. Pedile a la óptica otro email o cambiá el de esa cuenta.`,
    );
  }
  if (userExistente?.opticaId && existente && userExistente.opticaId !== existente.id) {
    throw Errors.conflict(`El usuario ${s.email} ya pertenece a otra óptica`);
  }
  if (userExistente?.opticaId && !existente) {
    throw Errors.conflict(`El usuario ${s.email} ya pertenece a otra óptica`);
  }

  // Coordenadas para la asignación automática (si hay Google Maps; si no, se cargan después en el ABM).
  let coords: { lat: number; lng: number } | null = null;
  if (!existente?.lat) {
    try {
      const g = await geocodificar(env, { direccion: `${s.direccion}, ${s.localidad}, ${s.provincia}, Argentina` });
      if (g) coords = { lat: g.lat, lng: g.lng };
    } catch {
      /* sin coordenadas: el admin las completa */
    }
  }

  const password = passwordProvisoria();
  const passwordHash = await hashPassword(password);
  const slugNuevo = existente
    ? null
    : await uniqueSlug(
        `${s.nombreComercial} ${s.localidad}`,
        async (x) => !!(await prisma.optica.findUnique({ where: { slug: x }, select: { id: true } })),
      );

  // B2B 4: la óptica que la recomendó (por CUIT) suma el logro Embajadora.
  const referente = s.referidaPorCuit
    ? await prisma.optica.findFirst({ where: { cuit: s.referidaPorCuit, NOT: { cuit: s.cuit } }, select: { id: true } })
    : null;
  const inicial = await nivelInicial();

  const r = await prisma.$transaction(async (tx) => {
    const fiscales = {
      razonSocial: s.razonSocial,
      cuit: s.cuit,
      condicionIva: s.condicionIva,
      opticoResponsable: s.opticoResponsable,
      matricula: s.matricula,
      habilitacionUrl: s.habilitacionUrl,
    };
    const optica = existente
      ? await tx.optica.update({
          where: { id: existente.id },
          data: {
            ...fiscales,
            email: existente.email ?? s.email,
            telefono: existente.telefono ?? s.telefono,
            whatsapp: existente.whatsapp ?? s.whatsapp,
            ...(coords && !existente.lat ? coords : {}),
            ...(input.comisionPct !== undefined ? { comisionPct: input.comisionPct } : {}),
            ...(input.radioKm !== undefined ? { radioKm: input.radioKm } : {}),
            ...(input.capacidadDiaria !== undefined ? { capacidadDiaria: input.capacidadDiaria } : {}),
            updatedById: actorId,
          },
        })
      : await tx.optica.create({
          data: {
            ...fiscales,
            nombre: s.nombreComercial,
            slug: slugNuevo!,
            direccion: s.direccion,
            localidad: s.localidad,
            provincia: s.provincia,
            codigoPostal: s.codigoPostal,
            telefono: s.telefono,
            whatsapp: s.whatsapp,
            email: s.email,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            activa: true,
            ...inicial,
            referidaPorId: referente?.id ?? null,
            ...(input.comisionPct !== undefined ? { comisionPct: input.comisionPct } : {}),
            ...(input.radioKm !== undefined ? { radioKm: input.radioKm } : {}),
            ...(input.capacidadDiaria !== undefined ? { capacidadDiaria: input.capacidadDiaria } : {}),
            createdById: actorId,
            updatedById: actorId,
          },
        });

    const datosUsuario = {
      rol: 'OPTICA' as const,
      opticaId: optica.id,
      opticaDueno: true,
      activo: true,
      passwordHash,
      debeCambiarPassword: true,
    };
    const usuario = userExistente
      ? await tx.user.update({ where: { id: userExistente.id }, data: datosUsuario })
      : await tx.user.create({
          data: { ...datosUsuario, email: s.email, nombre: s.opticoResponsable, telefono: s.telefono },
        });
    if (userExistente) {
      // La contraseña cambió: se cierran las sesiones abiertas.
      await tx.refreshToken.updateMany({ where: { userId: usuario.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    const solicitud = await tx.solicitudOptica.update({
      where: { id: s.id },
      data: { estado: 'APROBADA', opticaId: optica.id, usuarioId: usuario.id, resueltoPorId: actorId, resueltoEn: new Date() },
      include: { optica: { select: { id: true, nombre: true, slug: true } } },
    });
    return { optica, usuario, solicitud };
  });

  if (referente) await evaluarLogros(env, referente.id);

  await enviarPlantilla(env, {
    tipo: 'SOLICITUD_OPTICA_APROBADA',
    para: r.usuario.email,
    vars: {
      nombre: primerNombre(r.usuario.nombre),
      optica: r.optica.nombre,
      email: r.usuario.email,
      password,
      url: `${web(env)}/optica/login`,
    },
    ctaHref: `${web(env)}/optica/login`,
  });

  return {
    solicitud: serializeSolicitudOptica(r.solicitud),
    optica: { id: r.optica.id, nombre: r.optica.nombre, slug: r.optica.slug, creada: !existente },
    usuario: { id: r.usuario.id, email: r.usuario.email, nombre: r.usuario.nombre, creado: !userExistente },
    passwordProvisoria: password,
  };
}

export async function rechazarSolicitudOptica(env: Env, id: string, motivo: string, actorId: string) {
  const s = await prisma.solicitudOptica.findUnique({ where: { id } });
  if (!s) throw Errors.notFound('Solicitud no encontrada');
  if (s.estado !== 'PENDIENTE') throw Errors.conflict(`La solicitud ya está ${s.estado === 'APROBADA' ? 'aprobada' : 'rechazada'}`);
  const r = await prisma.solicitudOptica.update({
    where: { id },
    data: { estado: 'RECHAZADA', motivoRechazo: motivo, resueltoPorId: actorId, resueltoEn: new Date() },
    include: { optica: { select: { id: true, nombre: true, slug: true } } },
  });
  await enviarPlantilla(env, {
    tipo: 'SOLICITUD_OPTICA_RECHAZADA',
    para: s.email,
    vars: { nombre: primerNombre(s.opticoResponsable), optica: s.nombreComercial, motivo, url: `${web(env)}/opticas/sumate` },
    ctaHref: `${web(env)}/opticas/sumate`,
  });
  return serializeSolicitudOptica(r);
}
