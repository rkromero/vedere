'use client';
// B2B 4: el cliente califica (1 a 5) un pedido entregado; alimenta la satisfacción de la óptica.
import { useState } from 'react';
import { Button } from '@vedere/ui';
import { mensajeError, tiendaApi } from '@/lib/tienda/client';

export interface Calificacion {
  puntaje: number;
  comentario: string | null;
  createdAt: string;
}

function Estrellas({ valor, onChange }: { valor: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1" role={onChange ? 'radiogroup' : undefined} aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} de 5`}
            onClick={() => onChange(n)}
            className={`text-3xl leading-none transition-colors ${n <= valor ? 'text-negro' : 'text-negro/20 hover:text-negro/50'}`}
            data-testid={`estrella-${n}`}
          >
            ★
          </button>
        ) : (
          <span key={n} aria-hidden className={`text-2xl leading-none ${n <= valor ? 'text-negro' : 'text-negro/20'}`}>
            ★
          </span>
        ),
      )}
    </div>
  );
}

export function CalificarPedido({ pedidoId, inicial }: { pedidoId: string; inicial: Calificacion | null }) {
  const [hecha, setHecha] = useState(inicial);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hecha) {
    return (
      <div className="font-text space-y-1" data-testid="calificacion-hecha">
        <Estrellas valor={hecha.puntaje} />
        {hecha.comentario && <p className="text-sm text-gris-texto">“{hecha.comentario}”</p>}
        <p className="text-sm">¡Gracias por contarnos cómo te fue!</p>
      </div>
    );
  }

  async function enviar() {
    if (!puntaje) return setError('Elegí de 1 a 5 estrellas');
    setEnviando(true);
    setError(null);
    try {
      const c = await tiendaApi.post<Calificacion>(`/cuenta/pedidos/${encodeURIComponent(pedidoId)}/calificacion`, {
        puntaje,
        comentario: comentario.trim() || null,
      });
      setHecha(c);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="font-text space-y-3" data-testid="calificar-pedido">
      <p className="text-sm text-gris-texto">¿Cómo fue la atención y la entrega de tu pedido?</p>
      <Estrellas valor={puntaje} onChange={setPuntaje} />
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Contanos algo más (opcional)"
        className="w-full rounded-2xl border border-negro/15 bg-blanco px-4 py-3 text-sm"
        aria-label="Comentario"
      />
      {error && (
        <p role="alert" className="text-sm text-carey">
          {error}
        </p>
      )}
      <Button size="sm" onClick={enviar} disabled={enviando} data-testid="enviar-calificacion">
        {enviando ? 'Enviando…' : 'Enviar calificación'}
      </Button>
    </div>
  );
}
