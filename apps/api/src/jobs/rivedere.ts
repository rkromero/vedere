// Plan Rivedere (prompt 6): cada `rivedereMeses` (default 24) desde la última compra pagada de recetados o
// multifocales, se le recuerda al cliente el control de la vista y se le emite un cupón de recambio
// (RIVEDERE-XXXX-XXXX, `rivedereDescuentoPct`, 90 días). `rivedereAvisadoEn` evita repetir el aviso hasta que
// vuelva a comprar recetados.
import { randomInt } from 'node:crypto';
import { prisma } from '@vedere/db';
import type { Env } from '../env.js';
import { cargarConfig } from '../lib/pedidos.js';
import { enviarPlantilla } from '../lib/plantillas.js';
import { dec } from '../lib/serialize.js';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VIGENCIA_DIAS = 90;
const LOTE = 100;

function aleatorio(largo: number): string {
  let s = '';
  for (let i = 0; i < largo; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

export const fmtPct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}%`;
export const fmtFecha = (d: Date) =>
  d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' });

interface Candidato {
  id: string;
  email: string;
  nombre: string;
  ultima: Date;
}

/** Clientes cuya última compra pagada de recetado/multifocal fue hace ≥ `meses` y aún no fueron avisados por ella. */
export async function candidatosRivedere(meses: number, ahora: Date, db = prisma): Promise<Candidato[]> {
  const limite = new Date(ahora);
  limite.setMonth(limite.getMonth() - meses);
  return db.$queryRaw<Candidato[]>`
    SELECT u.id, u.email, u.nombre, MAX(p.pagado_en) AS ultima
    FROM users u
    JOIN pedidos p ON p.user_id = u.id AND p.estado_pago = 'APROBADO' AND p.estado NOT IN ('CANCELADO', 'DEVUELTO') AND p.pagado_en IS NOT NULL
    JOIN pedido_items i ON i.pedido_id = p.id AND i.linea IN ('RECETADO', 'MULTIFOCAL')
    WHERE u.activo = true AND u.rol = 'CLIENTE'
    GROUP BY u.id, u.email, u.nombre, u.rivedere_avisado_en
    HAVING MAX(p.pagado_en) <= ${limite} AND (u.rivedere_avisado_en IS NULL OR u.rivedere_avisado_en < MAX(p.pagado_en))
    ORDER BY MAX(p.pagado_en) ASC
    LIMIT ${LOTE}`;
}

export async function jobRivedere(env: Env, ahora = new Date()): Promise<number> {
  const cfg = await cargarConfig();
  const pct = dec(cfg.rivedereDescuentoPct) ?? 15;
  const candidatos = await candidatosRivedere(cfg.rivedereMeses, ahora);
  const web = env.WEB_URL.replace(/\/$/, '');
  const vigenciaHasta = new Date(ahora.getTime() + VIGENCIA_DIAS * 86400_000);
  let enviados = 0;
  for (const c of candidatos) {
    // Claim atómico: otra instancia no vuelve a avisar al mismo cliente.
    const claim = await prisma.user.updateMany({
      where: { id: c.id, OR: [{ rivedereAvisadoEn: null }, { rivedereAvisadoEn: { lt: c.ultima } }] },
      data: { rivedereAvisadoEn: ahora },
    });
    if (claim.count === 0) continue;
    let cupon: { codigo: string } | null = null;
    for (let i = 0; i < 10 && !cupon; i++) {
      const codigo = `RIVEDERE-${aleatorio(4)}-${aleatorio(4)}`;
      try {
        cupon = await prisma.cupon.create({
          data: {
            codigo,
            descripcion: `Plan Rivedere: recambio de ${c.nombre}`,
            tipo: 'PORCENTAJE',
            valor: pct,
            usosMax: 1,
            usosMaxPorCliente: 1,
            acumulable: false,
            activo: true,
            vigenciaDesde: ahora,
            vigenciaHasta,
          },
          select: { codigo: true },
        });
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
    }
    if (!cupon) continue;
    const r = await enviarPlantilla(env, {
      tipo: 'PLAN_RIVEDERE',
      para: c.email,
      vars: {
        nombre: c.nombre.split(' ')[0] || c.nombre,
        cupon: cupon.codigo,
        descuento: fmtPct(pct),
        vigencia: fmtFecha(vigenciaHasta),
        url: `${web}/recetados`,
      },
      ctaHref: `${web}/recetados`,
    });
    if (r) enviados++;
  }
  return enviados;
}
