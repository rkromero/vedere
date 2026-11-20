// Código de barras: normalización, interpretación de datos externos y protección SSRF de la importación de fotos.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buscarCodigoExterno,
  detectarMedidas,
  formasEquivalentes,
  gtinValido,
  interpretar,
  limpiarCacheCodigos,
  normalizarCodigo,
} from '../src/lib/codigo-barras.js';
import { descargarImagen, ipPrivada } from '../src/lib/imagen-remota.js';
import { testEnv } from './helpers.js';

// Respuesta real de UPCitemdb (recortada) para un Ray-Ban RB3547N.
const UPCITEMDB_RAYBAN = {
  code: 'OK',
  total: 1,
  items: [
    {
      ean: '8053672611595',
      title: 'Ray-Ban Sunglasses, RB3547N 48',
      description:
        "Ray-Ban Oval Flat Lens Sunglasses, RB3547N 48 Women's - Handbags & Accessories Accessories - Sunglasses by Sunglass Hut",
      brand: 'Ray-ban',
      model: '8053672611595',
      color: 'Gold',
      size: '',
      category: 'Apparel & Accessories > Handbag & Wallet Accessories',
      images: [
        'https://slimages.macysassets.com/is/image/MCY/products/3/optimized/3644763_fpx.tif?wid=300&fmt=jpeg',
        'https://img-cdn1.cdnsbg.com/1200/1/14/318128_1599492736522.jpg',
      ],
      offers: [
        { title: 'New Unisex Sunglasses Ray-Ban RB3547N Oval Flat Lenses 001/9O 48' },
        { title: "Ray-Ban RB3547N Oval Flat Lenses 001/9O Men's Sunglasses Gold Size 48" },
      ],
    },
  ],
};

describe('normalización de códigos', () => {
  it('valida el dígito verificador GS1', () => {
    expect(gtinValido('8053672611595')).toBe(true);
    expect(gtinValido('8053672611596')).toBe(false);
    expect(gtinValido('036000291452')).toBe(true); // UPC-A
  });

  it('limpia espacios/guiones y pasa UPC-A a EAN-13', () => {
    expect(normalizarCodigo(' 8053672611595 ')).toBe('8053672611595');
    expect(normalizarCodigo('0360-0029-1452')).toBe('0036000291452');
    expect(normalizarCodigo('ved-avc-neg')).toBe('VEDAVCNEG');
    expect(normalizarCodigo('ab')).toBeNull();
    expect(normalizarCodigo('<script>')).toBeNull();
  });

  it('busca el mismo código como EAN-13 y como UPC-A', () => {
    expect(formasEquivalentes('0036000291452')).toEqual(['0036000291452', '036000291452']);
  });
});

describe('interpretación de datos externos', () => {
  it('arma la sugerencia de un Ray-Ban desde UPCitemdb', () => {
    const item = UPCITEMDB_RAYBAN.items[0]!;
    const s = interpretar('8053672611595', {
      fuente: 'UPCitemdb',
      titulos: [item.title, ...item.offers.map((o) => o.title)],
      descripcion: item.description,
      marca: item.brand,
      modelo: item.model,
      color: item.color,
      talle: item.size,
      categoria: item.category,
      imagenes: item.images,
    });
    expect(s.marca).toBe('Ray-Ban');
    expect(s.modelo).toBe('RB3547N');
    expect(s.nombre).toContain('Ray-Ban');
    expect(s.nombre).toContain('RB3547N');
    expect(s.nombre).not.toMatch(/sunglasses/i);
    expect(s.linea).toBe('SOL');
    expect(s.forma).toBe('REDONDO');
    expect(s.calibreMm).toBe(48);
    expect(s.colorArmazon).toBe('Dorado');
    expect(s.colorArmazonHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(s.genero).toBe('UNISEX');
    expect(s.imagenes).toHaveLength(2);
  });

  it('lee medidas en los formatos habituales', () => {
    expect(detectarMedidas(['Wayfarer 50-22-150'])).toEqual({
      calibreMm: 50,
      puenteMm: 22,
      varillaMm: 150,
    });
    expect(detectarMedidas(['Armazón 52□18 140'])).toEqual({
      calibreMm: 52,
      puenteMm: 18,
      varillaMm: 140,
    });
    expect(detectarMedidas(['Aviator 58mm'])).toEqual({
      calibreMm: 58,
      puenteMm: null,
      varillaMm: null,
    });
    expect(detectarMedidas(['Sin medidas'])).toEqual({
      calibreMm: null,
      puenteMm: null,
      varillaMm: null,
    });
  });
});

describe('búsqueda externa', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    limpiarCacheCodigos();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('usa UPCitemdb gratis sin claves y cachea el resultado', async () => {
    fetchMock.mockResolvedValue(json(UPCITEMDB_RAYBAN));
    const env = testEnv();
    const r1 = await buscarCodigoExterno(env, '8053672611595');
    expect(r1.sugerencia?.fuente).toBe('UPCitemdb');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/prod/trial/lookup?upc=8053672611595');
    await buscarCodigoExterno(env, '8053672611595');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si UPCitemdb no tiene cupo, avisa y prueba Open Product Facts', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ code: 'TOO_FAST' }, 429))
      .mockResolvedValueOnce(json({ status: 0 }));
    const r = await buscarCodigoExterno(testEnv(), '8053672611595');
    expect(r.sugerencia).toBeNull();
    expect(r.avisos[0]).toMatch(/límite/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no consulta afuera códigos internos ni con la búsqueda apagada', async () => {
    expect((await buscarCodigoExterno(testEnv(), 'VEDAVCNEG')).sugerencia).toBeNull();
    expect(
      (await buscarCodigoExterno(testEnv({ CODIGO_BARRAS_LOOKUP: 'false' }), '8053672611595'))
        .sugerencia,
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('importación de fotos (SSRF)', () => {
  it('detecta IPs internas', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.10',
      '172.20.0.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ])
      expect(ipPrivada(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111'])
      expect(ipPrivada(ip), ip).toBe(false);
  });

  it('rechaza URLs a la red interna y protocolos no http', async () => {
    const env = testEnv();
    await expect(descargarImagen(env, 'http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      /red interna/,
    );
    await expect(descargarImagen(env, 'http://127.0.0.1:4000/admin')).rejects.toThrow(
      /red interna/,
    );
    await expect(descargarImagen(env, 'file:///etc/passwd')).rejects.toThrow(/http/);
  });
});
