# Vedere · Documento de entrega (prompt 6 de 6)

Fecha: 3 de noviembre de 2026 · Rama `feat/checkout-pagos` → PR #2 a `main` (https://github.com/rkromero/vedere/pull/2)

Este documento cierra la serie de seis prompts. Resume qué quedó construido, dónde está publicado, con qué usuarios se prueba cada rol, cómo verificar los criterios de aceptación y qué falta para que la tienda opere con clientes reales.

## 1. Estado general

| Prompt | Alcance                                                                | Estado                                    |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------- |
| 1      | Base del monorepo, auth, Prisma, CI                                    | En `main` y en Railway                    |
| 2      | Catálogo y backoffice                                                  | En `main` y en Railway                    |
| 3      | Tienda pública                                                         | En `main` y en Railway                    |
| 4      | Checkout, Mercado Pago, transferencia, stock                           | En PR #2 (pendiente de merge)             |
| 5      | Ópticas socias, asignación, panel de la óptica, liquidaciones          | En PR #2 (pendiente de merge)             |
| 6      | Cuentas de cliente, emails, marketing, legal, reportes, producción      | En PR #2 (pendiente de merge)             |

Al mergear el PR #2, Railway despliega `api` y `web` desde `main`, corre `prisma migrate deploy` al arrancar la API y la tienda queda con todo el alcance. Antes de recibir clientes reales hay que cargar las variables de la sección 6.

## 2. URLs

**Producción (Railway, proyecto `vedere`)**

| Servicio | URL                                                | Notas                                                     |
| -------- | -------------------------------------------------- | --------------------------------------------------------- |
| Tienda   | https://web-production-8efee5.up.railway.app       | Dominio propio pendiente (ver sección 6)                  |
| API      | https://api-production-057e.up.railway.app         | `GET /health` responde estado, versión y latencia de DB   |
| Backoffice | https://web-production-8efee5.up.railway.app/admin | Roles ADMIN y OPERADOR                                   |
| Panel óptica | https://web-production-8efee5.up.railway.app/optica | Rol OPTICA con óptica vinculada                        |
| Mi cuenta | https://web-production-8efee5.up.railway.app/mi-cuenta | Rol CLIENTE                                           |

**Local**

| Servicio | URL                     | Cómo levantarlo                                                              |
| -------- | ----------------------- | ---------------------------------------------------------------------------- |
| API      | http://localhost:4000   | `pnpm --filter @vedere/api dev` (lee `.env` de la raíz)                      |
| Web      | http://localhost:3000   | `pnpm --filter @vedere/web dev`                                              |
| DB       | localhost:5432/vedere   | PostgreSQL 16 local; `pnpm --filter @vedere/db exec prisma migrate dev`      |

Rutas nuevas del prompt 6 (todas sobre la web):

- Cliente: `/ingresar`, `/recuperar`, `/restablecer/:token`, `/r/:codigo` (link de referido), `/mi-cuenta` (resumen, `pedidos`, `pedidos/:id`, `recetas`, `direcciones`, `favoritos`, `datos`, `referidos`).
- Legal: `/legal/terminos`, `/legal/privacidad`, `/legal/cambios`, `/legal/cookies`, `/legal/arrepentimiento`, `/newsletter/baja/:token`.
- SEO y feeds: `/sitemap.xml`, `/robots.txt`, `/api/feeds/meta.csv`, `/api/feeds/google.xml`, imagen OG dinámica.
- Backoffice: `/admin/reportes`, `/admin/plantillas`, `/admin/legal`, `/admin/redirecciones`, `/admin/arrepentimientos`, `/admin/newsletter`, `/admin/configuracion` (datos fiscales).
- API: `/auth/*` (registro con `ref`, recuperar, restablecer, Google), `/cuenta/*`, `/sitio/*`, `/feeds/*`, `/jobs/:nombre` (header `x-cron-secret`), `/admin/reportes`, `/admin/plantillas`, `/admin/sitio/*`, `/admin/debug/sentry`, `/admin/debug/error`.

## 3. Accesos de prueba por rol

Las contraseñas no se guardan en el repo. Cada fila indica de dónde sale.

