'use client';
import { Drawer } from '@vedere/ui';

function talle(calibre: number | null): string {
  if (!calibre) return '';
  if (calibre < 50) return 'chico';
  if (calibre <= 54) return 'mediano';
  return 'grande';
}

export function GuiaTalles({
  open,
  onClose,
  medidas,
}: {
  open: boolean;
  onClose: () => void;
  medidas: { calibreMm: number | null; puenteMm: number | null; varillaMm: number | null };
}) {
  const t = talle(medidas.calibreMm);
  return (
    <Drawer open={open} onClose={onClose} title="Guía de talles" side="bottom">
      <div className="font-text space-y-5 text-base">
        <p>
          Las medidas están grabadas en la cara interna de la varilla de tus anteojos actuales, por
          ejemplo <span className="font-mono">52 □ 18 140</span>. Compará esos números con los del
          modelo.
        </p>
        <dl className="space-y-3">
          <div>
            <dt className="font-semibold">Calibre (ancho del lente)</dt>
            <dd className="text-gris-texto">
              Hasta 49 mm: chico · 50 a 54 mm: mediano · 55 mm o más: grande.
              {medidas.calibreMm && (
                <span className="block text-negro">
                  Este modelo mide {medidas.calibreMm} mm: talle {t}.
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Puente</dt>
            <dd className="text-gris-texto">
              Distancia entre los lentes. Un puente de 14 a 18 mm es el más común; si tus anteojos
              se te resbalan, buscá uno más chico.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Varilla</dt>
            <dd className="text-gris-texto">
              Largo de la patilla. 135 a 150 mm cubre casi todas las cabezas; la óptica socia la
              ajusta a tu medida.
            </dd>
          </div>
        </dl>
        <p className="rounded-2xl bg-gris-claro p-4 text-sm">
          ¿Dudás entre dos talles? Elegí el que más te guste: el ajuste en la óptica es gratis y, si
          no te queda, lo cambiás sin cargo dentro de los 30 días.
        </p>
      </div>
    </Drawer>
  );
}
