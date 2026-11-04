// Tests del prompt B2B 4: niveles y logros de las ópticas socias. Unitarios (puntaje, nivel, reglas de subida,
// gracia e inactividad, sugerencia, prioridad en la asignación) e integración (recálculo con pedidos reales,
// beneficios aplicados solos, inactividad, nivel manual, logros, panel, reporte y calificaciones).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluarOpticas } from '../src/lib/asignacion.js';
import type { OpticaCandidata } from '../src/lib/asignacion.js';
import {
  CONFIG_NIVELES_DEFAULT as CFG,
  calcularPuntaje,
  decidirNivel,
  mesLocal,
  nivelPorPuntaje,
  puntosVariable,
  recalcularNivel,
  sugerencias,
  VARIABLES,
} from '../src/lib/niveles.js';
import type { Calidad, Metricas, Variable } from '../src/lib/niveles.js';
import { jobNiveles } from '../src/jobs/niveles.js';
import { crearContexto } from './prompt6-helpers.js';
import type { Contexto, Cookies } from './prompt6-helpers.js';

const hasDb = !!process.env.TEST_DATABASE_URL;
const DIA = 86_400_000;

const metricas = (m: Partial<Metricas>): Metricas => ({
  unidades: 0,
  porCompra: 0,
  pedidosMayoristas: 0,
  unidadesMayoristas: 0,
  meses: 0,
  diasSinActividad: null,
  ultimaActividad: null,
  ...m,
});
const sinWeb: Calidad = { pedidosWeb: 0, aTiempoPct: null, calificaciones: 0, satisfaccion: null };

/** La variable que más puntos de puntaje suma al llegar a su próximo rango (recencia: un pedido da 5). */
function mejorVariable(m: Metricas): { variable: Variable; suma: number } | null {
  const p = calcularPuntaje(m, CFG);
  let mejor: { variable: Variable; suma: number } | null = null;
  for (const v of VARIABLES) {
    if (p.puntos[v] >= 5) continue;
    const a = v === 'recencia' ? 5 : p.puntos[v] + 1;
    const suma = Math.round((a - p.puntos[v]) * CFG.pesos[v] * 20);
    if (!mejor || suma > mejor.suma) mejor = { variable: v, suma };
  }
  return mejor;
}

