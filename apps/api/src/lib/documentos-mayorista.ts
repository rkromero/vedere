// B2B 3: documentos en PDF del canal mayorista: remito (numeración correlativa R-000001) y estado de
// cuenta de una óptica. Helvetica (WinAnsi) alcanza para el castellano.
import PDFDocument from 'pdfkit';
import { ars, TIPO_MOVIMIENTO_LABEL } from './cuenta-corriente.js';
import type { estadoDeCuenta, ResumenCuenta } from './cuenta-corriente.js';
import type { PedidoGestion } from './gestion-mayorista.js';
import { datosFiscales } from './plantillas.js';

const fecha = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const numeroRemito = (n: number) => `R-${String(n).padStart(6, '0')}`;

function nuevoDoc(titulo: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: titulo, Author: 'Vedere' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  return { doc, fin };
}

async function encabezado(doc: PDFKit.PDFDocument, titulo: string, derecha: string[]) {
  const fiscal = await datosFiscales().catch(() => null);
  const top = doc.y;
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111').text('VEDERE', 44, top);
  doc.font('Helvetica').fontSize(8.5).fillColor('#555555');
  const emisor = [fiscal?.razonSocial, fiscal?.cuit ? `CUIT ${fiscal.cuit}` : null, fiscal?.domicilioFiscal].filter(Boolean) as string[];
  doc.text(emisor.length ? emisor.join(' · ') : 'Anteojos Vedere', 44, top + 24, { width: 300 });
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111').text(titulo, 330, top, { width: 221, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  derecha.forEach((l, i) => doc.text(l, 330, top + 20 + i * 12, { width: 221, align: 'right' }));
  doc.y = Math.max(doc.y, top + 24 + derecha.length * 12) + 14;
  doc.moveTo(44, doc.y).lineTo(551, doc.y).strokeColor('#dddddd').stroke();
  doc.y += 12;
}

interface Columna {
  titulo: string;
  ancho: number;
  align?: 'left' | 'right' | 'center';
}

function tabla(doc: PDFKit.PDFDocument, cols: Columna[], filas: string[][], opts: { negritaUltima?: boolean } = {}) {
  const x0 = 44;
  const fila = (valores: string[], bold: boolean, fondo?: string) => {
    if (doc.y > 770) {
      doc.addPage();
      doc.y = 44;
    }
    const y = doc.y;
    const alto = Math.max(
      16,
      ...valores.map((v, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).heightOfString(v, { width: cols[i]!.ancho - 8 }) + 6),
    );
    if (fondo) doc.rect(x0, y, 507, alto).fill(fondo);
    let x = x0;
    valores.forEach((v, i) => {
      const c = cols[i]!;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#111111').text(v, x + 4, y + 4, { width: c.ancho - 8, align: c.align ?? 'left' });
      x += c.ancho;
    });
    doc.y = y + alto;
    doc.moveTo(x0, doc.y).lineTo(x0 + 507, doc.y).strokeColor('#eeeeee').stroke();
  };
  fila(cols.map((c) => c.titulo.toUpperCase()), true, '#f3f3f1');
  filas.forEach((f, i) => fila(f, !!opts.negritaUltima && i === filas.length - 1));
  doc.y += 8;
}

/** Remito del pedido mayorista (sin precios: acompaña la mercadería). */
export async function remitoPdf(p: PedidoGestion): Promise<Buffer> {
  const n = numeroRemito(p.numeroRemito ?? 0);
  const { doc, fin } = nuevoDoc(`Remito ${n} · ${p.numero}`);
  await encabezado(doc, `REMITO ${n}`, [`Fecha: ${fecha(p.despachadoEn ?? p.listoParaRetiroEn ?? new Date())}`, `Pedido: ${p.numero}`, 'Documento no válido como factura']);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Destinatario');
  doc.font('Helvetica').fontSize(9).fillColor('#333333');
  doc.text(p.optica.razonSocial ? `${p.optica.razonSocial} (${p.optica.nombre})` : p.optica.nombre);
  if (p.optica.cuit) doc.text(`CUIT ${p.optica.cuit}`);
  doc.text(`${p.entrega === 'RETIRO_DEPOSITO' ? 'Retira en' : 'Entrega en'}: ${p.direccionEntrega}`);
  if (p.transporte) doc.text(`Transporte: ${p.transporte}${p.numeroSeguimiento ? ` · Guía ${p.numeroSeguimiento}` : ''}`);
  if (p.numeroFactura) doc.text(`Factura: ${p.numeroFactura}`);
  doc.moveDown(1);

  const filas = p.items.map((i) => [i.sku, i.nombre, i.color, String(i.cantidad)]);
  filas.push(['', '', 'Total de unidades', String(p.unidades)]);
  tabla(
    doc,
    [
      { titulo: 'SKU', ancho: 120 },
      { titulo: 'Modelo', ancho: 200 },
      { titulo: 'Color', ancho: 117 },
      { titulo: 'Cantidad', ancho: 70, align: 'right' },
    ],
    filas,
    { negritaUltima: true },
  );

  if (p.notas) {
    doc.font('Helvetica-Bold').fontSize(9).text('Notas de la óptica');
    doc.font('Helvetica').fontSize(9).text(p.notas);
    doc.moveDown(1);
  }
  doc.moveDown(3);
  const y = Math.min(doc.y, 740);
  doc.moveTo(60, y).lineTo(250, y).strokeColor('#999999').stroke();
  doc.moveTo(345, y).lineTo(535, y).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor('#555555');
  doc.text('Entregó (firma y aclaración)', 60, y + 4, { width: 190, align: 'center' });
  doc.text('Recibió (firma, aclaración y DNI)', 345, y + 4, { width: 190, align: 'center' });
  doc.end();
  return fin;
}

