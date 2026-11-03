-- Prompt 5: ópticas socias (datos fiscales, radio, capacidad, comisión, usuarios OPTICA), asignación
-- automática de pedidos, línea de tiempo, turnos, solicitudes de cambio, reembolsos y emails.

-- CreateEnum
CREATE TYPE "CanalPedido" AS ENUM ('WEB', 'WHATSAPP', 'OPTICA', 'ADMIN');
CREATE TYPE "TipoEventoPedido" AS ENUM ('ESTADO', 'ASIGNACION', 'RECHAZO', 'NOTA', 'EMAIL', 'PAGO', 'REEMBOLSO', 'SOLICITUD');
CREATE TYPE "TipoTurno" AS ENUM ('MEDICION', 'AJUSTE', 'RETIRO', 'OTRO');
CREATE TYPE "EstadoTurno" AS ENUM ('PROGRAMADO', 'REALIZADO', 'CANCELADO');
CREATE TYPE "TipoSolicitud" AS ENUM ('CAMBIO', 'DEVOLUCION');
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');
CREATE TYPE "ResolucionSolicitud" AS ENUM ('NUEVO_PEDIDO', 'REINTEGRO');
CREATE TYPE "EstadoReembolso" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
CREATE TYPE "EstadoEmail" AS ENUM ('ENVIADO', 'SIMULADO', 'ERROR');

-- AlterEnum: nuevos estados del pedido. Los pedidos existentes se mapean:
-- CONFIRMADO → PAGADO, EN_PREPARACION → EN_ARMADO (el resto conserva su nombre).
BEGIN;
CREATE TYPE "EstadoPedido_new" AS ENUM ('PENDIENTE_PAGO', 'PAGADO', 'ASIGNADO', 'ACEPTADO', 'EN_ARMADO', 'LISTO', 'ENVIADO', 'ENTREGADO', 'CANCELADO', 'DEVUELTO');
ALTER TABLE "pedidos" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "pedidos" ALTER COLUMN "estado" TYPE "EstadoPedido_new" USING (
  CASE "estado"::text
    WHEN 'CONFIRMADO' THEN 'PAGADO'
    WHEN 'EN_PREPARACION' THEN 'EN_ARMADO'
    ELSE "estado"::text
  END
)::"EstadoPedido_new";
ALTER TYPE "EstadoPedido" RENAME TO "EstadoPedido_old";
ALTER TYPE "EstadoPedido_new" RENAME TO "EstadoPedido";
DROP TYPE "EstadoPedido_old";
ALTER TABLE "pedidos" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE_PAGO';
COMMIT;

-- AlterTable
ALTER TABLE "config_tienda" ADD COLUMN     "hora_habil_desde" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "hora_habil_hasta" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "plazo_aceptacion_horas" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "sabado_habil" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "opticas" ADD COLUMN     "capacidad_diaria" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "comision_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "matricula" TEXT,
ADD COLUMN     "optico_responsable" TEXT,
ADD COLUMN     "radio_km" DOUBLE PRECISION NOT NULL DEFAULT 10,
ADD COLUMN     "razon_social" TEXT;

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "aceptado_en" TIMESTAMP(3),
ADD COLUMN     "aceptar_antes_de" TIMESTAMP(3),
ADD COLUMN     "asignado_en" TIMESTAMP(3),
ADD COLUMN     "canal" "CanalPedido" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "comision_monto" DECIMAL(12,2),
ADD COLUMN     "comision_pct" DECIMAL(5,2),
ADD COLUMN     "entregado_en" TIMESTAMP(3),
ADD COLUMN     "enviado_en" TIMESTAMP(3),
ADD COLUMN     "numero_seguimiento" TEXT,
ADD COLUMN     "opticas_excluidas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reembolsado" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "optica_id" TEXT;

-- CreateTable
CREATE TABLE "pedido_eventos" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "tipo" "TipoEventoPedido" NOT NULL,
    "estado_anterior" "EstadoPedido",
    "estado_nuevo" "EstadoPedido",
    "optica_id" TEXT,
    "user_id" TEXT,
    "actor_nombre" TEXT,
    "actor_rol" "Rol",
    "nota" TEXT,
    "datos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "optica_id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "tipo" "TipoTurno" NOT NULL DEFAULT 'MEDICION',
    "estado" "EstadoTurno" NOT NULL DEFAULT 'PROGRAMADO',
    "fecha" TIMESTAMP(3) NOT NULL,
    "duracion_min" INTEGER NOT NULL DEFAULT 30,
    "cliente_nombre" TEXT NOT NULL,
    "cliente_telefono" TEXT,
    "notas" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_cambio" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "tipo" "TipoSolicitud" NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "resolucion" "ResolucionSolicitud",
    "nuevo_pedido_id" TEXT,
    "respuesta" TEXT,
    "resuelto_por_id" TEXT,
    "resuelto_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reembolsos" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "pago_id" TEXT,
    "proveedor" TEXT NOT NULL,
    "externo_id" TEXT,
    "monto" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoReembolso" NOT NULL DEFAULT 'APROBADO',
    "detalle" JSONB,
    "creado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reembolsos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails_enviados" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT,
    "tipo" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "estado" "EstadoEmail" NOT NULL,
    "proveedor" TEXT,
    "externo_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pedido_eventos_pedido_id_created_at_idx" ON "pedido_eventos"("pedido_id", "created_at");

-- CreateIndex
CREATE INDEX "turnos_optica_id_fecha_idx" ON "turnos"("optica_id", "fecha");

-- CreateIndex
CREATE INDEX "turnos_pedido_id_idx" ON "turnos"("pedido_id");

-- CreateIndex
CREATE INDEX "solicitudes_cambio_estado_created_at_idx" ON "solicitudes_cambio"("estado", "created_at");

-- CreateIndex
CREATE INDEX "solicitudes_cambio_pedido_id_idx" ON "solicitudes_cambio"("pedido_id");

-- CreateIndex
CREATE INDEX "reembolsos_pedido_id_idx" ON "reembolsos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "reembolsos_proveedor_externo_id_key" ON "reembolsos"("proveedor", "externo_id");

-- CreateIndex
CREATE INDEX "emails_enviados_pedido_id_created_at_idx" ON "emails_enviados"("pedido_id", "created_at");

-- CreateIndex
CREATE INDEX "pedidos_estado_aceptar_antes_de_idx" ON "pedidos"("estado", "aceptar_antes_de");

-- CreateIndex
CREATE INDEX "pedidos_optica_id_asignado_en_idx" ON "pedidos"("optica_id", "asignado_en");

-- CreateIndex
CREATE INDEX "users_optica_id_idx" ON "users"("optica_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_eventos" ADD CONSTRAINT "pedido_eventos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_eventos" ADD CONSTRAINT "pedido_eventos_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_cambio" ADD CONSTRAINT "solicitudes_cambio_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reembolsos" ADD CONSTRAINT "reembolsos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails_enviados" ADD CONSTRAINT "emails_enviados_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

