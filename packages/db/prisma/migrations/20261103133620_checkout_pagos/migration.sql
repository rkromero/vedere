-- CreateEnum
CREATE TYPE "TipoPromocion" AS ENUM ('DOS_POR_UNO', 'SEGUNDO_50', 'ENVIO_GRATIS');

-- CreateEnum
CREATE TYPE "ModoReceta" AS ENUM ('VALORES', 'ARCHIVO', 'OPTICA');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('MERCADO_PAGO', 'MERCADO_PAGO_BILLETERA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "ModalidadEntrega" AS ENUM ('RETIRO_OPTICA', 'ENVIO_DOMICILIO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('ACTIVA', 'CONSUMIDA', 'LIBERADA');

-- AlterTable
ALTER TABLE "cupones" ADD COLUMN     "acumulable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creador_id" TEXT,
ADD COLUMN     "usos_max_por_cliente" INTEGER;

-- CreateTable
CREATE TABLE "creadores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "instagram" TEXT,
    "email" TEXT,
    "comision" DECIMAL(5,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "creadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promociones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPromocion" NOT NULL,
    "linea" "Linea",
    "coleccion_id" TEXT,
    "monto_minimo" DECIMAL(12,2),
    "acumulable" BOOLEAN NOT NULL DEFAULT false,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "promociones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_tienda" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "transferencia_habilitada" BOOLEAN NOT NULL DEFAULT true,
    "cbu" TEXT,
    "alias" TEXT,
    "titular_cuenta" TEXT,
    "banco" TEXT,
    "descuento_transferencia" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "transferencia_horas_reserva" INTEGER NOT NULL DEFAULT 48,
    "mp_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "mp_billetera_habilitada" BOOLEAN NOT NULL DEFAULT false,
    "cuotas_general" INTEGER NOT NULL DEFAULT 6,
    "cuotas_por_linea" JSONB NOT NULL DEFAULT '{}',
    "costo_envio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "config_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "modo" "ModoReceta" NOT NULL,
    "od_esfera" DECIMAL(5,2),
    "od_cilindro" DECIMAL(5,2),
    "od_eje" INTEGER,
    "oi_esfera" DECIMAL(5,2),
    "oi_cilindro" DECIMAL(5,2),
    "oi_eje" INTEGER,
    "adicion" DECIMAL(4,2),
    "dp" DECIMAL(4,1),
    "archivo_url" TEXT,
    "archivo_nombre" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "modalidad" "ModalidadEntrega" NOT NULL,
    "optica_id" TEXT,
    "direccion" TEXT NOT NULL,
    "piso" TEXT,
    "localidad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "codigo_postal" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "place_id" TEXT,
    "direccion_completa" TEXT,
    "receta_id" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuentos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuentos_detalle" JSONB NOT NULL DEFAULT '[]',
    "envio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "cupon_codigo" TEXT,
    "metodo_pago" "MetodoPago" NOT NULL,
    "estado_pago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "pagado_en" TIMESTAMP(3),
    "stock_descontado" BOOLEAN NOT NULL DEFAULT false,
    "reserva_expira_en" TIMESTAMP(3),
    "numero_factura" TEXT,
    "notas" TEXT,
    "notas_internas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "variante_id" TEXT,
    "producto_id" TEXT,
    "nombre" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imagen" TEXT,
    "linea" "Linea" NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "precio_lista" DECIMAL(12,2),
    "cantidad" INTEGER NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "con_receta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "proveedor" TEXT NOT NULL,
    "externo_id" TEXT,
    "preferencia_id" TEXT,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "monto" DECIMAL(12,2) NOT NULL,
    "detalle" JSONB,
    "comprobante_url" TEXT,
    "comprobante_nombre" TEXT,
    "comprobante_subido_en" TIMESTAMP(3),
    "confirmado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_stock" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "variante_id" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'ACTIVA',
    "expira_en" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupon_usos" (
    "id" TEXT NOT NULL,
    "cupon_id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupon_usos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_webhook" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "procesado_en" TIMESTAMP(3),
    "resultado" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CategoriaToCupon" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoriaToCupon_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ColeccionToCupon" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ColeccionToCupon_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "creadores_slug_key" ON "creadores"("slug");

-- CreateIndex
CREATE INDEX "promociones_activa_tipo_idx" ON "promociones"("activa", "tipo");

-- CreateIndex
CREATE INDEX "recetas_user_id_idx" ON "recetas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE INDEX "pedidos_estado_created_at_idx" ON "pedidos"("estado", "created_at");

-- CreateIndex
CREATE INDEX "pedidos_estado_pago_idx" ON "pedidos"("estado_pago");

-- CreateIndex
CREATE INDEX "pedidos_user_id_idx" ON "pedidos"("user_id");

-- CreateIndex
CREATE INDEX "pedidos_email_idx" ON "pedidos"("email");

-- CreateIndex
CREATE INDEX "pedidos_optica_id_idx" ON "pedidos"("optica_id");

-- CreateIndex
CREATE INDEX "pedido_items_pedido_id_idx" ON "pedido_items"("pedido_id");

-- CreateIndex
CREATE INDEX "pedido_items_variante_id_idx" ON "pedido_items"("variante_id");

-- CreateIndex
CREATE INDEX "pagos_pedido_id_idx" ON "pagos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_proveedor_externo_id_key" ON "pagos"("proveedor", "externo_id");

-- CreateIndex
CREATE INDEX "reservas_stock_variante_id_estado_idx" ON "reservas_stock"("variante_id", "estado");

-- CreateIndex
CREATE INDEX "reservas_stock_estado_expira_en_idx" ON "reservas_stock"("estado", "expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "cupon_usos_pedido_id_key" ON "cupon_usos"("pedido_id");

-- CreateIndex
CREATE INDEX "cupon_usos_cupon_id_email_idx" ON "cupon_usos"("cupon_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_proveedor_evento_id_key" ON "eventos_webhook"("proveedor", "evento_id");

-- CreateIndex
CREATE INDEX "_CategoriaToCupon_B_index" ON "_CategoriaToCupon"("B");

-- CreateIndex
CREATE INDEX "_ColeccionToCupon_B_index" ON "_ColeccionToCupon"("B");

-- CreateIndex
CREATE INDEX "cupones_creador_id_idx" ON "cupones"("creador_id");

-- AddForeignKey
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "creadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_coleccion_id_fkey" FOREIGN KEY ("coleccion_id") REFERENCES "colecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "recetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_usos" ADD CONSTRAINT "cupon_usos_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_usos" ADD CONSTRAINT "cupon_usos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoriaToCupon" ADD CONSTRAINT "_CategoriaToCupon_A_fkey" FOREIGN KEY ("A") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoriaToCupon" ADD CONSTRAINT "_CategoriaToCupon_B_fkey" FOREIGN KEY ("B") REFERENCES "cupones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColeccionToCupon" ADD CONSTRAINT "_ColeccionToCupon_A_fkey" FOREIGN KEY ("A") REFERENCES "colecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColeccionToCupon" ADD CONSTRAINT "_ColeccionToCupon_B_fkey" FOREIGN KEY ("B") REFERENCES "cupones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Secuencia para el número legible de pedido (VD-10001, VD-10002, ...)
CREATE SEQUENCE IF NOT EXISTS "pedidos_numero_seq" START WITH 10001 INCREMENT BY 1;
