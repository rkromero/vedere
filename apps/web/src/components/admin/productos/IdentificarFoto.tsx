'use client';
// "Identificar por foto": se sacan (o suben) hasta 4 fotos del anteojo — la patilla por dentro y el
// frente — y la IA lee marca, modelo, color y medidas, busca la ficha en internet y devuelve una
// sugerencia con la misma forma que la del código de barras.
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import type { SugerenciaProducto } from '@/lib/types';
import { Btn, Modal, Spinner } from '@/components/admin/ui';

export interface SugerenciaFoto extends SugerenciaProducto {
  textoLeido: string;
  codigoColor: string | null;
  confianza: 'alta' | 'media' | 'baja';
  notas: string;
  fichaWeb: boolean;
}

export interface ResultadoFoto {
  sugerencia: SugerenciaFoto;
  fotosPropias: Array<{ url: string; urlMediana: string; urlMiniatura: string }>;
}

const MAX_FOTOS = 4;

const MENSAJES = [
  'Leyendo lo que dice la patilla…',
  'Reconociendo marca y modelo…',
  'Buscando la ficha del modelo en internet…',
  'Juntando fotos y descripción…',
];

export function IdentificarFotoModal({
  open,
  onClose,
  onResultado,
}: {
  open: boolean;
  onClose: () => void;
  onResultado: (r: ResultadoFoto) => void;
}) {
  const [fotos, setFotos] = useState<Array<{ file: File; url: string }>>([]);
  const [enviando, setEnviando] = useState(false);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [habilitada, setHabilitada] = useState<boolean | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ habilitada: boolean }>('/admin/identificar-foto/config')
      .then((c) => setHabilitada(c.habilitada))
      .catch(() => setHabilitada(null));
  }, [open]);

  // Limpia al cerrar (y libera las URLs de vista previa).
  useEffect(() => {
    if (open) return;
    setFotos((l) => {
      l.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!enviando) return;
    setPaso(0);
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, MENSAJES.length - 1)), 9000);
    return () => clearInterval(t);
  }, [enviando]);

  function agregar(files: FileList | null) {
    if (!files) return;
    const nuevas = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFotos((l) => [...l, ...nuevas].slice(0, MAX_FOTOS));
    setError(null);
  }

  function quitar(i: number) {
    setFotos((l) => {
      URL.revokeObjectURL(l[i]!.url);
      return l.filter((_, j) => j !== i);
    });
  }

  async function identificar() {
    if (fotos.length === 0) return;
    setEnviando(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of fotos) fd.append('file', f.file);
      const r = await api.post<ResultadoFoto>('/admin/identificar-foto', fd);
      onClose();
      onResultado(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !enviando && onClose()}
      title="Identificar por foto"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Btn>
          <Btn
            onClick={() => void identificar()}
            loading={enviando}
            disabled={fotos.length === 0 || habilitada === false}
          >
            Identificar
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {habilitada === false && (
          <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
            La identificación por foto no está configurada: falta la clave de Anthropic
            (ANTHROPIC_API_KEY) en la API.
          </p>
        )}

        <ol className="list-decimal space-y-1 pl-5 text-sm text-negro/80">
          <li>
            <strong>Patilla por dentro</strong>, de cerca y bien enfocada, que se lean las letras y
            las medidas (ej. <span className="font-mono">52□18 140</span>).
          </li>
          <li>
            <strong>El anteojo de frente</strong>, sobre un fondo claro. Si sale bien, la usamos
            como foto del producto.
          </li>
          <li>Opcional: el otro lado de la patilla, la etiqueta o el estuche.</li>
        </ol>

        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = '';
          }}
        />

        {fotos.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {fotos.map((f, i) => (
              <li
                key={f.url}
                className="relative aspect-square overflow-hidden rounded-lg bg-gris-claro"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded-full bg-negro px-1.5 text-xs text-blanco">
                  {i + 1}
                </span>
                {!enviando && (
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    aria-label={`Quitar foto ${i + 1}`}
                    className="absolute right-1 top-1 rounded-full bg-blanco/90 px-1.5 text-xs"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {fotos.length < MAX_FOTOS && !enviando && (
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" onClick={() => camRef.current?.click()}>
              Sacar foto
            </Btn>
            <Btn variant="secondary" onClick={() => fileRef.current?.click()}>
              Subir fotos
            </Btn>
          </div>
        )}

        {enviando && (
          <p className="flex items-center gap-2 text-sm text-gris-medio" role="status">
            <Spinner className="h-4 w-4" /> {MENSAJES[paso]} (puede tardar hasta un minuto)
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
