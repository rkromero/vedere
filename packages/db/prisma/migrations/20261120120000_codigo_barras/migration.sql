-- Código de barras del fabricante en cada variante (carga de stock por escaneo).
ALTER TABLE "variantes" ADD COLUMN "codigo_barras" TEXT;

CREATE UNIQUE INDEX "variantes_codigo_barras_key" ON "variantes"("codigo_barras");
