// Tests unitarios del motor de promociones (sin base de datos).
import { describe, expect, it } from 'vitest';
import { calcularCarrito, cuotasParaCarrito } from '../src/lib/promos.js';
import type { CuponPromo, ItemPromo, ReglaPromo } from '../src/lib/promos.js';

const item = (over: Partial<ItemPromo> & { varianteId: string; precio: number }): ItemPromo => ({
  productoId: `p-${over.varianteId}`,
  nombre: over.varianteId,
  precioLista: null,
  cantidad: 1,
  linea: 'SOL',
  coleccionId: null,
  categoriaIds: [],
  ...over,
});

const regla = (over: Partial<ReglaPromo> & { tipo: ReglaPromo['tipo'] }): ReglaPromo => ({
  id: `r-${over.tipo}`,
  nombre: over.tipo,
  linea: null,
  coleccionId: null,
  montoMinimo: null,
  acumulable: false,
  prioridad: 0,
  ...over,
});

const cupon = (over: Partial<CuponPromo> = {}): CuponPromo => ({
  id: 'c1',
  codigo: 'TEST10',
  descripcion: null,
  tipo: 'PORCENTAJE',
  valor: 10,
  minimoCompra: null,
  acumulable: false,
  categoriaIds: [],
  coleccionIds: [],
  ...over,
});

const retiro = { modalidad: 'RETIRO_OPTICA' as const, costo: 0 };
const envio = { modalidad: 'ENVIO_DOMICILIO' as const, costo: 9900 };

