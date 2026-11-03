-- CreateEnum
CREATE TYPE "TipoCupon" AS ENUM ('PORCENTAJE', 'MONTO');

-- CreateEnum
CREATE TYPE "MotivoContacto" AS ENUM ('CONSULTA', 'TURNO', 'CAMBIO', 'ARREPENTIMIENTO', 'OPTICA', 'OTRO');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "edicion_limitada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "promo_mensajes" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "link" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "promo_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opticas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "codigo_postal" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "telefono" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "horarios" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "opticas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoCupon" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "minimo_compra" DECIMAL(12,2),
    "usos_max" INTEGER,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones_newsletter" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "origen" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_stock" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "variante_id" TEXT NOT NULL,
    "notificado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_contacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "motivo" "MotivoContacto" NOT NULL DEFAULT 'CONSULTA',
    "mensaje" TEXT NOT NULL,
    "pedido" TEXT,
    "leido_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carritos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "cupon" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carritos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promo_mensajes_activo_orden_idx" ON "promo_mensajes"("activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "opticas_slug_key" ON "opticas"("slug");

-- CreateIndex
CREATE INDEX "opticas_activa_provincia_idx" ON "opticas"("activa", "provincia");

-- CreateIndex
CREATE INDEX "opticas_codigo_postal_idx" ON "opticas"("codigo_postal");

-- CreateIndex
CREATE UNIQUE INDEX "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_newsletter_email_key" ON "suscripciones_newsletter"("email");

-- CreateIndex
CREATE INDEX "avisos_stock_variante_id_idx" ON "avisos_stock"("variante_id");

-- CreateIndex
CREATE UNIQUE INDEX "avisos_stock_email_variante_id_key" ON "avisos_stock"("email", "variante_id");

-- CreateIndex
CREATE INDEX "mensajes_contacto_motivo_created_at_idx" ON "mensajes_contacto"("motivo", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "carritos_user_id_key" ON "carritos"("user_id");

-- AddForeignKey
ALTER TABLE "avisos_stock" ADD CONSTRAINT "avisos_stock_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos" ADD CONSTRAINT "carritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
