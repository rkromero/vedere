# Vedere

E-commerce de anteojos (sol, recetados, multifocales y accesorios) de Argentina. El cliente compra online y el pedido lo arma, entrega y ajusta la **óptica socia más cercana** a su domicilio.

> Estado: **prompt 1 de 6** — base del proyecto e infraestructura (monorepo, auth, DB, deploy).

## Stack

| Capa     | Tecnología                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces                                                            |
| Web      | `apps/web` — Next.js 15 (App Router), React 19, TypeScript, Tailwind v4    |
| API      | `apps/api` — Node 20, Fastify 5, TypeScript, Zod                           |
| Base     | `packages/db` — Prisma 6 + PostgreSQL                                      |
| UI       | `packages/ui` — componentes y tokens compartidos                           |
| Auth     | JWT en cookie httpOnly + refresh token rotativo (hasheado en DB), argon2id |
| Imágenes | Cloudflare R2 (S3 compatible) vía URL prefirmada, URL pública en la DB     |
| Infra    | GitHub (main protegida + develop) → Railway (Postgres, api, web)           |

## Estructura

```
vedere/
├── apps/
│   ├── api/            Fastify: /health, /auth/*, /admin/*, /uploads/*
│   └── web/            Next.js: layout (promo bar, header, footer), /, /health, 404
├── packages/
│   ├── db/             Prisma schema, migraciones, seed, cliente compartido
│   └── ui/             Button, Container, cn(), tokens de marca
├── docker-compose.yml  Postgres local
├── .env.example        Todas las variables (api + db + web)
└── .github/workflows   CI: lint · typecheck · test · build
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
- Docker (para Postgres local) **o** una `DATABASE_URL` externa
- CLI: `gh` (GitHub) y `railway` (Railway) para infra

## Instalación y desarrollo local

```bash
pnpm install

# 1) Postgres local
docker compose up -d

# 2) Variables de entorno
cp .env.example .env                    # api + db + seed
cp apps/web/.env.example apps/web/.env.local
# editar .env: JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -base64 48), ADMIN_PASSWORD

# 3) Base de datos: migraciones + usuario admin
pnpm db:deploy      # aplica packages/db/prisma/migrations
pnpm db:seed        # crea el ADMIN con ADMIN_EMAIL / ADMIN_PASSWORD

# 4) Levantar todo (api :4000, web :3000)
pnpm dev
```

Scripts útiles:

| Comando           | Qué hace                                        |
| ----------------- | ----------------------------------------------- |
| `pnpm dev`        | api (tsx watch) + web (next dev)                |
| `pnpm build`      | build de db, ui, api y web                      |
| `pnpm lint`       | ESLint en todos los paquetes                    |
| `pnpm typecheck`  | `tsc --noEmit` en todos los paquetes            |
| `pnpm test`       | tests (vitest en la API)                        |
| `pnpm format`     | Prettier                                        |
| `pnpm db:migrate` | `prisma migrate dev` (crea una migración nueva) |
| `pnpm db:deploy`  | `prisma migrate deploy` (aplica migraciones)    |
| `pnpm db:seed`    | seed del admin                                  |
| `pnpm db:studio`  | Prisma Studio                                   |

## API

Base: `http://localhost:4000`. Todas las respuestas de error tienen la forma `{ error: { code, message, details? } }`.

| Método | Ruta               | Auth            | Descripción                                         |
| ------ | ------------------ | --------------- | --------------------------------------------------- |
| GET    | `/health`          | —               | Estado de la API y la base (200 ok / 503 degradado) |
| POST   | `/auth/register`   | —               | Alta de CLIENTE; setea cookies de sesión            |
| POST   | `/auth/login`      | —               | Login; setea cookies de sesión                      |
| POST   | `/auth/refresh`    | cookie refresh  | Rota refresh token y renueva access token           |
| POST   | `/auth/logout`     | cookie refresh  | Revoca refresh token y limpia cookies               |
| GET    | `/auth/me`         | access          | Usuario actual                                      |
| GET    | `/admin/ping`      | ADMIN           | Prueba de roles (403 para otros roles)              |
| GET    | `/admin/users`     | ADMIN           | Listado paginado de usuarios                        |
| POST   | `/uploads/presign` | ADMIN, OPERADOR | URL prefirmada para subir una imagen a R2           |

