-- CreateEnum
CREATE TYPE "TipoMovimientoCuenta" AS ENUM ('DEBITO_PEDIDO', 'PAGO', 'NOTA_CREDITO', 'CREDITO_LIQUIDACION', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MedioPagoCuenta" AS ENUM ('TRANSFERENCIA', 'ECHEQ', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "EstadoPagoInformado" AS ENUM ('PENDIENTE', 'VALIDADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoDevolucionMayorista" AS ENUM ('SOLICITADA', 'APROBADA', 'RECHAZADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoPedidoMayorista" ADD VALUE 'EN_REVISION';
ALTER TYPE "EstadoPedidoMayorista" ADD VALUE 'EN_PREPARACION';
ALTER TYPE "EstadoPedidoMayorista" ADD VALUE 'LISTO_PARA_RETIRO';

-- AlterTable
ALTER TABLE "config_mayorista" ADD COLUMN     "dias_tolerancia_vencida" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "pedidos_mayoristas" ADD COLUMN     "en_preparacion_en" TIMESTAMP(3),
ADD COLUMN     "link_seguimiento" TEXT,
ADD COLUMN     "listo_para_retiro_en" TIMESTAMP(3),
ADD COLUMN     "motivo_revision" TEXT,
ADD COLUMN     "numero_factura" TEXT,
ADD COLUMN     "numero_remito" INTEGER,
ADD COLUMN     "plazo_pago_dias" INTEGER,
ADD COLUMN     "recordatorio_previo_en" TIMESTAMP(3),
ADD COLUMN     "recordatorio_vencido_en" TIMESTAMP(3),
ADD COLUMN     "transporte" TEXT,
ADD COLUMN     "vence_en" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cuentas_corrientes" (
    "id" TEXT NOT NULL,
    "optica_id" TEXT NOT NULL,
    "limite_credito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "plazo_pago_dias" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_corrientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_cuenta" (
    "id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "tipo" "TipoMovimientoCuenta" NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "motivo" TEXT,
    "medio" "MedioPagoCuenta",
    "referencia" TEXT,
    "comprobante_url" TEXT,
    "pedido_mayorista_id" TEXT,
    "devolucion_id" TEXT,
    "liquidacion_mes" TEXT,
    "vencimiento" TIMESTAMP(3),
    "clave" TEXT,
    "creado_por_id" TEXT,
    "creado_por_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imputaciones_pago" (
    "id" TEXT NOT NULL,
    "movimiento_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imputaciones_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_informados" (
    "id" TEXT NOT NULL,
    "optica_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "usuario_nombre" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "medio" "MedioPagoCuenta" NOT NULL,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "referencia" TEXT,
    "comprobante_url" TEXT NOT NULL,
    "comprobante_nombre" TEXT,
    "notas" TEXT,
    "pedido_ids" TEXT[],
    "estado" "EstadoPagoInformado" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "movimiento_id" TEXT,
    "revisado_por_id" TEXT,
    "revisado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_informados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_pedido_mayorista" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" "EstadoPedidoMayorista",
    "nota" TEXT,
    "interno" BOOLEAN NOT NULL DEFAULT false,
    "usuario_id" TEXT,
    "usuario_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pedido_mayorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_mayoristas" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "optica_id" TEXT NOT NULL,
    "estado" "EstadoDevolucionMayorista" NOT NULL DEFAULT 'SOLICITADA',
    "motivo" TEXT NOT NULL,
    "fotos" TEXT[],
    "usuario_id" TEXT,
    "usuario_nombre" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "motivo_rechazo" TEXT,
    "resuelto_por_id" TEXT,
    "resuelto_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_mayoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_mayorista_items" (
    "id" TEXT NOT NULL,
    "devolucion_id" TEXT NOT NULL,
    "pedido_item_id" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "devolucion_mayorista_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones_cierre" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "cantidad_opticas" INTEGER NOT NULL,
    "cerrado_por_id" TEXT,
    "cerrado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_cierre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_corrientes_optica_id_key" ON "cuentas_corrientes"("optica_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_cuenta_clave_key" ON "movimientos_cuenta"("clave");

-- CreateIndex
CREATE INDEX "movimientos_cuenta_cuenta_id_fecha_idx" ON "movimientos_cuenta"("cuenta_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_cuenta_tipo_fecha_idx" ON "movimientos_cuenta"("tipo", "fecha");

-- CreateIndex
CREATE INDEX "imputaciones_pago_movimiento_id_idx" ON "imputaciones_pago"("movimiento_id");

-- CreateIndex
CREATE INDEX "imputaciones_pago_pedido_id_idx" ON "imputaciones_pago"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_informados_movimiento_id_key" ON "pagos_informados"("movimiento_id");

-- CreateIndex
CREATE INDEX "pagos_informados_estado_created_at_idx" ON "pagos_informados"("estado", "created_at");

-- CreateIndex
CREATE INDEX "pagos_informados_optica_id_created_at_idx" ON "pagos_informados"("optica_id", "created_at");

-- CreateIndex
CREATE INDEX "eventos_pedido_mayorista_pedido_id_created_at_idx" ON "eventos_pedido_mayorista"("pedido_id", "created_at");

-- CreateIndex
CREATE INDEX "devoluciones_mayoristas_estado_created_at_idx" ON "devoluciones_mayoristas"("estado", "created_at");

-- CreateIndex
CREATE INDEX "devoluciones_mayoristas_pedido_id_idx" ON "devoluciones_mayoristas"("pedido_id");

-- CreateIndex
CREATE INDEX "devolucion_mayorista_items_devolucion_id_idx" ON "devolucion_mayorista_items"("devolucion_id");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_cierre_mes_key" ON "liquidaciones_cierre"("mes");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_mayoristas_numero_remito_key" ON "pedidos_mayoristas"("numero_remito");

-- AddForeignKey
ALTER TABLE "cuentas_corrientes" ADD CONSTRAINT "cuentas_corrientes_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_corrientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_pedido_mayorista_id_fkey" FOREIGN KEY ("pedido_mayorista_id") REFERENCES "pedidos_mayoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputaciones_pago" ADD CONSTRAINT "imputaciones_pago_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos_cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputaciones_pago" ADD CONSTRAINT "imputaciones_pago_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_mayoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_informados" ADD CONSTRAINT "pagos_informados_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_informados" ADD CONSTRAINT "pagos_informados_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos_cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_pedido_mayorista" ADD CONSTRAINT "eventos_pedido_mayorista_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_mayoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_mayoristas" ADD CONSTRAINT "devoluciones_mayoristas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_mayoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_mayoristas" ADD CONSTRAINT "devoluciones_mayoristas_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_mayorista_items" ADD CONSTRAINT "devolucion_mayorista_items_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones_mayoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_mayorista_items" ADD CONSTRAINT "devolucion_mayorista_items_pedido_item_id_fkey" FOREIGN KEY ("pedido_item_id") REFERENCES "pedido_mayorista_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Numeración correlativa de remitos (R-000001...).
CREATE SEQUENCE IF NOT EXISTS "pedidos_mayoristas_remito_seq" START WITH 1;

-- Un ajuste siempre lleva motivo.
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_ajuste_motivo_chk" CHECK ("tipo" <> 'AJUSTE' OR ("motivo" IS NOT NULL AND length(trim("motivo")) > 0));
