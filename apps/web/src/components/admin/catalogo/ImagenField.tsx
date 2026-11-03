'use client';
// Campo de imagen única (logo, banner): subir archivo (procesado por la API) o pegar URL.
import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import { Btn, Field, Input } from '@/components/admin/ui';

export function ImagenField({
  label,
  value,
  onChange,
  folder,
  tamano = 'urlMediana',
  error,
  hint,
  previewClassName = 'h-16 w-16 rounded-lg object-contain',
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  /** Qué tamaño procesado guardar. */
  tamano?: 'url' | 'urlMediana' | 'urlMiniatura';
  error?: string;
  hint?: string;
  previewClassName?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setSubiendo(true);
    try {
      const res = await api.upload(file, folder);
      onChange(res[tamano]);
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Field label={label} error={error ?? uploadError ?? undefined} hint={hint}>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-negro/10 bg-gris-claro">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className={previewClassName} />
          ) : (
            <span className="text-xs text-gris-medio">Sin imagen</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            type="url"
            placeholder="https://…"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Btn
              variant="secondary"
              size="sm"
              loading={subiendo}
              onClick={() => fileRef.current?.click()}
            >
              Subir imagen
            </Btn>
            {value && (
              <Btn variant="ghost" size="sm" onClick={() => onChange(null)}>
                Quitar
              </Btn>
            )}
          </div>
        </div>
      </div>
    </Field>
  );
}
