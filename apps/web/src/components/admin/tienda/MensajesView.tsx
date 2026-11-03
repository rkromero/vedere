'use client';
// Bandeja: mensajes de contacto, avisos de stock y suscriptores del newsletter.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { formatFecha } from '@/lib/format';
import type {
  AvisoStock,
  MensajeContacto,
  MotivoContacto,
  Paged,
  SuscripcionNewsletter,
} from '@/lib/types';
import {
  Badge,
  Btn,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Tabs,
} from '@/components/admin/ui';
import {
  FilterSelect,
  Pagination,
  SearchInput,
  Table,
  Td,
  Th,
  Toolbar,
  Tr,
  useQueryParams,
} from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

export const MOTIVO_LABEL: Record<MotivoContacto, string> = {
  CONSULTA: 'Consulta',
  TURNO: 'Turno',
  CAMBIO: 'Cambio',
  ARREPENTIMIENTO: 'Arrepentimiento',
  OPTICA: 'Óptica',
  OTRO: 'Otro',
};

export type Bandeja =
  | { tab: 'contacto'; data: Paged<MensajeContacto>; sinLeer: number }
  | { tab: 'avisos'; data: Paged<AvisoStock>; sinLeer: number }
  | { tab: 'newsletter'; data: Paged<SuscripcionNewsletter>; sinLeer: number };

export function MensajesView({ bandeja }: { bandeja: Bandeja }) {
  const { set } = useQueryParams();
  return (
    <>
      <PageHeader
        title="Mensajes"
        description="Lo que llega desde la tienda: formulario de contacto, pedidos de aviso de stock y suscripciones."
      />
      <Tabs
        tabs={[
          {
            value: 'contacto',
            label: 'Contacto',
            badge: bandeja.sinLeer > 0 ? <Badge tone="info">{bandeja.sinLeer}</Badge> : undefined,
          },
          { value: 'avisos', label: 'Avisos de stock' },
          { value: 'newsletter', label: 'Newsletter' },
        ]}
        value={bandeja.tab}
        onChange={(tab) => set({ tab, q: undefined, motivo: undefined, leido: undefined })}
      />
      {bandeja.tab === 'contacto' && <Contacto data={bandeja.data} />}
      {bandeja.tab === 'avisos' && <Avisos data={bandeja.data} />}
      {bandeja.tab === 'newsletter' && <Newsletter data={bandeja.data} />}
    </>
  );
}

