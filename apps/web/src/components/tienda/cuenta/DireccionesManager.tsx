'use client';
// Direcciones guardadas: alta, edición, baja y predeterminada. Se precargan en el checkout.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Checkbox, Field, Input } from '@vedere/ui';
import { erroresPorCampo, mensajeError } from '@/lib/tienda/client';
import { PROVINCIAS, cuentaApi } from '@/lib/tienda/cuenta';
import type { Direccion, DireccionInput } from '@/lib/tienda/cuenta';
import { Pastilla, SinDatos } from './Tarjeta';

const VACIA: DireccionInput = {
  etiqueta: 'Casa',
  direccion: '',
  piso: null,
  localidad: '',
  provincia: 'Buenos Aires',
  codigoPostal: '',
  telefono: null,
  predeterminada: false,
};

export function DireccionesManager({ inicial, error: errorInicial }: { inicial: Direccion[]; error?: boolean }) {
  const [items, setItems] = useState(inicial);
  const [editando, setEditando] = useState<Direccion | 'nueva' | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function guardada(d: Direccion) {
    setItems((xs) => {
      const sin = xs.filter((x) => x.id !== d.id).map((x) => (d.predeterminada ? { ...x, predeterminada: false } : x));
      return [d, ...sin].sort((a, b) => Number(b.predeterminada) - Number(a.predeterminada));
    });
    setEditando(null);
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Borrar esta dirección?')) return;
    setOcupado(id);
    setError(null);
    try {
      await cuentaApi.borrarDireccion(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  async function predeterminar(id: string) {
    setOcupado(id);
    setError(null);
    try {
      await cuentaApi.predeterminar(id);
      setItems((xs) =>
        xs
          .map((x) => ({ ...x, predeterminada: x.id === id }))
          .sort((a, b) => Number(b.predeterminada) - Number(a.predeterminada)),
      );
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {error}
        </p>
      )}

      {editando ? (
        <DireccionForm
          inicial={editando === 'nueva' ? { ...VACIA, predeterminada: items.length === 0 } : editando}
          id={editando === 'nueva' ? null : editando.id}
          onCancelar={() => setEditando(null)}
          onGuardada={guardada}
        />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setEditando('nueva')} data-testid="direccion-nueva">
          Agregar dirección
        </Button>
      )}

      {items.length === 0 ? (
        <SinDatos>
          {errorInicial
            ? 'No pudimos cargar tus direcciones. Probá de nuevo en un momento.'
            : 'Todavía no tenés direcciones guardadas. Las que uses en el checkout se guardan acá.'}
        </SinDatos>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((d) => (
            <li key={d.id} className="rounded-2xl border border-negro/10 p-4" data-testid="direccion-item">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{d.etiqueta}</p>
                {d.predeterminada && <Pastilla tone="ok">Predeterminada</Pastilla>}
              </div>
              <p className="mt-1 text-sm">
                {d.direccion}
                {d.piso ? `, ${d.piso}` : ''}
              </p>
              <p className="text-sm text-gris-texto">
                {d.localidad}, {d.provincia} ({d.codigoPostal})
                {d.telefono ? ` · ${d.telefono}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditando(d)}>
                  Editar
                </Button>
                {!d.predeterminada && (
                  <Button variant="ghost" size="sm" onClick={() => predeterminar(d.id)} loading={ocupado === d.id}>
                    Usar como predeterminada
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => borrar(d.id)} loading={ocupado === d.id}>
                  Borrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DireccionForm({
  inicial,
  id,
  onCancelar,
  onGuardada,
}: {
  inicial: DireccionInput;
  id: string | null;
  onCancelar: () => void;
  onGuardada: (d: Direccion) => void;
}) {
  const [form, setForm] = useState<DireccionInput>(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof DireccionInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrores({});
    setGeneral(null);
    setGuardando(true);
    const body: DireccionInput = {
      ...form,
      piso: form.piso?.trim() ? form.piso.trim() : null,
      telefono: form.telefono?.trim() ? form.telefono.trim() : null,
    };
    try {
      const d = id ? await cuentaApi.editarDireccion(id, body) : await cuentaApi.crearDireccion(body);
      onGuardada(d);
    } catch (err) {
      setErrores(erroresPorCampo(err));
      setGeneral(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-gris-claro p-4 md:p-5" noValidate>
      <p className="font-semibold">{id ? 'Editar dirección' : 'Nueva dirección'}</p>
      {general && (
        <p role="alert" className="rounded-2xl bg-carey/10 px-4 py-3 text-sm text-carey">
          {general}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Etiqueta" hint="Casa, Trabajo…" error={errores.etiqueta}>
          {(p) => <Input {...p} value={form.etiqueta} onChange={set('etiqueta')} data-testid="direccion-etiqueta" />}
        </Field>
        <Field label="Teléfono" error={errores.telefono}>
          {(p) => <Input {...p} type="tel" value={form.telefono ?? ''} onChange={set('telefono')} autoComplete="tel" />}
        </Field>
        <Field label="Calle y número" required error={errores.direccion} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.direccion} onChange={set('direccion')} autoComplete="street-address" data-testid="direccion-direccion" />}
        </Field>
        <Field label="Piso / depto" error={errores.piso}>
          {(p) => <Input {...p} value={form.piso ?? ''} onChange={set('piso')} />}
        </Field>
        <Field label="Código postal" required error={errores.codigoPostal}>
          {(p) => <Input {...p} value={form.codigoPostal} onChange={set('codigoPostal')} autoComplete="postal-code" placeholder="1425 o C1425ABC" data-testid="direccion-cp" />}
        </Field>
        <Field label="Localidad" required error={errores.localidad}>
          {(p) => <Input {...p} value={form.localidad} onChange={set('localidad')} autoComplete="address-level2" data-testid="direccion-localidad" />}
        </Field>
        <Field label="Provincia" required error={errores.provincia}>
          {(p) => (
            <>
              <Input {...p} list="provincias-ar" value={form.provincia} onChange={set('provincia')} autoComplete="address-level1" data-testid="direccion-provincia" />
              <datalist id="provincias-ar">
                {PROVINCIAS.map((pr) => (
                  <option key={pr} value={pr} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </div>
      <Checkbox
        checked={form.predeterminada}
        onChange={(e) => setForm((f) => ({ ...f, predeterminada: e.target.checked }))}
        label="Usar como dirección predeterminada"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={guardando} data-testid="direccion-guardar">
          Guardar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
