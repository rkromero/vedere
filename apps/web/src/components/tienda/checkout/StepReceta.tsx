'use client';
// Paso 3: receta (sólo si hay ítems recetados/multifocales). Cuatro modos: cargar valores, subir foto o PDF,
// "me la toman en la óptica" o reutilizar una guardada en la cuenta.
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Checkbox, Field, Input, Spinner, Textarea, cn } from '@vedere/ui';
import { mensajeError, tiendaApi } from '@/lib/tienda/client';
import { formatDioptria } from '@/lib/tienda/checkout';
import type { Receta, RecetaInput, RecetaValores } from '@/lib/tienda/checkout';

export interface RecetaElegida {
  input: RecetaInput;
  guardar: boolean;
  /** Para el resumen: nombre de archivo o descripción corta. */
  etiqueta: string;
}

type Modo = 'VALORES' | 'ARCHIVO' | 'OPTICA' | 'GUARDADA';

const MODOS: Array<{ modo: Modo; titulo: string; detalle: string }> = [
  { modo: 'VALORES', titulo: 'Cargar los valores', detalle: 'Copiá los números de tu receta.' },
  { modo: 'ARCHIVO', titulo: 'Subir foto o PDF', detalle: 'La óptica la lee y te consulta si hace falta.' },
  { modo: 'OPTICA', titulo: 'Me la miden en la óptica', detalle: 'Sin receta: pedís turno y te la toman gratis.' },
];

interface ValoresForm {
  odEsfera: string;
  odCilindro: string;
  odEje: string;
  oiEsfera: string;
  oiCilindro: string;
  oiEje: string;
  adicion: string;
  dp: string;
  notas: string;
}

const VACIO: ValoresForm = { odEsfera: '', odCilindro: '0', odEje: '0', oiEsfera: '', oiCilindro: '0', oiEje: '0', adicion: '', dp: '', notas: '' };

