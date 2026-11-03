# Vedere

E-commerce de anteojos (sol, recetados, multifocales y accesorios) de Argentina. El cliente compra online y el pedido lo arma, entrega y ajusta la **óptica socia más cercana** a su domicilio.

> Estado: **prompt 3 de 6** — tienda pública (home, listados con filtros, ficha, buscador, carrito, ópticas e institucionales) sobre el catálogo y backoffice del prompt 2. Falta: checkout y pagos (prompt 4).

## Stack

| Capa     | Tecnología                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces                                                            |
| Web      | `apps/web` — Next.js 15 (App Router), React 19, TypeScript, Tailwind v4    |
| API      | `apps/api` — Node 20, Fastify 5, TypeScript, Zod                           |
| Base     | `packages/db` — Prisma 6 + PostgreSQL                                      |
| UI       | `packages/ui` — componentes y tokens compartidos                           |
| Auth     | JWT en cookie httpOnly + refresh token rotativo (hasheado en DB), argon2id |
| Imágenes | sharp → WebP en 3 tamaños → Cloudflare R2 (S3) o disco local en desarrollo |
| Infra    | GitHub (main protegida + develop) → Railway (Postgres, api, web)           |

## Estructura

```
vedere/
├── apps/
│   ├── api/            Fastify: /health, /auth/*, /admin/* (backoffice), /catalogo/* (tienda)
│   └── web/            Next.js: tienda (/, /health, 404) y backoffice (/admin/*)
├── packages/
│   ├── db/             Prisma schema, migraciones, seed, cliente compartido
│   └── ui/             Button, Container, cn(), tokens de marca
├── docker-compose.yml  Postgres local
├── .env.example        Todas las variables (api + db + web)
└── .github/workflows   CI: lint · typecheck · test (con Postgres) · build
```

## Branding

Definido en `apps/web/src/styles/globals.css` (bloque `@theme` de Tailwind v4) y en `packages/ui/src/tokens.ts`.

- Colores: `negro #0A0A0A`, `blanco #FFFFFF`, `gris-claro #F2F2F0`, `gris-medio #8A8A86`. Colección: `sol #F2B33D`, `vetro #7FD1C1`, `noche #3A5BD9`, `carey #B7712F`. Se usan como `bg-sol`, `text-negro`, etc.
- Tipografía: **Archivo** variable (Google Fonts, ejes `wdth` + `wght`) cargada con `next/font`.
  - `font-campaign`: titulares de campaña → wdth 62, peso 800, mayúsculas.
  - `font-text` (y el default): wdth 100, pesos 400 a 600.
- Logos en `apps/web/public/brand/` (`logo.svg`, `logo-blanco.svg`, `isotipo.svg`). Los actuales son **placeholders**: reemplazarlos por los SVG oficiales manteniendo los nombres.

## Requisitos

- Node 20 o 22, pnpm 9 (`corepack enable` o `npm i -g pnpm@9`)
- Postgres local: Docker (`docker compose up -d`) **o** una instalación local (ej. `scoop install postgresql`) **o** una `DATABASE_URL` externa
- CLI: `gh` (GitHub) y `railway` (Railway) para infra

## Instalación y desarrollo local

```bash
pnpm install

# 1) Postgres local (opción Docker)
docker compose up -d
#    Opción sin Docker (Windows con scoop): scoop install postgresql; pg_ctl -D <scoop>/apps/postgresql/current/data start
#    y crear el rol/base: CREATE ROLE vedere LOGIN PASSWORD 'vedere' SUPERUSER; CREATE DATABASE vedere OWNER vedere; CREATE DATABASE vedere_test OWNER vedere;

# 2) Variables de entorno
cp .env.example .env                    # api + db + seed
cp apps/web/.env.example apps/web/.env.local
# editar .env: JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -base64 48), ADMIN_PASSWORD

# 3) Base de datos: migraciones + seed (admin + catálogo de ejemplo)
pnpm db:deploy      # aplica packages/db/prisma/migrations
pnpm db:seed        # crea el ADMIN (ADMIN_EMAIL / ADMIN_PASSWORD) + 4 categorías base con hijas, 4 marcas, 4 colecciones y 12 productos
                    # SEED_CATALOGO=false pnpm db:seed → sólo el admin

# 4) Levantar todo (api :4000, web :3000)
pnpm dev
```

Backoffice local: http://localhost:3000/admin (ingresar con el admin del seed).

