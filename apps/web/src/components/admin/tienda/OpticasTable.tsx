'use client';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { OpticaAdmin, OpticaMapaItem, Paged } from '@/lib/types';
import {
  Badge,
  Btn,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/admin/ui';
import { OpticasMapaAdmin } from './OpticasMapaAdmin';
import {
  FilterSelect,
  Pagination,
  SearchInput,
  Table,
  Td,
  Th,
  Toolbar,
  Tr,
} from '@/components/admin/table';
import { useToast } from '@/components/admin/toast';

interface FormState {
  nombre: string;
  razonSocial: string;
  cuit: string;
  condicionIva: string;
  opticoResponsable: string;
  matricula: string;
  radioKm: string;
  comisionPct: string;
  capacidadDiaria: string;
  descuentoPct: string;
  minimoTipo: string;
  minimoValor: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  lat: string;
  lng: string;
  telefono: string;
  whatsapp: string;
  email: string;
  horarios: string;
  orden: string;
  activa: boolean;
}
const vacio: FormState = {
  nombre: '',
  razonSocial: '',
  cuit: '',
  condicionIva: '',
  opticoResponsable: '',
  matricula: '',
  radioKm: '10',
  comisionPct: '10',
  capacidadDiaria: '20',
  descuentoPct: '0',
  minimoTipo: '',
  minimoValor: '',
  direccion: '',
  localidad: '',
  provincia: 'Buenos Aires',
  codigoPostal: '',
  lat: '',
  lng: '',
  telefono: '',
  whatsapp: '',
  email: '',
  horarios: '',
  orden: '0',
  activa: true,
};

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function OpticasTable({
  data,
  provincias,
  mapa,
}: {
  data: Paged<OpticaAdmin>;
  provincias: string[];
  mapa: OpticaMapaItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [enMapa, setEnMapa] = useState<string | null>(null);
  const [editing, setEditing] = useState<OpticaAdmin | null>(null);
  const [form, setForm] = useState<FormState>(vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<OpticaAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  function abrir(o: OpticaAdmin | null) {
    setEditing(o);
    setForm(
      o
        ? {
            nombre: o.nombre,
            razonSocial: o.razonSocial ?? '',
            cuit: o.cuit ?? '',
            condicionIva: o.condicionIva ?? '',
            opticoResponsable: o.opticoResponsable ?? '',
            matricula: o.matricula ?? '',
            radioKm: String(o.radioKm ?? 10),
            comisionPct: String(o.comisionPct ?? 0),
            capacidadDiaria: String(o.capacidadDiaria ?? 20),
            descuentoPct: String(o.descuentoPct ?? 0),
            minimoTipo: o.minimoTipo ?? '',
            minimoValor: o.minimoValor === null || o.minimoValor === undefined ? '' : String(o.minimoValor),
            direccion: o.direccion,
            localidad: o.localidad,
            provincia: o.provincia,
            codigoPostal: o.codigoPostal,
            lat: o.lat === null ? '' : String(o.lat),
            lng: o.lng === null ? '' : String(o.lng),
            telefono: o.telefono ?? '',
            whatsapp: o.whatsapp ?? '',
            email: o.email ?? '',
            horarios: o.horarios ?? '',
            orden: String(o.orden),
            activa: o.activa,
          }
        : vacio,
    );
    setErrors({});
    setGeneralError(null);
    setOpen(true);
  }

  const f = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneralError(null);
    const latN = num(form.lat);
    const lngN = num(form.lng);
    if ((latN !== null && Number.isNaN(latN)) || (lngN !== null && Number.isNaN(lngN))) {
      setErrors({ lat: 'Coordenadas inválidas' });
      setSaving(false);
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      razonSocial: form.razonSocial.trim() || null,
      cuit: form.cuit.trim() || null,
      condicionIva: form.condicionIva || null,
      opticoResponsable: form.opticoResponsable.trim() || null,
      matricula: form.matricula.trim() || null,
      radioKm: Number(form.radioKm.replace(',', '.')) || 10,
      comisionPct: Number(form.comisionPct.replace(',', '.')) || 0,
      capacidadDiaria: Number(form.capacidadDiaria) || 20,
      descuentoPct: Number(form.descuentoPct.replace(',', '.')) || 0,
      minimoTipo: (form.minimoTipo || null) as OpticaAdmin['minimoTipo'],
      minimoValor: form.minimoTipo ? Number(form.minimoValor.replace(',', '.')) || 0 : null,
      direccion: form.direccion.trim(),
      localidad: form.localidad.trim(),
      provincia: form.provincia.trim(),
      codigoPostal: form.codigoPostal.trim(),
      lat: latN,
      lng: lngN,
      telefono: form.telefono.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      horarios: form.horarios.trim() || null,
      orden: Number(form.orden) || 0,
      activa: form.activa,
    };
    try {
      if (editing) {
        await api.put(`/admin/opticas/${editing.id}`, payload);
        toast.ok('Óptica actualizada');
      } else {
        await api.post('/admin/opticas', payload);
        toast.ok('Óptica creada');
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setGeneralError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/admin/opticas/${toDelete.id}`);
      toast.ok('Óptica eliminada');
      setToDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ópticas socias"
        description="Red de ópticas que arman, entregan y ajustan los pedidos. Los pedidos pagados se asignan a la óptica activa más cercana cuyo radio cubre al cliente y que tenga cupo ese día."
        actions={
          <>
            <Link
              href="/admin/liquidaciones"
              className="inline-flex h-10 items-center rounded-lg border border-negro/20 bg-blanco px-4 text-sm font-medium hover:bg-gris-claro"
            >
              Liquidaciones
            </Link>
            <Btn onClick={() => abrir(null)}>Nueva óptica</Btn>
          </>
        }
      />

      <Card className="mb-6" title={`Mapa de cobertura (${mapa.length} con coordenadas)`}>
        {mapa.length === 0 ? (
          <p className="text-sm text-gris-medio">Cargá latitud y longitud en cada óptica para verla en el mapa y que reciba pedidos automáticamente.</p>
        ) : (
          <OpticasMapaAdmin opticas={mapa} seleccionada={enMapa} />
        )}
      </Card>

      <Toolbar>
        <SearchInput placeholder="Buscar por nombre, localidad o CP…" />
        <FilterSelect
          param="provincia"
          label="Provincia"
          allLabel="Todas"
          options={provincias.map((p) => ({ value: p, label: p }))}
        />
        <FilterSelect
          param="activa"
          label="Estado"
          allLabel="Todas"
          options={[
            { value: 'true', label: 'Activas' },
            { value: 'false', label: 'Inactivas' },
          ]}
        />
      </Toolbar>

      {data.items.length === 0 ? (
        <EmptyState
          title="No hay ópticas"
          description="Cargá la primera óptica socia para que aparezca en el buscador por código postal."
          action={<Btn onClick={() => abrir(null)}>Nueva óptica</Btn>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Óptica</Th>
                <Th>Dirección</Th>
                <Th>Contacto</Th>
                <Th align="right">Radio</Th>
                <Th align="right">Comisión</Th>
                <Th align="right">Hoy</Th>
                <Th>Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <p className="font-medium">{o.nombre}</p>
                    <p className="text-xs text-gris-medio">
                      {o.razonSocial ?? o.slug}
                      {o.cuit && ` · CUIT ${o.cuit}`}
                    </p>
                    {o.opticoResponsable && (
                      <p className="text-xs text-gris-medio">
                        {o.opticoResponsable}
                        {o.matricula && ` · ${o.matricula}`}
                      </p>
                    )}
                  </Td>
                  <Td>
                    {o.direccion}
                    <span className="block text-xs text-gris-medio">
                      {o.localidad}, {o.provincia} · CP {o.codigoPostal}
                    </span>
                    {o.lat !== null && o.lng !== null ? (
                      <button type="button" onClick={() => setEnMapa(o.id)} className="text-xs underline underline-offset-2">
                        Ver en el mapa
                      </button>
                    ) : (
                      <Badge tone="warn">Sin coordenadas</Badge>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {o.whatsapp && <span className="block">WA {o.whatsapp}</span>}
                    {o.telefono && <span className="block">Tel {o.telefono}</span>}
                    {o.email && <span className="block text-gris-medio">{o.email}</span>}
                    {!o.whatsapp && !o.telefono && !o.email && '—'}
                  </Td>
                  <Td align="right" className="tabular-nums">{o.radioKm} km</Td>
                  <Td align="right" className="tabular-nums">{o.comisionPct}%</Td>
                  <Td align="right" className="tabular-nums">
                    {o.asignadosHoy ?? 0}/{o.capacidadDiaria}
                  </Td>
                  <Td>
                    <Badge tone={o.activa ? 'ok' : 'neutral'}>
                      {o.activa ? 'Activa' : 'Pausada'}
                    </Badge>
                    {(o.usuarios ?? 0) > 0 && (
                      <span className="block text-xs text-gris-medio">
                        {o.usuarios} {o.usuarios === 1 ? 'usuario' : 'usuarios'}
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => abrir(o)}>
                        Editar
                      </Btn>
                      <Link
                        href={`/admin/pedidos?opticaId=${o.id}`}
                        className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium hover:bg-gris-claro"
                      >
                        Pedidos
                      </Link>
                      <Btn variant="ghost" size="sm" onClick={() => setToDelete(o)}>
                        Eliminar
                      </Btn>
                    </div>
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
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar óptica' : 'Nueva óptica'}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Btn>
            <Btn type="submit" form="optica-form" loading={saving}>
              {editing ? 'Guardar cambios' : 'Crear óptica'}
            </Btn>
          </>
        }
      >
        <form id="optica-form" onSubmit={guardar} className="space-y-4">
          {generalError && (
            <p className="rounded-lg bg-carey/10 px-3 py-2 text-sm text-carey">{generalError}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" required error={errors.nombre}>
              <Input value={form.nombre} onChange={f('nombre')} required autoFocus />
            </Field>
            <Field label="Razón social" error={errors.razonSocial}>
              <Input value={form.razonSocial} onChange={f('razonSocial')} placeholder="Óptica Ejemplo S.R.L." />
            </Field>
            <Field label="CUIT" error={errors.cuit} hint="11 dígitos, con o sin guiones">
              <Input value={form.cuit} onChange={f('cuit')} inputMode="numeric" placeholder="30-12345678-9" />
            </Field>
            <Field label="Condición frente al IVA" error={errors.condicionIva}>
              <Select value={form.condicionIva} onChange={(e) => setForm({ ...form, condicionIva: e.target.value })}>
                <option value="">Sin informar</option>
                <option value="RESPONSABLE_INSCRIPTO">Responsable inscripto</option>
                <option value="MONOTRIBUTO">Monotributo</option>
                <option value="EXENTO">Exento</option>
              </Select>
            </Field>
            {editing?.habilitacionUrl && (
              <p className="self-end pb-2 text-sm">
                <a href={editing.habilitacionUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Ver habilitación
                </a>
              </p>
            )}
            <Field label="Óptico técnico responsable" error={errors.opticoResponsable}>
              <Input value={form.opticoResponsable} onChange={f('opticoResponsable')} />
            </Field>
            <Field label="Matrícula" error={errors.matricula}>
              <Input value={form.matricula} onChange={f('matricula')} placeholder="MN 1234" />
            </Field>
            <Field label="Radio de cobertura (km)" required error={errors.radioKm} hint="Hasta qué distancia del cliente toma pedidos.">
              <Input value={form.radioKm} onChange={f('radioKm')} inputMode="decimal" required />
            </Field>
            <Field label="Comisión (%)" required error={errors.comisionPct} hint="Sobre el total de cada pedido entregado.">
              <Input value={form.comisionPct} onChange={f('comisionPct')} inputMode="decimal" required />
            </Field>
            <Field label="Capacidad diaria" required error={errors.capacidadDiaria} hint="Pedidos nuevos por día; superado, se asigna a la siguiente.">
              <Input type="number" min={1} value={form.capacidadDiaria} onChange={f('capacidadDiaria')} required />
            </Field>
            <Field
              label="Descuento mayorista (%)"
              error={errors.descuentoPct}
              hint="Sobre el precio mayorista de lista. Lo ve sólo esta óptica en su portal."
            >
              <Input value={form.descuentoPct} onChange={f('descuentoPct')} inputMode="decimal" data-testid="optica-descuento" />
            </Field>
            <Field label="Compra mínima" error={errors.minimoTipo} hint="Vacío = la general de Configuración.">
              <div className="flex gap-2">
                <Select value={form.minimoTipo} onChange={(e) => setForm({ ...form, minimoTipo: e.target.value })} className="flex-1">
                  <option value="">Usar la general</option>
                  <option value="NINGUNO">Sin mínimo</option>
                  <option value="UNIDADES">Unidades</option>
                  <option value="MONTO">Monto sin IVA ($)</option>
                </Select>
                {(form.minimoTipo === 'UNIDADES' || form.minimoTipo === 'MONTO') && (
                  <Input
                    value={form.minimoValor}
                    onChange={f('minimoValor')}
                    inputMode="decimal"
                    className="w-32"
                    aria-label="Valor de la compra mínima"
                  />
                )}
              </div>
            </Field>
            <Field label="Dirección" required error={errors.direccion}>
              <Input
                value={form.direccion}
                onChange={f('direccion')}
                required
                placeholder="Av. Santa Fe 1234"
              />
            </Field>
            <Field label="Localidad" required error={errors.localidad}>
              <Input value={form.localidad} onChange={f('localidad')} required />
            </Field>
            <Field label="Provincia" required error={errors.provincia}>
              <Input value={form.provincia} onChange={f('provincia')} required list="provincias" />
              <datalist id="provincias">
                {provincias.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Código postal" required error={errors.codigoPostal} hint="1425 o C1425ABC">
              <Input value={form.codigoPostal} onChange={f('codigoPostal')} required maxLength={8} />
            </Field>
            <Field label="Latitud" error={errors.lat} hint="Decimal, ej. -34.5875">
              <Input value={form.lat} onChange={f('lat')} inputMode="decimal" />
            </Field>
            <Field label="Longitud" error={errors.lng} hint="Decimal, ej. -58.4000">
              <Input value={form.lng} onChange={f('lng')} inputMode="decimal" />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp} hint="Con código de país: 5491112345678">
              <Input value={form.whatsapp} onChange={f('whatsapp')} inputMode="tel" />
            </Field>
            <Field label="Teléfono" error={errors.telefono}>
              <Input value={form.telefono} onChange={f('telefono')} inputMode="tel" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={f('email')} />
            </Field>
            <Field label="Orden" error={errors.orden} hint="Menor aparece primero a igual distancia.">
              <Input type="number" min={0} value={form.orden} onChange={f('orden')} />
            </Field>
            <Field label="Horarios" error={errors.horarios} className="sm:col-span-2">
              <Textarea
                value={form.horarios}
                onChange={f('horarios')}
                placeholder="Lun a vie 10 a 19 h · Sáb 10 a 13 h"
                className="min-h-[64px]"
              />
            </Field>
          </div>
          <Checkbox
            label="Óptica activa (visible en la tienda y recibe pedidos). Pausada: no recibe asignaciones nuevas."
            checked={form.activa}
            onChange={(e) => setForm({ ...form, activa: e.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={eliminar}
        title="Eliminar óptica"
        description={toDelete ? `Se eliminará "${toDelete.nombre}" de la red.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
      />
    </>
  );
}