describe('puntaje y nivel (unitario)', () => {
  it('320 unidades, 8 por compra, 10 meses activos y 20 días desde la última actividad dan 76 puntos: Prisma', () => {
    const m = metricas({ unidades: 320, porCompra: 8, pedidosMayoristas: 40, unidadesMayoristas: 320, meses: 10, diasSinActividad: 20 });
    const p = calcularPuntaje(m, CFG);
    expect(p.puntos).toEqual({ total: 4, porCompra: 3, frecuencia: 4, recencia: 4 });
    expect(p.puntaje).toBe(76);
    expect(nivelPorPuntaje(p.puntaje, CFG)).toBe('PRISMA');
  });

  it('cada variable da de 1 a 5 puntos según sus rangos', () => {
    expect([59, 60, 149, 150, 299, 300, 599, 600].map((v) => puntosVariable('total', v, CFG))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
    expect([2.9, 3, 5, 6, 10, 11, 20, 21].map((v) => puntosVariable('porCompra', v, CFG))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
    expect([0, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((v) => puntosVariable('frecuencia', v, CFG))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect([95, 91, 90, 61, 60, 31, 30, 15, 14, 0].map((v) => puntosVariable('recencia', v, CFG))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(puntosVariable('recencia', null, CFG)).toBe(1);
  });

  it('cortes de nivel: Vetro 0-39, Cristallo 40-59, Prisma 60-79, Zafiro 80+', () => {
    expect([0, 39, 40, 59, 60, 79, 80, 100].map((p) => nivelPorPuntaje(p, CFG))).toEqual([
      'VETRO',
      'VETRO',
      'CRISTALLO',
      'CRISTALLO',
      'PRISMA',
      'PRISMA',
      'ZAFIRO',
      'ZAFIRO',
    ]);
  });

  it('los logros suman puntos extra (con tope) sobre el puntaje base', () => {
    const m = metricas({ unidades: 320, porCompra: 8, pedidosMayoristas: 40, unidadesMayoristas: 320, meses: 10, diasSinActividad: 20 });
    expect(calcularPuntaje(m, CFG, 5)).toMatchObject({ base: 76, puntosExtra: 5, puntaje: 81 });
  });
});

describe('reglas de nivel (unitario)', () => {
  const base = { mes: '2026-11', bajaPendienteDesde: null, calidad: sinWeb, cfg: CFG };

  it('con más de 90 días sin actividad vuelve a Vetro', () => {
    expect(decidirNivel({ ...base, actual: 'PRISMA', calculado: 'CRISTALLO', diasSinActividad: 95 })).toMatchObject({ nivel: 'VETRO' });
    expect(decidirNivel({ ...base, actual: 'ZAFIRO', calculado: 'ZAFIRO', diasSinActividad: 91 }).nivel).toBe('VETRO');
    expect(decidirNivel({ ...base, actual: 'PRISMA', calculado: 'PRISMA', diasSinActividad: 90 }).nivel).toBe('PRISMA');
  });

  it('para subir exige 90% a tiempo y satisfacción de 4,5 (sólo si tiene pedidos web)', () => {
    const sube = { ...base, actual: 'CRISTALLO' as const, calculado: 'PRISMA' as const, diasSinActividad: 10 };
    expect(decidirNivel(sube).nivel).toBe('PRISMA');
    const tarde = decidirNivel({ ...sube, calidad: { pedidosWeb: 10, aTiempoPct: 80, calificaciones: 0, satisfaccion: null } });
    expect(tarde).toMatchObject({ nivel: 'CRISTALLO', motivo: expect.stringMatching(/90% de los pedidos web a tiempo/) });
    const malos = decidirNivel({ ...sube, calidad: { pedidosWeb: 10, aTiempoPct: 100, calificaciones: 4, satisfaccion: 4.2 } });
    expect(malos).toMatchObject({ nivel: 'CRISTALLO', motivo: expect.stringMatching(/satisfacción/) });
    expect(decidirNivel({ ...sube, calidad: { pedidosWeb: 10, aTiempoPct: 90, calificaciones: 4, satisfaccion: 4.5 } }).nivel).toBe('PRISMA');
  });

  it('si baja el puntaje, mantiene el nivel 2 meses de gracia y después baja', () => {
    const baja = { ...base, actual: 'PRISMA' as const, calculado: 'CRISTALLO' as const, diasSinActividad: 10 };
    const m1 = decidirNivel({ ...baja, mes: '2026-11' });
    expect(m1).toMatchObject({ nivel: 'PRISMA', bajaPendienteDesde: '2026-11' });
    const m2 = decidirNivel({ ...baja, mes: '2026-12', bajaPendienteDesde: m1.bajaPendienteDesde });
    expect(m2).toMatchObject({ nivel: 'PRISMA', bajaPendienteDesde: '2026-11' });
    const m3 = decidirNivel({ ...baja, mes: '2027-01', bajaPendienteDesde: m2.bajaPendienteDesde });
    expect(m3).toMatchObject({ nivel: 'CRISTALLO', bajaPendienteDesde: null });
    // Si se recupera durante la gracia, se corta la cuenta.
    expect(decidirNivel({ ...baja, calculado: 'PRISMA', mes: '2026-12', bajaPendienteDesde: '2026-11' })).toMatchObject({ nivel: 'PRISMA', bajaPendienteDesde: null });
  });
});

describe('sugerencia del panel (unitario)', () => {
  const casos: Metricas[] = [
    metricas({ unidades: 320, porCompra: 8, pedidosMayoristas: 40, unidadesMayoristas: 320, meses: 10, diasSinActividad: 20 }),
    metricas({ unidades: 700, porCompra: 9, pedidosMayoristas: 70, unidadesMayoristas: 630, meses: 12, diasSinActividad: 5 }),
    metricas({ unidades: 40, porCompra: 2, pedidosMayoristas: 20, unidadesMayoristas: 40, meses: 3, diasSinActividad: 70 }),
    metricas({ unidades: 620, porCompra: 25, pedidosMayoristas: 20, unidadesMayoristas: 500, meses: 7, diasSinActividad: 3 }),
    metricas({ unidades: 155, porCompra: 5, pedidosMayoristas: 30, unidadesMayoristas: 150, meses: 11, diasSinActividad: 40 }),
  ];
  it('coincide con la variable que más puntos suma', () => {
    for (const m of casos) {
      const nivel = nivelPorPuntaje(calcularPuntaje(m, CFG).puntaje, CFG);
      const s = sugerencias(m, CFG, nivel)[0]!;
      const esperada = mejorVariable(m)!;
      expect(s.variable, JSON.stringify(m)).toBe(esperada.variable);
      expect(s.suma).toBe(esperada.suma);
    }
  });

  it('dice qué hacer y a qué nivel pasa', () => {
    // 8 por compra en 40 pedidos: para promediar 11 hace falta una compra de 11×41 − 320 = 131 unidades.
    const m = metricas({ unidades: 320, porCompra: 8, pedidosMayoristas: 40, unidadesMayoristas: 320, meses: 10, diasSinActividad: 20 });
    const ss = sugerencias(m, CFG, 'PRISMA');
    expect(ss[0]).toMatchObject({ variable: 'total', suma: 7, puntajeNuevo: 83, pasaA: 'ZAFIRO' });
    expect(ss[0]!.mensaje).toBe('Si sumás 280 unidades más en tus compras, pasás a Zafiro.');
    expect(ss.find((s) => s.variable === 'porCompra')!.mensaje).toBe('Si tu próxima compra es de 131 unidades o más, pasás a Zafiro.');
    // Una óptica que compra poco y seguido: la próxima compra grande es lo que más mueve.
    const chica = metricas({ unidades: 700, porCompra: 9, pedidosMayoristas: 1, unidadesMayoristas: 9, meses: 12, diasSinActividad: 5 });
    const s = sugerencias(chica, CFG, 'PRISMA')[0]!;
    expect(s).toMatchObject({ variable: 'porCompra', pasaA: 'ZAFIRO' });
    expect(s.mensaje).toBe('Si tu próxima compra es de 13 unidades o más, pasás a Zafiro.');
  });
});

describe('prioridad por nivel en la asignación (unitario)', () => {
  const optica = (id: string, nivel: number, extra: Partial<OpticaCandidata> = {}): OpticaCandidata => ({
    id,
    nombre: `Óptica ${id}`,
    lat: -34.6,
    lng: -58.4,
    radioKm: 10,
    capacidadDiaria: 10,
    activa: true,
    asignadosHoy: 0,
    prioridadNivel: nivel,
    ...extra,
  });
  const cliente = { lat: -34.61, lng: -58.41 };

  it('a igual distancia gana la óptica de mayor nivel', () => {
    const r = evaluarOpticas(cliente, [optica('a-vetro', 0), optica('b-prisma', 2), optica('c-cristallo', 1)]);
    expect(r.map((e) => e.optica.id)).toEqual(['b-prisma', 'c-cristallo', 'a-vetro']);
    expect(r[0]!.distanciaKm).toBe(r[2]!.distanciaKm);
  });

  it('la distancia sigue mandando, salvo dentro del radio de exclusividad', () => {
    const cerca = optica('cerca', 0, { lat: -34.6105, lng: -58.4105 });
    const lejos = optica('lejos', 3);
    expect(evaluarOpticas(cliente, [lejos, cerca])[0]!.optica.id).toBe('cerca');
    const zafiro = { ...lejos, radioExclusividadKm: 2 };
    const r = evaluarOpticas(cliente, [zafiro, cerca]);
    expect(r[0]).toMatchObject({ exclusiva: true, optica: { id: 'lejos' } });
  });
});

describe.skipIf(!hasDb)('B2B 4: niveles de las ópticas (integración)', () => {
  let ctx: Contexto;
  let opticaP = '';
  let cookieP: Cookies;
  let productoId = '';
  let numero = 90000;

  const get = (url: string, c?: Cookies) => ctx.inject('GET', url, c);
  const put = (url: string, c: Cookies, body: unknown) => ctx.inject('PUT', url, c, body);
  const post = (url: string, c: Cookies, body?: unknown) => ctx.inject('POST', url, c, body ?? {});

  async function usuarioOptica(opticaId: string, email: string) {
    const u = await ctx.prisma.user.create({ data: { email, nombre: `Compras ${email}`, rol: 'OPTICA', opticaId, opticaDueno: true, passwordHash: 'x' } });
    return { vedere_access: ctx.app.jwt.sign({ sub: u.id, email, rol: 'OPTICA', nombre: u.nombre, opticaId }) };
  }

  async function nuevaOptica(slug: string, extra: Record<string, unknown> = {}) {
    return ctx.prisma.optica.create({
      data: { nombre: `Óptica ${slug}`, slug, direccion: 'Calle 1', localidad: 'La Plata', provincia: 'Buenos Aires', codigoPostal: '1900', email: `${slug}@test.vedere`, ...extra },
    });
  }

  /** Pedido mayorista ya despachado (para armar historia de compras). */
  async function despachado(opticaId: string, fecha: Date, unidades: number) {
    await ctx.prisma.pedidoMayorista.create({
      data: {
        numero: `VM-${numero++}`,
        estado: 'DESPACHADO',
        opticaId,
        usuarioNombre: 'Compras',
        usuarioEmail: 'compras@test.vedere',
        entrega: 'RETIRO_DEPOSITO',
        direccionEntrega: 'Depósito',
        unidades,
        subtotalLista: unidades * 1000,
        subtotal: unidades * 1000,
        ivaPct: 21,
        iva: unidades * 210,
        total: unidades * 1210,
        createdAt: fecha,
        aprobadoEn: fecha,
        despachadoEn: fecha,
        items: {
          create: [{ productoId, nombre: 'Aviador', sku: 'NV-AVI', color: 'Negro', precioMayorista: 1000, precioUnitario: 1000, cantidad: unidades, total: unidades * 1000 }],
        },
      },
    });
  }

  /** 40 compras de 8 unidades en 10 meses distintos; la última hace 20 días. */
  async function historiaPrisma(opticaId: string, ahora: Date) {
    const ultima = new Date(ahora.getTime() - 20 * DIA);
    const [a, m] = mesLocal(ultima).split('-').map(Number) as [number, number];
    for (let k = 0; k < 10; k++) {
      const fecha = k === 0 ? ultima : new Date(Date.UTC(a, m - 1 - k, 15, 15));
      for (let i = 0; i < 4; i++) await despachado(opticaId, fecha, 8);
    }
  }

  beforeAll(async () => {
    ctx = await crearContexto();
    const marca = await ctx.prisma.marca.findFirstOrThrow();
    const prod = await ctx.prisma.producto.create({
      data: { nombre: 'Aviador Nivel', slug: 'aviador-nivel', linea: 'SOL', precio: 200000, precioMayorista: 100000, estado: 'PUBLICADO', publicadoEn: new Date(), marcaId: marca.id, variantes: { create: [{ sku: 'NV-AVI', colorArmazon: 'Negro', stock: 30 }] } },
    });
    productoId = prod.id;
    opticaP = (await nuevaOptica('prisma-test')).id;
    cookieP = await usuarioOptica(opticaP, 'compras@prisma.cc');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('una óptica nueva arranca en Vetro con beneficios de Cristallo por 3 meses', async () => {
    const r = await post('/admin/opticas', ctx.staffCookie, {
      nombre: 'Óptica Nueva',
      direccion: 'Av. 7 800',
      localidad: 'La Plata',
      provincia: 'Buenos Aires',
      codigoPostal: '1900',
    });
    expect(r.statusCode, r.body).toBe(201);
    const o = r.json();
    expect(o).toMatchObject({ nivel: 'VETRO', beneficioProvisorio: 'CRISTALLO', condiciones: { nivel: 'VETRO', nivelBeneficios: 'CRISTALLO', descuentoPct: 5, limiteCredito: 1_500_000, plazoPagoDias: 15 } });
    const meses = (new Date(o.beneficioProvisorioHasta).getTime() - Date.now()) / DIA;
    expect(meses).toBeGreaterThan(88);
    expect(meses).toBeLessThan(93);
  });

  it('el recálculo con 320 unidades, 8 por compra, 10 meses y 20 días la pasa a Prisma: 10% de descuento y crédito nuevo sin tocar nada', async () => {
    const antes = (await get('/optica/mayorista/condiciones', cookieP)).json();
    expect(antes.descuentoPct).toBe(0);
    expect((await get('/optica/cuenta', cookieP)).json().resumen).toMatchObject({ limiteCredito: 500_000, plazoPagoDias: 0 });

    const ahora = new Date();
    await historiaPrisma(opticaP, ahora);
    const r = await post(`/admin/niveles/opticas/${opticaP}/recalcular`, ctx.staffCookie);
    expect(r.statusCode, r.body).toBe(200);
    // 76 de las variables + 1 del logro Primer foco (primer pedido despachado).
    expect(r.json()).toMatchObject({ nivelAnterior: 'VETRO', nivel: 'PRISMA', cambio: true, puntaje: 77, logrosNuevos: ['PRIMER_FOCO'] });
    const h = await ctx.prisma.historialNivel.findFirstOrThrow({ where: { opticaId: opticaP } });
    expect(h).toMatchObject({ mes: mesLocal(ahora), nivel: 'PRISMA', nivelCalculado: 'PRISMA', puntosExtra: 1 });
    expect(h.detalle).toMatchObject({ base: 76, puntos: { total: 4, porCompra: 3, frecuencia: 4, recencia: 4 } });

    const despues = (await get('/optica/mayorista/condiciones', cookieP)).json();
    expect(despues.descuentoPct).toBe(10);
    expect((await get('/optica/mayorista/productos/aviador-nivel', cookieP)).json()).toMatchObject({ precio: { descuentoPct: 10, unitario: 90000 } });
    expect((await get('/optica/cuenta', cookieP)).json().resumen).toMatchObject({ limiteCredito: 4_000_000, plazoPagoDias: 30 });
    expect(await ctx.prisma.emailEnviado.count({ where: { tipo: 'NIVEL_CAMBIO', para: 'prisma-test@test.vedere' } })).toBe(1);
    expect(await ctx.prisma.emailEnviado.count({ where: { tipo: 'NIVEL_LOGRO', para: 'prisma-test@test.vedere' } })).toBe(1);
  });

  it('una excepción por óptica pisa el beneficio del nivel (y se puede volver al del nivel)', async () => {
    await put(`/admin/opticas/${opticaP}`, ctx.staffCookie, { descuentoPct: 12, limiteCredito: 2_000_000 });
    expect((await get('/optica/mayorista/condiciones', cookieP)).json().descuentoPct).toBe(12);
    expect((await get('/optica/cuenta', cookieP)).json().resumen.limiteCredito).toBe(2_000_000);
    const r = await put(`/admin/opticas/${opticaP}`, ctx.staffCookie, { descuentoPct: null, limiteCredito: null });
    expect(r.json()).toMatchObject({ descuentoPct: null, limiteCredito: null, condiciones: { descuentoPct: 10, limiteCredito: 4_000_000 } });
  });

  it('el panel /optica/nivel muestra puntaje, puntos por variable y la sugerencia de la variable que más suma', async () => {
    const r = await get('/optica/nivel', cookieP);
    expect(r.statusCode, r.body).toBe(200);
    const p = r.json();
    expect(p).toMatchObject({ nivel: 'PRISMA', nivelInfo: { nombre: 'Prisma', color: '#3A5BD9' }, puntaje: 77, base: 76, puntosExtra: 1 });
    expect(p.variables.map((v: { variable: string; puntos: number }) => [v.variable, v.puntos])).toEqual([
      ['total', 4],
      ['porCompra', 3],
      ['frecuencia', 4],
      ['recencia', 4],
    ]);
    const esperada = mejorVariable(p.metricas)!;
    expect(p.sugerencia).toMatchObject({ variable: esperada.variable, suma: esperada.suma, pasaA: 'ZAFIRO' });
    expect(p.sugerencia.mensaje).toMatch(/pasás a Zafiro/);
    expect(p.beneficios).toMatchObject({ actual: { nivel: 'PRISMA', descuentoPct: 10 }, siguiente: { nivel: 'ZAFIRO', descuentoPct: 15, limiteCredito: 8_000_000, plazoPagoDias: 45 } });
    expect(p.logros).toHaveLength(6);
    expect(p.logros.filter((l: { obtenido: boolean }) => l.obtenido).map((l: { logro: string }) => l.logro)).toEqual(['PRIMER_FOCO']);
    expect(p.progreso).toMatchObject({ desde: 60, hasta: 80, siguiente: 'ZAFIRO', faltan: 3 });
  });

  it('con 95 días sin actividad, el recálculo la pasa a Vetro', async () => {
    const o = await nuevaOptica('inactiva', { nivel: 'PRISMA', puntaje: 70 });
    const ahora = new Date();
    for (let i = 0; i < 10; i++) await despachado(o.id, new Date(ahora.getTime() - (95 + i * 20) * DIA), 30);
    const r = await recalcularNivel(ctx.app.env, o.id, { ahora });
    expect(r).toMatchObject({ nivelAnterior: 'PRISMA', nivel: 'VETRO', cambio: true, motivo: expect.stringMatching(/90 días sin actividad/) });
    expect((await ctx.prisma.optica.findUniqueOrThrow({ where: { id: o.id } })).nivel).toBe('VETRO');
  });

  it('a igual distancia, un pedido web se asigna a la óptica de mayor nivel', async () => {
    // Dos ópticas en la misma esquina de Ushuaia (lejos de las demás): la Cristallo gana a la Vetro.
    const coords = { lat: -54.8019, lng: -68.303, radioKm: 10, capacidadDiaria: 5 };
    const vetro = await nuevaOptica('ushuaia-a', { ...coords, nivel: 'VETRO' });
    const cristallo = await nuevaOptica('ushuaia-b', { ...coords, nivel: 'CRISTALLO' });
    const { cargarCandidatas, elegirOptica } = await import('../src/lib/asignacion.js');
    const elegida = elegirOptica({ lat: -54.805, lng: -68.31 }, await cargarCandidatas());
    expect(elegida?.optica.id).toBe(cristallo.id);
    // Con nivel manual Zafiro (motivo y vencimiento), la Vetro pasa adelante.
    const m = await put(`/admin/niveles/opticas/${vetro.id}/manual`, ctx.staffCookie, { nivel: 'ZAFIRO', motivo: 'Socia fundadora', hasta: '2099-12-31' });
    expect(m.statusCode, m.body).toBe(200);
    expect(m.json()).toMatchObject({ nivel: 'ZAFIRO', manual: { nivel: 'ZAFIRO', motivo: 'Socia fundadora' } });
    expect(elegirOptica({ lat: -54.805, lng: -68.31 }, await cargarCandidatas())?.optica.id).toBe(vetro.id);
    const sinMotivo = await put(`/admin/niveles/opticas/${vetro.id}/manual`, ctx.staffCookie, { nivel: 'ZAFIRO', motivo: '' });
    expect(sinMotivo.statusCode).toBe(400);
    expect((await ctx.inject('DELETE', `/admin/niveles/opticas/${vetro.id}/manual`, ctx.staffCookie)).json()).toMatchObject({ nivel: 'VETRO', manual: null });
  });

  it('la óptica ve su nivel pero no puede tocar niveles; config editable con validación', async () => {
    expect((await get('/admin/niveles/reporte', cookieP)).statusCode).toBe(403);
    expect((await post(`/admin/niveles/opticas/${opticaP}/recalcular`, cookieP)).statusCode).toBe(403);
    const cfg = (await get('/admin/niveles/config', ctx.staffCookie)).json().config;
    expect(cfg.cortes).toEqual({ CRISTALLO: 40, PRISMA: 60, ZAFIRO: 80 });
    const mal = await put('/admin/niveles/config', ctx.staffCookie, { ...cfg, pesos: { ...cfg.pesos, total: 0.5 } });
    expect(mal.statusCode).toBe(400);
    const nuevo = { ...cfg, beneficios: { ...cfg.beneficios, PRISMA: { ...cfg.beneficios.PRISMA, descuentoPct: 11 } } };
    expect((await put('/admin/niveles/config', ctx.staffCookie, nuevo)).statusCode).toBe(200);
    // El beneficio editado rige al instante.
    expect((await get('/optica/mayorista/condiciones', cookieP)).json().descuentoPct).toBe(11);
    await put('/admin/niveles/config', ctx.staffCookie, cfg);
  });

  it('reporte por nivel, recálculo general y job mensual idempotente', async () => {
    const rep = (await get('/admin/niveles/reporte', ctx.staffCookie)).json();
    expect(rep.porNivel.PRISMA).toBeGreaterThanOrEqual(1);
    expect(rep.evolucion).toHaveLength(12);
    expect(rep.evolucion.at(-1)).toMatchObject({ mes: mesLocal(new Date()) });
    expect(rep.opticas.find((o: { id: string }) => o.id === opticaP)).toMatchObject({ nivel: 'PRISMA', puntaje: 77 });
    const todas = await post('/admin/niveles/recalcular', ctx.staffCookie);
    expect(todas.json().recalculadas).toBeGreaterThanOrEqual(5);
    // Ya hay historial del mes: el job no vuelve a correr.
    expect(await jobNiveles(ctx.app.env)).toBe(0);
    const mesQueViene = new Date(Date.now() + 32 * DIA);
    await jobNiveles(ctx.app.env, mesQueViene);
    expect(await ctx.prisma.historialNivel.count({ where: { mes: mesLocal(mesQueViene) } })).toBeGreaterThan(0);
  });

  it('logros: Vitrina Vedere con muestrario y 3 fotos; Embajadora al aprobar una óptica que la refirió', async () => {
    const boundary = 'xxVITRINAxx';
    const subir = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/optica/nivel/vitrina',
        cookies: cookieP,
        payload: Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="vitrina.png"\r\nContent-Type: image/png\r\n\r\n`),
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]),
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      });
    for (let i = 0; i < 3; i++) expect((await subir()).statusCode).toBe(201);
    await put(`/admin/opticas/${opticaP}`, ctx.staffCookie, { muestrario: true });
    const logros = await ctx.prisma.logroOptica.findMany({ where: { opticaId: opticaP }, select: { logro: true } });
    expect(logros.map((l) => l.logro).sort()).toEqual(['PRIMER_FOCO', 'VITRINA_VEDERE']);

    await ctx.prisma.optica.update({ where: { id: opticaP }, data: { cuit: '30-71234569-4' } });
    const s = await ctx.prisma.solicitudOptica.create({
      data: {
        razonSocial: 'Referida SRL',
        nombreComercial: 'Óptica Referida',
        cuit: '20-12345678-6',
        condicionIva: 'MONOTRIBUTO',
        direccion: 'Calle 2',
        localidad: 'Quilmes',
        provincia: 'Buenos Aires',
        codigoPostal: '1878',
        telefono: '+54 11 4444-0000',
        email: 'referida@test.vedere',
        opticoResponsable: 'Juana Pérez',
        matricula: 'MP 1234',
        habilitacionUrl: '/uploads/opticas-habilitaciones/x.pdf',
        aceptaTerminosEn: new Date(),
        referidaPorCuit: '30-71234569-4',
      },
    });
    const ap = await post(`/admin/opticas/solicitudes/${s.id}/aprobar`, ctx.staffCookie, {});
    expect(ap.statusCode, ap.body).toBe(200);
    expect(await ctx.prisma.logroOptica.count({ where: { opticaId: opticaP, logro: 'EMBAJADORA' } })).toBe(1);
    const nueva = await ctx.prisma.optica.findFirstOrThrow({ where: { cuit: '20-12345678-6' } });
    expect(nueva).toMatchObject({ referidaPorId: opticaP, nivel: 'VETRO', beneficioProvisorio: 'CRISTALLO' });
  });

  it('el cliente califica un pedido entregado (una vez) y la satisfacción entra en la calidad de la óptica', async () => {
    const pedido = await ctx.prisma.pedido.create({
      data: {
        numero: 'W-NIVEL-1',
        estado: 'ENTREGADO',
        userId: ctx.ids.cliente,
        email: 'cli@p6.vedere',
        nombre: 'Ana',
        dni: '30123456',
        telefono: '1155551234',
        modalidad: 'RETIRO_OPTICA',
        opticaId: opticaP,
        direccion: 'Calle 1',
        localidad: 'La Plata',
        provincia: 'Buenos Aires',
        codigoPostal: '1900',
        subtotal: 100000,
        total: 100000,
        metodoPago: 'TRANSFERENCIA',
        estadoPago: 'APROBADO',
        entregadoEn: new Date(),
      },
    });
    const mala = await post(`/cuenta/pedidos/${pedido.id}/calificacion`, ctx.clienteCookie, { puntaje: 6 });
    expect(mala.statusCode).toBe(400);
    const ok = await post(`/cuenta/pedidos/${pedido.id}/calificacion`, ctx.clienteCookie, { puntaje: 4, comentario: 'Muy amables' });
    expect(ok.statusCode, ok.body).toBe(201);
    expect((await post(`/cuenta/pedidos/${pedido.id}/calificacion`, ctx.clienteCookie, { puntaje: 5 })).statusCode).toBe(409);
    expect((await get(`/cuenta/pedidos/${pedido.id}`, ctx.clienteCookie)).json().calificacion).toMatchObject({ puntaje: 4 });
    const panel = (await get('/optica/nivel', cookieP)).json();
    expect(panel.calidad).toMatchObject({ pedidosWeb: 1, aTiempoPct: 100, calificaciones: 1, satisfaccion: 4 });
    expect(panel.calidadParaSubir).toMatchObject({ ok: false, motivo: expect.stringMatching(/satisfacción de 4,5/) });
  });
});
