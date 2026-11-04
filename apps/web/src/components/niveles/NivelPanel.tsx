'use client';
// B2B 4: panel de nivel de una óptica. Lo usan la óptica (/optica/nivel, puede cargar fotos de su vitrina)
// y el admin (/admin/niveles/[id], sólo lectura + acciones propias).
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { Beneficios, NivelOptica, PanelNivel } from '@/lib/niveles';
import { formatMesCorto, LOGRO_ICONO, NIVEL_INFO, NIVELES, valorVariable } from '@/lib/niveles';
import { Badge, Card } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

export function NivelChip({ nivel, className = '' }: { nivel: NivelOptica; className?: string }) {
  const i = NIVEL_INFO[nivel];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-negro/15 px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ backgroundColor: i.color, color: i.texto }}
      data-nivel={nivel}
    >
      {i.nombre}
    </span>
  );
}

function Puntos({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${n} de 5 puntos`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2 w-5 rounded-full ${i <= n ? 'bg-negro' : 'bg-negro/10'}`} />
      ))}
    </span>
  );
}

function filasBeneficios(b: Beneficios): Array<[string, string]> {
  return [
    ['Descuento mayorista', `${b.descuentoPct}%`],
    ['Crédito', formatPrecio(b.limiteCredito)],
    ['Plazo de pago', b.plazoPagoDias === 0 ? 'Contado' : `${b.plazoPagoDias} días`],
    ['Radio de exclusividad', b.radioExclusividadKm > 0 ? `${b.radioExclusividadKm} km` : '—'],
    ['Acceso anticipado a colecciones', b.accesoAnticipadoDias > 0 ? `${b.accesoAnticipadoDias} días antes` : '—'],
  ];
}

