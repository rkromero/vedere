// Motor de promociones (puro, sin base de datos): calcula descuentos de reglas automáticas
// (2x1, segundo al 50 %, envío gratis), cupones y descuento por transferencia sobre un carrito.
//
// Reglas de combinación:
//  - Los descuentos monetarios (promos 2x1 / segundo 50 % y cupón) NO se acumulan entre sí salvo que
//    estén marcados `acumulable`: entre los no acumulables gana el de mayor monto; los acumulables se
//    suman siempre. El cupón que se combina con promos se calcula sobre el precio ya rebajado.
//  - El envío gratis es independiente (se evalúa sobre el subtotal neto de descuentos).
//  - El descuento por transferencia es un beneficio del medio de pago: se aplica al final sobre el neto.
// Todos los importes son pesos enteros (se redondea con Math.round).

export type LineaPromo = 'SOL' | 'RECETADO' | 'MULTIFOCAL' | 'ACCESORIO';
export type TipoRegla = 'DOS_POR_UNO' | 'SEGUNDO_50' | 'ENVIO_GRATIS';
export type MetodoPagoPromo = 'MERCADO_PAGO' | 'MERCADO_PAGO_BILLETERA' | 'TRANSFERENCIA';

export interface ItemPromo {
  varianteId: string;
  productoId: string;
  nombre: string;
  /** Precio unitario vigente (el que ve el cliente). */
  precio: number;
  precioLista: number | null;
  cantidad: number;
  linea: LineaPromo;
  coleccionId: string | null;
  categoriaIds: string[];
}

export interface ReglaPromo {
  id: string;
  nombre: string;
  tipo: TipoRegla;
  linea: LineaPromo | null;
  coleccionId: string | null;
  /** Sólo ENVIO_GRATIS: monto mínimo (neto de descuentos). null = siempre. */
  montoMinimo: number | null;
  acumulable: boolean;
  prioridad: number;
}

export interface CuponPromo {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: 'PORCENTAJE' | 'MONTO';
  valor: number;
  minimoCompra: number | null;
  acumulable: boolean;
  /** Alcance: si hay categorías o colecciones, el descuento aplica sólo a esos ítems. */
  categoriaIds: string[];
  coleccionIds: string[];
}

export interface EntradaCalculo {
  items: ItemPromo[];
  reglas: ReglaPromo[];
  cupon?: CuponPromo | null;
  envio: { modalidad: 'RETIRO_OPTICA' | 'ENVIO_DOMICILIO'; costo: number };
  pago?: { metodo: MetodoPagoPromo; descuentoTransferencia: number } | null;
}

export interface DescuentoAplicado {
  tipo: 'PROMO' | 'CUPON' | 'TRANSFERENCIA';
  id?: string;
  codigo?: string;
  descripcion: string;
  monto: number;
  /** Reparto del descuento por variante (para congelar en los ítems del pedido). */
  porItem: Record<string, number>;
}

export interface ResultadoCalculo {
  subtotal: number;
  /** Diferencia entre precio de lista y precio vigente (ya reflejada en el precio). */
  ahorroLista: number;
  descuentos: DescuentoAplicado[];
  descuentoTotal: number;
  envio: number;
  envioGratis: boolean;
  /** Nombre de la regla (o "retiro") por la que el envío es gratis. */
  envioGratisPor: string | null;
  total: number;
  /** Lo que el cliente ahorra en total (descuentos + precio de lista). */
  ahorroTotal: number;
  items: Array<{ varianteId: string; subtotal: number; descuento: number; total: number }>;
  /** Motivo por el que el cupón no aplicó (mínimo de compra, sin ítems en su alcance). */
  cuponError: string | null;
  /** Promos vigentes que no se aplicaron por no ser acumulables (gana la mayor). */
  promosDescartadas: string[];
}

const r = (n: number) => Math.round(n);

function enAlcance(item: ItemPromo, regla: Pick<ReglaPromo, 'linea' | 'coleccionId'>): boolean {
  if (regla.linea && item.linea !== regla.linea) return false;
  if (regla.coleccionId && item.coleccionId !== regla.coleccionId) return false;
  return true;
}

function cuponAlcanza(item: ItemPromo, cupon: CuponPromo): boolean {
  const sinAlcance = cupon.categoriaIds.length === 0 && cupon.coleccionIds.length === 0;
  if (sinAlcance) return true;
  if (cupon.coleccionIds.length && item.coleccionId && cupon.coleccionIds.includes(item.coleccionId)) {
    return true;
  }
  return cupon.categoriaIds.some((c) => item.categoriaIds.includes(c));
}

