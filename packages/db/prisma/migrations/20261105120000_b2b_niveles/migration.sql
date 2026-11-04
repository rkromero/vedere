CREATE TYPE "NivelOptica" AS ENUM ('VETRO', 'CRISTALLO', 'PRISMA', 'ZAFIRO');
-- CreateEnum
CREATE TYPE "TipoLogro" AS ENUM ('PRIMER_FOCO', 'MANO_FIRME', 'MULTIFOCAL_MAESTRO', 'RELOJITO', 'VITRINA_VEDERE', 'EMBAJADORA');
-- AlterTable
ALTER TABLE "cuentas_corrientes" ALTER COLUMN "limite_credito" DROP NOT NULL,
ALTER COLUMN "limite_credito" DROP DEFAULT,
ALTER COLUMN "plazo_pago_dias" DROP NOT NULL,
ALTER COLUMN "plazo_pago_dias" DROP DEFAULT;
-- AlterTable
ALTER TABLE "opticas" ADD COLUMN     "baja_pendiente_desde" TEXT,
ADD COLUMN     "beneficio_provisorio" "NivelOptica",
ADD COLUMN     "beneficio_provisorio_hasta" TIMESTAMP(3),
ADD COLUMN     "fotos_vitrina" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "muestrario_en" TIMESTAMP(3),
ADD COLUMN     "nivel" "NivelOptica" NOT NULL DEFAULT 'VETRO',
ADD COLUMN     "nivel_calculado_en" TIMESTAMP(3),
ADD COLUMN     "nivel_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nivel_manual" "NivelOptica",
ADD COLUMN     "nivel_manual_hasta" TIMESTAMP(3),
ADD COLUMN     "nivel_manual_motivo" TEXT,
ADD COLUMN     "nivel_manual_por_id" TEXT,
ADD COLUMN     "puntaje" INTEGER,
ADD COLUMN     "referida_por_id" TEXT,
ALTER COLUMN "descuento_pct" DROP NOT NULL,
ALTER COLUMN "descuento_pct" DROP DEFAULT;
-- AlterTable
ALTER TABLE "solicitudes_optica" ADD COLUMN     "referida_por_cuit" TEXT;
-- CreateTable
CREATE TABLE "config_niveles" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "datos" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "config_niveles_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "historial_niveles" (
    "id" TEXT NOT NULL,
    "optica_id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "puntos_extra" INTEGER NOT NULL DEFAULT 0,
    "nivel_calculado" "NivelOptica" NOT NULL,
    "nivel" "NivelOptica" NOT NULL,
    "nivel_anterior" "NivelOptica",
    "motivo" TEXT,
    "detalle" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "historial_niveles_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "logros_opticas" (
    "id" TEXT NOT NULL,
    "optica_id" TEXT NOT NULL,
    "logro" "TipoLogro" NOT NULL,
    "puntos" INTEGER NOT NULL,
    "obtenido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "logros_opticas_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "calificaciones_pedidos" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "optica_id" TEXT,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calificaciones_pedidos_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "historial_niveles_mes_idx" ON "historial_niveles"("mes");
-- CreateIndex
CREATE UNIQUE INDEX "historial_niveles_optica_id_mes_key" ON "historial_niveles"("optica_id", "mes");
-- CreateIndex
CREATE UNIQUE INDEX "logros_opticas_optica_id_logro_key" ON "logros_opticas"("optica_id", "logro");
-- CreateIndex
CREATE UNIQUE INDEX "calificaciones_pedidos_pedido_id_key" ON "calificaciones_pedidos"("pedido_id");
-- CreateIndex
CREATE INDEX "calificaciones_pedidos_optica_id_created_at_idx" ON "calificaciones_pedidos"("optica_id", "created_at");
-- AddForeignKey
ALTER TABLE "opticas" ADD CONSTRAINT "opticas_referida_por_id_fkey" FOREIGN KEY ("referida_por_id") REFERENCES "opticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "historial_niveles" ADD CONSTRAINT "historial_niveles_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "logros_opticas" ADD CONSTRAINT "logros_opticas_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calificaciones_pedidos" ADD CONSTRAINT "calificaciones_pedidos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calificaciones_pedidos" ADD CONSTRAINT "calificaciones_pedidos_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- B2B 4: los valores manuales pasan a ser excepciones. Los que estaban en el default vuelven a "según nivel".
UPDATE "opticas" SET "descuento_pct" = NULL WHERE "descuento_pct" = 0;
UPDATE "cuentas_corrientes" SET "limite_credito" = NULL WHERE "limite_credito" = 0;
UPDATE "cuentas_corrientes" SET "plazo_pago_dias" = NULL WHERE "plazo_pago_dias" = 30;

ALTER TABLE "calificaciones_pedidos" ADD CONSTRAINT "calificaciones_pedidos_puntaje_chk" CHECK ("puntaje" BETWEEN 1 AND 5);