const num = (v: string): number | null => {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function describirReceta(r: Receta): string {
  if (r.modo === 'ARCHIVO') return r.archivoNombre ?? 'Archivo';
  if (r.modo === 'OPTICA') return 'Medida en la óptica';
  return `OD ${formatDioptria(r.odEsfera)} / OI ${formatDioptria(r.oiEsfera)}${r.adicion ? ` · Ad ${formatDioptria(r.adicion)}` : ''}`;
}

export function StepReceta({
  valor,
  errores,
  guardadas,
  conSesion,
  multifocal,
  onContinuar,
}: {
  valor: RecetaElegida | null;
  errores: Record<string, string>;
  guardadas: Receta[];
  conSesion: boolean;
  /** Hay ítems multifocales: la adición es obligatoria. */
  multifocal: boolean;
  onContinuar: (r: RecetaElegida) => void;
}) {
  const [modo, setModo] = useState<Modo>(valor?.input.modo ?? (guardadas.length ? 'GUARDADA' : 'VALORES'));
  const [form, setForm] = useState<ValoresForm>(() => {
    if (valor?.input.modo === 'VALORES') {
      const v = valor.input.valores;
      return {
        odEsfera: String(v.odEsfera),
        odCilindro: String(v.odCilindro),
        odEje: String(v.odEje),
        oiEsfera: String(v.oiEsfera),
        oiCilindro: String(v.oiCilindro),
        oiEje: String(v.oiEje),
        adicion: v.adicion === null ? '' : String(v.adicion),
        dp: v.dp === null ? '' : String(v.dp),
        notas: v.notas ?? '',
      };
    }
    return VACIO;
  });
  const [archivo, setArchivo] = useState<{ url: string; nombre: string } | null>(
    valor?.input.modo === 'ARCHIVO' ? { url: valor.input.archivoUrl, nombre: valor.input.archivoNombre ?? 'Receta' } : null,
  );
  const [subiendo, setSubiendo] = useState(false);
  const [guardadaId, setGuardadaId] = useState(valor?.input.modo === 'GUARDADA' ? valor.input.recetaId : (guardadas[0]?.id ?? ''));
  const [guardar, setGuardar] = useState(valor?.guardar ?? conSesion);
  const [localErr, setLocalErr] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ValoresForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function subir(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setLocalErr({});
    try {
      const r = await tiendaApi.upload<{ url: string; nombre: string }>('/checkout/recetas/archivo', file);
      setArchivo({ url: r.url, nombre: r.nombre || file.name });
    } catch (err) {
      setLocalErr({ archivo: mensajeError(err) });
    } finally {
      setSubiendo(false);
    }
  }

  function validarValores(): RecetaValores | null {
    const err: Record<string, string> = {};
    const paso = (n: number) => Math.abs((n * 100) % 25) < 1e-6;
    const esf = (k: 'odEsfera' | 'oiEsfera') => {
      const n = num(form[k]);
      if (n === null) err[k] = 'Ingresá la esfera';
      else if (n < -20 || n > 20) err[k] = 'Entre -20 y +20';
      else if (!paso(n)) err[k] = 'En pasos de 0,25';
      return n ?? 0;
    };
    const cil = (k: 'odCilindro' | 'oiCilindro') => {
      const n = num(form[k]) ?? 0;
      if (n < -6 || n > 6) err[k] = 'Entre -6 y +6';
      else if (!paso(n)) err[k] = 'En pasos de 0,25';
      return n;
    };
    const eje = (k: 'odEje' | 'oiEje') => {
      const n = num(form[k]) ?? 0;
      if (!Number.isInteger(n) || n < 0 || n > 180) err[k] = 'Entre 0 y 180';
      return n;
    };
    const v: RecetaValores = {
      odEsfera: esf('odEsfera'),
      odCilindro: cil('odCilindro'),
      odEje: eje('odEje'),
      oiEsfera: esf('oiEsfera'),
      oiCilindro: cil('oiCilindro'),
      oiEje: eje('oiEje'),
      adicion: num(form.adicion),
      dp: num(form.dp),
      notas: form.notas.trim() || null,
    };
    if (v.adicion !== null && (v.adicion < 0.75 || v.adicion > 3.5 || !paso(v.adicion))) err.adicion = 'Entre 0,75 y 3,50 en pasos de 0,25';
    if (multifocal && v.adicion === null) err.adicion = 'Los multifocales necesitan la adición';
    if (v.dp !== null && (v.dp < 50 || v.dp > 80)) err.dp = 'Entre 50 y 80 mm';
    setLocalErr(err);
    return Object.keys(err).length ? null : v;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (modo === 'VALORES') {
      const v = validarValores();
      if (!v) return;
      onContinuar({
        input: { modo: 'VALORES', valores: v },
        guardar,
        etiqueta: `OD ${formatDioptria(v.odEsfera)} / OI ${formatDioptria(v.oiEsfera)}${v.adicion ? ` · Ad ${formatDioptria(v.adicion)}` : ''}`,
      });
    } else if (modo === 'ARCHIVO') {
      if (!archivo) {
        setLocalErr({ archivo: 'Subí la foto o el PDF de tu receta' });
        return;
      }
      onContinuar({ input: { modo: 'ARCHIVO', archivoUrl: archivo.url, archivoNombre: archivo.nombre }, guardar, etiqueta: archivo.nombre });
    } else if (modo === 'GUARDADA') {
      const r = guardadas.find((g) => g.id === guardadaId);
      if (!r) {
        setLocalErr({ guardada: 'Elegí una receta' });
        return;
      }
      onContinuar({ input: { modo: 'GUARDADA', recetaId: r.id }, guardar: false, etiqueta: `Guardada · ${describirReceta(r)}` });
    } else {
      onContinuar({ input: { modo: 'OPTICA' }, guardar: false, etiqueta: 'Me la miden en la óptica' });
    }
  }

  const err = { ...localErr, ...errores };
  const opciones = guardadas.length ? [{ modo: 'GUARDADA' as Modo, titulo: 'Usar una guardada', detalle: 'De tu cuenta.' }, ...MODOS] : MODOS;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">¿Cómo nos pasás tu receta?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {opciones.map((o) => {
            const activo = modo === o.modo;
            return (
              <label
                key={o.modo}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors',
                  activo ? 'border-negro bg-gris-claro' : 'border-negro/15 hover:border-negro/40',
                )}
              >
                <input
                  type="radio"
                  name="modo-receta"
                  value={o.modo}
                  checked={activo}
                  onChange={() => setModo(o.modo)}
                  className="mt-1 h-4 w-4 shrink-0 accent-negro"
                  data-testid={`receta-modo-${o.modo}`}
                />
                <span>
                  <span className="block font-medium">{o.titulo}</span>
                  <span className="mt-0.5 block text-sm text-gris-texto">{o.detalle}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {modo === 'VALORES' && (
        <div className="space-y-4">
          {(['od', 'oi'] as const).map((ojo) => (
            <fieldset key={ojo} className="rounded-2xl border border-negro/10 p-4">
              <legend className="px-1 text-sm font-semibold">{ojo === 'od' ? 'Ojo derecho (OD)' : 'Ojo izquierdo (OI)'}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Esfera" required error={err[`${ojo}Esfera`]} hint="Ej. -1,50">
                  {(p) => <Input {...p} inputMode="decimal" value={form[`${ojo}Esfera`]} onChange={set(`${ojo}Esfera`)} data-testid={`receta-${ojo}-esfera`} />}
                </Field>
                <Field label="Cilindro" error={err[`${ojo}Cilindro`]} hint="0 si no tiene">
                  {(p) => <Input {...p} inputMode="decimal" value={form[`${ojo}Cilindro`]} onChange={set(`${ojo}Cilindro`)} />}
                </Field>
                <Field label="Eje" error={err[`${ojo}Eje`]} hint="0 a 180">
                  {(p) => <Input {...p} inputMode="numeric" value={form[`${ojo}Eje`]} onChange={set(`${ojo}Eje`)} />}
                </Field>
              </div>
            </fieldset>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={multifocal ? 'Adición' : 'Adición (multifocal)'} required={multifocal} error={err.adicion} hint="Entre 0,75 y 3,50">
              {(p) => <Input {...p} inputMode="decimal" value={form.adicion} onChange={set('adicion')} data-testid="receta-adicion" />}
            </Field>
            <Field label="Distancia pupilar (mm)" error={err.dp} hint="Si no figura, la mide la óptica.">
              {(p) => <Input {...p} inputMode="decimal" value={form.dp} onChange={set('dp')} />}
            </Field>
          </div>
          <Field label="Notas para la óptica" error={err.notas}>
            {(p) => <Textarea {...p} value={form.notas} onChange={set('notas')} maxLength={500} className="min-h-[80px]" />}
          </Field>
        </div>
      )}

      {modo === 'ARCHIVO' && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="sr-only"
            onChange={(e) => subir(e.target.files?.[0])}
            data-testid="receta-archivo"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" loading={subiendo} onClick={() => fileRef.current?.click()}>
              {archivo ? 'Cambiar archivo' : 'Elegir foto o PDF'}
            </Button>
            {archivo && <span className="text-sm">{archivo.nombre}</span>}
            {subiendo && <Spinner />}
          </div>
          {err.archivo && (
            <p role="alert" className="text-sm text-carey">
              {err.archivo}
            </p>
          )}
          <p className="text-xs text-gris-texto">JPG, PNG, WEBP, HEIC o PDF. Que se lean bien los valores y la fecha.</p>
        </div>
      )}

      {modo === 'GUARDADA' && (
        <div className="space-y-2">
          {guardadas.map((r) => (
            <label key={r.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm', guardadaId === r.id ? 'border-negro' : 'border-negro/15')}>
              <input type="radio" name="receta-guardada" checked={guardadaId === r.id} onChange={() => setGuardadaId(r.id)} className="h-4 w-4 accent-negro" />
              <span>
                <span className="block font-medium">{describirReceta(r)}</span>
                <span className="block text-xs text-gris-texto">Cargada el {new Date(r.createdAt).toLocaleDateString('es-AR')}</span>
              </span>
            </label>
          ))}
          {err.guardada && <p className="text-sm text-carey">{err.guardada}</p>}
        </div>
      )}

      {modo === 'OPTICA' && (
        <p className="rounded-xl bg-gris-claro px-4 py-3 text-sm">
          Te pedimos turno en la óptica socia y te miden la vista sin cargo. Los anteojos se arman después de la medición.
        </p>
      )}

      {conSesion && (modo === 'VALORES' || modo === 'ARCHIVO') && (
        <Checkbox label="Guardar esta receta en mi cuenta para la próxima" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
      )}

      <Button type="submit" size="md" className="w-full sm:w-auto" disabled={subiendo} data-testid="checkout-siguiente">
        Continuar al pago
      </Button>
    </form>
  );
}