- Cookies: `vedere_access` (JWT, `ACCESS_TOKEN_TTL`, path `/`) y `vedere_refresh` (opaco, `REFRESH_TOKEN_TTL_DAYS`, path `/auth`). Ambas `httpOnly`.
- Roles: `ADMIN`, `OPERADOR`, `OPTICA`, `CLIENTE`. Guards: `app.authenticate` y `app.requireRole(...roles)`.
- Rate limiting: `RATE_LIMIT_MAX`/min global por IP, `RATE_LIMIT_AUTH_MAX`/min en register, login y refresh.
- CORS: sólo `WEB_URL`, con credenciales.

Ejemplo:

```bash
curl -i -c cookies.txt -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@vedere.com.ar","password":"..."}'

curl -b cookies.txt http://localhost:4000/admin/ping
```

## Deploy en Railway

Proyecto **vedere** con tres servicios: `Postgres`, `api` y `web`. `api` y `web` están vinculados al repo de GitHub (`rkromero/vedere`) y despliegan automáticamente con cada push a `main`. Cada uno se construye con su Dockerfile desde la raíz del monorepo (`apps/api/Dockerfile`, `apps/web/Dockerfile`), configurado en el servicio de Railway (Dockerfile path, healthcheck `/health`, restart on failure). Railway deprecó `railway.json`; la configuración vive en el servicio.

La API corre `prisma migrate deploy` al arrancar, así que cada deploy aplica las migraciones pendientes.

### Variables en Railway (nunca en el repo)

**api**

| Variable                                                                                  | Valor                                                                                                            |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                            | `${{Postgres.DATABASE_URL}}`                                                                                     |
| `NODE_ENV`                                                                                | `production`                                                                                                     |
| `WEB_URL`                                                                                 | URL pública de la web (CORS)                                                                                     |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                 | `openssl rand -base64 48` (distintos)                                                                            |
| `COOKIE_SECURE`                                                                           | `true`                                                                                                           |
| `COOKIE_SAME_SITE`                                                                        | `none` mientras web y api estén en dominios distintos; `lax` con dominio propio + `COOKIE_DOMAIN=.vedere.com.ar` |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`     | opcionales (ver `.env.example`)                                                                                  |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | cuando se configure el bucket                                                                                    |

**web**

| Variable                                                                        | Valor                 |
| ------------------------------------------------------------------------------- | --------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                          | URL pública de la web |
| `NEXT_PUBLIC_API_URL`                                                           | URL pública de la API |
| `NEXT_PUBLIC_PROMO_ENABLED`, `NEXT_PUBLIC_PROMO_TEXT`, `NEXT_PUBLIC_PROMO_LINK` | barra de promo        |

Las `NEXT_PUBLIC_*` se inyectan en **build time** (Railway las pasa como build args al Dockerfile): al cambiarlas hay que redeployar la web.

### Seed del admin en Railway

```bash
railway link                      # elegir proyecto vedere / servicio api
railway run --service api -- pnpm db:seed   # usa ADMIN_EMAIL / ADMIN_PASSWORD de las variables del servicio
```

O localmente apuntando a la base de Railway:

```bash
DATABASE_URL="$(railway variables --service Postgres --kv | grep ^DATABASE_PUBLIC_URL | cut -d= -f2-)" \
ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @vedere/db exec tsx prisma/seed.ts
```

## Flujo de trabajo con Git

- `main`: producción. Protegida: sin force-push ni borrado, CI obligatorio. Push a `main` → deploy automático.
- `develop`: integración. PRs de feature → `develop` → PR a `main`.
