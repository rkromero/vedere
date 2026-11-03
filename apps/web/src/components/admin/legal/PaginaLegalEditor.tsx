'use client';
// Editor Markdown de una página legal con vista previa (marked) y control de publicación.
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { marked } from 'marked';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { Badge, Btn, Card, Checkbox, Field, Input, PageHeader, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import type { PaginaLegal } from '@/lib/admin/prompt6';
import { urlPublicaLegal } from './PaginasLegalesTable';

function renderMarkdown(md: string): string {
  try {
    return marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  } catch {
    return '<p>No se pudo renderizar el Markdown.</p>';
  }
}

export function PaginaLegalEditor({ pagina }: { pagina: PaginaLegal }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    titulo: pagina.titulo,
    intro: pagina.intro ?? '',
    contenido: pagina.contenido,
    publicada: pagina.publicada,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [vista, setVista] = useState<'editar' | 'previa'>('editar');
  const html = useMemo(() => renderMarkdown(form.contenido), [form.contenido]);
  const sucio =
    form.titulo !== pagina.titulo ||
    form.intro !== (pagina.intro ?? '') ||
    form.contenido !== pagina.contenido ||
    form.publicada !== pagina.publicada;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put(`/admin/paginas-legales/${pagina.slug}`, {
        titulo: form.titulo,
        intro: form.intro.trim() || null,
        contenido: form.contenido,
        publicada: form.publicada,
      });
      toast.ok('Página guardada');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={pagina.titulo}
        description={`Se publica en ${urlPublicaLegal(pagina.slug)}`}
        actions={
          <>
            <Link href="/admin/legal" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-gris-claro">
              ← Páginas legales
            </Link>
            <a href={urlPublicaLegal(pagina.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro">
              Ver en la tienda
            </a>
          </>
        }
      />
      <form onSubmit={guardar} className="space-y-4">
        <Card
          title="Contenido"
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={form.publicada ? 'ok' : 'warn'}>{form.publicada ? 'Publicada' : 'Borrador'}</Badge>
              <div className="flex rounded-lg border border-negro/15 p-0.5 text-xs">
                {(['editar', 'previa'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVista(v)}
                    className={`rounded-md px-2.5 py-1 font-medium ${vista === v ? 'bg-negro text-blanco' : 'hover:bg-gris-claro'}`}
                  >
                    {v === 'editar' ? 'Editar' : 'Vista previa'}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" error={errors.titulo} required>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required maxLength={160} />
              </Field>
              <Field label="Intro" error={errors.intro} hint="Bajada corta debajo del título (opcional).">
                <Input value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} maxLength={300} />
              </Field>
            </div>
            {vista === 'editar' ? (
              <Field label="Texto (Markdown)" error={errors.contenido} required hint="Títulos con ##, listas con -, negritas con **texto**, links [texto](url).">
                <Textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} required rows={28} className="min-h-[560px] font-mono text-[13px] leading-relaxed" />
              </Field>
            ) : (
              <div className="rounded-lg border border-negro/10 bg-blanco p-6">
                <h1 className="mb-1 text-2xl font-semibold tracking-tight">{form.titulo}</h1>
                {form.intro && <p className="mb-4 text-sm text-gris-medio">{form.intro}</p>}
                <div className="space-y-3 text-sm leading-relaxed text-negro/85 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-negro [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-negro [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-negro" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            )}
            <Checkbox label="Publicada (visible en la tienda)" checked={form.publicada} onChange={(e) => setForm({ ...form, publicada: e.target.checked })} />
          </div>
        </Card>
        <div className="flex items-center gap-3">
          <Btn type="submit" loading={saving} disabled={!sucio}>
            Guardar
          </Btn>
          {sucio && <span className="text-xs text-gris-medio">Cambios sin guardar</span>}
        </div>
      </form>
    </>
  );
}