function Contacto({ data }: { data: Paged<MensajeContacto> }) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState<MensajeContacto | null>(null);
  const [toDelete, setToDelete] = useState<MensajeContacto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function abrir(m: MensajeContacto) {
    setAbierto(m);
    if (!m.leidoEn) {
      try {
        await api.put(`/admin/contacto/${m.id}/leido`);
        router.refresh();
      } catch {
        /* no bloquea la lectura */
      }
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/contacto/${toDelete.id}`);
      toast.ok('Mensaje eliminado');
      setToDelete(null);
      setAbierto(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Toolbar>
        <SearchInput placeholder="Buscar por nombre, email o texto…" />
        <FilterSelect
          param="motivo"
          label="Motivo"
          options={(Object.keys(MOTIVO_LABEL) as MotivoContacto[]).map((m) => ({
            value: m,
            label: MOTIVO_LABEL[m],
          }))}
        />
        <FilterSelect
          param="leido"
          label="Lectura"
          options={[
            { value: 'false', label: 'Sin leer' },
            { value: 'true', label: 'Leídos' },
          ]}
        />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState
          title="No hay mensajes"
          description="Los mensajes del formulario de contacto aparecen acá."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>De</Th>
                <Th>Motivo</Th>
                <Th>Mensaje</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <Tr key={m.id} onClick={() => abrir(m)} className={m.leidoEn ? '' : 'font-medium'}>
                  <Td className="whitespace-nowrap text-xs">{formatFecha(m.createdAt, true)}</Td>
                  <Td>
                    {m.nombre}
                    <span className="block text-xs text-gris-medio">{m.email}</span>
                  </Td>
                  <Td>
                    <Badge
                      tone={m.motivo === 'ARREPENTIMIENTO' || m.motivo === 'CAMBIO' ? 'warn' : 'neutral'}
                    >
                      {MOTIVO_LABEL[m.motivo]}
                    </Badge>
                  </Td>
                  <Td className="max-w-md truncate text-gris-medio">{m.mensaje}</Td>
                  <Td align="right">
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(m);
                      }}
                    >
                      Eliminar
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
          />
        </>
      )}

      <Modal
        open={!!abierto}
        onClose={() => setAbierto(null)}
        title={abierto ? `${MOTIVO_LABEL[abierto.motivo]} · ${abierto.nombre}` : ''}
        footer={
          abierto && (
            <>
              <Btn variant="danger" onClick={() => setToDelete(abierto)}>
                Eliminar
              </Btn>
              <a
                href={`mailto:${abierto.email}?subject=${encodeURIComponent('Re: tu mensaje a Vedere')}`}
                className="inline-flex h-10 items-center rounded-lg bg-negro px-4 text-sm font-medium text-blanco"
              >
                Responder por email
              </a>
            </>
          )
        }
      >
        {abierto && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gris-medio">Recibido</dt>
              <dd>{formatFecha(abierto.createdAt, true)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gris-medio">Contacto</dt>
              <dd>
                {abierto.email}
                {abierto.telefono && <span className="block">{abierto.telefono}</span>}
              </dd>
            </div>
            {abierto.pedido && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gris-medio">Pedido</dt>
                <dd className="font-mono">{abierto.pedido}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-gris-medio">Mensaje</dt>
              <dd className="whitespace-pre-wrap">{abierto.mensaje}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar mensaje"
        description={toDelete ? `Se eliminará el mensaje de ${toDelete.nombre}.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}

function Avisos({ data }: { data: Paged<AvisoStock> }) {
  return (
    <>
      <Toolbar>
        <SearchInput placeholder="Buscar email…" />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState
          title="Nadie espera stock"
          description="Cuando un producto se agota, los clientes dejan su email acá."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Email</Th>
                <Th>Producto</Th>
                <Th>Variante</Th>
                <Th align="right">Stock hoy</Th>
                <Th>Avisado</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap text-xs">{formatFecha(a.createdAt, true)}</Td>
                  <Td>{a.email}</Td>
                  <Td>
                    <a
                      href={`/admin/productos/${a.variante.producto.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {a.variante.producto.nombre}
                    </a>
                  </Td>
                  <Td>
                    {a.variante.colorArmazon}
                    <span className="block font-mono text-xs text-gris-medio">{a.variante.sku}</span>
                  </Td>
                  <Td align="right">
                    <Badge tone={a.variante.stock > 0 ? 'ok' : 'danger'}>{a.variante.stock}</Badge>
                  </Td>
                  <Td className="text-xs">
                    {a.notificadoEn ? formatFecha(a.notificadoEn, true) : '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
          />
        </>
      )}
    </>
  );
}

function Newsletter({ data }: { data: Paged<SuscripcionNewsletter> }) {
  const router = useRouter();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<SuscripcionNewsletter | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/newsletter/${toDelete.id}`);
      toast.ok('Suscripción eliminada');
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function exportar() {
    const filas = data.items.map((s) => [s.email, s.origen ?? '', s.createdAt].join(','));
    const csv = ['email,origen,fecha', ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Toolbar>
        <SearchInput placeholder="Buscar email…" />
        <Btn variant="secondary" size="sm" onClick={exportar} disabled={data.items.length === 0}>
          Exportar página (CSV)
        </Btn>
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState
          title="Sin suscriptores"
          description="Los emails del bloque de newsletter de la home aparecen acá."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Email</Th>
                <Th>Origen</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="whitespace-nowrap text-xs">{formatFecha(s.createdAt, true)}</Td>
                  <Td>{s.email}</Td>
                  <Td className="text-gris-medio">{s.origen ?? '—'}</Td>
                  <Td align="right">
                    <Btn variant="ghost" size="sm" onClick={() => setToDelete(s)}>
                      Eliminar
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
          />
        </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar suscripción"
        description={toDelete ? `Se dará de baja a ${toDelete.email}.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
