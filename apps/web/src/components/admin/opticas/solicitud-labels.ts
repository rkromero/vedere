import type { BadgeTone } from '@/lib/format';
import type { CondicionIva, EstadoSolicitudOptica } from '@/lib/types';

export const ESTADO_SOLICITUD: Record<EstadoSolicitudOptica, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export const TONO_SOLICITUD: Record<EstadoSolicitudOptica, BadgeTone> = {
  PENDIENTE: 'warn',
  APROBADA: 'ok',
  RECHAZADA: 'danger',
};

export const CONDICION_IVA: Record<CondicionIva, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
};
