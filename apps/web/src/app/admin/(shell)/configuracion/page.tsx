import type { Metadata } from 'next';
import { Badge, Card, PageHeader } from '@/components/admin/ui';
import { serverApiOrNull } from '@/lib/api-server';
import { getSession } from '@/lib/session';
import { site } from '@/config/site';
import Link from 'next/link';
import { LABELS, formatPrecio } from '@/lib/format';
import { colors } from '@vedere/ui';

export const metadata: Metadata = { title: 'Configuración' };
export const dynamic = 'force-dynamic';

interface StorageConfig {
  driver: 'r2' | 'local';
  maxUploadMb: number;
  tiposPermitidos: string[];
}

interface Health {
  status: string;
  version: string;
  env: string;
  uptimeSeconds: number;
  db: { ok: boolean; latencyMs: number; error?: string };
}

const COLOR_NAMES: Record<keyof typeof colors, string> = {
  negro: 'Negro',
  blanco: 'Blanco',
  grisClaro: 'Gris claro',
  grisMedio: 'Gris medio',
  grisTexto: 'Gris texto',
  sol: 'Sol',
  vetro: 'Vetro',
  noche: 'Noche',
  carey: 'Carey',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-gris-medio">{label}</dt>
      <dd className="font-medium sm:text-right">{children}</dd>
    </div>
  );
}

