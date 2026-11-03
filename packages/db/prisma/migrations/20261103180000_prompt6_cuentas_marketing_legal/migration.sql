-- Prompt 6: cuentas de cliente (Google, recuperación, direcciones, favoritos, referidos, Plan Rivedere),
-- plantillas de email, arrepentimiento, páginas legales, redirecciones, newsletter con baja, carrito abandonado y datos fiscales.
-- CreateEnum
CREATE TYPE "EstadoArrepentimiento" AS ENUM ('RECIBIDO', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "carritos" ADD COLUMN     "aviso_1h_en" TIMESTAMP(3),
ADD COLUMN     "aviso_24h_en" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "config_tienda" ADD COLUMN     "carrito_abandonado_habilitado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "condicion_iva" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "domicilio_fiscal" TEXT,
ADD COLUMN     "email_contacto" TEXT,
ADD COLUMN     "ingresos_brutos" TEXT,
ADD COLUMN     "inicio_actividades" TEXT,
ADD COLUMN     "razon_social" TEXT,
ADD COLUMN     "referido_descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
ADD COLUMN     "rivedere_descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 15,
ADD COLUMN     "rivedere_meses" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
-- Filas existentes: token aleatorio y updated_at = created_at antes de exigir NOT NULL.
ALTER TABLE "suscripciones_newsletter" ADD COLUMN     "baja_en" TIMESTAMP(3),
ADD COLUMN     "nombre" TEXT,
ADD COLUMN     "token" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3);
UPDATE "suscripciones_newsletter" SET "token" = md5(random()::text || id), "updated_at" = "created_at";
ALTER TABLE "suscripciones_newsletter" ALTER COLUMN "token" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "codigo_referido" TEXT,
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "newsletter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referido_por_id" TEXT,
ADD COLUMN     "referido_recompensado_en" TIMESTAMP(3),
ADD COLUMN     "rivedere_avisado_en" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL DEFAULT 'Casa',
    "direccion" TEXT NOT NULL,
    "piso" TEXT,
    "localidad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "codigo_postal" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "place_id" TEXT,
    "telefono" TEXT,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoritos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_email" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "asunto" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "cta_label" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "plantillas_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arrepentimientos" (
    "id" TEXT NOT NULL,
    "numero_tramite" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dni" TEXT,
    "telefono" TEXT,
    "pedido_numero" TEXT,
    "pedido_id" TEXT,
    "motivo" TEXT,
    "estado" "EstadoArrepentimiento" NOT NULL DEFAULT 'RECIBIDO',
    "respuesta" TEXT,
    "resuelto_en" TIMESTAMP(3),
    "resuelto_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arrepentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paginas_legales" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "intro" TEXT,
    "contenido" TEXT NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "paginas_legales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirecciones" (
    "id" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "permanente" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirecciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "direcciones_user_id_idx" ON "direcciones"("user_id");

-- CreateIndex
CREATE INDEX "favoritos_producto_id_idx" ON "favoritos"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "favoritos_user_id_producto_id_key" ON "favoritos"("user_id", "producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_email_tipo_key" ON "plantillas_email"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "arrepentimientos_numero_tramite_key" ON "arrepentimientos"("numero_tramite");

-- CreateIndex
CREATE INDEX "arrepentimientos_estado_created_at_idx" ON "arrepentimientos"("estado", "created_at");

-- CreateIndex
CREATE INDEX "arrepentimientos_email_idx" ON "arrepentimientos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "paginas_legales_slug_key" ON "paginas_legales"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "redirecciones_origen_key" ON "redirecciones"("origen");

-- CreateIndex
CREATE INDEX "carritos_updated_at_idx" ON "carritos"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_newsletter_token_key" ON "suscripciones_newsletter"("token");

-- CreateIndex
CREATE INDEX "suscripciones_newsletter_baja_en_idx" ON "suscripciones_newsletter"("baja_en");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_codigo_referido_key" ON "users"("codigo_referido");

-- CreateIndex
CREATE INDEX "users_referido_por_id_idx" ON "users"("referido_por_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referido_por_id_fkey" FOREIGN KEY ("referido_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

