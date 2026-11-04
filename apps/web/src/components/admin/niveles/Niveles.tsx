'use client';
// B2B 4: niveles de las ópticas en el backoffice: reporte (ópticas por nivel y evolución), listado con
// recálculo, detalle con nivel manual y configuración (cortes, rangos, pesos, beneficios y logros).
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { formatFecha, formatPrecio } from '@/lib/format';
import type { ConfigNiveles, NivelOptica, PanelNivel, ReporteNiveles, TipoLogro, Variable } from '@/lib/niveles';
import { formatMesCorto, NIVEL_INFO, NIVELES, VARIABLE_LABEL } from '@/lib/niveles';
import { NivelChip, NivelPanel } from '@/components/niveles/NivelPanel';
import { Table, Td, Th, Tr } from '@/components/admin/table';
import { Btn, Card, EmptyState, Field, Input, LinkBtn, Modal, PageHeader, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

function useRecalcular() {
  const router = useRouter();
  const toast = useToast();
  const [cargando, setCargando] = useState(false);
  async function recalcular(url: string, okMsg: (r: unknown) => string) {
    setCargando(true);
    try {
      const r = await api.post(url);
      toast.ok(okMsg(r));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCargando(false);
    }
  }
  return { cargando, recalcular };
}

export function NivelesReporte({ data, esAdmin }: { data: ReporteNiveles; esAdmin: boolean }) {
  const { cargando, recalcular } = useRecalcular();
  const maxTotal = Math.max(1, ...data.evolucion.map((e) => e.total));
  return (
    <>
      <PageHeader
        title="Niveles de ópticas"
        description="Vetro, Cristallo, Prisma y Zafiro: se recalculan solos el día 1 de cada mes con los últimos 12 meses."
        actions={
          <>
            {esAdmin && (
              <LinkBtn href="/admin/niveles/configuracion" variant="secondary">
                Configuración
              </LinkBtn>
            )}
            <Btn
              onClick={() => recalcular('/admin/niveles/recalcular', (r) => `Recalculadas ${(r as { recalculadas: number }).recalculadas} ópticas`)}
              loading={cargando}
              data-testid="recalcular-niveles"
            >
              Recalcular ahora
            </Btn>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="opticas-por-nivel">
        {NIVELES.map((n) => (
          <div key={n} className="rounded-xl border border-negro/10 p-5" style={{ backgroundColor: NIVEL_INFO[n].color, color: NIVEL_INFO[n].texto }}>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] opacity-75">{NIVEL_INFO[n].nombre}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{data.porNivel[n]}</p>
            <p className="text-xs opacity-75">ópticas</p>
          </div>
        ))}
      </div>

      <Card title="Evolución (cierre de cada mes)" className="mb-6">
        {data.evolucion.every((e) => e.total === 0) ? (
          <p className="text-sm text-gris-medio">Todavía no hay recálculos. El primero corre solo el día 1 o con “Recalcular ahora”.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-[560px] items-end gap-2" style={{ height: 180 }} data-testid="evolucion-niveles">
              {data.evolucion.map((e) => (
                <div key={e.mes} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(e.total / maxTotal) * 140}px` }} title={`${formatMesCorto(e.mes)}: ${e.total} ópticas`}>
                    {NIVELES.map((n) =>
                      e[n] > 0 ? (
                        <div key={n} style={{ flexGrow: e[n], backgroundColor: NIVEL_INFO[n].color }} className="border-t border-blanco/60" title={`${NIVEL_INFO[n].nombre}: ${e[n]}`} />
                      ) : null,
                    )}
                  </div>
                  <span className="text-[10px] text-gris-medio">{formatMesCorto(e.mes)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {NIVELES.map((n) => (
                <span key={n} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-negro/15" style={{ backgroundColor: NIVEL_INFO[n].color }} />
                  {NIVEL_INFO[n].nombre}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {data.opticas.length === 0 ? (
        <EmptyState title="No hay ópticas activas" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Óptica</Th>
              <Th>Nivel</Th>
              <Th align="right">Puntaje</Th>
              <Th align="right">Descuento</Th>
              <Th align="right">Crédito</Th>
              <Th align="right">Logros</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {data.opticas.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <Link href={`/admin/niveles/${o.id}`} className="font-medium hover:underline">
                    {o.nombre}
                  </Link>
                  <span className="block text-xs text-gris-medio">{o.localidad}</span>
                </Td>
                <Td>
                  <NivelChip nivel={o.nivel} />
                </Td>
                <Td align="right" className="tabular-nums">
                  {o.puntaje ?? '—'}
                  {o.tendencia !== null && o.tendencia !== 0 && (
                    <span className={`ml-1 text-xs ${o.tendencia > 0 ? 'text-[#2f7d4f]' : 'text-carey'}`}>
                      {o.tendencia > 0 ? '▲' : '▼'}
                      {Math.abs(o.tendencia)}
                    </span>
                  )}
                </Td>
                <Td align="right" className="tabular-nums">
                  {o.descuentoPct}%
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatPrecio(o.limiteCredito)}
                  <span className="block text-xs text-gris-medio">{o.plazoPagoDias} días</span>
                </Td>
                <Td align="right" className="tabular-nums">
                  {o.logros}
                </Td>
                <Td className="text-xs">
                  {o.manual && <span className="block">Manual{o.manual.hasta ? ` hasta ${formatFecha(o.manual.hasta)}` : ''}</span>}
                  {o.provisorio && <span className="block">Bienvenida {NIVEL_INFO[o.provisorio.nivel].nombre} hasta {formatFecha(o.provisorio.hasta)}</span>}
                  {o.enGracia && <span className="block text-[#8a5a12]">En gracia</span>}
                  {!o.manual && !o.provisorio && !o.enGracia && <span className="text-gris-medio">—</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export function NivelOpticaAdmin({ panel, esAdmin }: { panel: PanelNivel; esAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { cargando, recalcular } = useRecalcular();
  const [manual, setManual] = useState(false);
  const [quitando, setQuitando] = useState(false);
  async function quitarManual() {
    setQuitando(true);
    try {
      await api.del(`/admin/niveles/opticas/${panel.optica.id}/manual`);
      toast.ok('Se quitó el nivel manual');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setQuitando(false);
    }
  }
  return (
    <>
      <nav className="mb-4 text-sm text-gris-medio">
        <Link href="/admin/niveles" className="hover:underline">
          Niveles
        </Link>{' '}
        / <span className="text-negro">{panel.optica.nombre}</span>
      </nav>
      <NivelPanel
        panel={panel}
        modo="admin"
        acciones={
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="secondary"
              onClick={() => recalcular(`/admin/niveles/opticas/${panel.optica.id}/recalcular`, () => 'Nivel recalculado')}
              loading={cargando}
              data-testid="recalcular-optica"
            >
              Recalcular
            </Btn>
            {esAdmin && (
              <Btn variant="secondary" onClick={() => setManual(true)} data-testid="nivel-manual">
                Nivel manual
              </Btn>
            )}
            {esAdmin && panel.manual && (
              <Btn variant="ghost" onClick={quitarManual} loading={quitando}>
                Quitar nivel manual
              </Btn>
            )}
            <LinkBtn href={`/admin/opticas?q=${encodeURIComponent(panel.optica.nombre)}`} variant="ghost">
              Excepciones de la óptica
            </LinkBtn>
          </div>
        }
      />
      {manual && <ManualModal opticaId={panel.optica.id} actual={panel.manual?.nivel ?? panel.nivel} onClose={() => setManual(false)} />}
    </>
  );
}

function ManualModal({ opticaId, actual, onClose }: { opticaId: string; actual: NivelOptica; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [nivel, setNivel] = useState<NivelOptica>(actual);
  const [motivo, setMotivo] = useState('');
  const [hasta, setHasta] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setEnviando(true);
    setErrores({});
    try {
      await api.put(`/admin/niveles/opticas/${opticaId}/manual`, { nivel, motivo, hasta: hasta || null });
      toast.ok(`Nivel ${NIVEL_INFO[nivel].nombre} asignado`);
      onClose();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Nivel manual"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={guardar} loading={enviando} disabled={motivo.trim().length < 5} data-testid="guardar-nivel-manual">
            Asignar
          </Btn>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-gris-medio">Pisa el nivel calculado hasta la fecha que elijas. La óptica recibe un email si su nivel cambia.</p>
        <Field label="Nivel" required>
          <Select value={nivel} onChange={(e) => setNivel(e.target.value as NivelOptica)}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {NIVEL_INFO[n].nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Motivo" required error={errores.motivo}>
          <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Socia fundadora, acuerdo comercial…" data-testid="nivel-manual-motivo" />
        </Field>
        <Field label="Vence" hint="Vacío = hasta que lo quites." error={errores.hasta}>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------

const LOGRO_NOMBRE: Record<TipoLogro, string> = {
  PRIMER_FOCO: 'Primer foco',
  MANO_FIRME: 'Mano firme',
  MULTIFOCAL_MAESTRO: 'Multifocal maestro',
  RELOJITO: 'Relojito',
  VITRINA_VEDERE: 'Vitrina Vedere',
  EMBAJADORA: 'Embajadora',
};
const VARS: Variable[] = ['total', 'porCompra', 'frecuencia', 'recencia'];
const AYUDA_RANGO: Record<Variable, string> = {
  total: 'Unidades ponderadas desde las que da 2, 3, 4 y 5 puntos.',
  porCompra: 'Promedio por pedido desde el que da 2, 3, 4 y 5 puntos.',
  frecuencia: 'Meses con actividad desde los que da 2, 3, 4 y 5 puntos.',
  recencia: 'Días como máximo para dar 2, 3, 4 y 5 puntos (menos días = más puntos).',
};

const n = (s: string) => Number(String(s).replace(',', '.'));

export function ConfigNivelesForm({ inicial, editable }: { inicial: ConfigNiveles; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const d = !editable;
  const sumaPesos = Math.round(VARS.reduce((a, v) => a + c.pesos[v], 0) * 100);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    try {
      await api.put('/admin/niveles/config', c);
      toast.ok('Configuración de niveles guardada');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setGuardando(false);
    }
  }

  const num = (valor: number, on: (v: number) => void, extra: { step?: string; label: string; testid?: string }) => (
    <Input
      type="number"
      step={extra.step ?? '1'}
      value={Number.isFinite(valor) ? valor : ''}
      onChange={(e) => on(n(e.target.value))}
      disabled={d}
      aria-label={extra.label}
      className="w-full"
      data-testid={extra.testid}
    />
  );

  return (
    <form onSubmit={guardar} className="space-y-6" data-testid="config-niveles">
      <PageHeader title="Configuración de niveles" description="Cortes, rangos, pesos, beneficios y logros. Los cambios en beneficios rigen al instante; los de puntaje, en el próximo recálculo." />
      <Card title="Cortes de nivel (puntaje mínimo)">
        <div className="grid gap-4 sm:grid-cols-3">
          {(['CRISTALLO', 'PRISMA', 'ZAFIRO'] as const).map((k) => (
            <Field key={k} label={NIVEL_INFO[k].nombre}>
              {num(c.cortes[k], (v) => setC({ ...c, cortes: { ...c.cortes, [k]: v } }), { label: `Corte ${k}` })}
            </Field>
          ))}
        </div>
        {errores.cortes && <p className="mt-2 text-sm text-carey">{errores.cortes}</p>}
      </Card>

      <Card title={`Variables: pesos (suman ${sumaPesos}%) y rangos`}>
        <div className="space-y-4">
          {VARS.map((v) => (
            <div key={v} className="grid items-end gap-3 sm:grid-cols-[12rem_6rem_1fr]">
              <div>
                <p className="font-medium">{VARIABLE_LABEL[v]}</p>
                <p className="text-xs text-gris-medio">{AYUDA_RANGO[v]}</p>
              </div>
              <Field label="Peso %">
                {num(Math.round(c.pesos[v] * 100), (x) => setC({ ...c, pesos: { ...c.pesos, [v]: x / 100 } }), { label: `Peso ${v}` })}
              </Field>
              <div className="grid grid-cols-4 gap-2">
                {c.rangos[v].map((x, i) => (
                  <Field key={i} label={`${i + 2} pts`}>
                    {num(x, (y) => setC({ ...c, rangos: { ...c.rangos, [v]: c.rangos[v].map((z, j) => (j === i ? y : z)) } }), { label: `Rango ${v} ${i + 2}`, step: 'any' })}
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
        {(errores.pesos || errores.rangos) && <p className="mt-2 text-sm text-carey">{errores.pesos ?? errores.rangos}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {(['SOL', 'RECETADO', 'MULTIFOCAL', 'ACCESORIO'] as const).map((l) => (
            <Field key={l} label={`Ponderación ${l === 'SOL' ? 'sol' : l === 'RECETADO' ? 'recetado' : l === 'MULTIFOCAL' ? 'multifocal' : 'accesorio'}`}>
              {num(c.ponderacionLinea[l], (x) => setC({ ...c, ponderacionLinea: { ...c.ponderacionLinea, [l]: x } }), { label: `Ponderación ${l}`, step: 'any' })}
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Beneficios por nivel">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-negro/10 text-left text-xs uppercase tracking-wide text-gris-medio">
              <tr>
                <th className="px-5 py-2 font-medium">Nivel</th>
                <th className="px-2 py-2 font-medium">Descuento %</th>
                <th className="px-2 py-2 font-medium">Crédito $</th>
                <th className="px-2 py-2 font-medium">Plazo (días)</th>
                <th className="px-2 py-2 font-medium">Exclusividad (km)</th>
                <th className="px-5 py-2 font-medium">Anticipado (días)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-negro/5">
              {NIVELES.map((niv) => {
                const b = c.beneficios[niv];
                const set = (k: keyof typeof b, v: number) => setC({ ...c, beneficios: { ...c.beneficios, [niv]: { ...b, [k]: v } } });
                return (
                  <tr key={niv}>
                    <td className="px-5 py-2">
                      <NivelChip nivel={niv} />
                    </td>
                    <td className="px-2 py-2">{num(b.descuentoPct, (v) => set('descuentoPct', v), { label: `Descuento ${niv}`, step: 'any', testid: `beneficio-${niv}-descuento` })}</td>
                    <td className="px-2 py-2">{num(b.limiteCredito, (v) => set('limiteCredito', v), { label: `Crédito ${niv}` })}</td>
                    <td className="px-2 py-2">{num(b.plazoPagoDias, (v) => set('plazoPagoDias', v), { label: `Plazo ${niv}` })}</td>
                    <td className="px-2 py-2">{num(b.radioExclusividadKm, (v) => set('radioExclusividadKm', v), { label: `Exclusividad ${niv}`, step: 'any' })}</td>
                    <td className="px-5 py-2">{num(b.accesoAnticipadoDias, (v) => set('accesoAnticipadoDias', v), { label: `Anticipado ${niv}` })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Logros (puntos extra, máximo ${c.maxPuntosLogrosAnio} por año)`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(LOGRO_NOMBRE) as TipoLogro[]).map((l) => (
              <Field key={l} label={LOGRO_NOMBRE[l]}>
                {num(c.logros[l], (v) => setC({ ...c, logros: { ...c.logros, [l]: v } }), { label: `Puntos ${l}` })}
              </Field>
            ))}
            <Field label="Tope anual">{num(c.maxPuntosLogrosAnio, (v) => setC({ ...c, maxPuntosLogrosAnio: v }), { label: 'Tope anual de logros' })}</Field>
          </div>
        </Card>
        <Card title="Reglas">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meses de gracia para bajar">{num(c.mesesGracia, (v) => setC({ ...c, mesesGracia: v }), { label: 'Meses de gracia' })}</Field>
            <Field label="Días sin actividad → Vetro">{num(c.diasInactividad, (v) => setC({ ...c, diasInactividad: v }), { label: 'Días de inactividad' })}</Field>
            <Field label="Mínimo a tiempo para subir (%)">{num(c.minATiempoPct, (v) => setC({ ...c, minATiempoPct: v }), { label: 'Mínimo a tiempo' })}</Field>
            <Field label="Satisfacción mínima para subir">{num(c.minSatisfaccion, (v) => setC({ ...c, minSatisfaccion: v }), { label: 'Satisfacción mínima', step: 'any' })}</Field>
            <Field label="Meses de bienvenida (Cristallo)">{num(c.mesesBeneficioNuevas, (v) => setC({ ...c, mesesBeneficioNuevas: v }), { label: 'Meses de bienvenida' })}</Field>
          </div>
        </Card>
      </div>

      {editable ? (
        <Btn type="submit" loading={guardando} data-testid="guardar-config-niveles">
          Guardar configuración
        </Btn>
      ) : (
        <p className="text-xs text-gris-medio">Sólo los administradores pueden cambiar estos valores.</p>
      )}
    </form>
  );
}
