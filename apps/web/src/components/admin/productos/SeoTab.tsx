'use client';
import { cn } from '@vedere/ui';
import { Field, Input, Textarea } from '@/components/admin/ui';
import type { ProductoFormState } from './form-types';

function Contador({ actual, max }: { actual: number; max: number }) {
  return (
    <span className={cn('text-xs', actual > max ? 'text-carey' : 'text-gris-medio')}>
      {actual}/{max}
    </span>
  );
}

export function SeoTab({
  state,
  errors,
  onChange,
}: {
  state: ProductoFormState;
  errors: Record<string, string>;
  onChange: (patch: Partial<ProductoFormState>) => void;
}) {
  const title =
    state.seoTitle || (state.nombre ? `${state.nombre} | Vedere` : 'Título del producto | Vedere');
  const description =
    state.seoDescription ||
    state.descripcion.slice(0, 160) ||
    'Descripción breve que aparece en los resultados de búsqueda.';
  const slug = state.slug || 'slug-del-producto';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field
          label="Título SEO"
          error={errors.seoTitle}
          hint="Si lo dejás vacío se usa el nombre del producto."
        >
          <div className="space-y-1">
            <Input
              value={state.seoTitle}
              maxLength={90}
              onChange={(e) => onChange({ seoTitle: e.target.value })}
              placeholder={`${state.nombre || 'Nombre'} | Vedere`}
            />
            <div className="flex justify-end">
              <Contador actual={state.seoTitle.length} max={70} />
            </div>
          </div>
        </Field>
        <Field
          label="Descripción SEO"
          error={errors.seoDescription}
          hint="Resumen de hasta 160 caracteres."
        >
          <div className="space-y-1">
            <Textarea
              value={state.seoDescription}
              maxLength={200}
              onChange={(e) => onChange({ seoDescription: e.target.value })}
            />
            <div className="flex justify-end">
              <Contador actual={state.seoDescription.length} max={160} />
            </div>
          </div>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-negro/70">
          Vista previa en buscadores
        </p>
        <div className="rounded-xl border border-negro/10 bg-blanco p-4">
          <p className="truncate text-xs text-gris-medio">vedere.com.ar › p › {slug}</p>
          <p className="mt-1 truncate text-lg text-noche">{title.slice(0, 70)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-negro/80">{description.slice(0, 160)}</p>
        </div>
      </div>
    </div>
  );
}