| Rol      | Usuario                                              | Dónde entra       | Contraseña                                                                  |
| -------- | ---------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| ADMIN    | `admin@vedere.local`                                 | `/admin/login`    | Variable `ADMIN_PASSWORD` (`.env` local; en Railway, servicio `api`)        |
| OPERADOR | no viene en el seed                                  | `/admin/login`    | Crearlo desde `/admin/usuarios` con rol OPERADOR                            |
| OPTICA   | `optica-optica-caballito-centro@vedere.com.ar` (hay uno por óptica socia: `optica-<slug>@vedere.com.ar`) | `/optica/login` | Valor de `OPTICA_PASSWORD` con el que se corrió el seed. En producción todavía no se corrió con esa variable (ver sección 6) |
| CLIENTE  | Cualquier email nuevo desde `/ingresar` → Crear cuenta | `/ingresar`     | La que elija el usuario (mínimo 8 caracteres, acepta términos)              |
| CLIENTE (local, creado por el e2e) | `compra-1793734431826-927084@vedere.local` | `/ingresar` | `E2e-compra-2026!` (misma que usa `apps/e2e/tests/compra.spec.ts`) |

En CI el e2e usa `ADMIN_PASSWORD=ci-admin-password-e2e` y `OPTICA_PASSWORD=ci-optica-password-e2e` sobre una base efímera.

## 4. Verificación de los criterios de aceptación

| Criterio                                                                 | Cómo se verificó                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El cliente se registra, compra, ve el pedido y la receta en Mi cuenta    | Playwright `apps/e2e/tests/compra.spec.ts` (registro → ficha → carrito → checkout retiro en óptica + transferencia → gracias → `/mi-cuenta/pedidos/:id`). Local 6/6. Pedidos VD-10005 y VD-10006 en la DB local |
| El e2e de compra corre en GitHub Actions                                 | Job `e2e` de `.github/workflows/ci.yml` (Postgres de servicio, migraciones, seed, build, API y web levantadas, Playwright, reporte como artifact). Estado en el PR #2 |
| Eventos GA4 y Meta visibles en modo debug                                | `?debug_analytics=1` (o `NEXT_PUBLIC_ANALYTICS_DEBUG=1`) loguea cada evento; `window.dataLayer` muestra `view_item`, `add_to_cart`, `begin_checkout`; `purchase` lo manda el servidor (Meta CAPI + GA4 Measurement Protocol, `event_id = purchase-<pedidoId>`) |
| El botón de arrepentimiento genera trámite y avisa al admin              | `/legal/arrepentimiento` → número `ARR-AAAA-NNNNNN` (local: ARR-2026-000001 vinculado a VD-10005), email al cliente y `ADMIN_ARREPENTIMIENTO` a `ADMIN_NOTIFY_EMAIL`; listado en `/admin/arrepentimientos` |
| Backup del día                                                           | `scripts/backup-db.sh` corrido en local (dump gzip de 30 KB); workflow `backup.yml` diario 06:00 UTC + manual, sube a R2 y guarda artifact 7 días           |
| Error forzado llega a Sentry                                             | `GET /admin/debug/error` (ADMIN) devuelve 500 y lo captura `capturarError`; `GET /admin/debug/sentry` dice si hay DSN. Sin `SENTRY_DSN` en local y en Railway todavía: queda en logs |
| Emails transaccionales editables desde el admin                          | `/admin/plantillas/:tipo` sobreescribe asunto y cuerpo; editar BIENVENIDA cambió el asunto del email real. Sin `RESEND_API_KEY` se registran como SIMULADO en `emails_enviados` |
| Reportes                                                                 | `/admin/reportes` con filtro de fechas, ventas por día (serie completa), ticket promedio, conversión, por estado, línea, óptica, colección y creador, más vendidos, CSV de pedidos e ítems |

Comandos de verificación local:

```bash
pnpm test                         # API: 123 tests (17 archivos) sobre TEST_DATABASE_URL
pnpm --filter @vedere/web lint && pnpm --filter @vedere/web typecheck && pnpm --filter @vedere/web build
pnpm --filter @vedere/e2e test    # Playwright, con API y web levantadas (ADMIN_PASSWORD y OPTICA_PASSWORD en el entorno)
curl -X POST http://localhost:4000/jobs/carrito-abandonado -H "x-cron-secret: $CRON_SECRET"
```

## 5. Operación

- **Jobs**: la API corre `carrito-abandonado` (cada 15 min: emails a 1 h y 24 h), `volvio-stock` y `rivedere` (cada 24 h: Plan Rivedere a los 2 años con cupón) con `setInterval`. `.github/workflows/jobs.yml` los dispara además por cron como respaldo cuando existen `vars.API_URL` y `secrets.CRON_SECRET`.
- **Backups**: `.github/workflows/backup.yml` (06:00 UTC). Restaurar: `gunzip -c archivo.sql.gz | psql "$DATABASE_URL"`.
- **Logs**: pino JSON en Railway (`requestId` por request). Sentry en API y web cuando haya DSN.
- **Deploy**: sólo desde `main`, protegida con PR + CI obligatorio. `NEXT_PUBLIC_*` se inyectan en build: al cambiarlas hay que redeployar `web`.
- **Legal**: textos de términos, privacidad, cambios y cookies editables en `/admin/legal` (Markdown); datos fiscales en `/admin/configuracion`, salen en el footer y en el pie de todos los emails.
- **Redirecciones 301**: `/admin/redirecciones`; el middleware de Next las aplica.