Scripts útiles:

| Comando           | Qué hace                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `pnpm dev`        | api (tsx watch) + web (next dev)                                 |
| `pnpm build`      | build de db, ui, api y web                                       |
| `pnpm lint`       | ESLint en todos los paquetes                                     |
| `pnpm typecheck`  | `tsc --noEmit` en todos los paquetes                             |
| `pnpm test`       | tests (vitest en la API; integración si hay `TEST_DATABASE_URL`) |
| `pnpm format`     | Prettier                                                         |
| `pnpm db:migrate` | `prisma migrate dev` (crea una migración nueva)                  |
| `pnpm db:deploy`  | `prisma migrate deploy` (aplica migraciones)                     |
| `pnpm db:seed`    | seed del admin y catálogo de ejemplo                             |
| `pnpm db:studio`  | Prisma Studio                                                    |

## Modelo de datos (catálogo)

- **Marca**: nombre, slug, logo, activa.
- **Categoria**: nombre, slug, padre opcional (árbol), orden, activa. Base del seed: Sol, Recetados, Multifocal, Accesorios (+ hijas).
- **Coleccion**: nombre, slug, color hex, banner, vigencia desde/hasta, activa (Sol, Vetro, Noche, Carey).
- **Producto**: nombre, slug, descripción, marca, categorías (N:N), colección, línea (SOL, RECETADO, MULTIFOCAL, ACCESORIO), material, forma (REDONDO, CUADRADO, OJO_DE_GATO, AVIADOR, RECTANGULAR), género (UNISEX, MUJER, HOMBRE), medidas (calibre, puente, varilla mm), precio, precio de lista, permite receta, destacado, estado (BORRADOR, PUBLICADO, ARCHIVADO), SEO (title, description), vendidos, publicadoEn.
- **Variante**: producto, color de armazón (+hex), color de lente (+hex), SKU único, stock, stock mínimo, activa, orden.
- **ImagenVariante**: tipo (FRENTE, PERFIL, TRES_CUARTOS, PUESTO, OTRA), orden, URL grande / mediana / miniatura, alt.
- **Auditoría** en todos: `createdAt`, `updatedAt`, `createdById`, `updatedById`.

## API

Base: `http://localhost:4000`. Todas las respuestas de error tienen la forma `{ error: { code, message, details? } }`. Un SKU o slug duplicado responde `409 DUPLICATE` con mensaje claro y no guarda nada.

### Auth y salud

| Método | Ruta             | Auth           | Descripción                                         |
| ------ | ---------------- | -------------- | --------------------------------------------------- |
| GET    | `/health`        | —              | Estado de la API y la base (200 ok / 503 degradado) |
| POST   | `/auth/register` | —              | Alta de CLIENTE; setea cookies de sesión            |
| POST   | `/auth/login`    | —              | Login; setea cookies de sesión                      |
| POST   | `/auth/refresh`  | cookie refresh | Rota refresh token y renueva access token           |
| POST   | `/auth/logout`   | cookie refresh | Revoca refresh token y limpia cookies               |
| GET    | `/auth/me`       | access         | Usuario actual                                      |

### Backoffice (`/admin/*`) — ADMIN y OPERADOR