export default async function ConfiguracionPage() {
  const [user, storage, health] = await Promise.all([
    getSession(),
    serverApiOrNull<StorageConfig>('/admin/imagenes/config'),
    serverApiOrNull<Health>('/health'),
  ]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Estado de la plataforma y dónde se cambia cada cosa. Esta pantalla es de sólo lectura: los valores viven en las variables de entorno de Railway."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Almacenamiento de imágenes"
          actions={
            storage ? (
              <Badge tone={storage.driver === 'r2' ? 'ok' : 'warn'}>
                {storage.driver === 'r2' ? 'Cloudflare R2' : 'Disco local'}
              </Badge>
            ) : (
              <Badge tone="danger">Sin datos</Badge>
            )
          }
        >
          {storage ? (
            <dl className="divide-y divide-negro/5">
              <Row label="Driver">{storage.driver}</Row>
              <Row label="Tamaño máximo por archivo">{storage.maxUploadMb} MB</Row>
              <Row label="Tipos permitidos">
                <span className="font-mono text-xs">{storage.tiposPermitidos.join(', ')}</span>
              </Row>
              <Row label="Procesamiento">WebP en 3 tamaños (320 / 800 / 1600 px)</Row>
            </dl>
          ) : (
            <p className="text-sm text-gris-medio">No se pudo consultar la API.</p>
          )}
          {storage?.driver === 'local' && (
            <p className="mt-4 rounded-lg bg-sol/20 px-3 py-2 text-sm">
              Modo local: las imágenes se guardan en el disco del servidor y se pierden en cada
              deploy. En producción cargá en el servicio{' '}
              <code className="font-mono text-xs">api</code> de Railway las variables{' '}
              <code className="font-mono text-xs">R2_ACCOUNT_ID</code>,{' '}
              <code className="font-mono text-xs">R2_ACCESS_KEY_ID</code>,{' '}
              <code className="font-mono text-xs">R2_SECRET_ACCESS_KEY</code>,{' '}
              <code className="font-mono text-xs">R2_BUCKET</code> y{' '}
              <code className="font-mono text-xs">R2_PUBLIC_URL</code>.
            </p>
          )}
        </Card>

        <Card
          title="Barra de promo"
          actions={<Badge tone="info">Se edita en Barra de promo</Badge>}
        >
          <p className="text-sm text-negro/80">
            Los mensajes rotativos de la barra superior se cargan en{' '}
            <Link href="/admin/promos" className="underline underline-offset-2">
              Barra de promo
            </Link>
            . Si no hay ninguno activo, la tienda usa el texto de respaldo de las variables{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_PROMO_TEXT</code> y{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_PROMO_LINK</code>
            {site.promo.enabled ? ` (ahora: "${site.promo.text}")` : ' (desactivado)'}.
          </p>
        </Card>

        <Card title="Tienda">
          <dl className="divide-y divide-negro/5">
            <Row label="Cuotas sin interés">{site.comercial.cuotas}</Row>
            <Row label="Envío gratis desde">{formatPrecio(site.comercial.envioGratisDesde)}</Row>
            <Row label="Días para cambios">{site.comercial.diasCambio}</Row>
            <Row label="WhatsApp">{site.whatsapp || '—'}</Row>
            <Row label="Email de contacto">{site.emailContacto}</Row>
          </dl>
          <p className="mt-4 text-sm text-gris-medio">
            Variables <code className="font-mono text-xs">NEXT_PUBLIC_CUOTAS</code>,{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_ENVIO_GRATIS_DESDE</code>,{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_WHATSAPP</code> y{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_EMAIL_CONTACTO</code> del servicio web.
          </p>
        </Card>

        <Card
          title="API"
          actions={
            health ? (
              <Badge tone={health.db.ok ? 'ok' : 'danger'}>
                {health.db.ok ? 'Operativa' : 'Degradada'}
              </Badge>
            ) : (
              <Badge tone="danger">Sin respuesta</Badge>
            )
          }
        >
          <dl className="divide-y divide-negro/5">
            <Row label="URL pública">
              <span className="font-mono text-xs">{site.apiUrl}</span>
            </Row>
            {health && (
              <>
                <Row label="Versión">{health.version}</Row>
                <Row label="Entorno">{health.env}</Row>
                <Row label="Base de datos">
                  {health.db.ok
                    ? `ok · ${health.db.latencyMs} ms`
                    : `error · ${health.db.error ?? 'desconocido'}`}
                </Row>
                <Row label="Uptime">{Math.round(health.uptimeSeconds / 60)} min</Row>
              </>
            )}
          </dl>
          <p className="mt-4 text-sm text-gris-medio">
            La web habla con la API a través del proxy{' '}
            <code className="font-mono text-xs">/api/*</code>. La URL se define con{' '}
            <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> y{' '}
            <code className="font-mono text-xs">API_URL</code>.
          </p>
        </Card>

        <Card title="Sesión">
          <dl className="divide-y divide-negro/5">
            <Row label="Usuario">{user?.nombre ?? '—'}</Row>
            <Row label="Email">{user?.email ?? '—'}</Row>
            <Row label="Rol">
              {user ? (
                <Badge tone={user.rol === 'ADMIN' ? 'info' : 'ok'}>{LABELS.rol[user.rol]}</Badge>
              ) : (
                '—'
              )}
            </Row>
          </dl>
          <p className="mt-4 text-sm text-gris-medio">
            Los administradores gestionan usuarios y roles desde la sección Usuarios. Los operadores
            gestionan el catálogo.
          </p>
        </Card>

        <Card title="Marca" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(colors) as Array<keyof typeof colors>).map((key) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-negro/10 p-3"
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-full border border-negro/10"
                  style={{ backgroundColor: colors[key] }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{COLOR_NAMES[key]}</p>
                  <p className="font-mono text-xs text-gris-medio">{colors[key]}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-negro/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gris-medio">
                Tipografía
              </p>
              <p className="mt-1 font-medium">Archivo (variable, ejes wdth y wght)</p>
              <p className="font-campaign mt-3 text-3xl">Titular de campaña</p>
              <p className="mt-1 text-xs text-gris-medio">wdth 62 · peso 800 · mayúsculas</p>
              <p className="mt-3 text-base">Títulos y texto</p>
              <p className="mt-1 text-xs text-gris-medio">wdth 100 · pesos 400 a 600</p>
            </div>
            <div className="rounded-lg border border-negro/10 p-4 text-sm text-gris-medio">
              Los tokens viven en{' '}
              <code className="font-mono text-xs">apps/web/src/styles/globals.css</code> y{' '}
              <code className="font-mono text-xs">packages/ui/src/tokens.ts</code>. Los logos están
              en <code className="font-mono text-xs">apps/web/public/brand</code>.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