## 6. Pendientes para salir a producción

Son datos o decisiones que sólo puede aportar el negocio. Nada de esto bloquea el merge; todo se configura en Railway o GitHub sin tocar código.

**Dominio y URLs**

1. Comprar/apuntar el dominio (por ejemplo `www.vedere.com.ar` y `api.vedere.com.ar`): CNAME a Railway desde Settings → Networking → Custom Domain de cada servicio. Railway emite el certificado.
2. Actualizar `WEB_URL`, `API_PUBLIC_URL` (api) y `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `API_URL` (web), redeployar web.

**Variables que faltan en Railway (servicio `api`)**

| Variable                                               | Para qué                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_ENABLED`   | Cobros con Mercado Pago (hoy sólo transferencia)                         |
| `RESEND_API_KEY`, `EMAIL_FROM`                         | Envío real de emails (hoy quedan SIMULADO); verificar el dominio en Resend |
| `ADMIN_NOTIFY_EMAIL`                                   | Casilla que recibe arrepentimientos, pedidos sin asignar y cambios       |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`             | Login con Google; redirect URI `<WEB_URL>/api/auth/google/callback`      |
| `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` | Conversions API (purchase server side)                                |
| `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`                 | GA4 Measurement Protocol (purchase server side)                          |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`                     | Errores de la API en Sentry                                              |
| `CRON_SECRET`                                          | Mismo valor que el secret de GitHub para `jobs.yml`                      |
| `OPTICA_PASSWORD`                                      | Sólo al correr el seed para crear los usuarios OPTICA de prueba          |
| `GOOGLE_MAPS_API_KEY`                                  | Autocompletado de direcciones (opcional)                                 |

**Variables que faltan en Railway (servicio `web`, requieren redeploy)**

| Variable                                                          | Para qué                                         |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | GTM, GA4 y Meta Pixel (sólo con consentimiento) |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`        | Errores del navegador y del servidor Next        |
| `NEXT_PUBLIC_WHATSAPP`                                            | Número real del botón flotante y los CTA         |

**Secrets y variables en GitHub (`rkromero/vedere`)**

| Nombre                                                                    | Uso                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| `BACKUP_DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Backup diario a R2 (sin R2 queda sólo el artifact) |
| `CRON_SECRET` (secret) y `API_URL` (variable)                             | Cron de respaldo de los jobs                     |

**Contenido y datos del negocio**

- Completar en `/admin/configuracion` los datos fiscales reales (razón social, CUIT, condición IVA, IIBB, inicio de actividades, domicilio) y el link al QR de Data Fiscal de AFIP.
- Revisar los textos legales en `/admin/legal` con asesoramiento legal (hoy son borradores razonables para Argentina).
- Reemplazar la URL `r2.dev` de las imágenes por un dominio propio sobre el bucket y actualizar `R2_PUBLIC_URL`.
- Correr el seed en Railway con `OPTICA_PASSWORD` si se quieren usuarios OPTICA de prueba, o crear los reales desde `/admin/opticas`.
- Cargar los SVG oficiales de marca y el número de WhatsApp (pendientes desde prompts anteriores).

**Detalles técnicos menores conocidos**

- El aviso de "volvió el stock" sólo sale por el job periódico, no en el instante en que se repone.
- Los links de los feeds de Meta y Google apuntan a la ficha con `?variante=`; la ficha preselecciona la variante pero no la valida contra el catálogo.
- `/admin/mensajes` conserva una pestaña de newsletter que duplica `/admin/newsletter`.
- El CSV de reportes se genera en memoria: para volúmenes muy grandes conviene paginar.

## 7. Repositorio y CI

- Repo: https://github.com/rkromero/vedere · rama `main` protegida (PR + CI).
- PR #2: https://github.com/rkromero/vedere/pull/2 (prompts 4, 5 y 6). Workflows: `ci.yml` (lint, typecheck, tests, build, e2e), `backup.yml`, `jobs.yml`.
- Plan de trabajo del prompt 6 y contratos entre módulos: `docs/PLAN-PROMPT6.md`.
- README: tabla de rutas, variables por servicio y sección "Producción".
