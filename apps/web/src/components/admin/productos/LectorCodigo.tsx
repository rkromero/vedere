'use client';
// Lector de códigos de barras: cámara del celular / notebook (BarcodeDetector nativo, o el de zxing
// como respaldo en Safari / Firefox) y campo de texto para lectores USB o Bluetooth, que "tipean"
// el código y mandan Enter.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Btn, Input, Modal, Spinner } from '@/components/admin/ui';

const FORMATOS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code',
] as const;

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

async function crearDetector(): Promise<Detector> {
  const nativo = (
    globalThis as {
      BarcodeDetector?: {
        new (o: { formats: string[] }): Detector;
        getSupportedFormats?: () => Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (nativo) {
    try {
      const soportados = (await nativo.getSupportedFormats?.()) ?? [];
      const formats = FORMATOS.filter((f) => soportados.includes(f));
      if (formats.length) return new nativo({ formats });
    } catch {
      // Cae al ponyfill.
    }
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: [...FORMATOS] });
}

/** Pitido corto al leer (feedback cuando se escanea muchas unidades seguidas). */
export function beep(ok = true) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1200 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.09 : 0.25));
    osc.onended = () => void ctx.close();
  } catch {
    // Sin audio: no pasa nada.
  }
}

/** Vista de cámara que llama a `onCodigo` cada vez que lee un código (con antirrebote del mismo código). */
export function CamaraCodigo({
  onCodigo,
  pausada = false,
}: {
  onCodigo: (codigo: string) => void;
  pausada?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<'iniciando' | 'leyendo' | 'error'>('iniciando');
  const [error, setError] = useState<string | null>(null);
  const ultimo = useRef<{ codigo: string; at: number } | null>(null);
  const cb = useRef(onCodigo);
  cb.current = onCodigo;
  const pausadaRef = useRef(pausada);
  pausadaRef.current = pausada;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado('error');
        setError(
          'Este navegador no permite usar la cámara (hace falta HTTPS). Usá un lector o tipeá el código.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelado) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = await crearDetector();
        if (cancelado) return;
        setEstado('leyendo');

        const tick = async () => {
          if (cancelado) return;
          if (!pausadaRef.current && video.readyState >= 2) {
            try {
              const codigos = await detector.detect(video);
              const valor = codigos[0]?.rawValue?.trim();
              if (valor) {
                const ahora = Date.now();
                // El mismo código dentro de 2,5 s se toma como la misma lectura.
                if (
                  !ultimo.current ||
                  ultimo.current.codigo !== valor ||
                  ahora - ultimo.current.at > 2500
                ) {
                  ultimo.current = { codigo: valor, at: ahora };
                  cb.current(valor);
                } else {
                  ultimo.current.at = ahora;
                }
              }
            } catch {
              // Frame ilegible: seguimos.
            }
          }
          timer = setTimeout(() => void tick(), 200);
        };
        void tick();
      } catch (err) {
        setEstado('error');
        const nombre = (err as { name?: string }).name;
        setError(
          nombre === 'NotAllowedError'
            ? 'No diste permiso para usar la cámara. Habilitalo en el navegador o usá un lector.'
            : nombre === 'NotFoundError'
              ? 'No se encontró ninguna cámara.'
              : 'No se pudo iniciar la cámara.',
        );
      }
    }
    void iniciar();
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl bg-negro">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
      {estado === 'leyendo' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-1/3 w-4/5 rounded-lg border-2 border-blanco/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
            <div className="mx-auto mt-[calc(50%-1px)] h-0.5 w-full animate-pulse bg-carey/80" />
          </div>
        </div>
      )}
      {estado === 'iniciando' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-blanco">
          <Spinner /> Iniciando cámara…
        </div>
      )}
      {estado === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-blanco">
          {error}
        </div>
      )}
    </div>
  );
}

/** Campo para lectores USB / Bluetooth (o tipeo manual): Enter dispara la búsqueda. */
export function CampoCodigo({
  onCodigo,
  autoFocus = true,
  disabled,
  placeholder = 'Escaneá o tipeá el código y Enter',
  inputRef,
}: {
  inputRef?: Ref<HTMLInputElement>;
  onCodigo: (codigo: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [valor, setValor] = useState('');
  const enviar = useCallback(() => {
    const c = valor.trim();
    if (c.length < 4) return;
    onCodigo(c);
    setValor('');
  }, [valor, onCodigo]);

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            enviar();
          }
        }}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-label="Código de barras"
        className="font-mono text-base"
      />
      <Btn variant="secondary" onClick={enviar} disabled={disabled || valor.trim().length < 4}>
        Buscar
      </Btn>
    </div>
  );
}

/** Modal "Escanear código": cámara + campo. Se cierra al primer código leído. */
export function LectorCodigoModal({
  open,
  onClose,
  onCodigo,
  titulo = 'Escanear código de barras',
}: {
  open: boolean;
  onClose: () => void;
  onCodigo: (codigo: string) => void;
  titulo?: string;
}) {
  const [camara, setCamara] = useState(false);
  useEffect(() => {
    if (!open) setCamara(false);
  }, [open]);

  const leer = (c: string) => {
    beep();
    onClose();
    onCodigo(c);
  };

  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      <div className="space-y-4">
        <CampoCodigo onCodigo={leer} autoFocus={!camara} />
        {camara ? (
          <CamaraCodigo onCodigo={leer} />
        ) : (
          <Btn variant="secondary" className="w-full" onClick={() => setCamara(true)}>
            Usar la cámara
          </Btn>
        )}
        <p className="text-xs text-gris-medio">
          Con un lector USB o Bluetooth, dejá el cursor en el campo y escaneá. Con la cámara, apuntá
          al código de la etiqueta o la caja del anteojo.
        </p>
      </div>
    </Modal>
  );
}