export function NivelPanel({ panel, modo, acciones }: { panel: PanelNivel; modo: 'optica' | 'admin'; acciones?: ReactNode }) {
  const info = NIVEL_INFO[panel.nivel];
  const sig = panel.progreso.siguiente;
  const cond = panel.condiciones;
  return (
    <div className="space-y-6" data-testid="panel-nivel">
      <section
        className="relative overflow-hidden rounded-2xl border border-negro/10 p-6 sm:p-8"
        style={{ backgroundColor: info.color, color: info.texto }}
        data-testid="nivel-actual"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{modo === 'optica' ? 'Tu nivel' : panel.optica.nombre}</p>
            <h2 className="mt-1 font-campaign text-5xl font-semibold tracking-tight sm:text-6xl">{info.nombre}</h2>
            <p className="mt-2 text-sm opacity-80">
              Desde el {formatFecha(panel.nivelDesde)}
              {panel.manual && ` · asignado a mano${panel.manual.hasta ? ` hasta el ${formatFecha(panel.manual.hasta)}` : ''}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Puntaje</p>
            <p className="font-campaign text-6xl font-semibold tabular-nums" data-testid="puntaje">
              {panel.puntaje}
            </p>
            {panel.puntosExtra > 0 && (
              <p className="text-xs opacity-80">
                {panel.base} + {panel.puntosExtra} por logros
              </p>
            )}
          </div>
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-xs opacity-80">
            <span>
              {info.nombre} · {panel.progreso.desde}
            </span>
            <span>{sig ? `${NIVEL_INFO[sig].nombre} · ${panel.progreso.hasta}` : 'Nivel máximo'}</span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full" style={{ backgroundColor: info.texto === '#FFFFFF' ? 'rgba(255,255,255,.2)' : 'rgba(10,10,10,.1)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${panel.progreso.pct}%`, backgroundColor: info.texto }}
              role="progressbar"
              aria-valuenow={panel.progreso.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={sig ? `Progreso hacia ${NIVEL_INFO[sig].nombre}` : 'Nivel máximo'}
            />
          </div>
          {sig && (
            <p className="mt-2 text-sm">
              {panel.progreso.faltan > 0 ? `Te faltan ${panel.progreso.faltan} puntos para ${NIVEL_INFO[sig].nombre}.` : `Tu puntaje ya alcanza ${NIVEL_INFO[sig].nombre}: se aplica en el próximo recálculo.`}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Escala de niveles">
          {NIVELES.map((n) => (
            <span
              key={n}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${n === panel.nivel ? 'ring-2 ring-current' : 'opacity-70'}`}
              style={{ backgroundColor: NIVEL_INFO[n].color, color: NIVEL_INFO[n].texto }}
            >
              {NIVEL_INFO[n].nombre} {n === 'VETRO' ? '0+' : `${panel.cortes[n]}+`}
            </span>
          ))}
        </div>
      </section>

      {acciones}

      {(panel.provisorio || panel.gracia || panel.manual) && (
        <div className="space-y-2 text-sm">
          {panel.provisorio && (
            <p className="rounded-lg bg-[#7FD1C1]/25 px-4 py-3">
              Bienvenida: tenés los beneficios de <strong>{NIVEL_INFO[panel.provisorio.nivel].nombre}</strong> hasta el {formatFecha(panel.provisorio.hasta)}.
            </p>
          )}
          {panel.gracia && (
            <p className="rounded-lg bg-[#b7791f]/10 px-4 py-3 text-[#8a5a12]">
              Tu puntaje bajó: mantenés {NIVEL_INFO[panel.nivel].nombre} hasta el recálculo de {formatMesCorto(panel.gracia.hasta)}. Si lo recuperás antes, no cambia nada.
            </p>
          )}
          {panel.manual?.motivo && modo === 'admin' && <p className="rounded-lg bg-gris-claro px-4 py-3">Nivel manual: {panel.manual.motivo}</p>}
        </div>
      )}

      {panel.sugerencia && (
        <section className="rounded-2xl border-2 border-negro bg-blanco p-5 sm:p-6" data-testid="sugerencia">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gris-medio">{modo === 'optica' ? 'Para subir' : 'Lo que más le suma'}</p>
          <p className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">{panel.sugerencia.mensaje}</p>
          {!panel.calidadParaSubir.ok && <p className="mt-2 text-sm text-carey">{panel.calidadParaSubir.motivo}.</p>}
          {panel.sugerencias.length > 1 && (
            <ul className="mt-4 space-y-1 text-sm text-gris-medio">
              {panel.sugerencias.slice(1).map((s) => (
                <li key={s.variable}>· {s.mensaje}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Cómo se calcula (últimos 12 meses)">
            <ul className="divide-y divide-negro/5" data-testid="variables">
              {panel.variables.map((v) => (
                <li key={v.variable} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-medium">{v.nombre}</p>
                    <p className="text-xs text-gris-medio">
                      {valorVariable(v.variable, v.valor)} · pesa {Math.round(v.peso * 100)}%
                    </p>
                  </div>
                  <Puntos n={v.puntos} />
                  <span className="w-16 text-right text-sm tabular-nums">{v.aporte.toLocaleString('es-AR')} pts</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gris-medio">
              Cada variable da de 1 a 5 puntos; el puntaje es la suma ponderada × 20, más hasta {panel.reglas.maxPuntosLogrosAnio} puntos por logros del último año.
            </p>
          </Card>

          <Card title="Logros">
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="logros">
              {panel.logros.map((l) => (
                <li
                  key={l.logro}
                  className={`flex gap-3 rounded-xl border p-3 ${l.obtenido ? 'border-negro bg-blanco' : 'border-dashed border-negro/20 text-gris-medio'}`}
                  data-obtenido={l.obtenido}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${l.obtenido ? 'bg-negro text-blanco' : 'bg-gris-claro'}`} aria-hidden>
                    {LOGRO_ICONO[l.logro]}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-negro">
                      {l.nombre} <span className="text-xs font-normal text-gris-medio">+{l.puntos}</span>
                    </span>
                    <span className="block text-xs">{l.descripcion}</span>
                    {l.obtenidoEn && <span className="block text-xs">Logrado el {formatFecha(l.obtenidoEn)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {modo === 'optica' && <Vitrina panel={panel} />}
        </div>

        <div className="space-y-4">
          <Card title="Tus beneficios">
            <TablaBeneficios b={cond} titulo={NIVEL_INFO[cond.nivelBeneficios].nombre} excepciones={cond.excepciones} />
          </Card>
          {panel.beneficios.siguiente && (
            <Card title={`Con ${NIVEL_INFO[panel.beneficios.siguiente.nivel].nombre}`}>
              <TablaBeneficios b={panel.beneficios.siguiente} />
            </Card>
          )}
          <Card title="Calidad en pedidos web">
            {panel.calidad.pedidosWeb === 0 ? (
              <p className="text-sm text-gris-medio">Sin pedidos web en el año: no se exige para subir.</p>
            ) : (
              <dl className="space-y-1.5 text-sm" data-testid="calidad">
                <Fila k="Pedidos web" v={panel.calidad.pedidosWeb} />
                <Fila k={`A tiempo (mín. ${panel.reglas.minATiempoPct}%)`} v={panel.calidad.aTiempoPct === null ? '—' : `${panel.calidad.aTiempoPct}%`} />
                <Fila
                  k={`Satisfacción (mín. ${panel.reglas.minSatisfaccion.toLocaleString('es-AR')})`}
                  v={panel.calidad.satisfaccion === null ? 'Sin calificaciones' : `${panel.calidad.satisfaccion.toLocaleString('es-AR')} ★ (${panel.calidad.calificaciones})`}
                />
              </dl>
            )}
          </Card>
          {panel.historial.length > 0 && (
            <Card title="Historial">
              <ul className="space-y-1.5 text-sm" data-testid="historial-nivel">
                {panel.historial.map((h) => (
                  <li key={h.mes} className="flex items-center justify-between gap-2">
                    <span className="text-gris-medio">{formatMesCorto(h.mes)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{h.puntaje}</span>
                      <NivelChip nivel={h.nivel} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TablaBeneficios({ b, titulo, excepciones }: { b: Beneficios; titulo?: string; excepciones?: { descuentoPct: boolean; limiteCredito: boolean; plazoPagoDias: boolean } }) {
  const marca = (i: number) => (excepciones && ((i === 0 && excepciones.descuentoPct) || (i === 1 && excepciones.limiteCredito) || (i === 2 && excepciones.plazoPagoDias)) ? ' *' : '');
  const conExcepcion = excepciones && (excepciones.descuentoPct || excepciones.limiteCredito || excepciones.plazoPagoDias);
  return (
    <>
      {titulo && <p className="mb-2 text-xs text-gris-medio">Beneficios de {titulo}</p>}
      <dl className="space-y-1.5 text-sm">
        {filasBeneficios(b).map(([k, v], i) => (
          <Fila key={k} k={k} v={`${v}${marca(i)}`} />
        ))}
      </dl>
      {conExcepcion && <p className="mt-2 text-xs text-gris-medio">* Condición especial acordada con Vedere.</p>}
    </>
  );
}

function Vitrina({ panel }: { panel: PanelNivel }) {
  const router = useRouter();
  const toast = useToast();
  const [subiendo, setSubiendo] = useState(false);
  const v = panel.vitrina;
  async function subir(files: FileList) {
    setSubiendo(true);
    try {
      for (const f of Array.from(files).slice(0, 8 - v.fotos.length)) {
        const fd = new FormData();
        fd.append('file', f);
        const r = await api.post<{ url: string; logros: string[] }>('/optica/nivel/vitrina', fd);
        if (r.logros.includes('VITRINA_VEDERE')) toast.ok('¡Lograste Vitrina Vedere!');
      }
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubiendo(false);
    }
  }
  async function quitar(url: string) {
    try {
      await api.del('/optica/nivel/vitrina', { url });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  return (
    <Card title="Tu vitrina Vedere">
      <p className="text-sm text-gris-medio">
        Subí al menos {v.minimo} fotos de la vitrina con el muestrario Vedere.{' '}
        {v.muestrario ? <Badge tone="ok">Muestrario entregado</Badge> : <Badge tone="neutral">Muestrario pendiente</Badge>}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {v.fotos.map((f) => (
          <figure key={f} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f} alt="Vitrina" className="h-24 w-24 rounded-lg border border-negro/10 object-cover" />
            <button
              type="button"
              onClick={() => quitar(f)}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-negro text-xs text-blanco opacity-80 hover:opacity-100"
              aria-label="Quitar foto"
            >
              ×
            </button>
          </figure>
        ))}
        {v.fotos.length < 8 && (
          <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-lg border border-dashed border-negro/30 text-center text-xs text-gris-medio hover:border-negro">
            {subiendo ? 'Subiendo…' : '+ Foto'}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && subir(e.target.files)} disabled={subiendo} data-testid="vitrina-foto" />
          </label>
        )}
      </div>
    </Card>
  );
}

function Fila({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}
