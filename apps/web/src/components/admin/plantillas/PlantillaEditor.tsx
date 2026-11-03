'use client';
// Editor de una plantilla de email (prompt 6): asunto, título, cuerpo, CTA, activa; chips de variables que se
// insertan en el campo activo; vista previa (HTML renderizado por la API) y envío de prueba.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '@vedere/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { Badge, Btn, Card, Checkbox, ConfirmDialog, Field, Input, Modal, PageHeader } from '@/components/admin/ui';
import { useToast } from '@/components/admin/toast';
import type { PlantillaEmail } from '@/lib/admin/prompt6';

type Campo = 'asunto' | 'titulo' | 'cuerpo' | 'ctaLabel';

// Campos con ref (para insertar variables donde está el cursor); mismo estilo que Input/Textarea de ui.tsx.
const fieldBase =
  'w-full rounded-lg border border-negro/20 bg-blanco px-3 text-sm text-negro placeholder:text-gris-medio focus:border-negro focus:outline-none focus:ring-1 focus:ring-negro disabled:bg-gris-claro disabled:text-gris-medio';
function InputRef({ className, ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...rest} />;
}
function TextareaRef({ className, ref, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-[96px] py-2', className)} {...rest} />;
}

export function PlantillaEditor({ plantilla, emailUsuario }: { plantilla: PlantillaEmail; emailUsuario: string }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    asunto: plantilla.asunto,
    titulo: plantilla.titulo,
    cuerpo: plantilla.cuerpo,
    ctaLabel: plantilla.ctaLabel ?? '',
    activa: plantilla.activa,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [preview, setPreview] = useState<{ asunto: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pruebaOpen, setPruebaOpen] = useState(false);
  const [pruebaPara, setPruebaPara] = useState(emailUsuario);
  const [enviando, setEnviando] = useState(false);
  const ultimoCampo = useRef<Campo>('cuerpo');
  const refs = {
    asunto: useRef<HTMLInputElement>(null),
    titulo: useRef<HTMLInputElement>(null),
    cuerpo: useRef<HTMLTextAreaElement>(null),
    ctaLabel: useRef<HTMLInputElement>(null),
  };

  const sucio =
    form.asunto !== plantilla.asunto ||
    form.titulo !== plantilla.titulo ||
    form.cuerpo !== plantilla.cuerpo ||
    form.ctaLabel !== (plantilla.ctaLabel ?? '') ||
    form.activa !== plantilla.activa;

  const cargarPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const r = await api.post<{ asunto: string; html: string }>(`/admin/plantillas-email/${plantilla.tipo}/vista-previa`, {
        asunto: form.asunto,
        titulo: form.titulo,
        cuerpo: form.cuerpo,
        ctaLabel: form.ctaLabel || null,
      });
      setPreview(r);
    } catch (err) {
      setPreviewError(errorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [plantilla.tipo, form.asunto, form.titulo, form.cuerpo, form.ctaLabel]);

  // Vista previa con debounce al editar.
  useEffect(() => {
    const t = setTimeout(() => void cargarPreview(), 500);
    return () => clearTimeout(t);
  }, [cargarPreview]);

  function insertarVariable(v: string) {
    const campo = ultimoCampo.current;
    const el = refs[campo].current;
    const token = `{{${v}}}`;
    const actual = form[campo];
    if (!el) {
      setForm({ ...form, [campo]: actual + token });
      return;
    }
    const start = el.selectionStart ?? actual.length;
    const end = el.selectionEnd ?? actual.length;
    const nuevo = actual.slice(0, start) + token + actual.slice(end);
    setForm({ ...form, [campo]: nuevo });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put(`/admin/plantillas-email/${plantilla.tipo}`, {
        asunto: form.asunto,
        titulo: form.titulo,
        cuerpo: form.cuerpo,
        ctaLabel: form.ctaLabel.trim() || null,
        activa: form.activa,
      });
      toast.ok('Plantilla guardada');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function restablecer() {
    setRestableciendo(true);
    try {
      const p = await api.post<PlantillaEmail>(`/admin/plantillas-email/${plantilla.tipo}/restablecer`);
      setForm({ asunto: p.asunto, titulo: p.titulo, cuerpo: p.cuerpo, ctaLabel: p.ctaLabel ?? '', activa: p.activa });
      setConfirmReset(false);
      toast.ok('Plantilla restablecida al texto por defecto');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRestableciendo(false);
    }
  }

  async function enviarPrueba(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post(`/admin/plantillas-email/${plantilla.tipo}/prueba`, { para: pruebaPara.trim() });
      toast.ok(`Email de prueba enviado a ${pruebaPara.trim()}${sucio ? ' (con la versión guardada)' : ''}`);
      setPruebaOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <PageHeader
        title={plantilla.nombre}
        description={plantilla.descripcion ?? `Plantilla ${plantilla.tipo}`}
        actions={
          <>
            <Link href="/admin/plantillas" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-gris-claro">
              ← Plantillas
            </Link>
            <Btn variant="secondary" onClick={() => setPruebaOpen(true)}>
              Enviar prueba
            </Btn>
            {plantilla.personalizada && (
              <Btn variant="danger" onClick={() => setConfirmReset(true)}>
                Restablecer
              </Btn>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          title="Contenido"
          actions={
            <div className="flex gap-1">
              <Badge tone={plantilla.personalizada ? 'info' : 'neutral'}>{plantilla.personalizada ? 'Personalizada' : 'Por defecto'}</Badge>
              <code className="rounded bg-gris-claro px-1.5 py-0.5 font-mono text-[11px]">{plantilla.tipo}</code>
            </div>
          }
        >
          <form onSubmit={guardar} className="space-y-4">
            {plantilla.variables.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-negro/70">Variables disponibles</p>
                <div className="flex flex-wrap gap-1.5">
                  {plantilla.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertarVariable(v)}
                      className="rounded-full border border-negro/20 bg-blanco px-2.5 py-0.5 font-mono text-xs hover:bg-gris-claro"
                      title={`Insertar {{${v}}} en el campo activo`}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gris-medio">Hacé clic en una variable para insertarla donde está el cursor.</p>
              </div>
            )}
            <Field label="Asunto" error={errors.asunto} required>
              <InputRef ref={refs.asunto} value={form.asunto} onFocus={() => (ultimoCampo.current = 'asunto')} onChange={(e) => setForm({ ...form, asunto: e.target.value })} required maxLength={200} />
            </Field>
            <Field label="Título" error={errors.titulo} required hint="Encabezado grande dentro del email.">
              <InputRef ref={refs.titulo} value={form.titulo} onFocus={() => (ultimoCampo.current = 'titulo')} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required maxLength={200} />
            </Field>
            <Field label="Cuerpo" error={errors.cuerpo} required hint="Párrafos separados por una línea en blanco. Listas con “- ”. **negrita** entre asteriscos.">
              <TextareaRef ref={refs.cuerpo} value={form.cuerpo} onFocus={() => (ultimoCampo.current = 'cuerpo')} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} required rows={12} className="min-h-[260px] font-mono text-[13px]" />
            </Field>
            <Field label="Texto del botón" error={errors.ctaLabel} hint="Vacío = sin botón. El link lo define el sistema según el email.">
              <InputRef ref={refs.ctaLabel} value={form.ctaLabel} onFocus={() => (ultimoCampo.current = 'ctaLabel')} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} maxLength={80} />
            </Field>
            <Checkbox label="Plantilla activa (si está desactivada, este email no se manda)" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
            <div className="flex items-center gap-3">
              <Btn type="submit" loading={saving} disabled={!sucio && plantilla.personalizada}>
                Guardar
              </Btn>
              {sucio && <span className="text-xs text-gris-medio">Cambios sin guardar</span>}
            </div>
          </form>
        </Card>

        <Card
          title="Vista previa"
          actions={
            <div className="flex items-center gap-2">
              {previewLoading && <span className="text-xs text-gris-medio">Actualizando…</span>}
              <Btn size="sm" variant="secondary" onClick={() => void cargarPreview()} loading={previewLoading}>
                Actualizar
              </Btn>
            </div>
          }
        >
          {previewError ? (
            <p className="text-sm text-carey">No se pudo generar la vista previa: {previewError}</p>
          ) : preview ? (
            <div>
              <p className="mb-3 text-sm">
                <span className="text-gris-medio">Asunto: </span>
                <span className="font-medium">{preview.asunto}</span>
              </p>
              <iframe
                title="Vista previa del email"
                srcDoc={preview.html}
                sandbox=""
                className="h-[640px] w-full rounded-lg border border-negro/10 bg-[#F2F2F0]"
              />
              <p className="mt-2 text-xs text-gris-medio">Las variables se reemplazan con datos de ejemplo.</p>
            </div>
          ) : (
            <p className="text-sm text-gris-medio">Generando vista previa…</p>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void restablecer()}
        title="Restablecer plantilla"
        description="Se descarta el texto personalizado y vuelve el texto por defecto de Vedere. Esta acción no se puede deshacer."
        confirmLabel="Restablecer"
        danger
        loading={restableciendo}
      />

      <Modal open={pruebaOpen} onClose={() => setPruebaOpen(false)} title="Enviar email de prueba" size="sm">
        <form onSubmit={enviarPrueba} className="space-y-4">
          <p className="text-sm text-negro/80">
            Se manda la versión <strong>guardada</strong> de la plantilla con datos de ejemplo.
            {sucio && ' Guardá primero para probar los cambios actuales.'}
          </p>
          <Field label="Enviar a" required>
            <Input type="email" value={pruebaPara} onChange={(e) => setPruebaPara(e.target.value)} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setPruebaOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" loading={enviando}>
              Enviar
            </Btn>
          </div>
        </form>
      </Modal>
    </>
  );
}
