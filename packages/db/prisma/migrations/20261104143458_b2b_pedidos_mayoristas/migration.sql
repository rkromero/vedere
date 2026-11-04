-- CreateEnum
CREATE TYPE "TipoMinimoMayorista" AS ENUM ('NINGUNO', 'UNIDADES', 'MONTO');

-- CreateEnum
CREATE TYPE "EnvioMayoristaModo" AS ENUM ('COSTO_FIJO', 'A_CARGO_OPTICA');

-- CreateEnum
CREATE TYPE "EntregaMayorista" AS ENUM ('ENVIO_TRANSPORTE', 'RETIRO_DEPOSITO');

-- CreateEnum
CREATE TYPE "EstadoPedidoMayorista" AS ENUM ('PENDIENTE_APROBACION', 'APROBADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "opticas" ADD COLUMN     "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "minimo_tipo" "TipoMinimoMayorista",
ADD COLUMN     "minimo_valor" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "reservas_stock" ADD COLUMN     "pedido_mayorista_id" TEXT,
ALTER COLUMN "pedido_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "config_mayorista" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "iva_pct" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "minimo_tipo" "TipoMinimoMayorista" NOT NULL DEFAULT 'NINGUNO',
    "minimo_valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "envio_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "envio_modo" "EnvioMayoristaModo" NOT NULL DEFAULT 'A_CARGO_OPTICA',
    "envio_costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retiro_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "retiro_direccion" TEXT,
    "retiro_horario" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "config_mayorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carritos_mayoristas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carritos_mayoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_mayoristas" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoPedidoMayorista" NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "optica_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "usuario_nombre" TEXT NOT NULL,
    "usuario_email" TEXT NOT NULL,
    "entrega" "EntregaMayorista" NOT NULL,
    "direccion_entrega" TEXT NOT NULL,
    "envio_a_cargo_optica" BOOLEAN NOT NULL DEFAULT false,
    "unidades" INTEGER NOT NULL,
    "subtotal_lista" DECIMAL(12,2) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "envio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva_pct" DECIMAL(5,2) NOT NULL,
    "iva" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "notas_internas" TEXT,
    "motivo_cancelacion" TEXT,
    "repetido_de_id" TEXT,
    "aprobado_en" TIMESTAMP(3),
    "aprobado_por_id" TEXT,
    "despachado_en" TIMESTAMP(3),
    "entregado_en" TIMESTAMP(3),
    "cancelado_en" TIMESTAMP(3),
    "numero_seguimiento" TEXT,
    "stock_descontado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_mayoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_mayorista_items" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "variante_id" TEXT,
    "producto_id" TEXT,
    "nombre" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imagen" TEXT,
    "precio_mayorista" DECIMAL(12,2) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "precio_publico" DECIMAL(12,2),
    "cantidad" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pedido_mayorista_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carritos_mayoristas_user_id_key" ON "carritos_mayoristas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_mayoristas_numero_key" ON "pedidos_mayoristas"("numero");

-- CreateIndex
CREATE INDEX "pedidos_mayoristas_optica_id_created_at_idx" ON "pedidos_mayoristas"("optica_id", "created_at");

-- CreateIndex
CREATE INDEX "pedidos_mayoristas_estado_created_at_idx" ON "pedidos_mayoristas"("estado", "created_at");

-- CreateIndex
CREATE INDEX "pedido_mayorista_items_pedido_id_idx" ON "pedido_mayorista_items"("pedido_id");

-- CreateIndex
CREATE INDEX "pedido_mayorista_items_variante_id_idx" ON "pedido_mayorista_items"("variante_id");

-- CreateIndex
CREATE INDEX "reservas_stock_pedido_mayorista_id_idx" ON "reservas_stock"("pedido_mayorista_id");

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_pedido_mayorista_id_fkey" FOREIGN KEY ("pedido_mayorista_id") REFERENCES "pedidos_mayoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos_mayoristas" ADD CONSTRAINT "carritos_mayoristas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_mayoristas" ADD CONSTRAINT "pedidos_mayoristas_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mayorista_items" ADD CONSTRAINT "pedido_mayorista_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos_mayoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mayorista_items" ADD CONSTRAINT "pedido_mayorista_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mayorista_items" ADD CONSTRAINT "pedido_mayorista_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Número legible VM-10001
CREATE SEQUENCE IF NOT EXISTS "pedidos_mayoristas_numero_seq" START WITH 10001 INCREMENT BY 1;

-- Cada reserva pertenece a un pedido web o a uno mayorista (nunca a ambos ni a ninguno).
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_un_pedido_chk"
  CHECK (("pedido_id" IS NULL) <> ("pedido_mayorista_id" IS NULL));

-- Configuración inicial del canal mayorista.
INSERT INTO "config_mayorista" ("id", "updated_at") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
