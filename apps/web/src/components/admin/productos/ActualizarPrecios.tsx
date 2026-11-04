'use client';
// Actualización masiva de precios por porcentaje (web o mayorista) por categoría, marca o colección. Primero
// muestra la vista previa (simulación) y después aplica; cada aplicación queda en el historial auditado.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { formatPrecio } from '@/lib/format';
import type { Coleccion, Marca } from '@/lib/types';
import { Btn, Field, Input, Modal, Select } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';

type Campo = 'PRECIO' | 'PRECIO_MAYORISTA';
type Alcance = 'TODOS' | 'CATEGORIA' | 'MARCA' | 'COLECCION';

interface Resultado {
  simulado: boolean;
  campo: Campo;
  porcentaje: number;
  alcanceNombre: string | null;
  productosAfectados: number;
  detalle: Array<{ id: string; nombre: string; antes: number; despues: number }>;
}

const REDONDEOS = [
  { value: '0.01', label: 'Sin redondeo (centavos)' },
  { value: '1', label: 'A pesos enteros' },
  { value: '10', label: 'A la decena' },
  { value: '100', label: 'A la centena' },
];

export function ActualizarPrecios({
  open,
  onClose,
  marcas,
  categorias,
  colecciones,
}: {
  open: boolean;
  onClose: () => void;
  marcas: Marca[];
  categorias: Array<{ value: string; label: string }>;
  colecciones: Coleccion[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [campo, setCampo] = useState<Campo>('PRECIO');
  const [porcentaje, setPorcentaje] = useState('');
  const [alcance, setAlcance] = useState<Alcance>('TODOS');
  const [alcanceId, setAlcanceId] = useState('');
  const [redondeo, setRedondeo] = useState('1');
  const [preview, setPreview] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<'preview' | 'aplicar' | null>(null);

  const opcionesAlcance = useMemo(() => {
    if (alcance === 'MARCA') return marcas.map((m) => ({ value: m.id, label: m.nombre }));
    if (alcance === 'COLECCION') return colecciones.map((c) => ({ value: c.id, label: c.nombre }));
    if (alcance === 'CATEGORIA') return categorias;
    return [];
  }, [alcance, marcas, colecciones, categorias]);

  function reset() {
    setPreview(null);
    setError(null);
  }

  function cerrar() {
    reset();
    onClose();
  }

  function payload(simular: boolean) {
    return {
      campo,
      porcentaje: Number(porcentaje.replace(',', '.')),
      alcance,
      alcanceId: alcance === 'TODOS' ? null : alcanceId || null,
      redondeo: Number(redondeo),
      simular,
    };
  }

  async function verPreview() {
    setError(null);
    const pct = Number(porcentaje.replace(',', '.'));
    if (!porcentaje.trim() || Number.isNaN(pct) || pct === 0) {
      setError('Ingresá un porcentaje distinto de 0 (negativo para bajar precios)');
      return;
    }
    if (alcance !== 'TODOS' && !alcanceId) {
      setError('Elegí a qué productos aplicar el cambio');
      return;
    }
    setCargando('preview');
    try {
      setPreview(await api.post<Resultado>('/admin/productos/precios', payload(true)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCargando(null);
    }
  }

  async function aplicar() {
    setCargando('aplicar');
    try {
      const r = await api.post<Resultado>('/admin/productos/precios', payload(false));
      toast.ok(`Actualizamos ${r.productosAfectados} precio${r.productosAfectados === 1 ? '' : 's'}`);
      cerrar();
      setPorcentaje('');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCargando(null);
    }
  }

  const nombreCampo = campo === 'PRECIO' ? 'precio web' : 'precio mayorista';

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Actualizar precios por porcentaje"
      size="lg"
      footer={
        <>
          <Link href="/admin/productos/precios" className="mr-auto text-sm underline-offset-2 hover:underline">
            Ver historial
          </Link>
          <Btn variant="secondary" onClick={cerrar}>
            Cancelar
          </Btn>
          {preview && preview.productosAfectados > 0 ? (
            <Btn onClick={aplicar} loading={cargando === 'aplicar'} data-testid="precios-aplicar">
              Aplicar a {preview.productosAfectados} producto{preview.productosAfectados === 1 ? '' : 's'}
            </Btn>
          ) : (
            <Btn onClick={verPreview} loading={cargando === 'preview'} data-testid="precios-preview">
              Ver vista previa
            </Btn>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Precio a actualizar">
            <Select
              value={campo}
              onChange={(e) => {
                setCampo(e.target.value as Campo);
                reset();
              }}
            >
              <option value="PRECIO">Precio web (con IVA)</option>
              <option value="PRECIO_MAYORISTA">Precio mayorista (sin IVA)</option>
            </Select>
          </Field>
          <Field label="Porcentaje" hint="Ej. 8 sube un 8%, -5 baja un 5%.">
            <Input
              inputMode="decimal"
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                reset();
              }}
              placeholder="8"
              data-testid="precios-porcentaje"
            />
          </Field>
          <Field label="Aplicar a">
            <Select
              value={alcance}
              onChange={(e) => {
                setAlcance(e.target.value as Alcance);
                setAlcanceId('');
                reset();
              }}
            >
              <option value="TODOS">Todos los productos</option>
              <option value="CATEGORIA">Una categoría (con sus subcategorías)</option>
              <option value="MARCA">Una marca</option>
              <option value="COLECCION">Una colección</option>
            </Select>
          </Field>
          {alcance !== 'TODOS' ? (
            <Field label={alcance === 'CATEGORIA' ? 'Categoría' : alcance === 'MARCA' ? 'Marca' : 'Colección'}>
              <Select
                value={alcanceId}
                onChange={(e) => {
                  setAlcanceId(e.target.value);
                  reset();
                }}
              >
                <option value="">Elegí…</option>
                {opcionesAlcance.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label="Redondeo">
            <Select
              value={redondeo}
              onChange={(e) => {
                setRedondeo(e.target.value);
                reset();
              }}
            >
              {REDONDEOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {campo === 'PRECIO_MAYORISTA' && (
          <p className="text-xs text-gris-medio">Sólo se actualizan los productos que ya tienen precio mayorista cargado.</p>
        )}
        {error && (
          <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey" role="alert">
            {error}
          </p>
        )}

        {preview && (
          <div>
            <p className="mb-2 text-sm">
              {preview.productosAfectados === 0 ? (
                'Ningún producto coincide con ese alcance.'
              ) : (
                <>
                  Vas a cambiar el <strong>{nombreCampo}</strong> de{' '}
                  <strong>
                    {preview.productosAfectados} producto{preview.productosAfectados === 1 ? '' : 's'}
                  </strong>{' '}
                  ({preview.alcanceNombre}) un {preview.porcentaje > 0 ? '+' : ''}
                  {preview.porcentaje}%.
                </>
              )}
            </p>
            {preview.detalle.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border border-negro/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gris-claro text-left text-xs text-gris-medio">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 text-right font-medium">Antes</th>
                      <th className="px-3 py-2 text-right font-medium">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.detalle.map((d) => (
                      <tr key={d.id} className="border-t border-negro/5">
                        <td className="px-3 py-1.5">{d.nombre}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gris-medio">{formatPrecio(d.antes)}</td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatPrecio(d.despues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

