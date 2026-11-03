// Tests unitarios (sin base) de la asignación: elección de la óptica más cercana con radio y cupo,
// plazo en horas hábiles y transiciones de estado.
import { describe, expect, it } from 'vitest';
import { TRANSICIONES, elegirOptica, evaluarOpticas, puedeTransicionar, rangoDiaLocal, sumarHorasHabiles } from '../src/lib/asignacion.js';

// Tres ópticas de prueba en CABA y una dirección en Caballito (Av. Rivadavia 5000).
const CABALLITO = { lat: -34.6177, lng: -58.4367 };
const opticas = [
  { id: 'palermo', nombre: 'Óptica Palermo', lat: -34.5846, lng: -58.4216, radioKm: 8, capacidadDiaria: 20, activa: true, asignadosHoy: 0 },
  { id: 'flores', nombre: 'Óptica Flores', lat: -34.6281, lng: -58.4636, radioKm: 6, capacidadDiaria: 20, activa: true, asignadosHoy: 0 },
  { id: 'belgrano', nombre: 'Óptica Belgrano', lat: -34.5615, lng: -58.4567, radioKm: 5, capacidadDiaria: 20, activa: true, asignadosHoy: 0 },
];

describe('elección de óptica', () => {
  it('elige la más cercana que tenga al cliente dentro de su radio', () => {
    const ev = evaluarOpticas(CABALLITO, opticas);
    expect(ev.map((e) => e.optica.id)).toEqual(['flores', 'palermo', 'belgrano']);
    expect(ev[0]!.distanciaKm).toBeLessThan(ev[1]!.distanciaKm!);
    expect(ev[2]!.dentroRadio).toBe(false); // Belgrano queda a ~6,5 km con radio 5
    expect(elegirOptica(CABALLITO, opticas)?.optica.id).toBe('flores');
  });

  it('salta las excluidas (rechazo o plazo vencido) y respeta la capacidad diaria', () => {
    expect(elegirOptica(CABALLITO, opticas, ['flores'])?.optica.id).toBe('palermo');
    const llena = opticas.map((o) => (o.id === 'flores' ? { ...o, asignadosHoy: 20 } : o));
    expect(elegirOptica(CABALLITO, llena)?.optica.id).toBe('palermo');
    expect(elegirOptica(CABALLITO, opticas, ['flores', 'palermo'])).toBeNull();
  });

  it('ignora ópticas pausadas o sin coordenadas y devuelve null si nadie cubre', () => {
    const pausada = opticas.map((o) => (o.id === 'flores' ? { ...o, activa: false } : o));
    expect(elegirOptica(CABALLITO, pausada)?.optica.id).toBe('palermo');
    const sinCoords = opticas.map((o) => ({ ...o, lat: null, lng: null }));
    expect(elegirOptica(CABALLITO, sinCoords)).toBeNull();
    expect(elegirOptica({ lat: -31.42, lng: -64.18 }, opticas)).toBeNull(); // Córdoba
  });
});

describe('horas hábiles', () => {
  const cfg = { horaHabilDesde: 9, horaHabilHasta: 18, sabadoHabil: false };
  // 2026-11-03 es martes. 10:00 ARG = 13:00Z.
  it('dentro del horario suma directo', () => {
    const r = sumarHorasHabiles(new Date('2026-11-03T13:00:00Z'), 4, cfg);
    expect(r.toISOString()).toBe('2026-11-03T17:00:00.000Z'); // 14:00 ARG
  });
  it('lo que no entra en el día pasa al siguiente día hábil', () => {
    const r = sumarHorasHabiles(new Date('2026-11-03T19:00:00Z'), 4, cfg); // 16:00 ARG → 2 h hoy + 2 h mañana
    expect(r.toISOString()).toBe('2026-11-04T14:00:00.000Z'); // miércoles 11:00 ARG
  });
  it('viernes a la tarde salta el fin de semana (sábado no hábil)', () => {
    const r = sumarHorasHabiles(new Date('2026-11-06T20:00:00Z'), 4, cfg); // viernes 17:00 ARG → 1 h + 3 h lunes
    expect(r.toISOString()).toBe('2026-11-09T15:00:00.000Z'); // lunes 12:00 ARG
  });
  it('fuera de horario arranca a contar desde la apertura; sábado hábil cuenta', () => {
    const r = sumarHorasHabiles(new Date('2026-11-07T02:00:00Z'), 2, cfg); // viernes 23:00 ARG
    expect(r.toISOString()).toBe('2026-11-09T14:00:00.000Z'); // lunes 11:00 ARG
    const conSabado = sumarHorasHabiles(new Date('2026-11-07T02:00:00Z'), 2, { ...cfg, sabadoHabil: true });
    expect(conSabado.toISOString()).toBe('2026-11-07T14:00:00.000Z'); // sábado 11:00 ARG
  });
  it('el día local de Argentina va de 03:00Z a 03:00Z', () => {
    const r = rangoDiaLocal(new Date('2026-11-03T02:30:00Z')); // todavía 2 de noviembre en ARG
    expect(r.desde.toISOString()).toBe('2026-11-02T03:00:00.000Z');
    expect(r.hasta.toISOString()).toBe('2026-11-03T03:00:00.000Z');
  });
});

describe('estados del pedido', () => {
  it('cubre los 10 estados y sólo permite la secuencia operativa', () => {
    expect(Object.keys(TRANSICIONES)).toHaveLength(10);
    expect(puedeTransicionar('ASIGNADO', 'ACEPTADO')).toBe(true);
    expect(puedeTransicionar('ACEPTADO', 'EN_ARMADO')).toBe(true);
    expect(puedeTransicionar('LISTO', 'ENVIADO')).toBe(true);
    expect(puedeTransicionar('LISTO', 'ENTREGADO')).toBe(true);
    expect(puedeTransicionar('ENTREGADO', 'DEVUELTO')).toBe(true);
    expect(puedeTransicionar('ENTREGADO', 'EN_ARMADO')).toBe(false);
    expect(puedeTransicionar('CANCELADO', 'PAGADO')).toBe(false);
    expect(puedeTransicionar('PENDIENTE_PAGO', 'ASIGNADO')).toBe(false);
  });
});
