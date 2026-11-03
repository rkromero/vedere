'use client';
import { Badge, Btn, Checkbox, Field, Input } from '@/components/admin/ui';
import { bajoStock, nuevaVariante } from './form-types';
import type { VarianteForm } from './form-types';

export function VariantesTab({
  variantes,
  errors,
  onChange,
  onRemove,
}: {
  variantes: VarianteForm[];
  errors: Record<string, string>;
  onChange: (variantes: VarianteForm[]) => void;
  onRemove: (v: VarianteForm) => void;
}) {
  function update(i: number, patch: Partial<VarianteForm>) {
    onChange(variantes.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  const err = (i: number, campo: string) => errors[`variantes.${i}.${campo}`];

  return (
    <div className="space-y-4">
      {variantes.length === 0 && (
        <p className="rounded-lg border border-dashed border-negro/20 px-4 py-6 text-center text-sm text-gris-medio">
          El producto todavía no tiene variantes. Agregá al menos una (color de armazón + SKU) para
          poder vender stock.
        </p>
      )}

      {variantes.map((v, i) => (
        <div key={v.key} className="rounded-xl border border-negro/10 bg-blanco p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-5 w-5 rounded-full border border-negro/20"
                style={{ backgroundColor: v.colorArmazonHex || '#ffffff' }}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">
                Variante {i + 1}
                {v.colorArmazon ? ` · ${v.colorArmazon}` : ''}
              </span>
              {v.sku && <span className="text-xs text-gris-medio">{v.sku.toUpperCase()}</span>}
              {bajoStock(v) && <Badge tone="warn">Stock bajo</Badge>}
              {!v.activa && <Badge tone="neutral">Inactiva</Badge>}
              {v.imagenes.length > 0 && <Badge tone="neutral">{v.imagenes.length} img</Badge>}
            </div>
            <Btn variant="danger" size="sm" onClick={() => onRemove(v)}>
              Quitar
            </Btn>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Color de armazón" required error={err(i, 'colorArmazon')}>
              <Input
                value={v.colorArmazon}
                onChange={(e) => update(i, { colorArmazon: e.target.value })}
                placeholder="Negro"
              />
            </Field>
            <Field label="Hex armazón" error={err(i, 'colorArmazonHex')}>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Elegir color de armazón"
                  value={v.colorArmazonHex || '#000000'}
                  onChange={(e) => update(i, { colorArmazonHex: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-negro/20 bg-blanco p-1"
                />
                <Input
                  value={v.colorArmazonHex}
                  onChange={(e) => update(i, { colorArmazonHex: e.target.value })}
                  placeholder="#0A0A0A"
                />
              </div>
            </Field>
            <Field label="Color de lente" error={err(i, 'colorLente')}>
              <Input
                value={v.colorLente}
                onChange={(e) => update(i, { colorLente: e.target.value })}
                placeholder="Gris"
              />
            </Field>
            <Field label="Hex lente" error={err(i, 'colorLenteHex')}>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Elegir color de lente"
                  value={v.colorLenteHex || '#555555'}
                  onChange={(e) => update(i, { colorLenteHex: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-negro/20 bg-blanco p-1"
                />
                <Input
                  value={v.colorLenteHex}
                  onChange={(e) => update(i, { colorLenteHex: e.target.value })}
                  placeholder="#555555"
                />
              </div>
            </Field>
            <Field label="SKU" required error={err(i, 'sku')} hint="Único en todo el catálogo">
              <Input
                value={v.sku}
                onChange={(e) => update(i, { sku: e.target.value.toUpperCase() })}
                placeholder="VED-AVC-NEG"
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Stock" error={err(i, 'stock')}>
              <Input
                type="number"
                min={0}
                step={1}
                value={v.stock}
                onChange={(e) => update(i, { stock: e.target.value })}
              />
            </Field>
            <Field
              label="Stock mínimo"
              error={err(i, 'stockMinimo')}
              hint="Alerta en el dashboard por debajo de este valor"
            >
              <Input
                type="number"
                min={0}
                step={1}
                value={v.stockMinimo}
                onChange={(e) => update(i, { stockMinimo: e.target.value })}
              />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Variante activa (visible en la tienda)"
                checked={v.activa}
                onChange={(e) => update(i, { activa: e.target.checked })}
              />
            </div>
          </div>
        </div>
      ))}

      <Btn variant="secondary" onClick={() => onChange([...variantes, nuevaVariante()])}>
        + Agregar variante
      </Btn>
    </div>
  );
}
