// Identificación por foto: lectura estructurada, búsqueda web (con pause_turn) y combinación de datos.
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import {
  buscarFichaWeb,
  combinar,
  identificarPorFotos,
  leerFotos,
} from '../src/lib/identificar-foto.js';
import type { LecturaFoto } from '../src/lib/identificar-foto.js';
import { testEnv } from './helpers.js';

const LECTURA: LecturaFoto = {
  esAnteojo: true,
  textoLeido: 'RB3025 | 001/58 | 58□14 135 | 3P | Ray-Ban ITALY',
  marca: 'Ray-Ban',
  modelo: 'RB3025',
  nombreComercial: null,
  codigoColor: '001/58',
  colorArmazon: 'Dorado',
  colorLente: null,
  calibreMm: 58,
  puenteMm: 14,
  varillaMm: 135,
  linea: 'SOL',
  forma: null,
  material: 'METAL',
  genero: null,
  polarizado: true,
  fotosDelProducto: [],
  confianza: 'alta',
  notas: '',
};

const FICHA_TOOL = {
  type: 'tool_use',
  id: 'tu_1',
  name: 'guardar_ficha',
  input: {
    encontrado: true,
    nombre: 'Ray-Ban Aviator Classic RB3025',
    descripcion: 'El clásico aviador de Ray-Ban, con armazón de metal y lentes polarizadas.',
    linea: 'SOL',
    forma: 'AVIADOR',
    material: 'METAL',
    genero: 'UNISEX',
    calibreMm: 62,
    puenteMm: 14,
    varillaMm: 140,
    colorArmazon: 'Dorado',
    colorLente: 'Verde',
    polarizado: true,
    imagenes: ['https://cdn.example.com/rb3025-001-58.jpg', 'javascript:alert(1)'],
  },
};

function clienteFalso(opts: { parse?: unknown; create?: unknown[] }) {
  const create = vi.fn();
  for (const r of opts.create ?? []) create.mockResolvedValueOnce(r);
  const parse = vi.fn().mockResolvedValue(opts.parse);
  return {
    client: { beta: { messages: { parse, create } } } as unknown as Anthropic,
    parse,
    create,
  };
}

describe('lectura de fotos', () => {
  it('manda las fotos como imágenes base64 con fallbacks y devuelve la salida estructurada', async () => {
    const { client, parse } = clienteFalso({
      parse: { stop_reason: 'end_turn', parsed_output: LECTURA },
    });
    const r = await leerFotos(client, ['AAA', 'BBB']);
    expect(r.modelo).toBe('RB3025');
    const params = parse.mock.calls[0]![0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toContain('server-side-fallback-2026-07-01');
    const imagenes = params.messages[0].content.filter((b: { type: string }) => b.type === 'image');
    expect(imagenes).toHaveLength(2);
    expect(imagenes[0].source).toMatchObject({
      type: 'base64',
      media_type: 'image/jpeg',
      data: 'AAA',
    });
  });

  it('un rechazo de la IA se informa como error claro', async () => {
    const { client } = clienteFalso({ parse: { stop_reason: 'refusal', parsed_output: null } });
    await expect(leerFotos(client, ['AAA'])).rejects.toThrow(/no pudo analizar/);
  });
});

describe('ficha web', () => {
  it('sigue después de pause_turn y lee guardar_ficha', async () => {
    const { client, create } = clienteFalso({
      create: [
        {
          stop_reason: 'pause_turn',
          content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: {} }],
        },
        { stop_reason: 'tool_use', content: [FICHA_TOOL] },
      ],
    });
    const f = await buscarFichaWeb(client, LECTURA);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]![0].messages).toHaveLength(2);
    expect(f?.forma).toBe('AVIADOR');
  });

  it('sin marca o modelo no busca; encontrado:false devuelve null', async () => {
    const { client, create } = clienteFalso({
      create: [
        {
          stop_reason: 'tool_use',
          content: [{ ...FICHA_TOOL, input: { ...FICHA_TOOL.input, encontrado: false } }],
        },
      ],
    });
    expect(await buscarFichaWeb(client, { ...LECTURA, modelo: null })).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(await buscarFichaWeb(client, LECTURA)).toBeNull();
  });
});

describe('combinación', () => {
  it('lo leído en la patilla manda y la web completa lo que falta', async () => {
    const { client } = clienteFalso({
      create: [{ stop_reason: 'tool_use', content: [FICHA_TOOL] }],
    });
    const ficha = await buscarFichaWeb(client, LECTURA);
    const s = combinar(LECTURA, ficha);
    expect(s.calibreMm).toBe(58); // de la patilla, no el 62 de la web
    expect(s.forma).toBe('AVIADOR'); // de la web
    expect(s.colorLente).toBe('Verde');
    expect(s.colorArmazonHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(s.descripcion).toContain('aviador');
    expect(s.imagenes).toEqual(['https://cdn.example.com/rb3025-001-58.jpg']);
    expect(s.fuente).toBe('Foto + web (IA)');
  });

  it('sin web arma el nombre con marca y modelo', () => {
    const s = combinar(LECTURA, null);
    expect(s.nombre).toBe('Ray-Ban RB3025');
    expect(s.fuente).toBe('Foto (IA)');
    expect(s.imagenes).toEqual([]);
  });
});

it('sin ANTHROPIC_API_KEY la función responde que no está configurada', async () => {
  await expect(
    identificarPorFotos(testEnv({ ANTHROPIC_API_KEY: '' }), [Buffer.from('x')]),
  ).rejects.toThrow(/no está configurada/);
});
