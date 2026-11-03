import type { Metadata } from 'next';
import { Container } from '@vedere/ui';
import { site } from '@/config/site';
import { getApiHealth } from '@/lib/api';

export const metadata: Metadata = { title: 'Estado del sistema', robots: { index: false } };
export const dynamic = 'force-dynamic';

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${ok ? 'bg-vetro' : 'bg-carey'}`}
      aria-hidden="true"
    />
  );
}

export default async function HealthPage() {
  const result = await getApiHealth();
  const checkedAt = new Date().toISOString();

  const apiOk = result.reachable && result.status === 200;
  const dbOk = result.reachable && result.data.db.ok;

  return (
    <Container className="py-16">
      <p className="font-text mb-3 text-sm font-medium uppercase tracking-widest text-gris-medio">
        Estado del sistema
      </p>
      <h1 className="font-campaign mb-10 text-5xl md:text-7xl">Health</h1>

      <dl className="grid max-w-2xl gap-4">
        <div className="flex items-center justify-between rounded-xl bg-gris-claro px-5 py-4">
          <dt className="font-text font-medium">Web</dt>
          <dd className="flex items-center gap-2 text-sm">
            <Dot ok /> ok
          </dd>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-gris-claro px-5 py-4">
          <dt className="font-text font-medium">
            API <span className="text-gris-medio">({site.apiUrl})</span>
          </dt>
          <dd className="flex items-center gap-2 text-sm">
            <Dot ok={apiOk} />
            {result.reachable ? `${result.status} · ${result.data.status}` : 'sin respuesta'}
          </dd>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-gris-claro px-5 py-4">
          <dt className="font-text font-medium">Base de datos</dt>
          <dd className="flex items-center gap-2 text-sm">
            <Dot ok={dbOk} />
            {result.reachable
              ? result.data.db.ok
                ? `ok · ${result.data.db.latencyMs} ms`
                : `error · ${result.data.db.error ?? 'desconocido'}`
              : 'desconocido'}
          </dd>
        </div>
      </dl>

      <pre className="mt-10 max-w-2xl overflow-x-auto rounded-xl bg-negro p-5 text-xs text-blanco">
        {JSON.stringify(result.reachable ? result.data : { error: result.error }, null, 2)}
      </pre>
      <p className="font-text mt-4 text-xs text-gris-medio">Consultado: {checkedAt}</p>
    </Container>
  );
}