| Ruta                                                                                       | Descripción                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/dashboard`                                                                     | Totales + variantes con stock por debajo del mínimo                                                                                                                                       |
| `GET/POST /admin/marcas`, `GET/PUT/DELETE /admin/marcas/:id`                               | ABM de marcas (`q`, `activa`, paginación)                                                                                                                                                 |
| `GET/POST /admin/categorias`, `GET/PUT/DELETE /admin/categorias/:id`                       | ABM de categorías; `?tree=true` devuelve el árbol                                                                                                                                         |
| `GET/POST /admin/colecciones`, `GET/PUT/DELETE /admin/colecciones/:id`                     | ABM de colecciones                                                                                                                                                                        |
| `GET/POST /admin/productos`, `GET/PUT/DELETE /admin/productos/:id`                         | ABM de productos (variantes anidadas al crear). Filtros: `q`, `estado`, `linea`, `marcaId`, `categoriaId`, `coleccionId`, `forma`, `material`, `genero`, `destacado`, `bajoStock`, `sort` |
| `POST /admin/productos/bulk`                                                               | `{ ids, accion: publicar \| archivar \| borrador \| destacar \| no_destacar \| eliminar }`                                                                                                |
| `GET /admin/productos/export.csv` · `POST /admin/productos/import`                         | Exportar / importar CSV (una fila por variante; multipart `file`, `text/csv` o `{ csv }`). La importación es todo-o-nada y devuelve errores por fila                                      |
| `GET/POST /admin/productos/:id/variantes`, `GET/PUT/DELETE /admin/variantes/:id`           | Variantes                                                                                                                                                                                 |
| `POST/PUT /admin/variantes/:id/imagenes`, `DELETE /admin/variantes/:id/imagenes/:imagenId` | Imágenes (PUT reemplaza la lista en el orden recibido)                                                                                                                                    |
| `POST /admin/imagenes`                                                                     | multipart `file` (+ `folder`) → sharp → WebP 320 / 800 / 1600 → R2 (S3 `PutObject`, cache immutable) o disco local. `GET /admin/imagenes/config` informa el driver                        |
| `POST /admin/imagenes/presign`                                                             | URL prefirmada para subida directa a R2                                                                                                                                                   |

Sólo ADMIN: `GET /admin/ping`, `GET/POST /admin/usuarios`, `GET/PUT /admin/usuarios/:id`, `POST /admin/usuarios/:id/password`, `POST /admin/usuarios/:id/desactivar`, `POST /admin/usuarios/:id/activar`. Un OPERADOR recibe 403.

### Tienda (`/catalogo/*`) — público, sólo productos PUBLICADOS

| Ruta                                                                 | Descripción                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /catalogo/productos` | Filtros (admiten listas separadas por coma): `q`, `categoria` (slug, incluye hijas), `linea`, `forma`, `color`, `material`, `genero`, `marca`, `coleccion`, `slugs`, `precioMin`, `precioMax`, `destacado`, `receta`. Orden: `orden=relevancia \| mas_vendidos \| novedades \| precio_asc \| precio_desc`. Paginación `page`, `pageSize` |
| `GET /catalogo/productos/:slug` · `/:slug/relacionados` | Detalle (404 si no está publicado) y relacionados (misma colección > forma > línea) |
| `GET /catalogo/sugerencias?q=` | Sugerencias en vivo para el buscador: productos, categorías y colecciones |
| `GET /catalogo/categorias` · `/marcas` · `/colecciones` · `/filtros` | Árbol de categorías, marcas, colecciones vigentes (con portada y cantidad) y valores disponibles para filtros |
| `GET /catalogo/promos` | Mensajes activos y vigentes de la barra de promo |
| `GET /catalogo/opticas` · `/opticas/:slug` | Ópticas socias activas; `cp` ordena por cercanía de código postal, `lat`/`lng` por distancia en km, `q` busca |
| `POST /catalogo/cupones/validar` | `{ codigo, subtotal }` → `{ valido, cupon, descuento }` (404 inexistente, 400 vencido/agotado/mínimo) |
| `POST /catalogo/newsletter` · `/avisos-stock` · `/contacto` | Formularios públicos (rate limit 12/min; `contacto` tiene honeypot `web`) |
| `GET/PUT/DELETE /carrito` | Carrito del usuario logueado (se sincroniza con el de localStorage) |

- Las rutas `PUT` aceptan cuerpos parciales: sólo cambian los campos enviados (los defaults del alta no se reaplican).
- Cookies: `vedere_access` (JWT, `ACCESS_TOKEN_TTL`, path `/`) y `vedere_refresh` (opaco, `REFRESH_TOKEN_TTL_DAYS`, path `/auth`). Ambas `httpOnly`.
- Roles: `ADMIN`, `OPERADOR`, `OPTICA`, `CLIENTE`. Guards: `app.authenticate` y `app.requireRole(...roles)`.
- Rate limiting: `RATE_LIMIT_MAX`/min global por IP, `RATE_LIMIT_AUTH_MAX`/min en register, login y refresh.
- CORS: sólo `WEB_URL`, con credenciales.

## Backoffice (`/admin`)

La web expone un proxy same-origin `/api/*` hacia la API, así las cookies de sesión quedan en el dominio de la web (SameSite=Lax) y los server components pueden leerlas. Un middleware renueva el access token con el refresh token cuando vence.

- Login en `/admin/login` (sólo ADMIN y OPERADOR).
- Menú lateral: Dashboard (métricas + alerta de stock bajo el mínimo), Productos (tabla con búsqueda, filtros, paginación, acciones masivas, exportar/importar CSV; formulario con pestañas Datos / Variantes y stock / Imágenes con arrastrar para ordenar / SEO), Categorías (árbol), Marcas, Colecciones, Usuarios (sólo ADMIN: crear, editar, desactivar, cambiar rol, resetear contraseña), Pedidos (vacío hasta el prompt de checkout), Barra de promo (mensajes rotativos), Ópticas (red de ópticas socias con coordenadas para el mapa), Cupones, Mensajes (contacto, avisos de stock y newsletter), Configuración (sólo lectura).

## Tienda pública

- Rutas: `/` (home), `/sol` `/recetados` `/multifocales` `/accesorios` `/novedades` `/mas-vendidos`, `/coleccion/[slug]`, `/categoria/[slug]`, `/buscar?q=`, `/p/[slug]?v=[varianteId]` (ficha), `/opticas` (mapa Leaflet + listado + buscador por CP), `/faq`, `/cambios-y-devoluciones`, `/contacto`, `/como-funciona`, `/envios`, `/nosotros`, `/legal/{terminos,privacidad,arrepentimiento}`, `/checkout` (placeholder hasta el prompt 4), más `sitemap.xml` y `robots.txt`.
- Catálogo con Server Components y caché (`revalidate` 60 s en home/listados/ficha, 300 s en ópticas). Filtros y orden viven en la URL (compartibles); scroll infinito con `?page=` en `replaceState`.
- Carrito en `localStorage` (`vedere_carrito_v1`); si hay sesión (`/api/auth/me`), se mezcla con `/carrito` y se sincroniza con un `PUT` debounced. Vistos recientemente en `vedere_recientes_v1`.
- Componentes compartidos y accesibles en `packages/ui` (Drawer con `<dialog>` nativo, botones de 44 px, foco visible, contraste AA).

## Tests

```bash
pnpm test
```

- `apps/api/test/roles.test.ts`, `health.test.ts`: unitarios con la DB mockeada.
- `apps/api/test/catalogo.test.ts`: integración contra `TEST_DATABASE_URL` (vitest aplica las migraciones): alta de marca / categoría hija / colección / producto con 3 variantes e imágenes y lectura pública, SKU duplicado → 409 sin guardar, PUT parcial que no pisa el resto de los campos, archivar saca del público sin borrar, OPERADOR gestiona el catálogo (crea, edita, publica, archiva, borra) pero no usuarios, CSV exportado → importado sin errores, orden y filtros públicos, borrado en cascada.
- `apps/api/test/usuarios.test.ts`: ABM de usuarios sólo ADMIN: alta con hash argon2id, filtros, email duplicado → 409, edición, cambio de rol (revoca sesiones), reset de contraseña (la vieja deja de servir), desactivar (no puede loguearse ni refrescar) y activar, protección del propio usuario, OPERADOR → 403 en todas las rutas.
- `apps/api/test/storage.test.ts`: driver R2 real contra un servidor S3-compatible levantado en el test (sin cuenta de Cloudflare): sharp → WebP 320 / 800 / 1600, 3 `PutObject` firmados con SigV4 al bucket, URLs públicas, no agranda imágenes chicas, URL prefirmada para subida directa y `POST /admin/imagenes` multipart de punta a punta.
- Los tests de integración se saltean si no hay `TEST_DATABASE_URL`.

## Deploy en Railway

Proyecto **vedere** con tres servicios principales (`Postgres`, `api` y `web`) más `storage`, un object store de respaldo que hoy no se usa. `api` y `web` están vinculados al repo de GitHub (`rkromero/vedere`) y despliegan automáticamente con cada push a `main`. Cada uno se construye con su Dockerfile desde la raíz del monorepo (`apps/api/Dockerfile`, `apps/web/Dockerfile`), configurado en el servicio de Railway (Dockerfile path, healthcheck `/health`, restart on failure). Railway deprecó `railway.json`; la configuración vive en el servicio.

Las imágenes de producción se guardan en **Cloudflare R2**: bucket `vedere-media` con URL pública de desarrollo (`https://pub-….r2.dev`) y un token de API `vedere-api` con permiso *Object Read & Write* limitado a ese bucket. El servicio `api` tiene `STORAGE_DRIVER=auto`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y `R2_PUBLIC_URL`, con `R2_ENDPOINT` vacío (endpoint `https://<account>.r2.cloudflarestorage.com`). Cada subida genera tres WebP (`-320`, `-800`, `-1600`) con `Cache-Control: immutable` y se sirve desde la URL pública. Para producción conviene reemplazar la URL `r2.dev` (limitada en tasa) por un dominio propio conectado al bucket y actualizar `R2_PUBLIC_URL`.

`storage` es un object store S3-compatible alternativo ([RustFS](https://github.com/rustfs/rustfs), imagen `rustfs/rustfs:1.0.4`, volumen en `/data`, bucket público `vedere-media`) que se usó antes de tener R2. Queda como respaldo: para volver a él basta con apuntar las variables `R2_*` a sus credenciales y poner su dominio en `R2_ENDPOINT`; también se puede eliminar el servicio y su volumen.

La API corre `prisma migrate deploy` al arrancar, así que cada deploy aplica las migraciones pendientes.

### Variables en Railway (nunca en el repo)

**api**

| Variable                                                                                  | Valor                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                            | `${{Postgres.DATABASE_URL}}`                                                                                                  |
| `NODE_ENV`                                                                                | `production`                                                                                                                  |
| `WEB_URL`                                                                                 | URL pública de la web (CORS)                                                                                                  |
| `API_PUBLIC_URL`                                                                          | URL pública de la API (URLs de imágenes en modo local)                                                                        |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                 | `openssl rand -base64 48` (distintos)                                                                                         |
| `COOKIE_SECURE`                                                                           | `true`                                                                                                                        |
| `COOKIE_SAME_SITE`                                                                        | `lax` (las cookies viajan por el proxy `/api/*` de la web)                                                                    |
| `STORAGE_DRIVER`, `UPLOADS_DIR`, `MAX_UPLOAD_MB`                                          | `auto` / `./uploads` / `10`. Con `auto` usa R2 si hay credenciales; si no, disco local (efímero en Railway)                   |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | credenciales del bucket de Cloudflare R2 (Account ID, token S3 y URL pública)                                                |
| `R2_ENDPOINT`                                                                             | endpoint S3 alternativo (local: RustFS de docker-compose; o el servicio `storage`). Vacío = Cloudflare R2 de la cuenta        |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`     | opcionales (ver `.env.example`)                                                                                               |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE`                                           | para el seed                                                                                                                  |

**web**

| Variable                                                                        | Valor                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                          | URL pública de la web                       |
| `NEXT_PUBLIC_API_URL`                                                           | URL pública de la API                       |
| `API_URL`                                                                       | URL de la API para el servidor Next (proxy) |
| `NEXT_PUBLIC_PROMO_ENABLED`, `NEXT_PUBLIC_PROMO_TEXT`, `NEXT_PUBLIC_PROMO_LINK` | barra de promo de respaldo (los mensajes se cargan en `/admin/promos`) |
| `NEXT_PUBLIC_WHATSAPP` | número con código de país para el botón flotante y los CTA (vacío = se ocultan) |
| `NEXT_PUBLIC_CUOTAS`, `NEXT_PUBLIC_ENVIO_GRATIS_DESDE` | cuotas sin interés (6) y umbral de envío gratis (80000) |
| `NEXT_PUBLIC_INSTAGRAM`, `NEXT_PUBLIC_EMAIL_CONTACTO` | enlaces del footer y contacto |
| `NEXT_PUBLIC_COLAB_TITULO`, `NEXT_PUBLIC_COLAB_TEXTO`, `NEXT_PUBLIC_COLAB_LINK`, `NEXT_PUBLIC_COLAB_CTA` | banner de colaboración de la home (opcionales) |

Las `NEXT_PUBLIC_*` se inyectan en **build time** (Railway las pasa como build args al Dockerfile): al cambiarlas hay que redeployar la web.

### Seed en Railway

```bash
railway ssh --service api -- sh -c "cd /app && pnpm --filter @vedere/db exec tsx prisma/seed.ts"
# sólo admin + datos de tienda (promos, ópticas socias, cupones), sin tocar el catálogo:
railway ssh --service api -- sh -c "cd /app && SEED_CATALOGO=false pnpm --filter @vedere/db exec tsx prisma/seed.ts"
# sólo admin:
railway ssh --service api -- sh -c "cd /app && SEED_CATALOGO=false SEED_TIENDA=false pnpm --filter @vedere/db exec tsx prisma/seed.ts"
```

## Flujo de trabajo con Git

- `main`: producción. Protegida: sin force-push ni borrado, CI obligatorio. Push a `main` → deploy automático.
- `develop`: integración. PRs de feature → `develop` → PR a `main`.
