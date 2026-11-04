-- CreateEnum
CREATE TYPE "CondicionIva" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO');

-- CreateEnum
CREATE TYPE "EstadoSolicitudOptica" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "CampoPrecio" AS ENUM ('PRECIO', 'PRECIO_MAYORISTA');

-- CreateEnum
CREATE TYPE "AlcancePrecio" AS ENUM ('TODOS', 'CATEGORIA', 'MARCA', 'COLECCION');

-- AlterTable
ALTER TABLE "opticas" ADD COLUMN     "condicion_iva" "CondicionIva",
ADD COLUMN     "habilitacion_url" TEXT;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "precio_mayorista" DECIMAL(12,2),
ADD COLUMN     "visible_mayorista" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visible_tienda" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optica_dueno" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "solicitudes_optica" (
    "id" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "nombre_comercial" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "condicion_iva" "CondicionIva" NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "codigo_postal" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "optico_responsable" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "habilitacion_url" TEXT NOT NULL,
    "habilitacion_nombre" TEXT,
    "acepta_terminos_en" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "estado" "EstadoSolicitudOptica" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "optica_id" TEXT,
    "usuario_id" TEXT,
    "resuelto_por_id" TEXT,
    "resuelto_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_optica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actualizaciones_precio" (
    "id" TEXT NOT NULL,
    "campo" "CampoPrecio" NOT NULL,
    "porcentaje" DECIMAL(7,2) NOT NULL,
    "alcance" "AlcancePrecio" NOT NULL,
    "alcance_id" TEXT,
    "alcance_nombre" TEXT,
    "productos_afectados" INTEGER NOT NULL,
    "detalle" JSONB NOT NULL,
    "usuario_id" TEXT,
    "usuario_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actualizaciones_precio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_optica_estado_created_at_idx" ON "solicitudes_optica"("estado", "created_at");

-- CreateIndex
CREATE INDEX "solicitudes_optica_cuit_idx" ON "solicitudes_optica"("cuit");

-- CreateIndex
CREATE INDEX "actualizaciones_precio_created_at_idx" ON "actualizaciones_precio"("created_at");

-- CreateIndex
CREATE INDEX "productos_estado_visible_tienda_idx" ON "productos"("estado", "visible_tienda");

-- AddForeignKey
ALTER TABLE "solicitudes_optica" ADD CONSTRAINT "solicitudes_optica_optica_id_fkey" FOREIGN KEY ("optica_id") REFERENCES "opticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los usuarios OPTICA que ya existían quedan como dueños de su óptica (pueden dar de alta a su equipo).
UPDATE "users" SET "optica_dueno" = true WHERE "rol" = 'OPTICA' AND "optica_id" IS NOT NULL;

-- Página editable con los términos del programa de ópticas socias (se acepta en /opticas/sumate).
INSERT INTO "paginas_legales" ("id", "slug", "titulo", "intro", "contenido", "publicada", "updated_at")
VALUES ('pagina-programa-opticas', 'programa-opticas', $t$Términos del programa de ópticas socias$t$, $t$Condiciones para sumarse a la red de ópticas socias Vedere y comprar al por mayor.$t$, $t$## Quién puede sumarse

Ópticas habilitadas por la autoridad sanitaria de su jurisdicción, con un óptico técnico matriculado como responsable y CUIT activo. Vedere revisa cada solicitud y puede aprobarla o rechazarla indicando el motivo.

## Qué datos pedimos

Razón social, nombre comercial, CUIT y condición frente al IVA, dirección del local, teléfono, email, nombre y matrícula del óptico responsable y la habilitación del local. La óptica declara que los datos son verdaderos y se compromete a mantenerlos actualizados.

## Acceso al panel

Al aprobar la solicitud enviamos un usuario y una contraseña provisoria para el panel de ópticas socias, que hay que cambiar en el primer ingreso. El dueño de la cuenta puede dar de alta a las personas de su equipo y es responsable del uso que hagan del panel.

## Precios mayoristas

Los precios mayoristas se informan sin IVA, son confidenciales y pueden cambiar sin previo aviso. No se pueden publicar ni compartir con terceros.

## Pedidos de clientes de la tienda

Si la óptica recibe pedidos de la tienda web, se compromete a aceptarlos o rechazarlos dentro del plazo informado en el panel, armarlos con los lentes indicados en la receta y entregarlos y ajustarlos sin cargo para el cliente. Cobra la comisión acordada por cada pedido entregado, según la liquidación mensual.

## Datos de los clientes

La óptica usa los datos de los clientes de Vedere sólo para atender sus pedidos y cumple la Ley 25.326 de protección de datos personales.

## Baja

Cualquiera de las partes puede terminar la relación avisando por email. Vedere puede pausar o dar de baja a una óptica que no cumpla estos términos.$t$, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