/** Estado de cuenta: resumen, vencimientos y movimientos con saldo acumulado. */
export async function estadoCuentaPdf(input: {
  optica: { nombre: string; razonSocial: string | null; cuit: string | null };
  resumen: ResumenCuenta;
  estado: Awaited<ReturnType<typeof estadoDeCuenta>>;
}): Promise<Buffer> {
  const { optica, resumen: r, estado } = input;
  const { doc, fin } = nuevoDoc(`Estado de cuenta · ${optica.nombre}`);
  await encabezado(doc, 'ESTADO DE CUENTA', [`Emitido: ${fecha(new Date())}`, optica.nombre, optica.cuit ? `CUIT ${optica.cuit}` : '']);

  const datos: Array<[string, string]> = [
    ['Saldo', `${ars(r.saldo)}${r.saldo < 0 ? ' (a favor)' : ''}`],
    ['Límite de crédito', ars(r.limiteCredito)],
    ['Crédito disponible', ars(r.disponible)],
    ['Deuda vencida', ars(r.deudaVencida)],
    ['Plazo de pago', `${r.plazoPagoDias} días`],
  ];
  const y0 = doc.y;
  datos.forEach(([k, v], i) => {
    const x = 44 + (i % 3) * 169;
    const y = y0 + Math.floor(i / 3) * 34;
    doc.font('Helvetica').fontSize(8).fillColor('#666666').text(k.toUpperCase(), x, y, { width: 160 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(v, x, y + 11, { width: 160 });
  });
  doc.x = 44;
  doc.y = y0 + 76;

  const pendientes = [...r.vencidos, ...r.proximosVencimientos];
  if (pendientes.length) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Pedidos con saldo pendiente', 44);
    doc.moveDown(0.4);
    tabla(
      doc,
      [
        { titulo: 'Pedido', ancho: 110 },
        { titulo: 'Vence', ancho: 100 },
        { titulo: 'Total', ancho: 100, align: 'right' },
        { titulo: 'Pagado', ancho: 97, align: 'right' },
        { titulo: 'Pendiente', ancho: 100, align: 'right' },
      ],
      pendientes.map((p) => [p.numero, `${fecha(p.venceEn)}${p.diasVencido > 0 ? ` (${p.diasVencido} d vencido)` : ''}`, ars(p.total), ars(p.pagado), ars(p.pendiente)]),
    );
  }

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Movimientos', 44);
  doc.moveDown(0.4);
  const filas = estado.movimientos.map((m) => [
    fecha(m.fecha),
    TIPO_MOVIMIENTO_LABEL[m.tipo],
    [m.descripcion, m.motivo].filter(Boolean).join(' · ') + (m.vencimiento ? ` · vence ${fecha(m.vencimiento)}` : ''),
    m.importe > 0 ? ars(m.importe) : '',
    m.importe < 0 ? ars(-m.importe) : '',
    ars(m.saldo),
  ]);
  filas.push(['', '', 'Saldo final', '', '', ars(estado.saldo)]);
  tabla(
    doc,
    [
      { titulo: 'Fecha', ancho: 62 },
      { titulo: 'Tipo', ancho: 80 },
      { titulo: 'Detalle', ancho: 165 },
      { titulo: 'Debe', ancho: 66, align: 'right' },
      { titulo: 'Haber', ancho: 66, align: 'right' },
      { titulo: 'Saldo', ancho: 68, align: 'right' },
    ],
    filas,
    { negritaUltima: true },
  );
  doc.end();
  return fin;
}

