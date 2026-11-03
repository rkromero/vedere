// Receta en Mi cuenta: tabla OD/OI o link al archivo subido.
import { formatFecha } from '@/lib/format';
import { formatDioptria } from '@/lib/tienda/checkout';
import type { Receta } from '@/lib/tienda/checkout';

const MODO_LABEL: Record<Receta['modo'] | 'GUARDADA', string> = {
  VALORES: 'Cargada a mano',
  ARCHIVO: 'Foto / PDF',
  OPTICA: 'Medida en la óptica',
  GUARDADA: 'Guardada',
};

export function RecetaResumen({ receta, compacta }: { receta: Receta; compacta?: boolean }) {
  const conValores = receta.odEsfera !== null && receta.odEsfera !== undefined;
  return (
    <div className="text-sm">
      <p className="flex flex-wrap items-center gap-2 text-gris-texto">
        <span>{MODO_LABEL[receta.modo] ?? receta.modo}</span>
        <span aria-hidden="true">·</span>
        <span>{formatFecha(receta.createdAt)}</span>
      </p>
      {conValores && (
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gris-texto">
              <th className="py-1 pr-3 font-medium">Ojo</th>
              <th className="py-1 pr-3 font-medium">Esfera</th>
              <th className="py-1 pr-3 font-medium">Cilindro</th>
              <th className="py-1 pr-3 font-medium">Eje</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-negro/10">
              <td className="py-1.5 pr-3 font-medium">OD</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatDioptria(receta.odEsfera)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatDioptria(receta.odCilindro)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{receta.odEje ?? '—'}°</td>
            </tr>
            <tr className="border-t border-negro/10">
              <td className="py-1.5 pr-3 font-medium">OI</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatDioptria(receta.oiEsfera)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{formatDioptria(receta.oiCilindro)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{receta.oiEje ?? '—'}°</td>
            </tr>
          </tbody>
        </table>
      )}
      {conValores && (receta.adicion || receta.dp) && (
        <p className="mt-2 text-gris-texto">
          {receta.adicion ? `Adición ${formatDioptria(receta.adicion)}` : ''}
          {receta.adicion && receta.dp ? ' · ' : ''}
          {receta.dp ? `DP ${String(receta.dp).replace('.', ',')} mm` : ''}
        </p>
      )}
      {receta.archivoUrl && (
        <a
          href={receta.archivoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 underline underline-offset-4"
          data-testid="receta-archivo"
        >
          Ver archivo{receta.archivoNombre ? ` (${receta.archivoNombre})` : ''}
        </a>
      )}
      {receta.modo === 'OPTICA' && !compacta && (
        <p className="mt-2 text-gris-texto">La graduación se mide en la óptica socia al retirar.</p>
      )}
      {receta.notas && !compacta && <p className="mt-2 italic text-gris-texto">{receta.notas}</p>}
    </div>
  );
}