describe('motor de promociones', () => {
  it('carrito sin reglas: subtotal, sin descuentos, envío gratis por retiro', () => {
    const res = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 89900, cantidad: 2, precioLista: 109900 })],
      reglas: [],
      envio: retiro,
    });
    expect(res.subtotal).toBe(179800);
    expect(res.descuentoTotal).toBe(0);
    expect(res.ahorroLista).toBe(40000);
    expect(res.ahorroTotal).toBe(40000);
    expect(res.envio).toBe(0);
    expect(res.envioGratis).toBe(true);
    expect(res.total).toBe(179800);
  });

  it('2x1 en una línea: la segunda unidad (la más barata del par) sale gratis', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'sol-caro', precio: 90000, linea: 'SOL' }),
        item({ varianteId: 'sol-barato', precio: 60000, linea: 'SOL' }),
        item({ varianteId: 'recetado', precio: 120000, linea: 'RECETADO' }),
      ],
      reglas: [regla({ tipo: 'DOS_POR_UNO', linea: 'SOL', nombre: '2x1 en Sol' })],
      envio: retiro,
    });
    expect(res.descuentos).toHaveLength(1);
    expect(res.descuentos[0]!.descripcion).toBe('2x1 en Sol');
    expect(res.descuentos[0]!.monto).toBe(60000);
    expect(res.descuentos[0]!.porItem).toEqual({ 'sol-barato': 60000 });
    expect(res.total).toBe(90000 + 120000);
    expect(res.items.find((i) => i.varianteId === 'sol-barato')!.total).toBe(0);
    expect(res.items.find((i) => i.varianteId === 'recetado')!.descuento).toBe(0);
  });

  it('2x1 con cantidad 3 del mismo ítem: se rebaja una sola unidad (un par completo)', () => {
    const res = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 50000, cantidad: 3 })],
      reglas: [regla({ tipo: 'DOS_POR_UNO' })],
      envio: retiro,
    });
    expect(res.descuentoTotal).toBe(50000);
    expect(res.total).toBe(100000);
  });

  it('2x1 por colección sólo toma los ítems de esa colección', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 80000, coleccionId: 'col-1' }),
        item({ varianteId: 'b', precio: 70000, coleccionId: 'col-2' }),
      ],
      reglas: [regla({ tipo: 'DOS_POR_UNO', coleccionId: 'col-1' })],
      envio: retiro,
    });
    expect(res.descuentoTotal).toBe(0);
  });

  it('segundo par al 50 %: la mitad de la unidad más barata del par', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 100000, linea: 'RECETADO' }),
        item({ varianteId: 'b', precio: 70001, linea: 'RECETADO' }),
      ],
      reglas: [regla({ tipo: 'SEGUNDO_50', linea: 'RECETADO' })],
      envio: retiro,
    });
    expect(res.descuentoTotal).toBe(35001);
    expect(res.total).toBe(135000);
  });

  it('cupón de porcentaje sobre todo el carrito', () => {
    const res = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 100000 })],
      reglas: [],
      cupon: cupon({ valor: 10 }),
      envio: retiro,
    });
    expect(res.descuentos[0]).toMatchObject({ tipo: 'CUPON', codigo: 'TEST10', monto: 10000 });
    expect(res.total).toBe(90000);
    expect(res.cuponError).toBeNull();
  });

  it('cupón de monto fijo no supera la base y respeta el mínimo de compra', () => {
    const ok = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 70000 })],
      reglas: [],
      cupon: cupon({ tipo: 'MONTO', valor: 5000, minimoCompra: 60000 }),
      envio: retiro,
    });
    expect(ok.descuentoTotal).toBe(5000);

    const bajo = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 50000 })],
      reglas: [],
      cupon: cupon({ tipo: 'MONTO', valor: 5000, minimoCompra: 60000 }),
      envio: retiro,
    });
    expect(bajo.descuentoTotal).toBe(0);
    expect(bajo.cuponError).toMatch(/60\.000/);

    const tope = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 3000 })],
      reglas: [],
      cupon: cupon({ tipo: 'MONTO', valor: 5000 }),
      envio: retiro,
    });
    expect(tope.descuentoTotal).toBe(3000);
    expect(tope.total).toBe(0);
  });

  it('cupón con alcance por categoría o colección sólo descuenta esos ítems', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 100000, categoriaIds: ['cat-sol'] }),
        item({ varianteId: 'b', precio: 50000, categoriaIds: ['cat-acc'] }),
        item({ varianteId: 'c', precio: 20000, coleccionId: 'col-x' }),
      ],
      reglas: [],
      cupon: cupon({ valor: 10, categoriaIds: ['cat-sol'], coleccionIds: ['col-x'] }),
      envio: retiro,
    });
    expect(res.descuentoTotal).toBe(12000);
    expect(res.descuentos[0]!.porItem).toEqual({ a: 10000, c: 2000 });

    const fuera = calcularCarrito({
      items: [item({ varianteId: 'b', precio: 50000, categoriaIds: ['cat-acc'] })],
      reglas: [],
      cupon: cupon({ valor: 10, categoriaIds: ['cat-sol'] }),
      envio: retiro,
    });
    expect(fuera.descuentoTotal).toBe(0);
    expect(fuera.cuponError).toMatch(/no aplica/);
  });

  it('promo y cupón no acumulables: gana el mayor y el otro queda descartado', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 90000 }),
        item({ varianteId: 'b', precio: 90000 }),
      ],
      reglas: [regla({ tipo: 'DOS_POR_UNO', nombre: '2x1' })],
      cupon: cupon({ valor: 10 }),
      envio: retiro,
    });
    expect(res.descuentos).toHaveLength(1);
    expect(res.descuentos[0]!.tipo).toBe('PROMO');
    expect(res.descuentoTotal).toBe(90000);
    expect(res.promosDescartadas).toEqual([]);
    expect(res.cuponError).toMatch(/no se combina con "2x1"/);
  });

  it('cupón acumulable se suma al 2x1 y se calcula sobre el neto', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 90000 }),
        item({ varianteId: 'b', precio: 90000 }),
      ],
      reglas: [regla({ tipo: 'DOS_POR_UNO', nombre: '2x1' })],
      cupon: cupon({ valor: 10, acumulable: true }),
      envio: retiro,
    });
    expect(res.descuentos.map((d) => d.tipo)).toEqual(['PROMO', 'CUPON']);
    expect(res.descuentos[1]!.monto).toBe(9000); // 10 % de 90.000 netos, no de 180.000
    expect(res.total).toBe(81000);
  });

  it('dos promos no acumulables: aplica la de mayor descuento y descarta la otra', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 100000 }),
        item({ varianteId: 'b', precio: 100000 }),
      ],
      reglas: [
        regla({ id: 'r1', tipo: 'SEGUNDO_50', nombre: 'Segundo 50' }),
        regla({ id: 'r2', tipo: 'DOS_POR_UNO', nombre: '2x1' }),
      ],
      envio: retiro,
    });
    expect(res.descuentos).toHaveLength(1);
    expect(res.descuentos[0]!.descripcion).toBe('2x1');
    expect(res.promosDescartadas).toEqual(['Segundo 50']);
  });

  it('envío gratis desde un monto (neto de descuentos) y costo de envío si no llega', () => {
    const reglas = [regla({ tipo: 'ENVIO_GRATIS', montoMinimo: 80000, nombre: 'Envío gratis desde 80k' })];
    const llega = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 85000 })],
      reglas,
      envio,
    });
    expect(llega.envio).toBe(0);
    expect(llega.envioGratis).toBe(true);
    expect(llega.envioGratisPor).toBe('Envío gratis desde 80k');

    const noLlega = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 85000 })],
      reglas,
      cupon: cupon({ valor: 10 }), // neto 76.500 < 80.000
      envio,
    });
    expect(noLlega.envio).toBe(9900);
    expect(noLlega.envioGratis).toBe(false);
    expect(noLlega.total).toBe(76500 + 9900);
  });

  it('descuento por transferencia se aplica al final sobre el neto', () => {
    const res = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 100000 })],
      reglas: [],
      cupon: cupon({ valor: 10, acumulable: true }),
      envio: retiro,
      pago: { metodo: 'TRANSFERENCIA', descuentoTransferencia: 10 },
    });
    expect(res.descuentos.map((d) => d.tipo)).toEqual(['CUPON', 'TRANSFERENCIA']);
    expect(res.descuentos[1]!.monto).toBe(9000);
    expect(res.total).toBe(81000);

    const mp = calcularCarrito({
      items: [item({ varianteId: 'a', precio: 100000 })],
      reglas: [],
      envio: retiro,
      pago: { metodo: 'MERCADO_PAGO', descuentoTransferencia: 10 },
    });
    expect(mp.descuentoTotal).toBe(0);
  });

  it('los descuentos por ítem suman el total y nunca dejan un ítem negativo', () => {
    const res = calcularCarrito({
      items: [
        item({ varianteId: 'a', precio: 90000, cantidad: 2 }),
        item({ varianteId: 'b', precio: 10000 }),
      ],
      reglas: [regla({ tipo: 'DOS_POR_UNO', acumulable: true })],
      cupon: cupon({ tipo: 'MONTO', valor: 500000, acumulable: true }),
      envio: retiro,
    });
    const suma = res.items.reduce((a, i) => a + i.descuento, 0);
    expect(suma).toBe(res.descuentoTotal);
    expect(res.items.every((i) => i.total >= 0)).toBe(true);
    expect(res.total).toBe(0);
  });

  it('cuotas por línea: la menor entre las líneas del carrito', () => {
    const config = { cuotasGeneral: 6, cuotasPorLinea: { MULTIFOCAL: 12 } };
    expect(cuotasParaCarrito(['MULTIFOCAL'], config)).toBe(12);
    expect(cuotasParaCarrito(['MULTIFOCAL', 'SOL'], config)).toBe(6);
    expect(cuotasParaCarrito([], config)).toBe(6);
  });
});
