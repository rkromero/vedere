# Vedere API — build desde la raíz del monorepo (Railway: Dockerfile path = apps/api/Dockerfile)
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@9.15.9
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter @vedere/api...

# ---- build ----
FROM deps AS build
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm --filter @vedere/db build \
  && pnpm --filter @vedere/api build

# ---- runtime ----
FROM build AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 4000
# Aplica migraciones pendientes y levanta el servidor.
CMD ["sh", "-c", "pnpm --filter @vedere/db exec prisma migrate deploy && node apps/api/dist/server.js"]