/** Descuento "por pares": unidades ordenadas de mayor a menor precio; la 2.ª de cada par se rebaja. */
function descuentoPorPares(
  items: ItemPromo[],
  regla: ReglaPromo,
  factor: number,
): Record<string, number> {
  const unidades: Array<{ varianteId: string; precio: number }> = [];
  for (const it of items) {
    if (!enAlcance(it, regla)) continue;
    for (let i = 0; i < it.cantidad; i++) unidades.push({ varianteId: it.varianteId, precio: it.precio });
  }
  unidades.sort((a, b) => b.precio - a.precio);
  const porItem: Record<string, number> = {};
  for (let i = 1; i < unidades.length; i += 2) {
    const u = unidades[i]!;
    porItem[u.varianteId] = (porItem[u.varianteId] ?? 0) + r(u.precio * factor);
  }
  return porItem;
}

/** Reparte `monto` entre los ítems proporcionalmente a su base (el último absorbe el redondeo). */
function prorratear(monto: number, bases: Array<{ varianteId: string; base: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  const totalBase = bases.reduce((a, b) => a + b.base, 0);
  if (totalBase <= 0 || monto <= 0) return out;
  let acumulado = 0;
  bases.forEach((b, i) => {
    const parte = i === bases.length - 1 ? monto - acumulado : r((monto * b.base) / totalBase);
    out[b.varianteId] = (out[b.varianteId] ?? 0) + parte;
    acumulado += parte;
  });
  return out;
}

function sumar(porItem: Record<string, number>): number {
  return Object.values(porItem).reduce((a, b) => a + b, 0);
}

interface Candidato {
  descuento: DescuentoAplicado;
  acumulable: boolean;
  prioridad: number;
  recalcularCupon?: true;
}

export function calcularCarrito(entrada: EntradaCalculo): ResultadoCalculo {
  const items = entrada.items.filter((i) => i.cantidad > 0);
  const subtotal = r(items.reduce((a, i) => a + i.precio * i.cantidad, 0));
  const ahorroLista = r(
    items.reduce(
      (a, i) => a + (i.precioLista && i.precioLista > i.precio ? (i.precioLista - i.precio) * i.cantidad : 0),
      0,
    ),
  );
  const lineaTotal = new Map(items.map((i) => [i.varianteId, r(i.precio * i.cantidad)]));

  // 1) Candidatos: promos monetarias.
  const candidatos: Candidato[] = [];
  const reglasOrdenadas = [...entrada.reglas].sort((a, b) => a.prioridad - b.prioridad);
  for (const regla of reglasOrdenadas) {
    if (regla.tipo === 'ENVIO_GRATIS') continue;
    const factor = regla.tipo === 'DOS_POR_UNO' ? 1 : 0.5;
    const porItem = descuentoPorPares(items, regla, factor);
    const monto = sumar(porItem);
    if (monto <= 0) continue;
    candidatos.push({
      acumulable: regla.acumulable,
      prioridad: regla.prioridad,
      descuento: { tipo: 'PROMO', id: regla.id, descripcion: regla.nombre, monto, porItem },
    });
  }

  // 2) Candidato: cupón (sobre su alcance; mínimo de compra contra el subtotal completo).
  let cuponError: string | null = null;
  const cupon = entrada.cupon ?? null;
  const calcularCupon = (netoPorItem: Map<string, number>): DescuentoAplicado | null => {
    if (!cupon) return null;
    const bases = items
      .filter((i) => cuponAlcanza(i, cupon))
      .map((i) => ({ varianteId: i.varianteId, base: netoPorItem.get(i.varianteId) ?? 0 }))
      .filter((b) => b.base > 0);
    const base = bases.reduce((a, b) => a + b.base, 0);
    if (base <= 0) return null;
    const monto = cupon.tipo === 'PORCENTAJE' ? r((base * cupon.valor) / 100) : Math.min(r(cupon.valor), base);
    if (monto <= 0) return null;
    return {
      tipo: 'CUPON',
      id: cupon.id,
      codigo: cupon.codigo,
      descripcion: cupon.descripcion ?? `Cupón ${cupon.codigo}`,
      monto,
      porItem: prorratear(monto, bases),
    };
  };
  if (cupon) {
    if (cupon.minimoCompra && subtotal < cupon.minimoCompra) {
      cuponError = `El cupón aplica para compras desde $${Math.round(cupon.minimoCompra).toLocaleString('es-AR')}`;
    } else {
      const d = calcularCupon(lineaTotal);
      if (!d) cuponError = 'El cupón no aplica a los productos del carrito';
      else candidatos.push({ acumulable: cupon.acumulable, prioridad: 1000, descuento: d, recalcularCupon: true });
    }
  }

  // 3) Selección: todos los acumulables + el mayor de los no acumulables.
  const promosDescartadas: string[] = [];
  const acumulables = candidatos.filter((c) => c.acumulable);
  const exclusivos = candidatos.filter((c) => !c.acumulable);
  const elegidos = [...acumulables];
  if (exclusivos.length) {
    exclusivos.sort((a, b) => b.descuento.monto - a.descuento.monto || a.prioridad - b.prioridad);
    const ganador = exclusivos[0]!;
    elegidos.push(ganador);
    for (const e of exclusivos.slice(1)) {
      if (e.recalcularCupon) cuponError = `El cupón no se combina con "${ganador.descuento.descripcion}"`;
      else promosDescartadas.push(e.descuento.descripcion);
    }
  }

  // 4) Si el cupón convive con promos, se recalcula sobre el neto de esas promos.
  const descuentos: DescuentoAplicado[] = [];
  const netoPorItem = new Map(lineaTotal);
  const aplicar = (d: DescuentoAplicado) => {
    // Tope: ningún ítem queda por debajo de 0.
    const porItem: Record<string, number> = {};
    for (const [vid, monto] of Object.entries(d.porItem)) {
      const neto = netoPorItem.get(vid) ?? 0;
      const aplicado = Math.min(monto, neto);
      if (aplicado <= 0) continue;
      porItem[vid] = aplicado;
      netoPorItem.set(vid, neto - aplicado);
    }
    const monto = sumar(porItem);
    if (monto > 0) descuentos.push({ ...d, monto, porItem });
  };
  const promosElegidas = elegidos.filter((c) => !c.recalcularCupon).sort((a, b) => a.prioridad - b.prioridad);
  for (const c of promosElegidas) aplicar(c.descuento);
  const cuponElegido = elegidos.find((c) => c.recalcularCupon);
  if (cuponElegido) {
    const d = promosElegidas.length ? calcularCupon(netoPorItem) : cuponElegido.descuento;
    if (d) aplicar(d);
    else cuponError = 'El cupón no aplica a los productos del carrito';
  }

  // 5) Descuento por transferencia (sobre el neto).
  const netoProductos = [...netoPorItem.values()].reduce((a, b) => a + b, 0);
  if (entrada.pago?.metodo === 'TRANSFERENCIA' && entrada.pago.descuentoTransferencia > 0 && netoProductos > 0) {
    const pct = entrada.pago.descuentoTransferencia;
    const monto = r((netoProductos * pct) / 100);
    if (monto > 0) {
      aplicar({
        tipo: 'TRANSFERENCIA',
        descripcion: `${pct % 1 === 0 ? pct : pct.toFixed(2)} % por transferencia`,
        monto,
        porItem: prorratear(
          monto,
          [...netoPorItem.entries()].map(([varianteId, base]) => ({ varianteId, base })),
        ),
      });
    }
  }

  const descuentoTotal = descuentos.reduce((a, d) => a + d.monto, 0);
  const neto = subtotal - descuentoTotal;

  // 6) Envío.
  let envio = 0;
  let envioGratis = true;
  let envioGratisPor: string | null = 'retiro';
  if (entrada.envio.modalidad === 'ENVIO_DOMICILIO') {
    const regla = reglasOrdenadas.find(
      (rg) => rg.tipo === 'ENVIO_GRATIS' && (rg.montoMinimo === null || neto >= rg.montoMinimo),
    );
    if (regla) {
      envioGratisPor = regla.nombre;
    } else if (entrada.envio.costo <= 0) {
      envioGratisPor = null;
      envioGratis = true;
    } else {
      envio = r(entrada.envio.costo);
      envioGratis = false;
      envioGratisPor = null;
    }
  }

  const total = Math.max(0, neto + envio);
  const itemsOut = items.map((i) => {
    const sub = lineaTotal.get(i.varianteId) ?? 0;
    const descuento = descuentos.reduce((a, d) => a + (d.porItem[i.varianteId] ?? 0), 0);
    return { varianteId: i.varianteId, subtotal: sub, descuento, total: sub - descuento };
  });

  return {
    subtotal,
    ahorroLista,
    descuentos,
    descuentoTotal,
    envio,
    envioGratis,
    envioGratisPor,
    total,
    ahorroTotal: descuentoTotal + ahorroLista,
    items: itemsOut,
    cuponError,
    promosDescartadas,
  };
}

/** Cuotas sin interés para un carrito: la menor entre las líneas presentes (configurable por línea). */
export function cuotasParaCarrito(
  lineas: LineaPromo[],
  config: { cuotasGeneral: number; cuotasPorLinea: Partial<Record<LineaPromo, number>> },
): number {
  if (lineas.length === 0) return config.cuotasGeneral;
  const valores = lineas.map((l) => config.cuotasPorLinea[l] ?? config.cuotasGeneral);
  return Math.max(1, Math.min(...valores));
}
